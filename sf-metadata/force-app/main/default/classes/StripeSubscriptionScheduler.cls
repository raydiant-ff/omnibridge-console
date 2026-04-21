public class StripeSubscriptionScheduler {
    private static final Stripe_Details__c stripeDetails = Stripe_Details__c.getInstance('Stripe Details');
    private static final String SECRET_KEY = stripeDetails.Serect_Key__c;

    /**
     * Quote To Invoice || Subscription Schedule
     * Creates Stripe Subscription Schedule when Quote is Accepted with future start date
     * Quote To Invoice - Collection Method => send_invoice
     */
    public static void createStripeSchedule(list<Id> quoteId) {
        try {
            List<SBQQ__Quote__c> quoteList = [
                SELECT
                    Id,
                    SBQQ__StartDate__c,
                    SBQQ__EndDate__c,
                    SBQQ__Account__c,
                    SBQQ__Account__r.Stripe_Customer_ID__c,
                    Bill_To_Contact__c,
                    Billing_Frequency_Override__c,
                    SBQQ__SubscriptionTerm__c,
                    CurrencyIsoCode,
                    SBQQ__PaymentTerms__c
                FROM SBQQ__Quote__c
                WHERE id IN :quoteId
                LIMIT 1
            ];
            if (quoteList.isEmpty())
                return;

            SBQQ__Quote__c quote = quoteList[0];
            List<id> quoteIds = new List<Id>();
            quoteIds.add(quote.Id);
            List<SBQQ__QuoteLine__c> quoteLines = [
                SELECT
                    Quantity_For_Stripe__c,
                    SBQQ__NetTotal__c,
                    MRR__c,
                    SBQQ__Product__r.Stripe_Product_ID__c,
                    SBQQ__Product__r.SBQQ__SubscriptionType__c,
                    SBQQ__Product__r.Name,
                    Billing_Frequency_Override__c,
                    CurrencyIsoCode
                FROM SBQQ__QuoteLine__c
                WHERE SBQQ__Quote__c = :quote.Id AND Stripe_Subscription_Type__c != 'One-time'
                LIMIT 20
            ];
            system.debug('--quoteItems-' + quoteLines);

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

            //  Create Price in Stripe for each Quote Lines
            for (SBQQ__QuoteLine__c ql : quoteLines) {
                String priceType;
                String interval;
                Integer intervalCount;

                String productId = ql.SBQQ__Product__r.Stripe_Product_Id__c;
                if (String.isBlank(productId))
                    continue;

                // Determine price type & interval
                if (ql.SBQQ__Product__r.SBQQ__SubscriptionType__c == 'Renewable') {
                    priceType = 'recurring';
                    hasRecurringProducts = true;

                    String freq = (ql.Billing_Frequency_Override__c != null
                        ? ql.Billing_Frequency_Override__c
                        : 'Monthly');

                    List<Object> freqData = freqMap.containsKey(freq) ? freqMap.get(freq) : freqMap.get('Monthly');

                    interval = (String) freqData[0];
                    intervalCount = (Integer) freqData[1];
                }

                // else if (ql.SBQQ__Product__r.SBQQ__SubscriptionType__c == 'One-time') {
                //     priceType = 'one_time';
                // }

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
                    Map<String, Object> priceResult = (Map<String, Object>) JSON.deserializeUntyped(priceRes.getBody());
                    String priceId = (String) priceResult.get('id');
                    quoteLineToPriceIdMap.put(ql.Id, priceId);
                } else {
                    System.debug('Price creation failed: ' + priceRes.getBody());
                }
            }

            // dynamic request body for Subscription Schedule
            List<String> bodyParts = new List<String>();

            Date StartDate = quote.SBQQ__StartDate__c;
            Datetime dt = Datetime.newInstance(startDate.year(), startDate.month(), startDate.day(), 0, 0, 0);
            Long unixTimestamp = dt.getTime() / 1000;
            System.debug('Unix Timestamp: ' + unixTimestamp);

            Date EndDate = startDate.addMonths(INTEGER.VALUEOF(quote.SBQQ__SubscriptionTerm__c)).addDays(-1);
            Datetime EndDatedt = Datetime.newInstance(EndDate.year(), EndDate.month(), EndDate.day(), 0, 0, 0);
            Long EndDateunixTimestamp = EndDatedt.getTime() / 1000;
            System.debug('Unix Timestamp: ' + EndDateunixTimestamp);

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
                String freq = quote.Billing_Frequency_Override__c;
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

            bodyParts.add('customer=' + EncodingUtil.urlEncode(quote.SBQQ__Account__r.Stripe_Customer_ID__c, 'UTF-8'));
            // bodyParts.add('start_date=1757071713');
            bodyParts.add('start_date=' + String.valueOf(unixTimestamp));
            bodyParts.add('end_behavior=cancel');
            bodyParts.add('default_settings[billing_cycle_anchor]=automatic');
            bodyParts.add('default_settings[collection_method]=send_invoice');
            bodyParts.add('default_settings[invoice_settings][days_until_due]=' + String.valueOf(daysUntilDue));
            bodyParts.add('metadata[salesforce_quote_id]=' + EncodingUtil.urlEncode(quote.Id, 'UTF-8'));
            bodyParts.add('metadata[subscription_schedule]=true');
            bodyParts.add('metadata[subscription_source]=salesforce');

            // Phase settings
            bodyParts.add('phases[0][currency]=' + quote.CurrencyIsoCode);
            bodyParts.add('phases[0][end_date]=' + String.valueOf(EndDateunixTimestamp));
            bodyParts.add('phases[0][metadata][salesforce_quote_id]=' + EncodingUtil.urlEncode(quote.Id, 'UTF-8'));
            bodyParts.add('phases[0][metadata][subscription_source]=salesforce');
            bodyParts.add('phases[0][metadata][subscription_schedule]=true');

            // Dynamic items
            // Integer i = 0;
            Integer j = 0;
            for (SBQQ__QuoteLine__c ql : quoteLines) {
                String priceId = quoteLineToPriceIdMap.get(ql.Id);
                if (String.isBlank(priceId))
                    continue;

                // if (ql.SBQQ__Product__r.SBQQ__SubscriptionType__c == 'One-time') {
                //     bodyParts.add(
                //         'phases[0][add_invoice_items][' + i + '][price]=' + EncodingUtil.urlEncode(priceId, 'UTF-8')
                //     );
                //     bodyParts.add(
                //         'phases[0][add_invoice_items][' + i + '][quantity]=' + String.valueOf(ql.Quantity_For_Stripe__c)
                //     );
                //     i++;
                //     system.debug('One _ Time');
                // } else

                if (ql.SBQQ__Product__r.SBQQ__SubscriptionType__c == 'Renewable') {
                    bodyParts.add('phases[0][items][' + j + '][price]=' + EncodingUtil.urlEncode(priceId, 'UTF-8'));
                    bodyParts.add('phases[0][items][' + j + '][quantity]=' + String.valueOf(ql.Quantity_For_Stripe__c));
                    j++;
                }
            }

            // Final encoded body
            String encodedBody = String.join(bodyParts, '&');
            System.debug('Encoded Stripe Request Body: ' + encodedBody);

            // Send Subscription Schedule Callout
            HttpRequest req = new HttpRequest();
            req.setEndpoint('https://api.stripe.com/v1/subscription_schedules');
            req.setMethod('POST');
            req.setHeader('Authorization', 'Basic ' + EncodingUtil.base64Encode(Blob.valueOf(SECRET_KEY + ':')));
            req.setHeader('Content-Type', 'application/x-www-form-urlencoded');
            req.setBody(encodedBody);

            HttpResponse res = http.send(req);
            if (res.getstatusCode() == 200) {
                Map<String, Object> subResponse = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());

                String subscriptionId = (String) subResponse.get('id');
                System.debug('Created Stripe Subscription ID: ' + subscriptionId);

                List<SBQQ__QuoteLine__c> quoteLinesToUpdate = new List<SBQQ__QuoteLine__c>();
                for (Id qlId : quoteLineToPriceIdMap.keySet()) {
                    quoteLinesToUpdate.add(
                        new SBQQ__QuoteLine__c(Id = qlId, Stripe_Price_ID__c = quoteLineToPriceIdMap.get(qlId))
                    );
                }
                update quoteLinesToUpdate;
            } else {
                System.debug('Stripe Subscription Schedule Error: ' + res.getBody());
                throw new CalloutException('Stripe Subscription Schedule Error: ' + res.getBody());
            }
        } catch (Exception e) {
            System.debug('Error in createStripeSchedule: ' + e.getMessage());
            Logger__c logger = new Logger__c(
                Name = 'Stripe Subscription Schedule Error',
                Message__c = e.getMessage(),
                StackTrace__c = e.getStackTraceString(),
                Status__c = 'Error',
                Apex_Class__c = 'StripeSubscriptionScheduler',
                Apex_Method__c = 'createStripeSchedule',
                Object_Name__c = 'SBQQ__Quote__c'
            );
            insert logger;
        }
    }
}
