# TREXVEN Admin: implementation plan for approval

Date: 16 October 2026. Status: **proposed, not started**. Evidence: [Stage 1 audit](18-integration-audit-2026-10-16.md).

## Approval scope

Approve local changes in the supplied Admin checkout, local/test-only tooling and dependency setup, synthetic integration testing, and preparation of migration/adapter/runbook artifacts. Preserve the existing Next.js application, page structure, visual tokens and components. Repair verified defects without rebuilding the website.

This approval does not authorize creating/resuming/configuring cloud resources, executing cloud migrations, exporting production data, altering Owner/POS/Vision code or business logic, changing payments/prices, sending real invitations or notifications, enabling production-changing commands, creating transactions, deleting records, or deploying. Production bridge and administrative handler artifacts may be drafted locally for separate review; they may not be installed or invoked against production.

## 1. Establish a reproducible local baseline

1. Preserve the supplied source and record checksums before changes; keep existing documents and demo fixtures available for local testing.
2. Complete dependency installation with a reviewed, pinned lockfile. Check actual resolved Next/React/Supabase versions and official security notices; make only necessary compatibility/security updates.
3. Separate Next.js, test, and Deno typechecking boundaries. Fix verified chart DTO and assurance-API errors. Include lint in the combined verification command.
4. Add validated configuration: explicit local fixture mode, fail-closed shared/production mode, required variable validation, Admin project identity guard, and no public service-role variables. Missing configuration becomes a truthful integration-required state.
5. Install or use a local Postgres/Supabase test runtime if available within authorized local setup; if host permissions prevent it, document the exact blocker and provide reproducible CI tests without claiming execution.

Acceptance: lockfile present; dependencies resolve; typecheck, lint, unit tests and production build actually execute; local failures are recorded and repaired before expanding verification.

## 2. Repair Admin identity, permissions and audit

1. Disable all demo session acceptance outside explicit local fixture mode. Validate token structure; never trust cookie-supplied permissions in real mode.
2. Implement real password login, verified active administrator lookup, correct SSR cookie refresh, TOTP enrollment/challenge and server/database AAL2 checks. Use supported APIs verified against installed versions.
3. Implement real signout and session-lifetime behavior. Scope recovery and privileged provisioning to a narrow server boundary; decide where that boundary lives consistently with secret confinement.
4. Prepare invite-only Supabase Auth settings, authorized invitation/token/profile/role workflow and a documented first-Super-Admin bootstrap. Test with mock/local Auth; no real invites sent.
5. Resolve document/code role-matrix drift explicitly. Keep the six roles and minimum permissions. Gate server DTOs, tables/charts/exports and RLS consistently; separate the approvals inbox from Admin Team access.
6. Implement internal audit writing, explicit function/table/sequence grants, RLS for exposed relations and protected partition access, and transactional audit for sensitive operations. Include denied attempts and export receipts; neutralize CSV formulas.

Acceptance: local authentication/API/authorization tests deny non-admin, inactive, wrong-role and AAL1 access; no forged demo cookie bypasses real mode; logout clears/revokes the intended session; database grants/RLS tests exercise each role and direct REST/RPC bypass attempts.

## 3. Make the Admin schema independently testable

1. Repair clean-bootstrap extension dependencies, table creation order and timeline columns/IDs.
2. Define explicit nullable unavailable values, currency exponents, approved country mapping, source timestamps, source versions, computation windows and projection lineage.
3. Keep pricing independently keyed by country+plan and validity period; NG/NGN, GH/GHS, TG/XOF and CI/XOF remain distinct. Remove active example prices from the real seed. No unconfirmed commercial amounts become authoritative.
4. Add non-overlapping price-version rules, safe admin-profile relationships, event/replay/attempt state constraints and monitoring indexes.
5. Keep AI Data metadata-only: registration, ownership, consent/licensing basis, sensitivity, checksums, retention metadata and version registry. Add guarded registry round trips without customer collection or training execution.
6. Create migration files using the Supabase CLI after discovering the installed CLI interface. Do not rewrite unknown deployed history; final migration packaging depends on a later read-only comparison with the restored Admin database.

