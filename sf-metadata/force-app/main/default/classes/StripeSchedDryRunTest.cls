@IsTest(SeeAllData=true)
private class StripeSchedDryRunTest {
    private static final Id TARGET_QUOTE_ID = 'a2fWQ000008fR7hYAE';
    private static Integer priceCallCount = 0;
    private static String scheduleRequestBody;

    private class StripeSchedulerCalloutMock implements HttpCalloutMock {
        public HttpResponse respond(HttpRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(200);
            res.setHeader('Content-Type', 'application/json');

            if (req.getEndpoint().contains('/v1/prices')) {
                StripeSchedDryRunTest.priceCallCount++;
                res.setBody('{"id":"price_dry_run_' + StripeSchedDryRunTest.priceCallCount + '"}');
                return res;
            }

            if (req.getEndpoint().contains('/v1/subscription_schedules')) {
                StripeSchedDryRunTest.scheduleRequestBody = req.getBody();
                res.setBody('{"id":"sub_sched_dry_run"}');
                return res;
            }

            System.assert(false, 'Unexpected endpoint: ' + req.getEndpoint());
            return res;
        }
    }

    private static void runScenario(String billingFrequency, String paymentTerms, String expectedDaysUntilDue) {
        SBQQ__Quote__c quote = [
            SELECT Id, Billing_Frequency_Override__c, SBQQ__PaymentTerms__c
            FROM SBQQ__Quote__c
            WHERE Id = :TARGET_QUOTE_ID
            LIMIT 1
        ];

        quote.Billing_Frequency_Override__c = billingFrequency;
        quote.SBQQ__PaymentTerms__c = paymentTerms;
        update quote;

        priceCallCount = 0;
        scheduleRequestBody = null;
        Test.setMock(HttpCalloutMock.class, new StripeSchedulerCalloutMock());

        Test.startTest();
        StripeSubscriptionScheduler.createStripeSchedule(new List<Id>{ quote.Id });
        Test.stopTest();

        System.assertNotEquals(null, scheduleRequestBody, 'Expected the schedule request to be captured.');
        System.assertEquals(
            false,
            scheduleRequestBody.contains('billing_mode[type]=flexible'),
            'Future-start schedule payload should not force flexible billing.'
        );
        System.assertEquals(
            false,
            scheduleRequestBody.contains('phases[0][proration_behavior]=always_invoice'),
            'Future-start schedule payload should not add phase-level always_invoice.'
        );
        System.assertEquals(
            true,
            scheduleRequestBody.contains('metadata[subscription_schedule]=true'),
            'Future-start schedule payload should still identify scheduled subscriptions.'
        );
        System.assertEquals(
            true,
            scheduleRequestBody.contains(
                'default_settings[invoice_settings][days_until_due]=' + expectedDaysUntilDue
            ),
            'Expected the invoice due days to match the configured payment terms.'
        );
        System.assert(priceCallCount > 0, 'Expected recurring quote lines to create Stripe prices.');
    }

    @IsTest
    static void createStripeSchedule_quarterlyNet15_dryRun() {
        runScenario('Quarterly', 'Net 15', '15');
    }

    @IsTest
    static void createStripeSchedule_semiannualNet45_dryRun() {
        runScenario('Semiannual', 'Net 45', '45');
    }

    @IsTest
    static void createStripeSchedule_monthlyPrepayment_dryRun() {
        runScenario('Monthly', 'Prepayment', '0');
    }

    @IsTest
    static void createStripeSchedule_annualDueOnReceipt_dryRun() {
        runScenario('Annual', 'Due on receipt', '0');
    }
}
