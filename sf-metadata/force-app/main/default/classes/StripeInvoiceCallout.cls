public class StripeInvoiceCallout implements Queueable, Database.AllowsCallouts {
    private static final Stripe_Details__c stripeDetails = Stripe_Details__c.getInstance('Stripe Details');
    private static final String SECRET_KEY = stripeDetails.Serect_Key__c;

    String invoiceId;
    String quoteId;

    public StripeInvoiceCallout(String invoiceId, String quoteId) {
        this.invoiceId = invoiceId;
        this.quoteId = quoteId;
    }

    public void execute(QueueableContext context) {
        try {
            List<SBQQ__Quote__c> quoteList = [
                SELECT
                    Id,
                    SBQQ__NetAmount__c,
                    SBQQ__StartDate__c,
                    SBQQ__Account__c,
                    Bill_To_Contact__c,
                    SBQQ__SubscriptionTerm__c,
                    SBQQ__Account__r.Stripe_Customer_ID__c,
                    SBQQ__PaymentTerms__c,
                    CurrencyIsoCode,
                    Billing_Frequency_Override__c,
                    SBQQ__Account__r.blng__BillToContact__c
                FROM SBQQ__Quote__c
                WHERE Id = :quoteId
                LIMIT 1
            ];

            List<SBQQ__QuoteLine__c> quoteLineItems = [
                SELECT
                    Id,
                    SBQQ__Product__r.Name,
                    SBQQ__Quantity__c,
                    SBQQ__NetTotal__c,
                    SBQQ__CustomerPrice__c,
                    SBQQ__Product__r.Stripe_Product_Id__c,
                    Stripe_Price_ID__c,
                    Quantity_For_Stripe__c,
                    CurrencyIsoCode,
                    Billing_Frequency_Override__c,
                    MRR__c,
                    SBQQ__Product__r.SBQQ__SubscriptionType__c
                FROM SBQQ__QuoteLine__c
                WHERE
                    SBQQ__Quote__c = :quoteList[0].Id
                    AND SBQQ__Product__r.Stripe_Product_Id__c != NULL
                    AND Stripe_Subscription_Type__c = 'One-time'
            ];
            system.debug('quoteLineItems--' + quoteLineItems);
            // Flag if we found any One-time quote lines
            Boolean hasOneTimeLines = !quoteLineItems.isEmpty();

            // prepare price id with Quote line price //
            if (hasOneTimeLines) {
                Map<Id, String> quoteLineToPriceIdMap = new Map<Id, String>();
                Http http = new Http();

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

                for (SBQQ__QuoteLine__c ql : quoteLineItems) {
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

                        List<Object> freqData = freqMap.containsKey(freq) ? freqMap.get(freq) : freqMap.get('Monthly');

                        interval = (String) freqData[0];
                        intervalCount = (Integer) freqData[1];
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
                ////////////add lines////////////////////////
                List<String> parts = new List<String>();
                Integer i = 0;

                for (SBQQ__QuoteLine__c item : quoteLineItems) {
                    String priceId = quoteLineToPriceIdMap.get(item.Id);

                    parts.add('lines[' + i + '][pricing][price]=' + EncodingUtil.urlEncode(priceId, 'UTF-8'));
                    parts.add(
                        'lines[' +
                            i +
                            '][quantity]=' +
                            EncodingUtil.urlEncode(
                                String.valueOf(item.Quantity_For_Stripe__c != null ? item.Quantity_For_Stripe__c : 1),
                                'UTF-8'
                            )
                    );

                    if (!String.isBlank(item.SBQQ__Product__r.Name)) {
                        parts.add(
                            'lines[' +
                                i +
                                '][description]=' +
                                EncodingUtil.urlEncode(item.SBQQ__Product__r.Name, 'UTF-8')
                        );
                    }

                    i++;
                }

                String endpoint = 'https://api.stripe.com/v1/invoices/' + invoiceId + '/add_lines';

                HttpRequest req2 = new HttpRequest();
                req2.setEndpoint(endpoint);
                req2.setMethod('POST');
                req2.setHeader('Authorization', 'Basic ' + EncodingUtil.base64Encode(Blob.valueOf(SECRET_KEY + ':')));
                req2.setHeader('Content-Type', 'application/x-www-form-urlencoded');
                req2.setBody(String.join(parts, '&'));

                Http http5 = new Http();
                HttpResponse res3 = http5.send(req2);
                System.debug('Stripe response: ' + res3.getBody());
                if (res3.getStatusCode() == 200) {
                    System.debug('Stripe Invoice Add Lines: ' + res3.getBody());
                } else {
                    System.debug('Stripe Invoice Error: ' + res3.getBody());
                    throw new CalloutException('Stripe callout failed: ' + res3.getBody());
                }
            }
            // invoice update ///

            Integer dueOffsetDays = 0;
            String terms = quoteList[0].SBQQ__PaymentTerms__c != null
                ? quoteList[0].SBQQ__PaymentTerms__c.toLowerCase()
                : '';
            system.debug('terms--' + terms);
            String extractedTerm = terms.replaceAll('\\D+', '');
            system.debug('extractedTerm--' + extractedTerm);

            switch on extractedTerm {
                when '15' {
                    dueOffsetDays = 15;
                }
                when '30' {
                    dueOffsetDays = 30;
                }
                when '45' {
                    dueOffsetDays = 45;
                }
                when '60' {
                    dueOffsetDays = 60;
                }
                when '90' {
                    dueOffsetDays = 90;
                }
                when else {
                    dueOffsetDays = 0;
                }
            }
            // Get the Salesforce user's timezone
            TimeZone tz = UserInfo.getTimeZone();
            System.debug('Display name: ' + tz.getDisplayName());
            System.debug('ID: ' + tz.getID());

            Date startDate = quoteList[0].SBQQ__StartDate__c;
            system.debug('dueOffsetDays--' + dueOffsetDays);
            Date dueDate = startDate.addDays(dueOffsetDays);
            Long unixStartDate;
            Long unixDueDate;

            if (startDate != null) {
                // Create datetime at midnight in user's local time
                Datetime userLocalStart = Datetime.newInstance(
                    startDate.year(),
                    startDate.month(),
                    startDate.day(),
                    0,
                    0,
                    0
                );
                // Convert that datetime to UTC by subtracting the user's offset
                // Datetime utcStart = userLocalStart.addSeconds(-tz.getOffset(userLocalStart) / 1000);
                unixStartDate = userLocalStart.getTime() / 1000;
            }

            if (dueDate != null) {
                Datetime userLocalDue = Datetime.newInstance(dueDate.year(), dueDate.month(), dueDate.day(), 0, 0, 0);
                unixDueDate = userLocalDue.getTime() / 1000;
            }

            System.debug('unixStartDate (user TZ adjusted): ' + unixStartDate);
            System.debug('unixDueDate (user TZ adjusted): ' + unixDueDate);
            
            List<String> bodyParts = new List<String>();
            // bodyParts.add('customer=' + EncodingUtil.urlEncode(quoteList[0].SBQQ__Account__r.Stripe_Customer_ID__c, 'UTF-8'));
            //  bodyParts.add('collection_method=send_invoice');
            //  bodyParts.add('currency=' + quoteList[0].CurrencyIsoCode);
            // bodyParts.add('payment_settings[payment_method_types][0]=card');
            // bodyParts.add('payment_settings[payment_method_types][1]=ach_debit');
            // bodyParts.add('payment_settings[payment_method_types][2]=klarna');
            bodyParts.add('metadata[salesforce_quote_id]=' + quoteList[0].Id);
            bodyParts.add('metadata[salesforce_quote_accepted]=true');

            if (unixStartDate != null) {
                bodyParts.add('effective_at=' + String.valueOf(unixStartDate));
            }
            if (dueOffsetDays != 0) {
                bodyParts.add('due_date=' + String.valueOf(unixDueDate));
            }

            String encodedBody = String.join(bodyParts, '&');
            system.debug('encodedBody--' + encodedBody);
            HttpRequest req = new HttpRequest();
            req.setEndpoint('https://api.stripe.com/v1/invoices/' + invoiceid);
            req.setMethod('POST');
            req.setHeader('Authorization', 'Basic ' + EncodingUtil.base64Encode(Blob.valueOf(SECRET_KEY + ':')));
            req.setHeader('Content-Type', 'application/x-www-form-urlencoded');
            req.setBody(encodedBody);

            Http http3 = new Http();
            HttpResponse res = http3.send(req);

            if (res.getStatusCode() == 200) {
                Map<String, Object> responseMap = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
                System.debug('Invoice updated Successfully: ' + responseMap);
            } else {
                System.debug('Stripe Invoice Error: ' + res.getBody());
                throw new CalloutException('Stripe callout failed: ' + res.getBody());
            }
        } catch (Exception e) {
            System.debug('Error during invoice creation: ' + e.getMessage());
            Logger__c logger = new Logger__c(
                Name = 'Stripe Invoice Callout Error',
                Message__c = e.getMessage(),
                StackTrace__c = e.getStackTraceString(),
                Status__c = 'Error',
                Apex_Class__c = 'StripeInvoiceCallout',
                Apex_Method__c = 'invoiceGeneration',
                Object_Name__c = 'Stripe_Invoice__c'
            );
            insert logger;
        }
    }

    private static Datetime toDateTime(Long unixTs) {
        if (unixTs == null)
            return null;
        return Datetime.newInstance(unixTs * 1000);
    }
}