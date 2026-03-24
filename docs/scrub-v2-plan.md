ok - now we have to devise a plan that is composed of several pieces.                                                                        
                                                                                                                                               
ideally, this subscriptions dashboard gives us key insights on our subscription data: number of subs active, cancelled, ended, upcoming (if    
any), etc - this will be the main subscriptions view                                                                                           
                                                                                                                                               
now, the scrub needs to aggregate data to show us how healthy that subscription is, and it is comprised of a few key items:                    
                                                                                                                                               
1. the ARR previous to the cancelled subscriptions in agiven month need to be the total ARR for that customer at the end of the last day of    
the previous month - this is where finance snapshots it. so the "pre-existing" column should be labeled ARR as of (last day of previous month) 
 and then calculated based on what subscriptions were active at that time, and their total values (composing that ARR snapshot)                
                                                                                                                                               
2. the canceled ARR for the customer comes second, in aggregate as of right now, but let;s drop this subscription dropdown - let;s do a side   
card just like in customers/[id]/360 - it opens a panel with relevant information. the card pop-up should reveal 4 key elements of each        
canceled subscription:                                                                                                                         
- the subscription items that were cancelled                                                                                                   
- last invoice paid with service period (and add a check if that paid invoice covers the service period of the cancelled sub or not. i.e.      
customer paid for 1 year and cancels 8 months in, until when are the ciovered for?                                                             
- then we need to see if the last 12 months of payments (including salesforce invoice records AND stripe invoice records (post-migration)      
cover the subscription term until the time of cancellation or period end. we can enhance this later                                            
                                                                                                                                               
the end game is to be able to see at a glance:                                                                                                 
                                                                                                                                               
- when did this subscription churn?                                                                                                            
- what are the other active subscriptions?                                                                                                     
- do all active subscriptions have a corresponding contract in sfdc?                                                                           
- do all active subscription lines have a corresponding subscription in salesforce? (this is usually detected by ID sharing between the        
systems)                                                                                                                                       
- does this subscription have enough invoice coverage? what gaps do we have from the invoice aggregate?                                        
                                                                                                                                               
let;s give it a first try - enter plan mode and give me your best idea to approach this                                                        

⏺ Entered plan mode
  Claude is now exploring and designing an implementation approach.

⏺ 2 Explore agents finished (ctrl+o to expand)
   ├─ Explore subscription/invoice data models · 29 tool uses · 73.2k tokens
   │  ⎿  Done
   └─ Explore existing scrub + dashboard UI · 34 tool uses · 65.1k tokens
      ⎿  Done

⏺ Now let me design the plan:

⏺ Plan(Design subscription scrub plan)
  ⎿  Done (23 tool uses · 50.7k tokens · 2m 15s)
  (ctrl+o to expand)

⏺ Now let me write the plan file:

⏺ Read 1 file (ctrl+o to expand)

⏺ Updated plan
  ⎿  /plan to preview

───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Ready to code?
                                                                                                                                               
 Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 Plan: Subscription Scrub v2 — Health Dashboard with Detail Panel

 Context

 The scrub page (/subscriptions/scrub) currently shows a per-month table of customers with cancellations, classifying them as
 churned/contracted/offset/expanded. However:

 1. The "pre-existing ARR" column shows currently active subs created before the month — not a true point-in-time snapshot of what ARR the
 customer had on the last day of the previous month (which is how finance measures it)
 2. The accordion expansion shows raw sub IDs but no actionable insight — no invoice coverage, no SF contract correlation, no service gap
 detection
 3. Scrub isn't in the sidebar nav

 Goal: Turn the scrub into a subscription health dashboard that answers at-a-glance: When did this sub churn? Is the customer covered through
 paid invoices? Do active subs have SF contracts? Are there revenue gaps?

 ---
 Phase 1: ARR Snapshot Column

 What changes: Replace "Pre-existing" with "ARR as of {last day of prev month}" — a point-in-time snapshot.

 File: apps/console/src/lib/queries/subscription-scrub.ts

 Current approach: Queries active subs with created < monthStart — misses subs that were active on Jan 31 but have since been canceled in Feb.

 New query: Find all subs that were active on the snapshot date (last day of prev month), regardless of current status:
 WHERE sub.customer_id = ANY($1)
   AND sub.start_date <= $2                              -- existed by snapshot date
   AND (sub.canceled_at IS NULL OR sub.canceled_at > $2) -- not yet canceled
   AND sub.status NOT IN ('incomplete', 'incomplete_expired')
 Where $2 = lastDayPrevMonth = new Date(Date.UTC(year, mon - 1, 0, 23, 59, 59, 999)).

 Type renames: preExistingSubs → snapshotSubs, preExistingArrDollars → snapshotArrDollars. Add snapshotDate: string to ScrubSummary.

 Table header: Dynamic label: "ARR as of Jan 31" (computed from month prop).

 Files:
 - lib/queries/subscription-scrub.ts — new snapshot query + type renames
 - scrub/scrub-table.tsx — column label + field references
 - scrub/scrub-section.tsx — pass month to ScrubTable

 ---
 Phase 2: Scrub Detail Server Action

 New file: apps/console/src/lib/queries/subscription-scrub-detail.ts

 Exports getScrubDetail(customerId: string, month: string) — fetched lazily when a row is clicked.

 Return type: ScrubDetailData

 interface ScrubDetailData {
   customerName: string;
   stripeCustomerId: string;
   canceledSubscriptions: CanceledSubDetail[];
   activeSubscriptions: ActiveSubDetail[];
 }

 Section A: Canceled Sub Items

 Per canceled sub (in the scrub month), fetch its StripeSubscriptionItem rows:
 SELECT si.*, sub.canceled_at
 FROM stripe_subscription_items si
 JOIN stripe_subscriptions sub ON sub.id = si.subscription_id
 WHERE sub.customer_id = $1 AND sub.status = 'canceled'
   AND sub.canceled_at >= $2 AND sub.canceled_at < $3
 Include: productName, quantity, unitAmount, billingInterval, ARR (computed), sfContractLineId, correlationStatus.

 Section B: Last Invoice Coverage

 Per canceled sub, find last paid invoice:
 SELECT * FROM stripe_invoices
 WHERE subscription_id = $1 AND status = 'paid'
 ORDER BY period_end DESC LIMIT 1
 Coverage check: Compare invoice.periodEnd vs sub.canceledAt:
 - periodEnd > canceledAt → "Covered until {periodEnd}" (green badge)
 - periodEnd <= canceledAt → "Gap: paid through {periodEnd}, canceled {canceledAt}" (red badge)
 - Calculate remaining covered months

 Section C: 12-Month Invoice History

 Batch query per customer (not per sub — avoids N+1):
 SELECT subscription_id,
        DATE_TRUNC('month', period_start) AS month,
        COUNT(*) AS cnt, SUM(amount_paid) AS total
 FROM stripe_invoices
 WHERE subscription_id = ANY($subIds) AND status = 'paid'
   AND period_start >= NOW() - INTERVAL '12 months'
 GROUP BY subscription_id, month ORDER BY month
 Render as month grid per sub. Flag months with no invoice.

 Section D: Active Sub Context with SF Correlation

 Active subs for the same customer, joined with SF data:
 -- Subs with contract match
 SELECT sub.*, sf.id AS sf_contract_id, sf.status AS sf_status
 FROM stripe_subscriptions sub
 LEFT JOIN sf_contracts sf ON sf.stripe_subscription_id = sub.id
 WHERE sub.customer_id = $1 AND sub.status IN ('active','trialing','past_due')

 -- Items with SF line match
 SELECT si.*, scl.id AS sf_line_id, scl.status AS sf_line_status
 FROM stripe_subscription_items si
 LEFT JOIN sf_contract_lines scl ON scl.stripe_sub_item_id = si.id
 WHERE si.subscription_id = ANY($activeSubIds)
 Status: "SF Matched" / "No SF Contract" / "Partial" (contract exists but not all items have lines).

 ---
 Phase 3: Sheet Component

 New file: apps/console/src/app/(app)/subscriptions/scrub/scrub-detail-sheet.tsx

 Uses existing Sheet from @/components/ui/sheet (right-side, sm:max-w-2xl for width).

 Data flow: Client component → calls server action getScrubDetail() on open → loading skeleton → render four DetailCard sections.

 Layout:
 SheetHeader: Customer Name + Stripe ID

 ScrollArea:
   DetailCard "Canceled Subscriptions" (count badge)
     Per sub: sub ID, canceled date, item table (product, qty, price, ARR, SF badge)

   DetailCard "Invoice Coverage"
     Per sub: last invoice info, coverage badge (green/red), months remaining

   DetailCard "Payment History (12mo)"
     Per sub: month grid with amounts, gap months in red

   DetailCard "Active Subscriptions" (count badge)
     Per sub: sub ID, status, SF contract match badge
     Per item: product, qty, ARR, SF line correlation badge

 Reuse: DetailCard/DetailRow from @/components/omni/detail-card, Badge, formatDollars, formatDate, formatCurrency.

 ---
 Phase 4: Wire Sheet into Table

 File: scrub/scrub-table.tsx

 - Keep the accordion rows for quick expand/collapse of summary data
 - Add a "View Details" button in each row that opens the Sheet
 - State: selectedCustomerId + selectedMonth
 - Render <ScrubDetailSheet> once at bottom of component
 - The accordion shows the quick summary (sub IDs, ARR); the Sheet shows the deep-dive

 ---
 Phase 5: Sidebar Nav

 File: apps/console/src/components/sidebar.tsx

 Add "Scrub" under Stripe > Subscriptions children:
 { label: "Scrub", href: "/subscriptions/scrub", icon: <Search className="size-3.5" /> }

 ---
 Files Summary

 ┌──────────────────────────────────────────┬───────────────────────────────────────────────────────────┐
 │                   File                   │                          Action                           │
 ├──────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ lib/queries/subscription-scrub.ts        │ Modify — point-in-time snapshot query, rename types       │
 ├──────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ lib/queries/subscription-scrub-detail.ts │ New — lazy detail fetch (items, invoices, SF correlation) │
 ├──────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ scrub/scrub-table.tsx                    │ Modify — dynamic column label, add Sheet trigger button   │
 ├──────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ scrub/scrub-detail-sheet.tsx             │ New — Sheet with 4 DetailCard sections                    │
 ├──────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ scrub/scrub-section.tsx                  │ Modify — pass month to table                              │
 ├──────────────────────────────────────────┼───────────────────────────────────────────────────────────┤
 │ components/sidebar.tsx                   │ Modify — add Scrub nav entry                              │
 └──────────────────────────────────────────┴───────────────────────────────────────────────────────────┘

 ---
 Verification

 1. Navigate to /subscriptions/scrub → verify "ARR as of Jan 31" column shows correct point-in-time values
 2. Click "View Details" on a customer with canceled subs → Sheet opens with all 4 sections
 3. Verify invoice coverage badges: find a customer with a paid annual invoice and mid-term cancellation → should show "Covered until X"
 4. Verify SF correlation: find a sub with sfContractLineId populated → should show "SF Matched"
 5. Check sidebar shows "Scrub" under Subscriptions
 6. pnpm build passes clean
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌

 Claude has written up a plan and is ready to execute. Would you like to proceed?