# AGENTS.md — Salon Queue Management System

This project is a **same-day salon queue web app**: customers join from their phones, track live waiting position and receive call alerts; reception and barbers run the queue; a TV displays current and upcoming tokens; the owner controls services, staff and online joining.

## Read Before Every Task
- `docs/01-brief.md` — purpose, users, must-have features and exclusions.
- `docs/02-screens.md` — all **seven** screens, their routes, layouts, actions and states.
- `docs/03-flows-rules.md` — customer/walk-in flows, queue rules, barber matching, waiting-time estimation and tests.

Use the documents as the product specification. If a requirement is ambiguous, explain your assumption before implementing it.

## Stack and Development
- Frontend: **React + Vite + TypeScript + Tailwind CSS**.
- Backend: **Node.js + Express**, with **Socket.IO** for live updates.
- Data: **SQLite** for local development; choose a deployment-safe persistent solution before production.
- Configure a simple root **`npm run dev`** command to run the app locally and document exact setup commands.
- Hosting target: **Vercel** frontend and **Render/Railway** backend where required.
- Avoid mixing incompatible Tailwind version configurations.

## Design and Localization
- Premium salon style: **charcoal #1F2937** and **gold #D4A017**, rounded cards, readable high-contrast text.
- Phone-first for Home, Join, My Status and Barber; tablet landscape for Reception; 1920×1080 full-screen TV display.
- All customer-facing and staff interface labels must come from a shared **English/Gujarati (EN/GU)** translation system; never hard-code one language throughout UI components.
- Use realistic sample barber names (Ravi, Amit, Imran) and salon services priced in **₹**.

## Working Rules
1. Work in the **current project root**. Do not create a second project elsewhere.
2. Read `docs/` before code changes. Build one screen or feature per task; do not build the entire app in a single prompt.
3. Keep **barber eligibility, FCFS order, status transitions, no-show and duplicate phone** logic centralized and enforce it on the backend.
4. Preserve exact barber preferences; do not silently reassign customers to other barbers.
5. Validate phone numbers, service limits and prices on the backend as well as in the UI.
6. Keep customer, receptionist, barber and TV views synchronized within approximately five seconds; reconnect and refresh from authoritative data if necessary.
7. Never add online payment, future appointments, SMS/WhatsApp, loyalty programs or multi-branch features.
8. Protect existing planning documents, source files and Git history; never delete or overwrite unrelated content.
9. For major work: show an implementation plan and changed-file list before making edits.
10. After each task: list changed files, exact run commands, and manual/automated test results. Do not claim PASS unless actually verified.
11. Add `.gitignore` for dependencies, build outputs, `.env` secrets, local databases and `.DS_Store`. Do not commit real credentials.
12. Do not deploy or push automatically without explicit approval.

## Completion and Submission
- Complete and verify all seven screens and the checklist in `docs/03-flows-rules.md`.
- Create `prompts.md` recording **every** agent prompt, including unsuccessful attempts, in chronological order.
- Keep source in GitHub with commits after working steps.
- Deploy a working phone-accessible live application; place **Live demo:** link immediately after the README title. Provide **test-only** staff PIN/login details if staff screens use them.
- Prepare a three-minute demo video and half-page reflection on one AI error and how it was corrected.
