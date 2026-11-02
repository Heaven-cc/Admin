# TREXVEN Admin

Existing Next.js and TypeScript administration website connected to the separate Admin Supabase project `tsnkzkpgxvomfuzyeyup`.

From this `app` directory:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open http://localhost:3000. The local `.env.local` contains the Admin URL and public publishable key. Privileged credentials belong only to Supabase Edge Functions and private cloud configuration.

Administrators use invitation-only access, a password, and authenticator MFA. Initial invitation acceptance is `/invite/accept`. Password recovery is `/reset`. Configure these URLs in the Admin Auth redirect allowlist. The invitation service currently uses the local website URL; changing it for a hosted site requires an explicit server-side configuration update.

Cloud reporting runs every five minutes. The production exporter supplies minimized business, subscription, payment, usage, fixed-code error and camera summaries plus saved Angel activity. No customer contacts, sale-level records, camera streams or message content are exported. Missing telemetry and billing configuration remain unavailable in the UI.

Country price drafts are independent for Nigeria, Ghana, Togo and Ivory Coast. Drafts do not activate billing. Suspend and Restore use authenticated business-scoped handlers. Permanent deletion is Super Admin only and requires fresh MFA and a separate typed confirmation. Other production commands, administrator role changes, deactivation, dataset deletion and training remain disabled pending approved contracts.

`supabase/migrations` contains Admin changes already applied to the existing cloud foundation. `supabase/production-migrations` contains separate production reporting changes. Do not apply either directory blindly to another project or run `db push` without checking the intended target. Local Admin migration filenames are aligned with the existing cloud history; the originally approved SQL is also preserved in `supabase/reviewed`. `supabase/legacy-generated` contains the incompatible generated baseline for reference only.

A configured Admin backend is required. There is no demo sign-in, sample business data, or fallback provider. Missing integrations show unavailable states.

Automated suites were not run for this implementation, as requested. Functional acceptance is manual. Existing npm scripts are retained for future authorized use.

Build output uses the project-local `.next` directory with Webpack caching disabled.
