public class StripeSubscriptionQueueable implements Queueable, Database.AllowsCallouts {
    String responseBody;
    String quoteId;

    public StripeSubscriptionQueueable(String responseBody, String quoteId) {
        this.responseBody = responseBody;
        this.quoteId = quoteId;
    }

    public void execute(QueueableContext context) {
        if (quoteId != null) {
            createSubscriptionWithQuote(responseBody, quoteId);
        } else {
            createSubscriptionWithoutQuote(responseBody);
        }
    }

    // Create Subscription when Subscription is created from Salesforce Quote
    private static void createSubscriptionWithQuote(String responseBody, String quoteId) {
        try {
            List<SBQQ__Quote__c> quoteList = [
                SELECT
                    Id,
                    SBQQ__StartDate__c,
                    SBQQ__ExpirationDate__c,
                    Expiration_Date__c,
                    SBQQ__EndDate__c,
                    SBQQ__Account__c,
                    Bill_To_Contact__c,
                    SBQQ__SubscriptionTerm__c,
                    SBQQ__Account__r.blng__BillToContact__c,
                    Billing_Frequency_Override__c,
                    SBQQ__Opportunity2__c
                FROM SBQQ__Quote__c
                WHERE Id = :quoteId
                LIMIT 1
            ];

            List<SBQQ__QuoteLine__c> quoteLines = [
                SELECT
                    Quantity_For_Stripe__c,
                    SBQQ__NetTotal__c,
                    SBQQ__Product__c,
                    MRR__c,
                    Monthly_Total__c,
                    Stripe_Price_ID__c,
                    SBQQ__SubscriptionType__c,
                    SBQQ__SubscriptionTerm__c,
                    Billing_Frequency_Override__c,
                    Annual_Total__c
                FROM SBQQ__QuoteLine__c
                WHERE SBQQ__Quote__c = :quoteList[0].Id AND Stripe_Subscription_Type__c != 'One-time'
                LIMIT 20
            ];

            system.debug('--quoteItems-' + quoteLines);

            Map<String, Object> payload = (Map<String, Object>) JSON.deserializeUntyped(responseBody);
            system.debug('--payload--' + payload);
            Map<String, Object> metadata = (Map<String, Object>) payload.get('metadata');
            system.debug('--metadata--' + metadata);
            String subscriptionSource = metadata != null &&
                metadata.containsKey('subscription_source') &&
                metadata.get('subscription_source') != null
                ? String.valueOf(metadata.get('subscription_source'))
                : null;
            Boolean subscriptionSchedule = metadata.get('subscription_schedule') != null
                ? Boolean.valueOf((String) metadata.get('subscription_schedule'))
                : false;
            Boolean isRenewalSubscription = metadata.get('auto_renewal') != null
                ? Boolean.valueOf((String) metadata.get('auto_renewal'))
                : false;
            Map<String, Object> items = (Map<String, Object>) payload.get('items');
            List<Object> subscriptionItems = (List<Object>) items.get('data');
            System.debug('Subscription Items: ' + subscriptionItems);
            System.debug('Total subscription items: ' + subscriptionItems.size());

            // Extract basic fields from payload
            String scheduleId = (String) (payload.containsKey('schedule') ? payload.get('schedule') : null);
            System.debug('Extracted Schedule Id: ' + scheduleId);
            String subscriptionId = (String) payload.get('id');
            String customerId = (String) payload.get('customer');
            String latestInvoice = (String) payload.get('latest_invoice');
            String collectionMethod = (String) payload.get('collection_method');
            String status = (String) payload.get('status');

            // Extract date fields as Long
            Long billingCycleAnchorUnix = payload.containsKey('billing_cycle_anchor')
                ? (Long) payload.get('billing_cycle_anchor')
                : null;
            Long cancelAtUnix = payload.containsKey('cancel_at') ? (Long) payload.get('cancel_at') : null;
            Long canceledAtUnix = payload.containsKey('canceled_at') ? (Long) payload.get('canceled_at') : null;
            Long createdUnix = payload.containsKey('created') ? (Long) payload.get('created') : null;
            Long currentPeriodStartUnix = payload.containsKey('current_period_start')
                ? (Long) payload.get('current_period_start')
                : null;
            Long currentPeriodEndUnix = payload.containsKey('current_period_end')
                ? (Long) payload.get('current_period_end')
                : null;
            Long startDateUnix = payload.containsKey('start_date') ? (Long) payload.get('start_date') : null;

            // Log extracted values
            System.debug('Subscription ID: ' + subscriptionId);
            System.debug('Customer ID: ' + customerId);
            System.debug('Latest Invoice: ' + latestInvoice);
            System.debug('Status: ' + status);

            Datetime billingCycleAnchor = toDateTime(billingCycleAnchorUnix);
            Date cancelAt = date.valueof(toDateTime(cancelAtUnix));
            Datetime canceledAt = toDateTime(canceledAtUnix);
            Datetime created = toDateTime(createdUnix);
            Datetime currentPeriodStart = toDateTime(currentPeriodStartUnix);
            Datetime currentPeriodEnd = toDateTime(currentPeriodEndUnix);
            Date startDate = date.valueof(toDateTime(startDateUnix));
            datetime subStartDate = toDateTime(startDateUnix);
            System.debug('Billing Cycle Anchor: ' + billingCycleAnchor);
            System.debug('Cancel At: ' + cancelAt);
            System.debug('Canceled At: ' + canceledAt);
            System.debug('Created: ' + created);
            System.debug('Current Period Start: ' + currentPeriodStart);
            System.debug('Current Period End: ' + currentPeriodEnd);
            System.debug('Start Date: ' + startDate);

            String latestChangeReason;

            if (isRenewalSubscription) {
                latestChangeReason = 'Auto Renewal Subscription Creaeted';
            } else {
                latestChangeReason = 'Subscription Created From Salesforce';
            }

            // Create Contract
            Contract contract = new Contract(
                AccountId = quoteList[0].SBQQ__Account__c,
                SBQQ__Quote__c = quoteId,
                SBQQ__Opportunity__c = quoteList[0].SBQQ__Opportunity2__c,
                Stripe_Subscription_ID__c = subscriptionId,
                Stripe_Customer_ID__c = customerId,
                Stripe_latest_Invoice_Id__c = latestInvoice,
                Collection_Method__c = collectionMethod,
                Stripe_Subscription_Source__c = subscriptionSource,
                Stripe_Status__c = status,
                Stripe_Subscription_URL__c = 'https://dashboard.stripe.com/subscriptions/' + subscriptionId,
                StartDate = startDate,
                ContractTerm = calculateContractTerm(startDate, cancelAt),
                Stripe_Billing_Date__c = date.valueof(billingCycleAnchor),
                CustomerSignedId = quoteList[0].SBQQ__Account__r.blng__BillToContact__c,
                Billing_Frequency_Override__c = quoteList[0].Billing_Frequency_Override__c,
                Created_From_Stripe__c = subscriptionSource != 'salesforce' ? true : false,
                Latest_Change_Reason__c = latestChangeReason,
                Stripe_Subscription_Schedule_ID__c = scheduleId,
                Stripe_Subscription_Start_Date__c = String.valueOf(startDateUnix)
            );

            if (cancelAt != null) {
                contract.EndDate = cancelAt;
            }

            upsert contract Stripe_Subscription_ID__c;

            if (status == 'canceled') {
                contract.Status = 'canceled';
            } else {
                contract.Status = 'Activated';
            }

            StripeTriggerHandler.enableBypass('Contract');
            update contract;
            StripeTriggerHandler.disableBypass('Contract');

            // Create Subscription Items
            List<SBQQ__Subscription__c> subscriptionItemsToInsert = new List<SBQQ__Subscription__c>();
            Map<String, SBQQ__QuoteLine__c> priceIdToQuoteLineMap = new Map<String, SBQQ__QuoteLine__c>();

            for (SBQQ__QuoteLine__c ql : quoteLines) {
                priceIdToQuoteLineMap.put(ql.Stripe_Price_ID__c, ql);
            }
            System.debug('Price ID to Quote Line Map: ' + priceIdToQuoteLineMap);
            System.debug('Total Quote Line Maps: ' + priceIdToQuoteLineMap.size());

            // Collect all unique product IDs from subscription items
            Set<String> stripeProductIds = new Set<String>();
            for (Object itemObj : subscriptionItems) {
                Map<String, Object> item = (Map<String, Object>) itemObj;
                Map<String, Object> price = (Map<String, Object>) item.get('price');
                String productId = (String) price.get('product');
                stripeProductIds.add(productId);
            }

            // Query Product2 records based on collected product IDs
            Map<String, Product2> stripeProductIdToProductMap = new Map<String, Product2>();
            if (!stripeProductIds.isEmpty()) {
                List<Product2> products = [
                    SELECT Id, Name, Stripe_Product_ID__c
                    FROM Product2
                    WHERE Stripe_Product_ID__c IN :stripeProductIds
                ];
                for (Product2 prod : products) {
                    stripeProductIdToProductMap.put(prod.Stripe_Product_ID__c, prod);
                }
            }
            System.debug('Stripe Product ID to Product Map: ' + stripeProductIdToProductMap);

            for (Object itemObj : subscriptionItems) {
                Map<String, Object> item = (Map<String, Object>) itemObj;
                Map<String, Object> price = (Map<String, Object>) item.get('price');
                Map<String, Object> recurring = (Map<String, Object>) price.get('recurring');
                String priceId = (String) price.get('id');
                System.debug('Processing Price ID: ' + priceId);
                String productId = (String) price.get('product');
                String interval = recurring != null && recurring.containsKey('interval')
                    ? (String) recurring.get('interval')
                    : null;
                Integer intervalCount = recurring != null && recurring.containsKey('interval_count')
                    ? (Integer) recurring.get('interval_count')
                    : 1;
                System.debug('Processing Price ID: ' + priceId);
                System.debug('Processing Product ID: ' + productId);

                Integer quantity = (Integer) item.get('quantity');
                Decimal unitAmount = ((Decimal) price.get('unit_amount')) / 100;
                Decimal monthlyAmount = calculateMonthlyAmount(unitAmount, interval, intervalCount);

                // Calculate values directly from Stripe response
                Decimal stripeMRR = monthlyAmount * quantity; // monthly value
                Decimal stripeARR = stripeMRR * 12; // annual value
                Integer contractTerm = contract.ContractTerm != null ? contract.ContractTerm : 0;
                Decimal customerPrice = contractTerm > 0 ? (stripeMRR * contractTerm) : null;

                Product2 matchingProduct = stripeProductIdToProductMap.get(productId);
                System.debug('Matching Product: ' + matchingProduct);

                SBQQ__QuoteLine__c matchingQuoteLine = priceIdToQuoteLineMap.get(priceId);
                System.debug('Matching Quote Line: ' + matchingQuoteLine);

                SBQQ__Subscription__c sub = new SBQQ__Subscription__c(
                    SBQQ__Contract__c = contract.Id,
                    SBQQ__Account__c = quoteList[0].SBQQ__Account__c,
                    Stripe_Subscription_ID__c = (String) item.get('id'),
                    Stripe_Price_ID__c = priceId,
                    Stripe_Product_ID__c = productId,
                    SBQQ__Quantity__c = quantity,
                    Stripe_Interval__c = interval,
                    Stripe_Activate__c = (Boolean) price.get('active'),
                    Status__c = status,
                    Stripe_Start_Date__c = toDateTime((Long) item.get('current_period_start')).date(),
                    Stripe_End_Date__c = toDateTime((Long) item.get('current_period_end')).date(),
                    SBQQ__SubscriptionStartDate__c = startDate,
                    SBQQ__SubscriptionEndDate__c = cancelAt,
                    Stripe_Billing_Date__c = date.valueof(billingCycleAnchor),
                    Latest_Change_Reason__c = latestChangeReason,
                    SBQQ__NetPrice__c = monthlyAmount,
                    SBQQ__ListPrice__c = unitAmount,
                    SBQQ__CustomerPrice__c = customerPrice,
                    SBQQ__Product__c = matchingProduct != null ? matchingProduct.Id : null,
                    SBQQ__BillingFrequency__c = getBillingFrequency(interval, intervalCount),
                    Billing_Frequency_Override__c = getBillingFrequency(interval, intervalCount),
                    Stripe_Monthly_Value__c = stripeMRR,
                    Stripe_Subscription_Term__c = contractTerm,
                    Stripe_ARR__c = stripeARR
                );

                // Only set quote line–related fields if matchingQuoteLine exists
                if (matchingQuoteLine != null) {
                    sub.SBQQ__QuoteLine__c = matchingQuoteLine.Id;
                }
                subscriptionItemsToInsert.add(sub);
            }

            System.debug('Subscription Items to Insert: ' + subscriptionItemsToInsert);
            System.debug('Total Subscription Items to Insert: ' + subscriptionItemsToInsert.size());

            if (!subscriptionItemsToInsert.isEmpty()) {
                upsert subscriptionItemsToInsert SBQQ__Subscription__c.Stripe_Subscription_ID__c;
                System.debug('Upserted ' + subscriptionItemsToInsert.size() + ' SBQQ__Subscription__c records');

                if (status != 'canceled') {
                    Stripe_Capture_Invoice_Preview__e event = new Stripe_Capture_Invoice_Preview__e(
                        StripeId__c = subscriptionId,
                        PreviewType__c = 'SUBSCRIPTION'
                    );

                    EventBus.publish(event);
                }
            } else {
                System.debug('No subscription records to insert');
                return;
            }
        } catch (exception ex) {
            Logger__c logger = new Logger__c(
                Name = 'Stripe Subscription Upsert Error',
                Message__c = ex.getMessage(),
                StackTrace__c = ex.getStackTraceString(),
                Status__c = 'Error',
                Apex_Class__c = 'StripeSubscriptionQueueable',
                Apex_Method__c = 'createSubscriptionWithQuote',
                Object_Name__c = 'Contract'
            );
            insert logger;
        }
    }