Acceptance: repeatable clean local migration/seed run; pgTAP or equivalent role/constraint tests, including audit immutability, partition access, bootstrap, pricing isolation and direct command-state injection. Nothing applied to a cloud project.

## 4. Implement a durable minimized reporting pipeline

Preserve the proposed one-way production -> controlled server publisher -> Admin receiver -> Admin projections -> RLS-scoped API/Server Components -> dashboard architecture.

1. Define versioned event schemas from verified production contracts. Initially cover business registrations/updates, subscription state/history, verified billing records, transaction/product aggregates and safe application-error counts.
2. Prepare a local production-adapter package and reviewed publisher/outbox proposal. Credentials must be dedicated, server-only and least privilege; no production service-role key enters the browser or Admin frontend configuration. Installation in production requires a separate explicit approval.
3. Authenticate service callers, scope producers to allowed event types, validate exact key IDs/signatures/timestamps, bound body/batch sizes, and implement durable nonce expiry. Reject unknown or disallowed fields before any storage.
4. Process each event transactionally: validate -> claim -> apply guarded projection -> mark success. Store a payload hash and stable source identity; duplicates with changed content conflict. Retryable failures must remain retryable rather than being treated as completed duplicates. Use source entity versions/timestamps to prevent stale updates and verified payments from regressing.
5. Implement scheduled retry/backoff with bounded attempts, dead-letter state, authenticated/manual replay, safe errors, run receipts, checkpoints and freshness evaluation. Retry must not claim resolution until successful reapplication.
6. Implement read-only reconciliation snapshots by entity/window/currency using stable counts and checksums. Discrepancies produce review records and bounded replay requests; never financial edits.
7. Backfill procedure: explicit allowlisted fields and date windows, snapshot high-water mark, paginated export, deterministic source IDs/revisions, checkpointed normal ingestion, then concurrent change catch-up and reconciliation. No complete production database copy and no raw customer media.
8. Test producer outages, Admin outages, late/out-of-order events, duplicates, failure after ledger insertion, poisoned batches, amount/currency mismatches, key rotation and schema upgrades with local mocks.

Acceptance: reproducible tests show effectively-once projection effects under at-least-once delivery, recoverable failures, no false accepted receipts, no sensitive-field persistence, bounded resource use and observable freshness. Production remains disconnected until a later reviewed activation.

## 5. Connect existing screens using truthful data states

| Module | Planned behavior |
|---|---|
| Overview | Complete authorized metrics and trends from projections; same date window for KPIs/charts; no fake zero for disconnected sources; separate ODT subscription revenue and business sales |
| Businesses | Directory/profile with real registration/country/subscription fields, normalized mappings, ID/name search, sorting, pagination, source activity timestamps and corrected timeline |
| Subscriptions | Start/Core/Pro, genuine lifecycle dates, upcoming-renewal filtering, cancellations and per-country/currency reporting; unavailable revenue until commercial configuration exists |
| Payments | Map only server-verified production truth; preserve failures, provider-scoped payment identities, minor/major units and reconciliation status; refunds/webhooks unavailable unless a verified source exists |
| Pricing | Independently versioned country price registry; unconfigured when no approved prices exist; production price changes disabled |
| Product analytics | Registrations and explicitly named transaction-based activity where supported; missing sessions/features/retention/install/download/version telemetry stays integration-required |
| Vision/Intelligence | Adapt existing safe health metrics; distinguish service capability from available Admin telemetry; preserve existing disabled/consent-gated exports and no media access |
| Angel | Acknowledge deployed service capability; report request/latency/token/cost values only from real measured aggregates, with timestamps/windows; otherwise unavailable |
| System health | Real dependency probes and job freshness rather than hardcoded healthy states; fixed-code app errors where available; honest crash/DB-error coverage gaps |
| Incidents | Atomic incident/timeline/audit actions; valid status transitions/resolution timestamps; truthful notification delivery state |
| AI Data | Metadata registry/version round trips and accurate governance descriptions; no automatic collection/training |
| Notifications/audit | Persistent per-admin read receipts, authorized listing/export and audited operations; no false “all caught up” on unavailable integration |

