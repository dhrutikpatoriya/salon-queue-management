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
