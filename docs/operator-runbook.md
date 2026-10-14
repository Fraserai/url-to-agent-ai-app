# AgentDrop Operator Runbook

Use this when the production app is live and one of the core launch flows breaks.

## Magic Links Fail

Symptoms:
- `/api/auth/magic-link` returns an error
- users do not receive login emails
- users click the email but do not return to the right page

Check:
1. Supabase Auth redirect URLs include `/auth/callback` for the live domain.
2. `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct in Vercel.
3. Vercel function logs for `/api/auth/magic-link`.
4. Supabase Auth logs for outbound email attempts and callback failures.

Fix:
1. Correct the redirect URLs in Supabase.
2. Redeploy if env vars were wrong.
3. Re-test login from a fresh incognito session.

## Checkout Fails

Symptoms:
- `/api/checkout` returns `500`
- Stripe Checkout never opens
- deploy stays blocked after payment attempt

Check:
1. `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set.
2. Optional `STRIPE_PRICE_*` env vars are either fully set for a plan or fully blank.
3. Vercel logs for `/api/checkout`.
4. Stripe dashboard logs for the checkout session request.

Fix:
1. Re-run `npm run ops:stripe-catalog` and update envs if price IDs drifted.
2. Confirm the correct live or test Stripe keys are in the deployment.
3. Retry checkout after a fresh deploy.

## Webhooks Fail

Symptoms:
- payments succeed in Stripe but AgentDrop does not unlock deploy
- subscriptions cancel in Stripe but the app still shows the business as active

Check:
1. Stripe endpoint deliveries for `/api/webhook/stripe`.
2. Vercel logs for webhook signature or payload errors.
3. Business rows in Supabase for `plan`, `status`, `stripe_customer_id`, `stripe_subscription_id`, and `subscription_status`.

Fix:
1. Replace `STRIPE_WEBHOOK_SECRET` if the signing secret is wrong.
2. Re-send failed events from Stripe after the secret is corrected.
3. Manually reconcile the affected business row in Supabase if needed.

## Lead Emails Missing

Symptoms:
- chat captures a name/email/phone but no business email arrives
- leads appear in conversations but not in inboxes

Check:
1. Resend dashboard delivery logs.
2. Vercel logs for `/api/chat` and `/api/lead-notify`.
3. The business row has a usable owner email or business email.
4. The conversation row shows `notification_sent` after the lead is captured.

Fix:
1. Correct `RESEND_API_KEY` or `RESEND_FROM_EMAIL`.
2. Re-run the lead flow with a fresh visitor to confirm delivery.
3. Backfill missing business owner emails if the row was claimed without one.

## Widget Does Not Load

Symptoms:
- script tag is installed but the widget never appears
- console shows network or JavaScript errors

Check:
1. The installed script points to `/api/widget/[id]` on the correct domain.
2. The widget URL returns JavaScript with HTTP `200`.
3. Browser console and network panel on the customer site.
4. Business status is still `live` and not `suspended`.

Fix:
1. Re-copy the embed snippet from the deploy screen.
2. Confirm the production domain matches `NEXT_PUBLIC_APP_URL`.
3. Redeploy the business if the widget URL is stale.