Use per-currency reporting initially. Consolidated USD reporting requires an approved FX source, dated rates and unit conventions; absent that decision, leave it unavailable. Real transactions do not establish app download or POS-install counts.

Vision's existing `{record, health}` Bearer delivery requires a separate reviewed adapter; do not redirect it into the HMAC batch receiver unchanged. For this task, default to aggregate health inputs without enabling customer record exports. Any later deployment/consent/export activation requires separate approval.

Acceptance: seeded local fixtures arrive through the real receiver/projection interface for integration tests; each screen distinguishes loading, empty, unavailable, stale, permission-denied and error states. Fixtures are persistently labeled across mobile/desktop and never selected silently in real mode.

## 6. Keep production-changing actions disabled

Retain the existing confirmation/dialog design, but require complete backend schemas and server-derived identity. Local command creation/approval tests must cover requester/approver separation, command-specific permissions, payload/target validation, immutable results, stable idempotency keys and audit.

| Action | Required future production contract |
|---|---|
| Suspend/restore business | Explicit account-access semantics for Owner/POS, subscription/billing interaction, independent production authorization, verified effect and reconciliation; no guessed write to replica or `pos_writes_paused` |
| Change subscription | Reviewed production handler respecting existing verified-subscription RPC/versioning and business rules; no direct projection change |
| Edit prices | Approved country/plan/effective-date rules, independent TG/CI rows, financial approval, versioned production source and verified result |
| Modify account/admin state | Correct target system, scoped privilege, session revocation, audit and recovery procedure |
| Refund/financial adjustment | Provider verification and accounting/reconciliation contract; no execution in this implementation scope |

An authenticated dispatcher and result-state machine can be tested against a local fake handler. Production network dispatch must remain independently disabled even if someone supplies a URL/secret. Do not ship controls claiming immediate effects that have no approved backend contract.

Acceptance: direct SQL/REST/RPC attempts cannot skip permission/approval checks; unsafe dispatch is impossible in the approved local configuration; the UI accurately shows disabled/pending/reconciled states. Enabling real effects is a later decision.

## 7. Repair UI and verify

1. Preserve themes/design; add mobile navigation and always-visible environment/fixture labeling.
2. Associate labels/hints/errors with fields; fix palette accessibility, responsive popovers/tables and keyboard flows.
3. Integrate route loading/error/not-found states, partial-source failures and mounted command status. Remove claims of logging/notification/dispatch/governance that have no implementation.
4. Execute typecheck, lint, build, existing unit tests and meaningful added auth/authorization/API/data-contract/pipeline/payment-consistency tests.
5. Execute local migration/RLS tests; run Playwright journeys in real local integration mode and explicit demo mode. Include small/large viewports, dark/light themes, permission denials, stale data, outages and eight audited regression cases.
6. Run accessibility and performance checks once the app renders. Add local/CI verification configuration without automatic cloud deployment.

Report exact commands, exit codes, case counts, environmental blockers and remaining risk. Do not broaden tests merely to repeat green checks; expand when changes or unresolved concerns justify it.

## Final deliverables after approval

- Updated feature/status audit with source references and fixed-bug list.
- Preserved frontend with real Admin provider integrations and truthful unsupported states.
- Admin-only migration/RLS artifacts, identity/permission report and local schema verification.
- Versioned secure receiver, publisher/adapter preparation, synthetic tests, reconciliation/backfill/freshness runbooks.
- Explicitly disabled production-changing workflows with documented future contracts.
- Test execution record and production-readiness assessment distinguishing implemented, tested, connected, deployed and externally blocked.

## Later decisions required for live operation

1. Explicit authority to restore/configure the existing Admin project and inspect its live migration/Auth state; no assumption that the historical empty schema is current.
2. Explicit approval for Admin migrations/configuration and any cloud staging resources.
3. Separate review/approval for production publisher installation, minimized data export, credential exchange, telemetry instrumentation or Vision export activation.
4. Confirmed country commercial prices, intervals and any FX reporting policy; separate authorization for payment setup.
5. Reviewed production command semantics, approval/receipt/reconciliation flows, then explicit activation authorization.
6. Test evidence and final explicit deployment authorization.

The immediate approval request is only for the local implementation and verification scope above. These later gates remain closed.