    // Create Subscription when Subscription is created manually from Stripe Portal
    private static void createSubscriptionWithoutQuote(String responseBody) {
        try {
            Map<String, Object> payload = (Map<String, Object>) JSON.deserializeUntyped(responseBody);
            system.debug('--payload--' + payload);
            Map<String, Object> metadata = (Map<String, Object>) payload.get('metadata');
            system.debug('--metadata--' + metadata);
            String subscriptionSource = metadata != null &&
                metadata.containsKey('subscription_source') &&
                metadata.get('subscription_source') != null
                ? String.valueOf(metadata.get('subscription_source'))
                : null;
            Boolean subscriptionSchedule = metadata.get('subscription_schedule') != null
                ? Boolean.valueOf((String) metadata.get('subscription_schedule'))
                : false;
            Boolean isRenewalSubscription = metadata.get('auto_renewal') != null
                ? Boolean.valueOf((String) metadata.get('auto_renewal'))
                : false;
            Map<String, Object> items = (Map<String, Object>) payload.get('items');
            List<Object> subscriptionItems = (List<Object>) items.get('data');
            System.debug('Subscription Items: ' + subscriptionItems);
            System.debug('Total subscription items: ' + subscriptionItems.size());

            // Extract basic fields from payload
            String scheduleId = (String) (payload.containsKey('schedule') ? payload.get('schedule') : null);
            System.debug('Extracted Schedule Id: ' + scheduleId);
            String subscriptionId = (String) payload.get('id');
            String customerId = (String) payload.get('customer');
            String latestInvoice = (String) payload.get('latest_invoice');
            String collectionMethod = (String) payload.get('collection_method');
            String status = (String) payload.get('status');

            // Extract date fields as Long
            Long billingCycleAnchorUnix = payload.containsKey('billing_cycle_anchor')
                ? (Long) payload.get('billing_cycle_anchor')
                : null;
            Long cancelAtUnix = payload.containsKey('cancel_at') ? (Long) payload.get('cancel_at') : null;
            Long trialEndUnix = payload.containsKey('trial_end') ? (Long) payload.get('trial_end') : null;
            Long canceledAtUnix = payload.containsKey('canceled_at') ? (Long) payload.get('canceled_at') : null;
            Long createdUnix = payload.containsKey('created') ? (Long) payload.get('created') : null;
            Long currentPeriodStartUnix = payload.containsKey('current_period_start')
                ? (Long) payload.get('current_period_start')
                : null;
            Long currentPeriodEndUnix = payload.containsKey('current_period_end')
                ? (Long) payload.get('current_period_end')
                : null;
            Long startDateUnix = payload.containsKey('start_date') ? (Long) payload.get('start_date') : null;

            // Log extracted values
            System.debug('Subscription ID: ' + subscriptionId);
            System.debug('Customer ID: ' + customerId);
            System.debug('Latest Invoice: ' + latestInvoice);
            System.debug('Status: ' + status);

            Datetime billingCycleAnchor = toDateTime(billingCycleAnchorUnix);
            Date cancelAt = cancelAtUnix != null
                ? date.valueof(toDateTime(cancelAtUnix))
                : date.valueOf(toDateTime(trialEndUnix));
            Datetime canceledAt = toDateTime(canceledAtUnix);
            Datetime created = toDateTime(createdUnix);
            Datetime currentPeriodStart = toDateTime(currentPeriodStartUnix);
            Datetime currentPeriodEnd = toDateTime(currentPeriodEndUnix);
            Date startDate = date.valueof(toDateTime(startDateUnix));
            datetime subStartDate = toDateTime(startDateUnix);
            System.debug('Billing Cycle Anchor: ' + billingCycleAnchor);
            System.debug('Cancel At: ' + cancelAt);
            System.debug('Canceled At: ' + canceledAt);
            System.debug('Created: ' + created);
            System.debug('Current Period Start: ' + currentPeriodStart);
            System.debug('Current Period End: ' + currentPeriodEnd);
            System.debug('Start Date: ' + startDate);

            String contractBillingFrequency;

            if (!subscriptionItems.isEmpty()) {
                Map<String, Object> firstItem = (Map<String, Object>) subscriptionItems[0];
                Map<String, Object> price = (Map<String, Object>) firstItem.get('price');
                Map<String, Object> recurring = (Map<String, Object>) price.get('recurring');

                String interval = recurring != null && recurring.containsKey('interval')
                    ? (String) recurring.get('interval')
                    : null;

                Integer intervalCount = recurring != null && recurring.containsKey('interval_count')
                    ? (Integer) recurring.get('interval_count')
                    : 1;

                contractBillingFrequency = getBillingFrequency(interval, intervalCount);
            }

            // if (contractBillingFrequency == null) {
            //     throw new AuraHandledException('Unable to determine billing frequency from Stripe price.');
            // }

            String latestChangeReason;

            if (subscriptionSource == 'salesforce') {
                if (isRenewalSubscription)
                    latestChangeReason = 'Contract Renewed From Salesforce';
                else
                    latestChangeReason = 'Contract Created From Salesforce';
            } else if (subscriptionSource == 'self_service' || subscriptionSource == 'amazon') {
                latestChangeReason = 'Contract Created From Stripe Self-Service Portal';
            } else if (subscriptionSource == null) {
                latestChangeReason = 'Contract Created From Stripe Manually';
            } else {
                latestChangeReason = 'Contract Created From Stripe';
            }
            System.debug('Latest Change Reason: ' + latestChangeReason);

            // Fetch Account based on Customer ID
            List<Account> accts = [
                SELECT Id, Name, blng__BillToContact__c
                FROM Account
                WHERE Stripe_Customer_ID__c = :customerId
            ];
            System.debug('accts--' + accts);

            Id accountId = accts.size() > 0 ? accts[0].Id : null;
            System.debug('Account ID: ' + accountId);
            if (accountId == null) {
                throw new DmlException('No Account found with Stripe Customer ID: ' + customerId);
            }

            // Create Contract
            Contract contract = new Contract(
                AccountId = accountId,
                Stripe_Subscription_ID__c = subscriptionId,
                Stripe_Customer_ID__c = customerId,
                Stripe_latest_Invoice_Id__c = latestInvoice,
                Collection_Method__c = collectionMethod,
                Stripe_Subscription_Source__c = subscriptionSource != null ? subscriptionSource : 'stripe',
                Stripe_Status__c = status,
                Stripe_Subscription_URL__c = 'https://dashboard.stripe.com/subscriptions/' + subscriptionId,
                StartDate = startDate,
                ContractTerm = calculateContractTerm(startDate, cancelAt),
                // SBQQ__Evergreen__c = calculateContractTerm(startDate, cancelAt) > 0 ? false : true,
                Stripe_Billing_Date__c = date.valueof(billingCycleAnchor),
                CustomerSignedId = accts.size() > 0 ? accts[0].blng__BillToContact__c : null,
                Billing_Frequency_Override__c = contractBillingFrequency,
                Created_From_Stripe__c = subscriptionSource != 'salesforce' ? true : false,
                Latest_Change_Reason__c = latestChangeReason,
                Stripe_Subscription_Schedule_ID__c = scheduleId,
                Stripe_Subscription_Start_Date__c = String.valueOf(startDateUnix)
            );

            if (cancelAt != null) {
                contract.EndDate = cancelAt;
            }

            upsert contract Stripe_Subscription_ID__c;

            if (status == 'canceled') {
                contract.Status = 'canceled';
            } else {
                contract.Status = 'Activated';
            }

            StripeTriggerHandler.enableBypass('Contract');
            update contract;
            StripeTriggerHandler.disableBypass('Contract');

            // Create Subscription Items
            List<SBQQ__Subscription__c> subscriptionItemsToInsert = new List<SBQQ__Subscription__c>();
            // Collect all unique product IDs from subscription items
            Set<String> stripeProductIds = new Set<String>();
            for (Object itemObj : subscriptionItems) {
                Map<String, Object> item = (Map<String, Object>) itemObj;
                Map<String, Object> price = (Map<String, Object>) item.get('price');
                String productId = (String) price.get('product');
                stripeProductIds.add(productId);
            }

            // Query Product2 records based on collected product IDs
            Map<String, Product2> stripeProductIdToProductMap = new Map<String, Product2>();
            if (!stripeProductIds.isEmpty()) {
                List<Product2> products = [
                    SELECT Id, Name, Stripe_Product_ID__c
                    FROM Product2
                    WHERE Stripe_Product_ID__c IN :stripeProductIds
                ];
                for (Product2 prod : products) {
                    stripeProductIdToProductMap.put(prod.Stripe_Product_ID__c, prod);
                }
            }
            System.debug('Stripe Product ID to Product Map: ' + stripeProductIdToProductMap);

            for (Object itemObj : subscriptionItems) {
                Map<String, Object> item = (Map<String, Object>) itemObj;
                Map<String, Object> price = (Map<String, Object>) item.get('price');
                Map<String, Object> recurring = (Map<String, Object>) price.get('recurring');
                String priceId = (String) price.get('id');
                String productId = (String) price.get('product');
                String interval = recurring != null && recurring.containsKey('interval')
                    ? (String) recurring.get('interval')
                    : null;
                Integer intervalCount = recurring != null && recurring.containsKey('interval_count')
                    ? (Integer) recurring.get('interval_count')
                    : 1;
                System.debug('Processing Price ID: ' + priceId);
                System.debug('Processing Product ID: ' + productId);

                Product2 matchingProduct = stripeProductIdToProductMap.get(productId);
                System.debug('Matching Product: ' + matchingProduct);

                Integer quantity = (Integer) item.get('quantity');
                Decimal unitAmount = ((Decimal) price.get('unit_amount')) / 100;
                Decimal monthlyAmount = calculateMonthlyAmount(unitAmount, interval, intervalCount);

                // Calculate values directly from Stripe response
                Decimal stripeMRR = monthlyAmount * quantity; // monthly value
                Decimal stripeARR = stripeMRR * 12; // annual value
                Integer contractTerm = contract.ContractTerm != null ? contract.ContractTerm : null;
                Decimal customerPrice = contractTerm > 0 ? (stripeMRR * contractTerm) : null;

                SBQQ__Subscription__c sub = new SBQQ__Subscription__c(
                    SBQQ__Contract__c = contract.Id,
                    SBQQ__Account__c = accountId,
                    Stripe_Subscription_ID__c = (String) item.get('id'),
                    Stripe_Price_ID__c = priceId,
                    Stripe_Product_ID__c = productId,
                    SBQQ__Quantity__c = quantity,
                    Stripe_Interval__c = interval,
                    Stripe_Activate__c = (Boolean) price.get('active'),
                    Status__c = status,
                    Stripe_Start_Date__c = toDateTime((Long) item.get('current_period_start')).date(),
                    Stripe_End_Date__c = toDateTime((Long) item.get('current_period_end')).date(),
                    SBQQ__SubscriptionStartDate__c = startDate,
                    SBQQ__SubscriptionEndDate__c = cancelAt,
                    Stripe_Billing_Date__c = date.valueof(billingCycleAnchor),
                    Latest_Change_Reason__c = latestChangeReason,
                    SBQQ__NetPrice__c = monthlyAmount,
                    SBQQ__ListPrice__c = unitAmount,
                    SBQQ__CustomerPrice__c = customerPrice,
                    SBQQ__Product__c = matchingProduct != null ? matchingProduct.Id : null,
                    SBQQ__BillingFrequency__c = getBillingFrequency(interval, intervalCount),
                    Billing_Frequency_Override__c = getBillingFrequency(interval, intervalCount),
                    Stripe_Monthly_Value__c = stripeMRR,
                    Stripe_Subscription_Term__c = contractTerm,
                    Stripe_ARR__c = stripeARR
                );

                subscriptionItemsToInsert.add(sub);
            }

            System.debug('Subscription Items to Insert: ' + subscriptionItemsToInsert);
            System.debug('Total Subscription Items to Insert: ' + subscriptionItemsToInsert.size());

            if (!subscriptionItemsToInsert.isEmpty()) {
                upsert subscriptionItemsToInsert SBQQ__Subscription__c.Stripe_Subscription_ID__c;
                System.debug('Upserted ' + subscriptionItemsToInsert.size() + ' SBQQ__Subscription__c records');

                if (status != 'canceled') {
                    Stripe_Capture_Invoice_Preview__e event = new Stripe_Capture_Invoice_Preview__e(
                        StripeId__c = subscriptionId,
                        PreviewType__c = 'SUBSCRIPTION'
                    );

                    EventBus.publish(event);
                }
            } else {
                System.debug('No subscription records to insert');
                return;
            }
        } catch (exception ex) {
            Logger__c logger = new Logger__c(
                Name = 'Subscription Creation Error Without Quote',
                Message__c = ex.getMessage(),
                StackTrace__c = ex.getStackTraceString(),
                Status__c = 'Error',
                Apex_Class__c = 'StripeSubscriptionQueueable',
                Apex_Method__c = 'createSubscriptionWithoutQuote',
                Object_Name__c = 'Contract'
            );
            insert logger;
        }
    }

