# AgentDrop

AgentDrop is a mobile-first MVP that turns an Australian business website into a custom AI chat agent in a few steps.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Optional provider integrations for Anthropic, Supabase, Resend, and Stripe
- File-based fallback persistence for local development when provider keys are missing

## Run locally

1. Copy `.env.example` to `.env.local`
2. Install dependencies with `npm install`
3. Start the app with `npm run dev`

## Operations

- Production checklist: [docs/go-live.md](/Users/caeseyfraser/Desktop/URL%20TO%20AGENT%20AI%20APP/docs/go-live.md)
- Incident handling: [docs/operator-runbook.md](/Users/caeseyfraser/Desktop/URL%20TO%20AGENT%20AI%20APP/docs/operator-runbook.md)
- Env preflight: `npm run ops:preflight -- --production`
- Stripe catalog sync: `npm run ops:stripe-catalog`
- Smoke testing: `npm run ops:smoke -- --mode public --base-url https://your-domain.com`

## Notes

- Website scanning and chat both work without external keys using deterministic fallbacks.
- If Supabase is not configured, the app persists businesses and conversations to `.data/agentdrop.json`.
- The widget script is served from `/api/widget/[id]` and posts back to `/api/chat`.
