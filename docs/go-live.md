# AgentDrop Go-Live

This project is ready for production wiring. Use this checklist to move from local MVP to a live customer-facing deployment.

## 1. Configure Production Providers

1. Copy [.env.example](/Users/caeseyfraser/Desktop/URL%20TO%20AGENT%20AI%20APP/.env.example) into your production environment.
2. Set `NEXT_PUBLIC_APP_URL` to the final public domain.
3. Add real keys for Anthropic, Supabase, Resend, and Stripe.
4. Run the preflight check:

```bash
npm run ops:preflight -- --production
```

## 2. Prepare Supabase

1. Create the Supabase project.
2. Apply [supabase/schema.sql](/Users/caeseyfraser/Desktop/URL%20TO%20AGENT%20AI%20APP/supabase/schema.sql) in the SQL editor.
3. Configure Auth:
   - Site URL: your `NEXT_PUBLIC_APP_URL`
   - Redirect URL: `https://your-domain.com/auth/callback`
4. Re-run preflight with the database check:

```bash
npm run ops:preflight -- --production --check-db
```

## 3. Prepare Stripe

1. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
2. Create or sync the Stripe catalog:

```bash
npm run ops:stripe-catalog
```

3. Copy the emitted `STRIPE_PRICE_*` values into Vercel or your production env.
4. Point the Stripe webhook to:

```text
https://your-domain.com/api/webhook/stripe
```

5. Subscribe the endpoint to:
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`

## 4. Prepare Email and AI

1. Configure `RESEND_API_KEY` and a verified `RESEND_FROM_EMAIL`.
2. Configure `ANTHROPIC_API_KEY`.
3. Confirm that production emails and scan/chat outputs work in a staging or preview deployment before enabling customer traffic.

## 5. Deploy to Vercel

1. Create the Vercel project from this repo.
2. Add every required env var before the first production deploy.
3. Deploy once to preview, then to production.
4. Confirm `NEXT_PUBLIC_APP_URL` matches the deployed production domain exactly.

## 6. QA Before Launch

Run automated smoke coverage against the deployed app:

```bash
npm run ops:smoke -- --mode public --base-url https://your-domain.com --scan-url https://example.com
```

If you already have a safe test business in production, extend the smoke test:

```bash
npm run ops:smoke -- --mode public --base-url https://your-domain.com --chat-business-id <business-id> --widget-business-id <business-id>
```

Manual QA checklist:

1. Scan a real site and confirm a draft business row is created in Supabase.
2. Save or deploy while logged out and confirm the login redirect preserves the pending action.
3. Complete a real magic-link sign-in and confirm the draft is claimed.
4. Complete one monthly checkout and one annual checkout in Stripe test mode.
5. Confirm deployment is blocked before payment and allowed after payment.
6. Open the deployed widget and confirm lead capture sends one email only.

## 7. Controlled Widget Install

1. Use the deploy flow to generate the widget snippet.
2. Install it on one controlled live site first.
3. Test:
   - widget loads without console errors
   - chat replies succeed
   - lead capture reaches the business inbox
   - removing the script removes the widget cleanly

## 8. Launch

1. Turn on production traffic only after the controlled install passes.
2. Keep Vercel logs, Supabase auth logs, Stripe webhook deliveries, and Resend delivery logs open for the first launch window.
3. Use [docs/operator-runbook.md](/Users/caeseyfraser/Desktop/URL%20TO%20AGENT%20AI%20APP/docs/operator-runbook.md) for incident handling.