    private static Datetime toDateTime(Long unixTs) {
        if (unixTs == null)
            return null;
        return Datetime.newInstance(unixTs * 1000);
    }

    private static Integer calculateContractTerm(Date startDate, Date endDate) {
        if (startDate == null || endDate == null) {
            return null;
        }

        Integer monthsBetween = startDate.monthsBetween(endDate);
        return monthsBetween > 0 ? monthsBetween : null;
    }

    // Helper method to get billing frequency from Stripe interval and interval count
    public static String getBillingFrequency(String interval, Integer intervalCount) {
        if (interval == 'month') {
            if (intervalCount == 1) {
                return 'Monthly';
            } else if (intervalCount == 3) {
                return 'Quarterly';
            } else if (intervalCount == 6) {
                return 'Semiannual';
            }
        } else if (interval == 'year') {
            if (intervalCount == 1) {
                return 'Annual';
            } else if (intervalCount == 2) {
                return '2-Year';
            } else if (intervalCount == 3) {
                return '3-Year';
            }
        }

        // Default fallback
        return null;
    }

    private static Decimal calculateMonthlyAmount(Decimal unitAmount, String interval, Integer intervalCount) {
        if (interval == 'month') {
            return unitAmount / intervalCount;
        } else if (interval == 'year') {
            return unitAmount / (12 * intervalCount);
        }

        // Default fallback
        return unitAmount;
    }
}
