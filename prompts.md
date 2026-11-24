# Prompt History Log (prompts.md)

This log records every prompt submitted to the AI agent during the development of the **Salon Queue Management System**, in chronological order, as required by the assignment guidelines.

---

### Prompt 1 — Project Initialization & Step 1 Setup
**Date:** Initial session  
**Prompt:**
> We are building a **Salon Queue Management System** for my MSc IT Vibe Coding Lab assignment.
> First, carefully read AGENTS.md, docs/01-brief.md, docs/02-screens.md, and docs/03-flows-rules.md.
> Task: Step 1 — Understand and Set Up.
> Use technology stack: React + Vite + TypeScript (frontend), Tailwind CSS, Node.js + Express (backend), SQLite (database), Socket.IO (real-time communication).
> Work inside existing folder, create modular architecture, single `npm run dev` root command, health check endpoint with real SQLite query, bilingual English/Gujarati structure.

---

### Prompt 2 — Approval of Step 1 Plan with Adjustments
**Date:** Initial session  
**Prompt:**
> I have reviewed your implementation plan. It is approved with three small adjustments:
> 1. The Waiting Area TV page (/display) must use a dedicated fullscreen layout without normal navigation bar.
> 2. English/Gujarati language toggle must preserve selected language across navigation and refresh using localStorage.
> 3. Preserve planning documents, PDFs, and Git history. Do not commit or push automatically.
> Ensure `npm run install:all` and `npm run dev` work, Tailwind v4 is configured, backend health check queries SQLite, and .gitignore excludes secrets/db.

---

### Prompt 3 — Verification of Socket.IO Configuration
**Date:** Initial session  
**Prompt:**
> During Step 1 verification, I noticed that `backend/src/socket/socketHandler.ts` is missing.
> Inspect backend files and connect Socket.IO to existing Express HTTP server handling connections and disconnections. Verify backend starts and Socket.IO accepts test connections.

---

### Prompt 4 — Run Application Locally
**Date:** Initial session  
**Prompt:**
> start project on local host

---

