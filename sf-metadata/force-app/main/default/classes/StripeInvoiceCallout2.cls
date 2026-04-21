public class StripeInvoiceCallout2 {
    private static final Stripe_Details__c STRIPE_DETAILS = Stripe_Details__c.getInstance('Stripe Details');
    private static final String SECRET_KEY = STRIPE_DETAILS != null ? STRIPE_DETAILS.Serect_Key__c : '';

    @future(callout=true)
    public static void invoiceGeneration(List<Id> quoteIds, Boolean billToday) {
        if (quoteIds == null || quoteIds.isEmpty())
            return;

        for (Id quoteId : quoteIds) {
            processSingleQuote(quoteId, billToday);
        }
    }

    // ----------------------
    // Core processing per quote
    // ----------------------
    private static void processSingleQuote(Id quoteId, Boolean billToday) {
        try {
            SBQQ__Quote__c quote = [
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

            if (quote == null) {
                System.debug('Quote not found for Id: ' + quoteId);
                return;
            }

            // Query one-time quote lines for this quote
            List<SBQQ__QuoteLine__c> quoteLineItems = [
                SELECT
                    Id,
                    SBQQ__Product__r.Name,
                    SBQQ__Product__r.Stripe_Product_Id__c,
                    SBQQ__Product__r.SBQQ__SubscriptionType__c,
                    SBQQ__Quantity__c,
                    SBQQ__NetTotal__c,
                    SBQQ__CustomerPrice__c,
                    Stripe_Price_ID__c,
                    Quantity_For_Stripe__c,
                    CurrencyIsoCode,
                    Billing_Frequency_Override__c,
                    MRR__c
                FROM SBQQ__QuoteLine__c
                WHERE SBQQ__Quote__c = :quoteId AND Stripe_Subscription_Type__c = 'One-time'
            ];

            if (quoteLineItems.isEmpty()) {
                System.debug('No one-time quote lines found for Quote Id: ' + quoteId);
                return;
            }

            // 1) Create Invoice (Stripe) - build body and call Stripe
            Long unixStartDate = null;
            Long unixDueDate = null;
            Date startDate = billToday ? Date.today() : quote.SBQQ__StartDate__c;

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

            // Use user's timezone to compute UTC seconds for the midnight of the date
            Datetime userLocalStart = Datetime.newInstance(
                startDate.year(),
                startDate.month(),
                startDate.day(),
                0,
                0,
                0
            );
            unixStartDate = (Long) (userLocalStart.getTime() / 1000);

            // Build invoice request body
            List<String> bodyParts = new List<String>();
            String customerId = quote.SBQQ__Account__r != null ? quote.SBQQ__Account__r.Stripe_Customer_ID__c : null;
            if (String.isBlank(customerId)) {
                throw new CalloutException('Missing Stripe Customer ID on Account for Quote: ' + quote.Id);
            }
            bodyParts.add('customer=' + EncodingUtil.urlEncode(customerId, 'UTF-8'));
            bodyParts.add('collection_method=send_invoice');
            bodyParts.add('currency=' + (quote.CurrencyIsoCode != null ? quote.CurrencyIsoCode : 'usd'));
            // bodyParts.add('payment_settings[payment_method_types][0]=card');
            // bodyParts.add('payment_settings[payment_method_types][1]=ach_debit');
            // bodyParts.add('payment_settings[payment_method_types][2]=klarna');
            bodyParts.add('metadata[salesforce_quote_id]=' + EncodingUtil.urlEncode(quote.Id, 'UTF-8'));
            bodyParts.add('metadata[salesforce_quote_accepted]=true');

            if (unixStartDate != null) {
                bodyParts.add('effective_at=' + String.valueOf(unixStartDate));
            }
            if (daysUntilDue != null) {
                bodyParts.add('days_until_due=' + daysUntilDue);
            }

            String encodedBody = String.join(bodyParts, '&');
            HttpRequest invoiceReq = new HttpRequest();
            invoiceReq.setEndpoint('https://api.stripe.com/v1/invoices');
            invoiceReq.setMethod('POST');
            invoiceReq.setHeader('Authorization', 'Basic ' + EncodingUtil.base64Encode(Blob.valueOf(SECRET_KEY + ':')));
            invoiceReq.setHeader('Content-Type', 'application/x-www-form-urlencoded');
            invoiceReq.setBody(encodedBody);

            Http http = new Http();
            HttpResponse invoiceRes = http.send(invoiceReq);

            if (invoiceRes.getStatusCode() != 200 && invoiceRes.getStatusCode() != 201) {
                throw new CalloutException('Stripe invoice creation failed: ' + invoiceRes.getBody());
            }

            Map<String, Object> invoiceResponse = (Map<String, Object>) JSON.deserializeUntyped(invoiceRes.getBody());
            String invoiceId = (String) invoiceResponse.get('id');
            if (String.isBlank(invoiceId)) {
                throw new CalloutException('Stripe returned no invoice id: ' + invoiceRes.getBody());
            }

            // 2) Create Price objects for each quote line (one_time or recurring)
            Map<Id, String> quoteLineToPriceIdMap = new Map<Id, String>();
            for (SBQQ__QuoteLine__c ql : quoteLineItems) {
                String priceType = 'One-time';
                String interval = null;
                Integer intervalCount = null;

                // If product has subscription type renewable -> recurring. (uncomment if needed)
                /* if (ql.SBQQ__Product__r != null && ql.SBQQ__Product__r.SBQQ__SubscriptionType__c == 'Renewable') {
                    priceType = 'recurring';
                    // pick frequency override or default to monthly
                    String freq = ql.Billing_Frequency_Override__c != null ? ql.Billing_Frequency_Override__c.toLowerCase() : 'monthly';
                    Map<String, List<Object>> freqMap = new Map<String, List<Object>>{
                        'monthly'   => new List<Object>{ 'month', 1 },
                        'quarterly' => new List<Object>{ 'month', 3 },
                        'annual'    => new List<Object>{ 'year', 1 },
                        '2-year'    => new List<Object>{ 'year', 2 },
                        '3-year'    => new List<Object>{ 'year', 3 }
                    };
                    if (freqMap.containsKey(freq)) {
                        List<Object> f = freqMap.get(freq);
                        interval = (String) f[0];
                        intervalCount = (Integer) f[1];
                    } else {
                        interval = 'month';
                        intervalCount = 1;
                    }
                }*/

                Decimal qty = (ql.Quantity_For_Stripe__c != null &&
                    ql.Quantity_For_Stripe__c != 0)
                    ? ql.Quantity_For_Stripe__c
                    : (ql.SBQQ__Quantity__c != null ? ql.SBQQ__Quantity__c : 1);
                Decimal unitPrice = 0;
                if (ql.MRR__c != null && ql.MRR__c != 0) {
                    unitPrice = ql.MRR__c / qty;
                } else if (ql.SBQQ__NetTotal__c != null) {
                    unitPrice = ql.SBQQ__NetTotal__c / qty;
                }

                // multiplier for recurring yearly/quarterly to convert to per unit (monthly baseline)
                Decimal multiplier = 1;
                /*  if (priceType == 'recurring') {
                    if (interval == 'month' && intervalCount == 3) multiplier = 3;
                    else if (interval == 'year') multiplier = 12 * Math.max(1, intervalCount);
                    else multiplier = Math.max(1, intervalCount);
                }*/

                // unit amount in cents with 2 decimal places
                Decimal unitAmountCents = (unitPrice != null
                    ? unitPrice.setScale(2, RoundingMode.HALF_UP) * multiplier * 100
                    : 0);

                List<String> priceParts = new List<String>{
                    'billing_scheme=per_unit',
                    'currency=' + (ql.CurrencyIsoCode != null ? ql.CurrencyIsoCode : quote.CurrencyIsoCode),
                    'product=' + (ql.SBQQ__Product__r != null ? ql.SBQQ__Product__r.Stripe_Product_Id__c : ''),
                    'unit_amount_decimal=' + String.valueOf(unitAmountCents)
                };
                /*if (priceType == 'recurring') {
                    priceParts.add('recurring[interval]=' + interval);
                    priceParts.add('recurring[interval_count]=' + String.valueOf(intervalCount));
                }*/

                String priceBody = String.join(priceParts, '&');

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
                if (priceRes.getStatusCode() != 200 && priceRes.getStatusCode() != 201) {
                    System.debug('Stripe price creation failed for QuoteLine ' + ql.Id + ': ' + priceRes.getBody());
                    continue;
                }
                Map<String, Object> priceRespMap = (Map<String, Object>) JSON.deserializeUntyped(priceRes.getBody());
                String priceId = (String) priceRespMap.get('id');
                if (!String.isBlank(priceId))
                    quoteLineToPriceIdMap.put(ql.Id, priceId);
            }

            // 3) Add lines to invoice
            List<String> lineParts = new List<String>();
            Integer idx = 0;
            for (SBQQ__QuoteLine__c item : quoteLineItems) {
                String priceId = quoteLineToPriceIdMap.containsKey(item.Id)
                    ? quoteLineToPriceIdMap.get(item.Id)
                    : item.Stripe_Price_ID__c;
                if (String.isBlank(priceId))
                    continue;

                lineParts.add('lines[' + idx + '][pricing][price]=' + EncodingUtil.urlEncode(priceId, 'UTF-8'));
                Integer qtyToSend = (item.Quantity_For_Stripe__c != null &&
                    item.Quantity_For_Stripe__c > 0)
                    ? Integer.valueOf(item.Quantity_For_Stripe__c)
                    : (item.SBQQ__Quantity__c != null ? Integer.valueOf(item.SBQQ__Quantity__c) : 1);
                lineParts.add(
                    'lines[' + idx + '][quantity]=' + EncodingUtil.urlEncode(String.valueOf(qtyToSend), 'UTF-8')
                );

                if (!String.isBlank(item.SBQQ__Product__r != null ? item.SBQQ__Product__r.Name : null)) {
                    lineParts.add(
                        'lines[' + idx + '][description]=' + EncodingUtil.urlEncode(item.SBQQ__Product__r.Name, 'UTF-8')
                    );
                }
                idx++;
            }

            if (!lineParts.isEmpty()) {
                String addLinesEndpoint = 'https://api.stripe.com/v1/invoices/' + invoiceId + '/add_lines';
                // Note: Stripe earlier used 'add_lines' endpoint; newer APIs use '/lines' and POST lines or you may use invoiceItems.
                HttpRequest addLinesReq = new HttpRequest();
                addLinesReq.setEndpoint(addLinesEndpoint);
                addLinesReq.setMethod('POST');
                addLinesReq.setHeader(
                    'Authorization',
                    'Basic ' + EncodingUtil.base64Encode(Blob.valueOf(SECRET_KEY + ':'))
                );
                addLinesReq.setHeader('Content-Type', 'application/x-www-form-urlencoded');
                addLinesReq.setBody(String.join(lineParts, '&'));
                HttpResponse addLinesRes = http.send(addLinesReq);

                if (addLinesRes.getStatusCode() != 200 && addLinesRes.getStatusCode() != 201) {
                    System.debug('Stripe add lines failed: ' + addLinesRes.getBody());
                    throw new CalloutException('Stripe invoice fetch failed: ' + addLinesRes.getBody());
                }
            }

            // 4) Fetch invoice full details and upsert Stripe_Invoice__c and lines
            HttpRequest fetchReq = new HttpRequest();
            fetchReq.setEndpoint('https://api.stripe.com/v1/invoices/' + invoiceId + '/send');
            fetchReq.setMethod('POST');
            fetchReq.setHeader('Authorization', 'Basic ' + EncodingUtil.base64Encode(Blob.valueOf(SECRET_KEY + ':')));
            fetchReq.setHeader('Content-Type', 'application/x-www-form-urlencoded');
            HttpResponse fetchRes = http.send(fetchReq);

            if (fetchRes.getStatusCode() == 200) {
                Map<String, Object> result = (Map<String, Object>) JSON.deserializeUntyped(fetchRes.getBody());
                System.debug('Stripe Invoice Sent Successfully for Quote ' + quoteId + ': ' + fetchRes.getBody());
            } else {
                System.debug('Stripe Invoice Send failed for Quote ' + quoteId + ': ' + fetchRes.getBody());
                throw new CalloutException('Stripe invoice send failed: ' + fetchRes.getBody());
            }
        } catch (Exception e) {
            System.debug('Error during invoice creation for quote ' + quoteId + ': ' + e.getMessage());

            Logger__c logger = new Logger__c(
                Name = 'Stripe Invoice Callout2 Error',
                Message__c = e.getMessage(),
                StackTrace__c = e.getStackTraceString(),
                Status__c = 'Error',
                Apex_Class__c = 'StripeInvoiceCallout2',
                Apex_Method__c = 'invoiceGeneration',
                Object_Name__c = 'Stripe_Invoice__c'
            );
            insert logger;
        }
    }

    // ----------------------
    // Helper: parse payment terms to days (supports extracting numbers like 'Net 30')
    // ----------------------
    private static Integer getDueOffsetDaysFromPaymentTerms(String paymentTerms) {
        if (String.isBlank(paymentTerms))
            return 0;
        // Extract digits
        String extracted = paymentTerms.replaceAll('\\D+', '');
        if (String.isBlank(extracted))
            return 0;
        try {
            Integer days = Integer.valueOf(extracted);
            return days;
        } catch (Exception e) {
            return 0;
        }
    }

    private static Datetime toDateTime(Long unixTs) {
        if (unixTs == null)
            return null;
        return Datetime.newInstance(unixTs * 1000);
    }
}