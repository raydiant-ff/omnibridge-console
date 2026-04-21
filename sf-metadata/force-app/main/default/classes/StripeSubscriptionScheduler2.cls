public class StripeSubscriptionScheduler2 {
    private static final Stripe_Details__c stripeDetails = Stripe_Details__c.getInstance('Stripe Details');
    private static final String SECRET_KEY = stripeDetails.Serect_Key__c;

    // -------- FLOW INPUT --------
    public class FlowInput {
        @InvocableVariable(required=true)
        public Id quoteId;
    }

    // -------- FLOW OUTPUT --------
    public class FlowResult {
        @InvocableVariable
        public Boolean isSuccess;
        @InvocableVariable
        public String message;
    }

    /**
     * Quote To Invoice || Subscription
     * Creates Stripe Subscription when Quote is Accepted with current or past start date
     * Quote To Invoice - Collection Method => send_invoice
     */
    @InvocableMethod(
        label='Create Stripe Subscription When Quote Accepted'
        description='Create Stripe Subscription When Quote Accepted'
        category='Stripe'
    )
    public static List<FlowResult> createStripeSubscriptionAsync(List<FlowInput> inputs) {
        FlowResult result = new FlowResult();
        List<FlowResult> results = new List<FlowResult>{ result };

        if (inputs == null || inputs.isEmpty()) {
            result.isSuccess = false;
            result.message = 'No quote Ids provided';
            return results;
        }

        try {
            SBQQ__Quote__c quote = [
                SELECT
                    Id,
                    SBQQ__StartDate__c,
                    SBQQ__Account__c,
                    Stripe_Customer_ID__c,
                    SBQQ__EndDate__c,
                    SBQQ__Account__r.Stripe_Customer_ID__c,
                    Billing_Frequency_Override__c,
                    SBQQ__SubscriptionTerm__c,
                    SBQQ__PaymentTerms__c,
                    CurrencyIsoCode
                FROM SBQQ__Quote__c
                WHERE Id = :inputs[0].quoteId
                LIMIT 1
            ];

            List<Id> quoteIds = new List<Id>{ quote.Id };

            Long currentTimeUnix = DateTime.now().getTime() / 1000;
            Date startDate = quote.SBQQ__StartDate__c;
            Datetime dt = Datetime.newInstance(startDate.year(), startDate.month(), startDate.day(), 0, 0, 0);
            Long unixTimestamp = dt.getTime() / 1000;
            System.debug('Unix Timestamp: ' + unixTimestamp);

            Date EndDate = startDate.addMonths(INTEGER.VALUEOF(quote.SBQQ__SubscriptionTerm__c)).addDays(-1);
            system.debug('EndDate--' + EndDate);
            Datetime EndDatedt = Datetime.newInstance(EndDate.year(), EndDate.month(), EndDate.day(), 0, 0, 0);
            Long EndDateunixTimestamp = EndDatedt.getTime() / 1000;
            System.debug('Unix Timestamp: ' + EndDateunixTimestamp);

            if (currentTimeUnix < unixTimestamp) {
                StripeSubscriptionScheduler.createStripeSchedule(quoteIds);
                StripeInvoiceCallout2.invoiceGeneration(quoteIds, true);

                result.isSuccess = true;
                result.message = 'Stripe Subscription Scheduled Successfully';
                return results;
            }

            List<SBQQ__QuoteLine__c> quoteLines = [
                SELECT
                    Quantity_For_Stripe__c,
                    MRR__c,
                    SBQQ__NetTotal__c,
                    SBQQ__Product__r.Name,
                    Billing_Frequency_Override__c,
                    CurrencyIsoCode,
                    SBQQ__Product__r.Stripe_Product_Id__c,
                    SBQQ__Product__r.SBQQ__SubscriptionType__c
                FROM SBQQ__QuoteLine__c
                WHERE
                    SBQQ__Quote__c = :quote.Id
                    AND Stripe_Subscription_Type__c != 'One-time'
                    AND SBQQ__Product__r.Stripe_Product_Id__c != NULL
            ];

            if (quoteLines.IsEmpty()) {
                StripeInvoiceCallout2.invoiceGeneration(quoteIds, false);

                result.isSuccess = true;
                result.message = 'Stripe Invoice Generated Successfully for One Time Products';
                return results;
            }

            // prepare price id with Quote line price //
            Map<Id, String> quoteLineToPriceIdMap = new Map<Id, String>();
            Http http = new Http();

            // Map for frequency to interval + count
            Map<String, List<Object>> freqMap = new Map<String, List<Object>>{
                'Monthly' => new List<Object>{ 'month', 1 },
                'Quarterly' => new List<Object>{ 'month', 3 },
                'Semiannual' => new List<Object>{ 'month', 6 },
                'Annual' => new List<Object>{ 'year', 1 },
                '2-Year' => new List<Object>{ 'year', 2 },
                '3-Year' => new List<Object>{ 'year', 3 }
            };

            // Determine product charge type
            Boolean hasRecurringProducts = false;

            for (SBQQ__QuoteLine__c ql : quoteLines) {
                String priceType;
                String interval;
                Integer intervalCount;

                // Determine price type & interval
                if (ql.SBQQ__Product__r.SBQQ__SubscriptionType__c == 'Renewable') {
                    priceType = 'recurring';
                    hasRecurringProducts = true;

                    String freq = (ql.Billing_Frequency_Override__c != null
                        ? ql.Billing_Frequency_Override__c
                        : 'Monthly');
                    system.debug('freq--' + freq);
                    List<Object> freqData = freqMap.containsKey(freq) ? freqMap.get(freq) : freqMap.get('Monthly');
                    system.debug('freqData--' + freqData);
                    interval = (String) freqData[0];
                    intervalCount = (Integer) freqData[1];
                    system.debug('interval--' + interval + '----intervalCount--' + intervalCount);
                } else if (ql.SBQQ__Product__r.SBQQ__SubscriptionType__c == 'One-time') {
                    priceType = 'one_time';
                }

                // Calculate unit price safely
                Decimal qty = (ql.Quantity_For_Stripe__c != null &&
                    ql.Quantity_For_Stripe__c != 0)
                    ? ql.Quantity_For_Stripe__c
                    : 1;
                Decimal unitPrice = (ql.MRR__c != null &&
                    ql.MRR__c != 0)
                    ? ql.MRR__c / qty
                    : ql.SBQQ__NetTotal__c / qty;

                // Calculate unitAmount in cents
                Decimal multiplier = 1;
                if (priceType == 'recurring') {
                    multiplier = (interval == 'month' &&
                        intervalCount == 3)
                        ? 3
                        : (interval == 'year') ? (12 * intervalCount) : 1; // monthly default
                }
                Decimal unitAmount = (unitPrice != null ? unitPrice.setScale(2) * multiplier * 100 : 0);

                System.debug('unitAmount--' + unitAmount);

                // Build Price API body
                List<String> bodyParts = new List<String>{
                    'billing_scheme=per_unit',
                    'currency=' + ql.CurrencyIsoCode,
                    'product=' + ql.SBQQ__Product__r.Stripe_Product_Id__c,
                    'unit_amount_decimal=' + unitAmount
                };

                // Add recurring details only if recurring
                if (priceType == 'recurring') {
                    bodyParts.add('recurring[interval]=' + interval);
                    bodyParts.add('recurring[interval_count]=' + intervalCount);
                }

                String priceBody = String.join(bodyParts, '&');

                // Send Price request
                HttpRequest priceReq = new HttpRequest();
                priceReq.setEndpoint('https://api.stripe.com/v1/prices');
                priceReq.setMethod('POST');
                priceReq.setHeader(
                    'Authorization',
                    'Basic ' + EncodingUtil.base64Encode(Blob.valueOf(SECRET_KEY + ':'))
                );
                priceReq.setHeader('Content-Type', 'application/x-www-form-urlencoded');
                priceReq.setBody(priceBody);
                HttpResponse priceRes = http.send(priceReq);

                if (priceRes.getStatusCode() == 200) {
                    String priceId = (String) ((Map<String, Object>) JSON.deserializeUntyped(priceRes.getBody()))
                        .get('id');
                    quoteLineToPriceIdMap.put(ql.Id, priceId);
                }
            }

            // Prepare subscription body
            List<String> bodyParts = new List<String>();
            bodyParts.add('customer=' + EncodingUtil.urlEncode(quote.SBQQ__Account__r.Stripe_Customer_ID__c, 'UTF-8'));

            Integer daysUntilDue;

            if (quote.SBQQ__PaymentTerms__c != null || String.isNotBlank(quote.SBQQ__PaymentTerms__c)) {
                if (quote.SBQQ__PaymentTerms__c == 'Prepayment') {
                    daysUntilDue = 0;
                } else if (quote.SBQQ__PaymentTerms__c == 'Due on receipt') {
                    daysUntilDue = 0;
                } else if (quote.SBQQ__PaymentTerms__c == 'Net 15') {
                    daysUntilDue = 15;
                } else if (quote.SBQQ__PaymentTerms__c == 'Net 30') {
                    daysUntilDue = 30;
                } else if (quote.SBQQ__PaymentTerms__c == 'Net 45') {
                    daysUntilDue = 45;
                } else if (quote.SBQQ__PaymentTerms__c == 'Net 60') {
                    daysUntilDue = 60;
                } else if (quote.SBQQ__PaymentTerms__c == 'Net 90') {
                    daysUntilDue = 90;
                } else {
                    daysUntilDue = 0; // Default to no due date
                }
            } else {
                daysUntilDue = 0; // Default to no due date if payment terms are not set
            }

            bodyParts.add('days_until_due=' + String.valueOf(daysUntilDue));
            bodyParts.add('collection_method=send_invoice');
            bodyParts.add('payment_behavior=default_incomplete');
            bodyParts.add('payment_settings[save_default_payment_method]=on_subscription');
            bodyParts.add('currency=' + (quote.CurrencyIsoCode));
            bodyParts.add('proration_behavior=always_invoice');
            bodyParts.add('billing_mode[type]=flexible');

            Date dateOfNextMonth = Date.newInstance(
                startDate.addMonths(1).year(),
                startDate.addMonths(1).month(),
                startDate.addMonths(1).day()
            );
            Date dateOfNextQuarter = Date.newInstance(
                startDate.addMonths(3).year(),
                startDate.addMonths(3).month(),
                startDate.addMonths(3).day()
            );
            Date dateOfNextSemiAnnual = Date.newInstance(
                startDate.addMonths(6).year(),
                startDate.addMonths(6).month(),
                startDate.addMonths(6).day()
            );
            Date dateOfNextYear = Date.newInstance(
                startDate.addYears(1).year(),
                startDate.addYears(1).month(),
                startDate.addYears(1).day()
            );
            Date dateOfNext2Year = Date.newInstance(
                startDate.addYears(2).year(),
                startDate.addYears(2).month(),
                startDate.addYears(2).day()
            );
            Date dateOfNext3Year = Date.newInstance(
                startDate.addYears(3).year(),
                startDate.addYears(3).month(),
                startDate.addYears(3).day()
            );

            // Set billing anchor based on billing frequency
            Datetime billingAnchor;
            if (quote.Billing_Frequency_Override__c != null) {
                String freq = quote.Billing_Frequency_Override__c.toLowerCase();
                if (freq == 'Monthly') {
                    billingAnchor = Datetime.newInstance(
                        dateOfNextMonth.year(),
                        dateOfNextMonth.month(),
                        dateOfNextMonth.day(),
                        0,
                        0,
                        0
                    );
                } else if (freq == 'Quarterly') {
                    billingAnchor = Datetime.newInstance(
                        dateOfNextQuarter.year(),
                        dateOfNextQuarter.month(),
                        dateOfNextQuarter.day(),
                        0,
                        0,
                        0
                    );
                } else if (freq == 'Semiannual') {
                    billingAnchor = Datetime.newInstance(
                        dateOfNextSemiAnnual.year(),
                        dateOfNextSemiAnnual.month(),
                        dateOfNextSemiAnnual.day(),
                        0,
                        0,
                        0
                    );
                } else if (freq == 'Annual') {
                    billingAnchor = Datetime.newInstance(
                        dateOfNextYear.year(),
                        dateOfNextYear.month(),
                        dateOfNextYear.day(),
                        0,
                        0,
                        0
                    );
                } else if (freq == '2-Year') {
                    billingAnchor = Datetime.newInstance(
                        dateOfNext2Year.year(),
                        dateOfNext2Year.month(),
                        dateOfNext2Year.day(),
                        0,
                        0,
                        0
                    );
                } else if (freq == '3-Year') {
                    billingAnchor = Datetime.newInstance(
                        dateOfNext3Year.year(),
                        dateOfNext3Year.month(),
                        dateOfNext3Year.day(),
                        0,
                        0,
                        0
                    );
                } else {
                    // Default to monthly
                    billingAnchor = Datetime.newInstance(
                        dateOfNextMonth.year(),
                        dateOfNextMonth.month(),
                        dateOfNextMonth.day(),
                        0,
                        0,
                        0
                    );
                }
            }

            bodyParts.add('cancel_at=' + String.valueOf(EndDateunixTimestamp)); //  give a date
            bodyParts.add('backdate_start_date=' + String.valueOf(unixTimestamp));
            // bodyParts.add('billing_cycle_anchor=' + String.valueOf(billingAnchor.getTime() / 1000));
            bodyParts.add('metadata[salesforce_quote_id]=' + EncodingUtil.urlEncode(quote.Id, 'UTF-8'));
            bodyParts.add('metadata[subscription_source]=salesforce');

            // Add line items
            Integer index = 0;
            for (SBQQ__QuoteLine__c ql : quoteLines) {
                String priceId = quoteLineToPriceIdMap.get(ql.Id);
                if (String.isBlank(priceId))
                    continue;

                bodyParts.add('items[' + index + '][price]=' + EncodingUtil.urlEncode(priceId, 'UTF-8'));
                bodyParts.add('items[' + index + '][quantity]=' + String.valueOf(ql.Quantity_For_Stripe__c));
                index++;
            }

            // Call Stripe /v1/subscriptions
            String encodedBody = String.join(bodyParts, '&');

            HttpRequest subReq = new HttpRequest();
            subReq.setEndpoint('https://api.stripe.com/v1/subscriptions');
            subReq.setMethod('POST');
            subReq.setHeader('Authorization', 'Basic ' + EncodingUtil.base64Encode(Blob.valueOf(SECRET_KEY + ':')));
            subReq.setHeader('Content-Type', 'application/x-www-form-urlencoded');
            subReq.setBody(encodedBody);

            HttpResponse subRes = http.send(subReq);
            if (subRes.getStatusCode() == 200) {
                Map<String, Object> subResponse = (Map<String, Object>) JSON.deserializeUntyped(subRes.getBody());

                String subscriptionId = (String) subResponse.get('id');
                String invoiceId = (String) subResponse.get('latest_invoice');
                System.debug('Created Stripe Subscription ID: ' + subscriptionId);
                System.debug('Latest Invoice ID: ' + invoiceId);

                List<SBQQ__QuoteLine__c> quoteLinesToUpdate = new List<SBQQ__QuoteLine__c>();
                for (Id qlId : quoteLineToPriceIdMap.keySet()) {
                    quoteLinesToUpdate.add(
                        new SBQQ__QuoteLine__c(Id = qlId, Stripe_Price_ID__c = quoteLineToPriceIdMap.get(qlId))
                    );
                }
                update quoteLinesToUpdate;

                System.enqueueJob(new StripeInvoiceCallout(invoiceId, quote.Id));

                result.isSuccess = true;
                result.message = 'Stripe Subscription Created Successfully';
                return results;
            } else {
                System.debug('Stripe Subscription Error: ' + subRes.getBody());
                throw new CalloutException('Stripe Subscription Error: ' + subRes.getBody());
            }
        } catch (Exception e) {
            System.debug('Error in createStripeSubscription: ' + e.getMessage());
            Logger__c logger = new Logger__c(
                Name = 'Stripe Subscription Creation Error',
                Message__c = e.getMessage(),
                StackTrace__c = e.getStackTraceString(),
                Status__c = 'Error',
                Apex_Class__c = 'StripeSubscriptionScheduler2',
                Apex_Method__c = 'createStripeSubscriptionAsync',
                Object_Name__c = 'SBQQ__Quote__c'
            );
            insert logger;

            result.isSuccess = false;
            result.message = e.getMessage();
            return results;
        }
    }
}