### Prompt 5 — Step 2: Home & Join Queue Screens
**Date:** Subsequent session  
**Prompt:**
> We are now working on Step 2 of the Salon Queue Management System.
> Read AGENTS.md, docs/01-brief.md, docs/02-screens.md, and docs/03-flows-rules.md.
> Build only Screen 1 (Home) and Screen 2 (Join Queue).
> Requirements:
> 1. Premium responsive Home screen with salon name, open/closed indicator, live queue summary, barber availability cards, prominent Join Queue button.
> 2. Join Queue screen with customer name, validated 10-digit Indian phone number, service selection (maximum 3), barber selection with "Any barber (fastest)".
> 3. Realistic dummy salon services (Haircut, Beard Trim, Hair Spa) in INR ₹.
> 4. Three sample barbers: Ravi, Amit, Imran.
> 5. Live summary of selected services, duration, price, and waiting-time preview.
> 6. Charcoal (#1F2937) and gold (#D4A017) design system.
> 7. Mobile-first, responsive, and visually polished.

---

### Prompt 6 — Step 2 Plan Approval with 3 Adjustments
**Date:** Subsequent session  
**Prompt:**
> I have reviewed your Step 2 implementation plan. Approved with three adjustments:
> 1. Clearly label all sample waiting counts, barber statuses, and estimated waiting times as demo data.
> 2. After valid Join Queue form submission, show a demo confirmation preview stating: "Demo preview — Your queue spot has not been booked yet."
> 3. Use clean TypeScript interfaces for services and barbers, structured for easy Step 3 backend connection.

---

### Prompt 7 — Step 2 Test Fixes (Modal & Mobile Layout)
**Date:** Subsequent session  
**Prompt:**
> We have completed manual testing of Step 2 (Home and Join Queue). 8 out of 10 tests passed. Two tests failed:
> - Failure 1: Demo confirmation modal must show selected customer name, phone number, services, barber, duration, price, and demo notice.
> - Failure 2: Mobile responsive layout at 390px and 320px viewport widths (fix vertical overflow on modal, horizontal overflow on small screens, touch targets 44px+).

---

### Prompt 8 — Step 3: Real Queue Joining, Daily Tokens, and My Status Screen
**Date:** Current session  
**Prompt:**
> Now implement Step 3 — Real Queue Joining, Daily Token Generation, and My Status Screen (/status/:id).
> Main requirements:
> 1. Real customer queue joining: validate name, 10-digit Indian phone number, 1–3 active services, barber preference. Read authoritative prices/durations from SQLite.
> 2. Daily sequential token generation: S-1, S-2, S-3 resetting each day. Concurrency-safe write transaction.
> 3. Duplicate active phone prevention: return existing active ticket if customer already has a waiting/called/in-chair spot.
> 4. My Status Screen (/status/:id): circular wait indicator, live queue position, "Start coming" alert (2nd in line), "It's your turn!" notification (called), "Cancel my spot" with confirmation.
> 5. Real-time updates via Socket.IO without private customer data leaks.
> 6. Access token authorization for private details and cancellations.
> 7. Non-production dev test endpoint to simulate barber calling customer.

---

### Prompt 9 — Step 3 Approval with 5 Mandatory Corrections
**Date:** Current session  
**Prompt:**
> I have reviewed your Step 3 implementation plan. Incorporate these five mandatory corrections:
> 1. Database uniqueness: `UNIQUE(created_date, token_number)` with atomic write transaction.
> 2. Partial unique index on active phone numbers (`status IN ('waiting', 'called', 'in_chair')`).
> 3. Waiting-time calculation: When no eligible barber is working, return unavailable estimate instead of dividing by 1.
> 4. Customer access security: Unpredictable access token required for private queue details and cancellation. Socket.IO emits generic trigger only.
> 5. Isolated dev-only test endpoint (`/api/dev/call-customer/:id`) excluded from production (`NODE_ENV === 'production'`), header-verified, enforcing barber eligibility.


---

### Prompt 10 — Step 3 Focused Security & Integration Review
**Date:** Current session  
**Prompt:**
> Before we mark Step 3 complete, perform a focused security and integration review:
> 1. Verify that a user entering another customer's phone number cannot obtain that customer's private access token, private customer details, or cancellation permission. If the duplicate-phone flow currently leaks access, fix it securely without allowing duplicate active spots.
> 2. Ensure all customer-private APIs require the correct customer-specific authorization credential. A guessed queue ID must never allow cancellation.
> 3. Verify the development-only Call Customer endpoint is completely unavailable in production, including when NODE_ENV is missing or misconfigured. Prefer explicit development-only enablement, bound to local development, with a separate secret.
> 4. Confirm Socket.IO broadcasts contain no customer PII or access credentials.
> 5. Verify token generation, SQLite persistence, and daily reset without deleting legitimate queue records.
> 6. Verify the complete frontend production build and backend type checking.
> 7. Do not modify unrelated screens, planning documents, or Git history. Do not commit or push automatically.
> Report the exact tests performed, PASS/FAIL results, files changed, and any unresolved issues. Do not claim PASS without verification.

---

### Step 4 — Reception Test Isolation
**Date:** 2026-11-24  
**Prompt:**
> I am continuing my existing Salon Queue Management System project.
>
> Read AGENTS.md and all files in docs/ first.
>
> Steps 1–3 are implemented. Step 4 Reception Dashboard has been coded but automated testing is incomplete.
>
> First inspect the existing code and Git changes. Do not recreate the project.
>
> The critical issue is that Step 4 tests were interfering with existing SQLite queue records.
>
> Your first task is to create an isolated SQLite test database, preserve all existing development records, fix the Step 4 tests, and run frontend/backend builds.
>
> Do not start Step 5 yet. Do not commit, push, or deploy automatically.
>
> Explain the changes and report actual test results.

---

### Step 4 — Call Next Debugging
**Date:** 2026-11-24  
**Prompt:**
> We are debugging Step 4 of my existing Salon Queue Management System.
>
> Manual testing results:
>
> - Staff login: PASS
> - Dashboard: PASS
> - Add Walk-in: PASS
> - Call Next: FAIL
> - Live Status: PASS
> - Cancellation: PASS
> - No-show: NOT TESTED
> - Gujarati: PASS
> - Responsive UI: PASS
>
> Your task is to diagnose and fix the Call Next failure without breaking the seven passing features.
>
> FIRST:
>
> 1. Read AGENTS.md and the docs folder.
> 2. Inspect ReceptionPage.tsx, backend reception routes, receptionService.ts, queueService.ts, and database schema.
> 3. Inspect how Call Next selects a barber and eligible Waiting customer.
> 4. Identify whether the failure is due to an actual bug, an unavailable barber, an existing Called/In Chair ticket, a missing eligible customer, an expired staff session, or a frontend/backend response mismatch.
> 5. Reproduce the failure using an isolated test database, not my existing salon.db.
>
> IMPORTANT:
>
> - Do not delete, modify, or reset existing customer records in backend/salon.db.
> - Do not force barber availability by modifying real tickets.
> - Do not weaken FCFS or barber preference rules to make tests pass.
> - Do not alter working Step 1–3 functionality.
> - Preserve all staff authentication protections.
> - Avoid unrelated UI redesigns.
>
> IF an actual bug is confirmed:
>
> - Fix only the relevant code.
> - Add a regression test reproducing the original failure.
> - Run backend and frontend builds.
> - Run Step 4 tests against the isolated database.
> - Report the root cause, exact changes, and PASS/FAIL results.
>
> Also provide a safe, beginner-friendly manual testing procedure for Call Next and the 10-minute No-show rule.
>
> Do not commit, push, or deploy automatically.

---

### Step 4 — Verify Manual Test Server Isolation
**Date:** 2026-11-24  
**Prompt:**
> The Step 4 Call Next fixes are complete and automated tests report 11/11 PASS.
>
> Before manual testing, please verify the safety of the suggested test server command:
>
> NODE_ENV=test PORT=5001 STAFF_PIN=4826 npm --prefix backend run dev
>
> 1. Inspect database.ts and confirm that NODE_ENV=test always selects an isolated in-memory SQLite database, including when starting the backend through npm run dev.
> 2. Verify that the test server cannot connect to or modify the existing backend/salon.db.
> 3. Confirm how to stop the existing backend process safely before starting the test server.
> 4. Verify that the test server seeds services and barbers correctly.
> 5. Do not modify or delete existing database records.
> 6. Do not commit, push, or deploy.
>
> Only after confirming these points, give me exact commands for safe manual testing of Call Next and No-show.
>
> Explain everything in beginner-friendly steps.

---

### Step 5 — Barber View and Waiting Area TV Display Plan
**Date:** 2026-11-24
**Prompt:**
> We are continuing the existing Salon Queue Management System.
>
> Steps 1–4 are implemented, manually tested, and pushed to GitHub. The latest committed version is on the main branch.
>
> Now prepare the implementation plan for Step 5 — Barber View and Waiting Area TV Display.
>
> First read:
>
> - AGENTS.md
> - docs/01-brief.md
> - docs/02-screens.md
> - docs/03-flows-rules.md
>
> Inspect the existing React + Vite + TypeScript + Tailwind frontend, Express backend, SQLite database schema, staff authentication, queue logic, and Socket.IO infrastructure.
>
> Part A — Barber View (/barber/:name):
>
> - Mobile-first interface.
> - Barber-specific authentication and authorization.
> - Show the current assigned customer, token, services, and service duration.
> - Start: Called → In Chair.
> - Done: In Chair → Done.
> - Toggle Available / On Break only when no active customer is assigned.
> - Store timestamps and update the queue in real time.
> - Use atomic database transactions for state changes.
> - Never allow one barber to modify another barber's assignments.
>
> Part B — TV Display (/display):
>
> - Fullscreen 1920×1080 layout without normal navigation.
> - Display on-duty barbers and their active token.
> - Show the next five waiting tokens in FCFS order.
> - Highlight newly Called tokens.
> - Update through Socket.IO with reconnect handling.
> - Never expose customer names, phone numbers, or private details.
> - English/Gujarati support.
> - Charcoal and gold theme.
>
> Safety requirements:
>
> - Preserve working Steps 1–4.
> - Never delete or reset existing SQLite customer records.
> - Use isolated in-memory SQLite for automated tests.
> - Keep staff and barber credentials out of committed source code.
> - Do not implement Owner Settings yet.
> - Do not commit, push, or deploy automatically.
>
> Before coding:
>
> 1. Explain the proposed backend architecture.
> 2. Explain barber authentication.
> 3. List required API endpoints.
> 4. Explain Start / Done / Break state transitions.
> 5. Explain TV data privacy.
> 6. List files to create or modify.
> 7. Describe automated and manual tests.
>
> IMPORTANT: Planning only. Do not modify files or run terminal commands. Wait for my approval before implementation.
>
> Explain everything in beginner-friendly English.

---

### Step 5 — Implementation Approval and Mandatory Adjustments
**Date:** 2026-11-24
**Prompt:**
> I have reviewed your Step 5 implementation plan.
>
> The overall plan is approved with three mandatory adjustments.
>
> 1. TV Waiting Queue:
>
> - Display the earliest five Waiting tokens for today in strict FCFS order.
> - Do not hide a waiting token merely because its preferred barber is on break or off duty.
> - If a wait estimate is unavailable, show an appropriate label rather than removing the token.
> - Do not expose customer names, phone numbers, internal IDs, or private data.
>
> 2. Barber Authentication:
>
> - Ensure each barber uses an individual server-configured credential.
> - Fail closed if a credential is missing.
> - Enforce session expiry and logout invalidation on the server.
> - Enforce rate limiting server-side.
> - Verify a barber cannot access another barber's assignments, even by changing URL parameters or ticket IDs.
> - Never commit real credentials or access tokens.
>
> 3. TV Real-Time Reliability:
>
> - Refresh the TV data when Socket.IO reconnects.
> - Add a periodic fallback refresh approximately every 30 seconds.
> - Show a visible reconnecting indicator when connection is lost.
> - Avoid replaying old Called animations after reconnect.
>
> You may now implement Step 5 only.
>
> Important:
>
> - Preserve all working Steps 1–4.
> - Do not modify or delete existing SQLite customer records.
> - Use isolated in-memory SQLite for automated tests.
> - Use atomic transactions for Called → In Chair → Done.
> - Prevent a barber from going On Break while an active assignment exists.
> - Maintain the charcoal and gold theme and English/Gujarati translations.
> - Do not implement Owner Settings yet.
> - Do not commit, push, or deploy automatically.
>
> After implementation:
>
> 1. Run the Step 5 isolated test suite.
> 2. Rerun Step 4 regression tests.
> 3. Run frontend and backend production builds.
> 4. Verify barber authentication, session expiry and logout.
> 5. Verify Start, Done, and Break transitions.
> 6. Verify TV next-five FCFS order and privacy.
> 7. Verify Socket.IO updates and reconnect behaviour.
> 8. Report exact PASS/FAIL results, changed files, and unresolved issues.
>
> Do not claim PASS for tests that were not actually performed.

---

### Step 5 — Isolated Manual Browser Test Setup
**Date:** 2026-11-24
**Prompt:**
> Step 5 automated tests and builds have passed.
>
> Before manual browser testing, please help me configure an isolated local Step 5 test environment.
>
> 1. Inspect how BARBER_CREDENTIALS is parsed and loaded.
> 2. Explain exactly how to configure distinct local test PINs for Ravi, Amit, and Imran without exposing real credentials.
> 3. Verify that NODE_ENV=test uses only in-memory SQLite.
> 4. Ensure the normal backend/salon.db and its records are not modified.
> 5. Provide exact commands to start the isolated backend and frontend on my Mac.
> 6. Do not run destructive database commands.
> 7. Do not commit, push, or deploy.
> 8. Do not include actual credentials in logs or responses.
>
> Explain the setup in beginner-friendly steps.

---

### Step 5 — Playwright Browser Testing
**Date:** 2026-11-24
**Prompt:**
> Step 5 implementation is complete, and the backend automated tests and production builds have passed.
>
> I have limited time, so I want automated browser testing instead of performing the manual walkthrough myself.
>
> Please set up and run Playwright end-to-end tests for the existing Salon Queue Management System.
>
> Requirements:
>
> 1. Inspect the existing project scripts, APIs, authentication configuration, and frontend routing before creating tests.
> 2. Use a completely isolated, temporary SQLite test database. Never modify or delete my existing backend/salon.db, its WAL/SHM files, or real customer records.
> 3. Configure separate test-only staff and barber credentials through environment variables. Never hardcode real credentials or print them in logs.
> 4. Start the backend and frontend using the correct existing development commands. Ensure tests cannot accidentally connect to my regular development backend. Use separate test ports and verify the backend is in test mode before any write operations.
> 5. Use Playwright to automatically test the complete workflow:
>    - Receptionist login.
>    - Add Walk-in customer.
>    - Call Next for an eligible barber.
>    - Customer My Status changes to Called.
>    - Barber-specific login.
>    - Start Service changes Called → In Chair.
>    - Done changes In Chair → Done.
>    - Barber returns to Available.
>    - Break toggle and active-assignment restrictions.
>    - Waiting Area TV displays the correct active tokens and first five Waiting tokens.
>    - TV never displays names, phone numbers, or private customer information.
>    - Socket.IO updates appear within five seconds.
>    - TV recovers after disconnection and reconnection.
> 6. Test screen responsiveness:
>    - Barber View at 390px and 320px.
>    - TV Display at 1920×1080.
>    - English and Gujarati labels on both screens.
>    - Check for horizontal overflow and unusable controls.
> 7. Capture screenshots for important states and save them in a test artifacts folder.
> 8. Use deterministic test fixtures and controlled clock/time configuration wherever necessary, without changing production business rules.
> 9. Run Step 4 and Step 5 regression tests, plus frontend and backend production builds.
> 10. If failures occur, identify the root cause and fix only confirmed bugs. Rerun failed tests and relevant regressions.
> 11. Report:
>
> - Number of tests passed, failed, and skipped.
> - Which browser and viewport sizes were actually tested.
> - Exact commands executed.
> - Screenshots generated.
> - Files created or modified.
> - Any remaining unverified behaviours.
>
> Important restrictions:
>
> - Do not modify real SQLite records.
> - Do not commit, push, or deploy automatically.
> - Do not falsely report PASS for unexecuted tests.
> - Preserve existing Steps 1–4 functionality.
>
> If Playwright or its browser binaries are unavailable, explain the blocker and try a supported installation method rather than claiming browser tests passed.
>
> Proceed with automated testing and provide a clear final report.

---

### Step 6 — Owner Settings and Final Testing Approval
**Date:** 2026-11-24
**Prompt:**
> I reviewed your Step 6 Owner Settings implementation plan.
>
> The plan is approved with these mandatory adjustments:
>
> 1. Separate physical opening hours from the manual online-joining switch. Before reusing salon_settings.is_open, inspect its existing semantics throughout the codebase. If needed, add a separate persistent setting with a backward-compatible, non-destructive migration. Disabling online joining must not prevent reception walk-ins during physical operating hours.
> 2. Make saved opening and closing times authoritative across frontend and backend, including the 30-minute online-joining cutoff. Use Asia/Kolkata consistently. Verify opening, cutoff and closing boundaries using a controlled clock. Preserve existing accepted queue tickets.
> 3. Add a settings persistence test using a completely disposable SQLite file in the OS temporary directory. Verify settings survive backend/database reinitialization and a process restart. Never use, overwrite, delete, or migrate the existing backend/salon.db for this test.
>
> You may now implement Step 6 — Owner Settings and Final Testing.
>
> Implement:
>
> - Secure owner-only authentication and session management.
> - Services management with price, duration and active status.
> - Barber on-duty/off-duty management.
> - Editable salon operating hours.
> - Manual online-joining control.
> - Today's queue statistics and average wait.
> - Live synchronization with Home, Join, Reception, Barber, My Status and TV.
> - English/Gujarati translations.
> - Responsive Owner Dashboard.
>
> Safety requirements:
>
> - Preserve all working Steps 1–5.
> - Never delete or reset existing queue records.
> - Preserve booked service prices, durations and barber preferences.
> - Reject taking a barber off duty while handling an active ticket.
> - Use server-side authorization and validation for all owner actions.
> - Keep actual credentials out of source code and logs.
> - Inspect and safely stop any regular backend watcher using the real database before modifying backend files.
> - Use in-memory SQLite for ordinary automated tests and a disposable SQLite file for persistence verification.
> - Do not commit, push or deploy automatically.
>
> Verification:
>
> 1. Run Step 6 backend integration tests.
> 2. Run Playwright automated browser tests for Owner Settings.
> 3. Rerun Step 4 and Step 5 regression tests.
> 4. Run existing Playwright E2E tests.
> 5. Run frontend and backend production builds.
> 6. Check that customer privacy and authentication remain intact.
> 7. Verify the actual database and its WAL/SHM files were preserved.
> 8. Record the implementation prompt in prompts.md.
>
> Fix confirmed test failures, then report exact PASS/FAIL/SKIPPED counts, changed files and remaining issues.
>
> Proceed with implementation and testing now. Do not claim that unexecuted checks passed.

---

### Credential Remediation Before Step 6 Commit
**Date:** 2026-11-24
**Prompt:**
> The Git security check correctly stopped because STAFF_PIN and DEV_TEST_SECRET in .env.example match the actual credentials in my local .env, and these template values exist in Git history.
>
> Please perform a safe credential remediation before committing Step 6.
>
> 1. Inspect the application's environment loading and credential usage.
> 2. Replace STAFF_PIN and DEV_TEST_SECRET in .env.example with empty placeholders. Also ensure OWNER_PASSWORD and BARBER_CREDENTIALS are placeholders only.
> 3. Generate strong, unique replacement values for STAFF_PIN and DEV_TEST_SECRET using a cryptographically secure generator.
> 4. Update my local, git-ignored .env with the new values. Preserve all unrelated configuration and existing owner/barber credentials.
> 5. Do not print, log, or expose any secret values in the conversation or terminal output.
> 6. Verify .env remains ignored by Git.
> 7. Verify no actual credential in .env.example matches a local credential.
> 8. Check whether the previously exposed DEV_TEST_SECRET enables any production-accessible development endpoint. Ensure development test endpoints are disabled in production and protected appropriately in development.
> 9. Run relevant authentication/security tests and frontend/backend production builds.
> 10. Verify the real SQLite database and its WAL/SHM files are unchanged.
> 11. Do not delete or reset database records.
> 12. Do not commit, push, force-push, or rewrite Git history.
>
> If the existing credentials are used anywhere beyond the local environment, report the required rotation steps without revealing the values.
>
> After completing remediation, provide a concise PASS/FAIL report. Do not include secret values.

---

### Publish Completed Step 6 Changes
**Date:** 2026-11-24
**Prompt:**
> Credential remediation is complete.
>
> Now safely commit and push the remaining Step 6 changes to origin/main.
>
> - Verify current branch and remote synchronization.
> - Confirm Step 5 is already committed.
> - Stage only Step 6 source code, configuration templates, translations, tests, and prompts.md.
> - Exclude all actual .env files, credentials, SQLite database files, WAL/SHM files, PDFs, ZIP archives, screenshots, node_modules, dist and test artifacts.
> - Scan staged changes for exposed secrets.
> - Check git diff --cached --check.
> - If all checks pass, commit using: Implement secure Owner Settings and salon configuration
> - Push to origin/main without force.
> - Verify the final commit hash and Git status.
> - Stop and report any security concern or remote divergence instead of pushing.
>
> Do not modify or reset the real SQLite database.

---

### Secure Staff Access Before Step 7
**Date:** 2026-11-24
**Prompt:**
> We need to add one final feature to the existing Salon Queue Management System before Step 7 deployment.
>
> FEATURE: Secure Staff Access and Credential Management inside the Owner Dashboard (/admin).
>
> Steps 1–6 are already implemented, tested and pushed to GitHub. Preserve all existing functionality.
>
> First inspect the existing authentication middleware for Reception, Barber and Owner, SQLite schema, session handling, environment variables and Owner Dashboard.
>
> IMPLEMENT THE FOLLOWING:
>
> 1. Owner Dashboard UI
>
> - Add a Staff Access / Security section.
> - Display the existing receptionist and barber accounts (Ravi, Amit, Imran).
> - Provide Change PIN/Passcode actions for each account.
> - Provide a Change Owner Password action.
> - Never display or retrieve existing passwords or PINs.
> - Use the charcoal/gold design.
> - Support English and Gujarati.
> - Make the UI responsive.
>
> 2. Secure credential storage
>
> - Use Argon2id with unique salts for storing credential hashes in SQLite.
> - Never store passwords or PINs in plaintext.
> - Never use reversible encryption for password storage.
> - Use a suitable maintained password hashing library compatible with the target Node runtime.
> - Add a backward-compatible, non-destructive database migration.
> - Do not change existing queue records or reset the database.
>
> 3. Safe bootstrap and migration
>
> - Keep current environment-configured credentials working during initial bootstrap.
> - Provide an explicit, idempotent initialization process for staff, barber and owner credentials.
> - Avoid silently overwriting credentials that were changed in the Owner Dashboard.
> - Once a database-backed credential exists, do not permit old environment credentials to authenticate as a fallback.
> - Fail closed when credentials are missing or improperly configured.
> - Do not rotate, expose, remove or print current local credentials.
> - Document how production credentials are initialized before deployment.
>
> 4. Owner-authorized credential management
>
> - Only the authenticated owner can change staff/barber credentials.
> - Require recent owner reauthentication before credential changes.
> - Require the current owner password when changing the owner password.
> - Enforce strong server-side passcode/password validation and confirmation.
> - Prevent empty credentials and reuse of known defaults.
> - Never accept credentials through URL query parameters.
> - Rate-limit authentication and sensitive credential-change endpoints.
> - Ensure credentials are excluded from logs, API read responses and Socket.IO events.
>
> 5. Sessions and security
>
> - Invalidate all affected sessions when a credential changes.
> - Preserve unrelated authenticated sessions.
> - Enforce authorization server-side on every sensitive API.
> - Use constant-time or secure password verification as appropriate.
> - Ensure all sensitive responses use Cache-Control: no-store.
> - Do not weaken existing login protections or cross-barber authorization.
> - Document the trade-offs of keeping session state in memory.
>
> 6. Testing
>
> - Add backend security/integration tests for credential bootstrap, persistence, login, password changes, authorization, credential reuse, invalidation, rate limiting and migration.
> - Use in-memory SQLite for ordinary tests.
> - Use a disposable file-backed SQLite database to verify credential persistence after backend restart.
> - Add Playwright automated browser tests for the Owner Dashboard credential-change workflow.
> - Verify that old credentials stop working and new credentials work.
> - Verify that previous sessions are invalidated appropriately.
> - Verify receptionist and barber permissions are preserved.
> - Run Steps 3–6 regression tests, existing Playwright E2E tests and frontend/backend production builds.
> - Provide actual PASS/FAIL/SKIPPED counts and command exit codes.
>
> 7. Project safety
>
> - Do not modify or delete the real backend/salon.db or WAL/SHM files during implementation or tests.
> - Do not accidentally start a watcher that modifies the real database.
> - Preserve existing tickets, prices, durations, barber preferences and settings.
> - Do not commit secrets, environment files, databases or test artifacts.
> - Do not commit, push or deploy automatically.
> - Do not purchase hosting or configure cloud resources.
>
> After implementation, report:
>
> - Files created/modified.
> - Database migration strategy.
> - Bootstrap instructions for local and production environments.
> - Actual test results.
> - Screenshots from automated browser tests.
> - Remaining risks or issues.
> - Confirmation of real database checksum preservation.
>
> Proceed with implementation and automated verification. Do not claim PASS for checks that were not actually executed.

---

### Barber PIN Setup and Login Integration
**Date:** 2026-11-24
**Prompt:**
> Fix the Barber View login and credential-management integration in my existing Salon Queue Management System.
>
> CURRENT PROBLEM:
>
> - The Owner Dashboard opens successfully.
> - Barber View login is not working correctly.
> - I want the Owner to be able to set or reset each barber's login PIN directly from Owner Dashboard → Staff Access and Security.
> - After an owner changes a barber PIN, that barber must be able to sign in with the new PIN immediately.
> - The old PIN must stop working.
>
> IMPORTANT: The secure credential-management feature was recently implemented, but its real local Barber login workflow has not yet been verified. Debug and fix the existing implementation rather than rewriting it.
>
> TASKS:
>
> 1. Inspect the existing Barber login flow, barberAuth middleware, credentialService, ownerCredentials routes, session handling, frontend BarberPage, and StaffAccess UI.
> 2. Identify why Barber View login fails in the actual local application. Check API requests, barber ID/name mapping (ravi, amit, imran), credential lookup precedence, and error responses.
> 3. Make Owner Dashboard → Staff Access and Security the normal way to manage individual barber PINs.
> 4. Ensure the owner can set/reset a barber PIN even if that barber has no previously initialized credential, after verifying the current owner's password.
> 5. Store new credentials using salted Argon2id hashes in persistent SQLite. Do not store plaintext PINs.
> 6. Ensure newly saved database-backed credentials take precedence over BARBER_CREDENTIALS environment values. No fallback to old environment credentials after an account is initialized.
> 7. Ensure password change invalidates only the affected barber's sessions.
> 8. Verify these complete flows for all three barbers:
>    - Owner signs in.
>    - Owner changes Ravi's PIN.
>    - Ravi signs in using the new PIN.
>    - Ravi's old PIN is rejected.
>    - Owner changes Amit's PIN.
>    - Amit signs in successfully.
>    - Owner changes Imran's PIN.
>    - Imran signs in successfully.
>    - Ravi cannot access Amit or Imran's assignments.
>    - Barber Start Service, Done, Available and On Break continue working.
> 9. Test the complete workflow using Playwright and isolated SQLite. Include both owner and barber browser screens.
> 10. Run credential security tests, Steps 4–6 regression tests, existing Playwright tests and frontend/backend builds.
> 11. Verify stored barber credentials remain valid after a backend restart using a disposable file-backed SQLite database.
> 12. Do not modify, delete, reset or migrate my real backend/salon.db or its WAL/SHM files while developing and testing.
> 13. Do not expose actual PINs, owner passwords, credentials, tokens or customer data in logs or reports.
> 14. Do not commit, push or deploy automatically.
>
> AFTER FIXING:
>
> - Report the root cause of the Barber login problem.
> - Report the exact files modified.
> - Provide actual PASS/FAIL test results.
> - Explain how I can change Ravi, Amit and Imran's PINs from Owner Dashboard and then log into their Barber Views.
> - Clearly distinguish automated test success from any local login that was not actually verified.
>
> Proceed with diagnosis, implementation and automated verification now.

---

### Barber Portal Before Deployment
**Date:** 2026-11-24
**Prompt:**
> Improve the Barber View user experience and UI in my existing Salon Queue Management System before deployment.
>
> CURRENT PROBLEM:
> Barbers currently need to manually change URLs such as /barber/ravi, /barber/amit, and /barber/imran. This is inconvenient and not suitable for a real salon.
>
> The Owner Dashboard and secure barber PIN management are now implemented and working.
>
> GOAL:
> Create a professional, mobile-first Barber Portal where any barber can select their profile and sign in without manually editing the URL.
>
> IMPLEMENT:
>
> 1. Common Barber Portal
> - Create /barber as the main entry route.
> - Show a polished barber selection screen with profile cards for Ravi, Amit and Imran, using the roster returned by the existing backend.
> - Never hardcode the barber list in the frontend.
> - Each card shows the barber's display name and availability when that information is public.
> - Clicking a barber opens their PIN login form.
> - Support keyboard navigation and accessible labels.
> - Preserve existing /barber/:name URLs as backward-compatible deep links.
>
> 2. Barber Authentication
> - Reuse the existing barber-specific backend authentication and Argon2id credential store.
> - Do not alter, reset or reinitialize any saved credentials.
> - Do not expose PINs or credential hashes.
> - Show clear messages for incorrect PIN, unconfigured account and unavailable server.
> - Add Sign Out and Switch Barber actions.
> - Prevent one barber's session from accessing another barber's assignments.
> - Ensure switching accounts clears the previous barber session safely.
>
> 3. Modern Barber Dashboard
> - Professional charcoal and gold styling consistent with the rest of the app.
> - Mobile-first responsive layout.
> - Clear welcome header, barber name and current duty/availability status.
> - Large current customer card with token, customer name, selected services and duration.
> - Large accessible Start Service and Complete Service buttons.
> - Clear Available / On Break controls.
> - Next eligible customer preview when provided by the backend.
> - Clear empty state when no customer is assigned.
> - Live Socket.IO updates, reconnection handling and loading/error states.
> - Good visual hierarchy, spacing, typography and touch-friendly buttons.
> - English and Gujarati translations.
>
> 4. Navigation
> - Add a clear Barber Portal entry in the app navigation.
> - Users should not have to type or edit a barber name in the URL.
> - Keep the existing Owner, Reception, Customer and TV routes working.
>
> 5. Safety
> - Preserve existing queue FCFS rules and barber preferences.
> - Preserve all current SQLite queue records, services, settings and credential hashes.
> - Do not modify production or real local database data during tests.
> - Do not weaken authentication or expose private information.
> - Do not change unrelated screens unnecessarily.
>
> 6. Automated verification
> - Add Playwright tests for /barber selection, each barber, PIN login, logout and switching, unauthorized access, Start and Done, availability and break, English and Gujarati, 320px and 390px widths, no horizontal overflow, and existing direct links.
> - Use an isolated in-memory or disposable SQLite database.
> - Run credential security tests, Steps 4–6 regression tests, existing Playwright tests and both production builds.
> - Report actual PASS/FAIL counts and changed files.
>
> IMPORTANT:
> - Do not modify or delete real SQLite database records.
> - Do not reset saved barber or owner credentials.
> - Do not commit, push or deploy automatically.
> - Do not expose secrets or tokens.
>
> Proceed with implementation and automated verification now.

---

### Waiting Area Display Navigation and Fullscreen
**Date:** 2026-11-24
**Prompt:**
> Improve the Waiting Area TV Display UI in my existing Salon Queue Management System BEFORE committing or pushing to GitHub.
>
> CURRENT PROBLEM:
> The /display page has no visible Back, Home, Exit or fullscreen controls. Users get stuck in the TV view and must manually edit the URL to leave.
>
> GOAL:
> Make the TV Display professional, responsive and easy to exit, without reducing its effectiveness as a waiting-area screen.
>
> IMPLEMENT:
>
> 1. TV Navigation Controls
>
> - Add a clearly accessible Home button that navigates to /.
> - Add a Back button that returns to a safe previous page, or Home if there is no safe same-origin history.
> - Add an Exit Display button that navigates to /.
> - Add an Enter/Exit Fullscreen toggle using the browser Fullscreen API.
> - Keep an always-discoverable Exit Display control; do not make all exit/navigation controls permanently invisible.
> - Controls must be usable with mouse, touch and keyboard.
> - The Escape key should exit browser fullscreen using normal browser behavior. Do not trap Escape or attempt to close the browser tab.
>
> 2. TV UI Improvements
>
> - Preserve the existing charcoal and gold theme.
> - Keep current serving tokens, barber status, and next five waiting tokens as the primary visual focus.
> - Design a compact, unobtrusive header/toolbar with navigation and fullscreen controls.
> - Ensure the toolbar does not obstruct queue information or animations.
> - Optimize for 1920x1080 TV screens and smaller desktop/tablet viewports.
> - Support English and Gujarati.
> - Add appropriate hover, focus-visible, and touch feedback.
> - Respect reduced-motion preferences.
> - Avoid unnecessary scrolling or horizontal overflow at 1920x1080.
>
> 3. Preserve Existing Functionality
>
> - Socket.IO real-time updates and reconnect handling.
> - The 30-second fallback refresh.
> - Newly Called token highlights.
> - Strict FCFS ordering of the first five Waiting tokens.
> - TV privacy: never show customer names, phone numbers, or private details.
> - Existing Reception, Barber, Owner, Customer and Home screens must continue working.
>
> 4. Automated Tests
>
> - Playwright test that Home and Exit Display navigate correctly.
> - Test Back button behavior with and without safe navigation history.
> - Test fullscreen enter and exit where the browser supports the API.
> - Verify navigation works with keyboard.
> - Verify 1920x1080 layout and responsive behavior.
> - Verify English and Gujarati controls.
> - Verify TV privacy, Socket.IO live updates, reconnect and highlight behavior.
>
> 5. Safety
>
> - Do not modify or delete the real SQLite database, WAL/SHM files, customer records, services, settings or credentials.
> - Use isolated SQLite for automated tests.
> - Do not introduce authentication to the public TV view.
> - Do not commit, push or deploy automatically.
>
> Run the existing Playwright suite, Steps 4–6 regression tests and both production builds.
>
> After implementation, report:
>
> - Files changed.
> - Actual PASS/FAIL/SKIPPED results.
> - Screenshots of the updated TV Display.
> - Any remaining limitations.
>
> Proceed with implementation and automated testing now.

---

### Reception Call Next investigation
**Date:** 2026-11-24
**Prompt:**
> Before GitHub push and deployment, investigate and fix a bug in the Reception Dashboard of my existing Salon Queue Management System.
>
> REPORTED ISSUE:
> In Reception Dashboard (/reception), barber Amit appears to show the "Call" action repeatedly, even when the queue or barber state should have changed.
>
> Do not assume the root cause. Investigate and reproduce it first.
>
> 1. Inspect ReceptionPage.tsx, receptionService.ts, queueService.ts, queueSelection.ts, barberService.ts, the SQLite schema and Socket.IO event handling.
> 2. Reproduce the reported Amit scenario using isolated SQLite fixtures and the actual Reception UI through Playwright. Test each state: Available, Called, In Chair, Done, On Break and Off Duty.
> 3. Verify that the correct barber ID and state are used throughout the frontend and backend. Check for name/ID mapping bugs specific to Amit.
> 4. Investigate stale state, duplicate Call Next requests, optimistic UI updates, race conditions, polling, and Socket.IO reconnect handling.
> 5. Ensure the Reception action reflects the actual server state:
>    - Available with no active assignment: Call Next allowed when an eligible customer exists.
>    - Called: Show the assigned token and appropriate Called status; do not permit another Call Next.
>    - In Chair: Show Busy / In Service; do not permit another Call Next.
>    - Done: Barber becomes Available and Call Next becomes eligible again.
>    - On Break or Off Duty: Call Next disabled.
>    - No eligible waiting ticket: clearly show no eligible customer instead of an active Call action.
> 6. Ensure server-side validation prevents duplicate or concurrent calls even if the UI mistakenly enables the button.
> 7. Verify first-come-first-served rules and barber preferences remain correct.
> 8. After Call Next, Reception, Barber Portal, Customer My Status and TV Display should synchronize through existing Socket.IO events. Include reconnect/fallback refresh checks.
> 9. Fix only confirmed bugs. Do not rewrite unrelated features or alter established business rules.
> 10. Run automated tests covering Amit specifically and compare his behavior with Ravi and Imran. Add a regression test to prevent this issue from recurring.
> 11. Run Step 4, Step 5, Step 6, credential security and Playwright tests, plus frontend/backend builds.
>
> SAFETY:
>
> - Do not modify, reset or delete my real backend/salon.db, WAL/SHM files, customer records, settings or credentials.
> - Stop or avoid any development watcher that might touch the real database.
> - Use isolated SQLite for tests.
> - Do not expose customer data or credentials.
> - Do not commit, push or deploy automatically.
>
> After fixing, report:
>
> - Exact root cause, with file/function references.
> - What was changed.
> - Actual PASS/FAIL/SKIPPED counts.
> - Whether Amit's Call action behaves correctly across all states.
> - Database checksum verification.
> - Any unresolved issues.
>
> Proceed with investigation, fixes and automated verification.

---

### Final GitHub Commit and Push
**Date:** 2026-11-24
**Prompt:**
> FINAL GITHUB PUSH — Salon Queue Management System
>
> My application is now working correctly. All development, UI improvements, and bug fixes are complete.
>
> Please perform the FINAL GitHub commit and push to my existing repository:
> [https://github.com/dhrutikpatoriya/salon-queue-management.git](https://github.com/dhrutikpatoriya/salon-queue-management.git)
>
> 1. Check git status, current branch, remote, and recent commits.
> 2. Fetch origin/main and verify there is no unexpected divergence.
> 3. Identify all pending Owner Dashboard, secure credential management, Barber Portal, PIN login, TV navigation, Reception fixes, frontend and backend improvements, English/Gujarati translations, tests, documentation and prompts.md changes.
> 4. Run available security tests, regression tests, Playwright E2E tests, and frontend/backend production builds.
> 5. Fix any confirmed critical failures and rerun affected tests.
> 6. Stage only appropriate source code, configuration templates, lockfiles, tests, and documentation. Do not use git add .
> 7. Never stage actual environment files or credentials, SQLite database files or backups, WAL/SHM files, assignment PDFs or ZIPs, screenshots, test artifacts, node_modules, or dist directories.
> 8. Verify .env.example contains placeholders only.
> 9. Scan staged changes for secrets, tokens, password hashes, and private customer data.
> 10. Run git diff --cached --check and review staged filenames.
> 11. If all checks pass, commit with the message: Finalize Salon Queue Management System
> 12. Push to origin/main without force.
> 13. Verify local main is 0 ahead and 0 behind origin/main.
> 14. Report the final commit hash, test results, and Git status.
>
> Preserve the existing SQLite database and saved credentials. Do not reset or delete records or rewrite Git history. Stop if secrets, unresolved test failures, or remote divergence are detected. Do not deploy or purchase hosting yet. Do not ask unnecessary questions.
>
> Proceed with the final GitHub verification, commit, and push now.

## Final deployment and submission preparation

> Prepare the existing project for one Render Web Service serving React, Express and Socket.IO on the same origin. Require persistent SQLite and safe production startup, secure CORS, authentication, developer endpoints and configuration, and preserve the local database and credentials. Write the root README, exact Render deployment instructions, a three-minute mobile demo script and a half-page reflection. Run all tests, builds and deployment checks against disposable databases, scan for secrets and commit and push if tests pass and the remote has not diverged. Do not provision a paid service, upload the local database or publish an unverified live URL.

> Resume the interrupted deployment work from the verified checkpoint. Preserve local data and saved credentials, complete the verification and safe GitHub push, and keep hosting strictly at ₹0. If Render Free cannot provide persistent SQLite, explain the limitation and document the safest free alternative while keeping the startup safeguards intact.

> Use Railway Free only for the final deployment. Verify the account, plan, CLI and persistent volume before provisioning. Keep the single-origin React, Express, Socket.IO and SQLite stack, require persistent storage, protect credentials and leave local data untouched. Test and push readiness changes, automate what the free account permits, and publish the live URL only after public HTTPS and restart checks pass. Stop before any payment step.

> Inspect the latest failed Railway deployment and identify the first startup error before making changes. Verify the public origin, mounted SQLite volume and path, credential bootstrap, runtime and networking ports, and the healthcheck. Preserve the production safeguards and keep billing disabled.

> Verify the deployed Railway HTTPS homepage and health endpoint. If reachable, publish the verified URL directly below the README title, identify Railway as the host, and confirm the README links to the prompt history, demo script, and reflection. Commit and push documentation only. Leave application functionality, the deployed database, and credentials untouched.
