public class StripeInvoiceQueueable implements Queueable, Database.AllowsCallouts {
    private static final Stripe_Details__c stripeDetails = Stripe_Details__c.getInstance('Stripe Details');
    private static final String SECRET_KEY = stripeDetails.Serect_Key__c;

    String stripeInvoiceId;
    String stripeSubscriptionId;
    String quoteId;

    public StripeInvoiceQueueable(String stripeInvoiceId, String stripeSubscriptionId, String quoteId) {
        this.stripeInvoiceId = stripeInvoiceId;
        this.stripeSubscriptionId = stripeSubscriptionId;
        this.quoteId = quoteId;
    }

    public void execute(QueueableContext context) {
        try {
            List<Contract> contracts = new List<Contract>();
            if (stripeSubscriptionId != null) {
                contracts = [
                    SELECT Id, Stripe_Subscription_ID__c, SBQQ__Quote__c
                    FROM Contract
                    WHERE Stripe_Subscription_ID__c = :stripeSubscriptionId
                ];
            }

            List<SBQQ__Quote__c> quoteList = new List<SBQQ__Quote__c>();
            if (!contracts.isEmpty()) {
                quoteList = [
                    SELECT Id, SBQQ__Account__c, Bill_To_Contact__c, SBQQ__Account__r.blng__BillToContact__c
                    FROM SBQQ__Quote__c
                    WHERE id = :contracts[0].SBQQ__Quote__c
                ];
            } else if (quoteId != null) {
                quoteList = [
                    SELECT Id, SBQQ__Account__c, Bill_To_Contact__c, SBQQ__Account__r.blng__BillToContact__c
                    FROM SBQQ__Quote__c
                    WHERE Id = :quoteId
                ];
            }

            HttpRequest req = new HttpRequest();
            req.setEndpoint('https://api.stripe.com/v1/invoices/' + stripeInvoiceId);
            req.setMethod('GET');
            req.setHeader('Authorization', 'Basic ' + EncodingUtil.base64Encode(Blob.valueOf(SECRET_KEY + ':')));

            Http http = new Http();
            HttpResponse res = http.send(req);

            if (res.getStatusCode() == 200) {
                Map<String, Object> result = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
                system.debug('result---' + result);

                Map<String, Object> lines = (Map<String, Object>) result.get('lines');
                List<Object> lineData = (List<Object>) lines.get('data');
                String customerId = result.containsKey('customer') ? (String) result.get('customer') : null;

                // Fetch Account based on Customer ID
                List<Account> accts = [
                    SELECT Id, Name, blng__BillToContact__c
                    FROM Account
                    WHERE Stripe_Customer_ID__c = :customerId
                ];
                System.debug('accts--' + accts);

                // Extract relevant fields
                Long effectivedate = (Long) result.get('effective_at');
                Long stratDate = (Long) result.get('period_start');
                Long endDate = (Long) result.get('period_end');
                Long webhoodDelivered = (Long) result.get('webhooks_delivered_at');
                Long dueDate = (Long) result.get('due_date');
                Long finalizesAt = (Long) result.get('automatically_finalizes_at');
                String currencyCode = (String) result.get('currency');
                String status = (String) result.get('status');
                Decimal prePaymentCreditAmount = result.containsKey('pre_payment_credit_notes_amount')
                    ? (Decimal) result.get('pre_payment_credit_notes_amount') / 100
                    : 0;
                Decimal postPaymentCreditAmount = result.containsKey('post_payment_credit_notes_amount')
                    ? (Decimal) result.get('post_payment_credit_notes_amount') / 100
                    : 0;
                String invoiceStatus;
                Id accountId;
                Id billToContactId;

                if (prePaymentCreditAmount + postPaymentCreditAmount > 0) {
                    invoiceStatus = 'Credited';
                } else {
                    if (status == 'open') {
                        invoiceStatus = 'Open';
                    } else if (status == 'paid') {
                        invoiceStatus = 'Paid';
                    } else if (status == 'void') {
                        invoiceStatus = 'Void';
                    } else if (status == 'uncollectible') {
                        invoiceStatus = 'Uncollectible';
                    } else {
                        invoiceStatus = status != null ? status.capitalize() : 'Open';
                    }
                }

                // Determine Account and Bill To Contact
                if (!accts.isEmpty()) {
                    accountId = accts[0].Id;
                    billToContactId = accts[0].blng__BillToContact__c;
                } else if (!quoteList.isEmpty()) {
                    accountId = quoteList[0].SBQQ__Account__c;
                    billToContactId = quoteList[0].Bill_To_Contact__c != null
                        ? quoteList[0].Bill_To_Contact__c
                        : quoteList[0].SBQQ__Account__r.blng__BillToContact__c;
                } else {
                    throw new DmlException('No Account found: ' + customerId);
                }
                System.debug('accountId--' + accountId);

                // Upsert Stripe Invoice Record
                Stripe_Invoice__c invoice = new Stripe_Invoice__c();
                invoice.Total_Amount__c = result.containsKey('total') ? (Decimal) result.get('total') / 100 : 0;
                invoice.Total_Amount_with_Tax__c = result.containsKey('total_excluding_tax')
                    ? (Decimal) result.get('total_excluding_tax') / 100
                    : 0;
                invoice.Subtotal__c = result.containsKey('subtotal') ? (Decimal) result.get('subtotal') / 100 : 0;
                invoice.Amount_Paid__c = result.containsKey('amount_paid')
                    ? (Decimal) result.get('amount_paid') / 100
                    : 0;
                invoice.Amount_Due__c = result.containsKey('amount_due') ? (Decimal) result.get('amount_due') / 100 : 0;
                invoice.Amount_Remaining__c = result.containsKey('amount_remaining')
                    ? (Decimal) result.get('amount_remaining') / 100
                    : 0;
                invoice.Amount_Credited__c = prePaymentCreditAmount + postPaymentCreditAmount;
                invoice.Tax_Rate__c = result.containsKey('tax') && result.get('tax') != null
                    ? (Decimal) result.get('tax')
                    : 0;
                invoice.Due_Date__c = duedate != null
                    ? Date.valueOf(toDateTime(dueDate))
                    : date.valueof(toDateTime(effectivedate));
                invoice.Automatically_Finalizes_At__c = toDateTime(finalizesAt);
                invoice.Billing_Reason__c = (String) result.get('billing_reason');
                invoice.CurrencyIsoCode = currencyCode.toUpperCase();
                invoice.Contract__c = contracts.isEmpty() ? null : contracts[0].Id;
                invoice.Quote_CPQ__c = quoteList.isEmpty() ? null : quoteList[0].Id;
                invoice.Account__c = accountId;
                invoice.Bill_to_Contact__c = billToContactId;
                invoice.Is_Payment_Done__c = status == 'paid' ? true : false;
                invoice.Stripe_Invoice_Id__c = stripeInvoiceId;
                invoice.Invoice_Date__c = date.valueof(toDateTime(effectivedate));
                invoice.Invoice_PDF_URL__c = (String) result.get('invoice_pdf');
                invoice.Invoice_URL__c = (String) result.get('hosted_invoice_url');
                invoice.Name = result.get('number') != null ? (String) result.get('number') : 'SI-DRAFT';
                invoice.Stripe_Invoice_Number__c = (String) result.get('number');
                invoice.Stripe_Invoice_Period_End__c = toDateTime(endDate);
                invoice.Stripe_Invoice_Period_Start__c = toDateTime(stratDate);
                invoice.Status__c = invoiceStatus;
                invoice.Webhook_Delivered_At__c = toDateTime(webhoodDelivered);

                upsert invoice Stripe_Invoice_Id__c;

                Id invoiceID = invoice.Id;
                system.debug('invoiceID--' + invoiceID);

                // Proceed to Invoice Line Items
                List<Stripe_Invoice_Line_Item__c> lineItems = new List<Stripe_Invoice_Line_Item__c>();

                // Collect all unique product IDs from subscription items
                Set<String> stripeProductIds = new Set<String>();
                for (Object item : lineData) {
                    Map<String, Object> lineItem = (Map<String, Object>) item;
                    if (lineItem.containsKey('pricing')) {
                        Map<String, Object> pricing = (Map<String, Object>) lineItem.get('pricing');
                        if (pricing.containsKey('price_details')) {
                            Map<String, Object> priceDetails = (Map<String, Object>) pricing.get('price_details');
                            if (priceDetails.containsKey('product')) {
                                stripeProductIds.add((String) priceDetails.get('product'));
                            }
                        }
                    }
                }

                // Query all products with matching Stripe Product IDs
                Map<String, Product2> stripeProductIdToProductMap = new Map<String, Product2>();
                if (!stripeProductIds.isEmpty()) {
                    List<Product2> products = [
                        SELECT Id, Stripe_Product_ID__c, Name
                        FROM Product2
                        WHERE Stripe_Product_ID__c IN :stripeProductIds
                    ];
                    for (Product2 prod : products) {
                        stripeProductIdToProductMap.put(prod.Stripe_Product_ID__c, prod);
                    }
                }
                System.debug('stripeProductIdToProductMap--' + stripeProductIdToProductMap);

                for (Object item : lineData) {
                    Map<String, Object> lineItem = (Map<String, Object>) item;

                    Map<String, Object> pricing = lineItem.containsKey('pricing')
                        ? (Map<String, Object>) lineItem.get('pricing')
                        : null;
                    Map<String, Object> priceDetails = (pricing != null && pricing.containsKey('price_details'))
                        ? (Map<String, Object>) pricing.get('price_details')
                        : null;
                    String productStripeId = (priceDetails != null && priceDetails.containsKey('product'))
                        ? (String) priceDetails.get('product')
                        : null;
                    Decimal amount = lineItem.containsKey('amount') && lineItem.get('amount') != null
                        ? Decimal.valueOf((Integer) lineItem.get('amount')) / 100
                        : 0;
                    Integer quantity = lineItem.containsKey('quantity') && lineItem.get('quantity') != null
                        ? Integer.valueOf(lineItem.get('quantity'))
                        : 0;
                    Decimal unitPrice = (amount != 0 && quantity != 0) ? (amount / quantity) : 0;
                    Product2 matchingProduct = stripeProductIdToProductMap.get(productStripeId);

                    Stripe_Invoice_Line_Item__c line = new Stripe_Invoice_Line_Item__c();
                    line.Name = matchingProduct != null
                        ? matchingProduct.Name
                        : 'INV-LI-' + (String) lineItem.get('id');
                    line.Stripe_Invoice__c = invoiceID;
                    line.Stripe_Invoice_line_Item_Id__c = (String) lineItem.get('id');
                    line.Quantity__c = quantity;
                    line.Unit_Price__c = unitPrice;
                    line.Description__c = (String) lineItem.get('description');
                    line.Product__c = matchingProduct != null ? matchingProduct.Id : null;
                    line.Product_Name__c = matchingProduct != null ? matchingProduct.Name : null;

                    // Period handling
                    if (lineItem.containsKey('period')) {
                        Map<String, Object> period = (Map<String, Object>) lineItem.get('period');
                        long lineStartDate = (long) period.get('start');
                        long lineEndDate = (long) period.get('end');
                        line.Start_Date__c = toDateTime(lineStartDate);
                        line.End_Date__c = toDateTime(lineEndDate);
                    }

                    lineItems.add(line);
                }

                if (!lineItems.isEmpty()) {
                    upsert lineItems Stripe_Invoice_line_Item_Id__c;
                }

                // If invoice is paid, attach a payment transaction record
                if (status == 'paid') {
                    System.enqueueJob(new StripePaymentIntentQueueable(stripeInvoiceId), 5);
                }
            } else {
                System.debug('Failed to fetch invoice from Stripe. Status: ' + res.getStatusCode());
                throw new CalloutException('Failed to fetch invoice from Stripe. Status: ' + res.getStatusCode());
            }
        } catch (Exception ex) {
            System.debug('Error in StripeInvoiceQueueable: ' + ex.getMessage());
            Logger__c logger = new Logger__c(
                Name = 'Stripe Invoice Queueable Error',
                Message__c = ex.getMessage(),
                StackTrace__c = ex.getStackTraceString(),
                Status__c = 'Error',
                Apex_Class__c = 'StripeInvoiceQueueable',
                Apex_Method__c = 'execute',
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