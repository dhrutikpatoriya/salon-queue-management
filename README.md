# Salon Queue Management System
**Live demo:** [Salon Queue Management System](https://salon-queue-demo-production.up.railway.app) (hosted on Railway)

A same-day salon queue with customer self-service, reception controls, individual barber sessions, a public waiting-area display, and owner settings. The app supports English and Gujarati.

## Screens

| Route | What you can do |
|---|---|
| `/` | See salon hours, queue status, and online joining availability. |
| `/join` | Choose services and a barber preference, then join today's queue. |
| `/status/:id` | Track an assigned token and see when you are called. |
| `/reception` | Add walk-ins, call the next eligible ticket, and handle cancellations and no-shows. |
| `/barber`, `/barber/:name` | Pick a barber profile, sign in, and start or complete service. |
| `/display` | View public tokens and barber availability, with fullscreen and exit controls. |
| `/admin` | Manage hours, online joining, services, barber duty, and staff credentials. |

## Run locally

Use Node **22.23.5** for the verified build setup. From the repository root:

```sh
npm run install:all
cp -n .env.example .env
npm run dev
```

Open `http://localhost:5173`. The Vite development server proxies API and live updates to the backend on `5001`. Configure distinct local owner, reception, and barber credentials in ignored `.env` before trying the staff screens. Use [Staff Access setup](docs/04-staff-access.md) to initialize or change credentials. The regular local backend uses `backend/salon.db`. Automated tests use isolated SQLite.

## Architecture

```text
Browser
  ├─ React/Vite static assets and frontend routes
  ├─ /api/*       Express JSON endpoints
  └─ /socket.io  Queue update notifications
                   └─ SQLite on the service's persistent disk
```

Production uses one Express service and one public HTTPS origin. SQLite stores queue records and salted Argon2id staff credential hashes. Sessions and login limits are held in the backend process. The TV uses a public response with token labels and barber states, without customer contact details. The server enforces FCFS among eligible tickets and keeps barber preferences attached to their tickets.

## Verification

```sh
npm run build:render
npm --prefix backend run test:production
npm --prefix backend run test:credentials
npm --prefix backend run test:step4
npm --prefix backend run test:step5
npm --prefix backend run test:step6
PATH="$PWD/node_modules/.bin:$PATH" PLAYWRIGHT_BROWSERS_PATH=0 playwright install chromium
npm run test:e2e
```

If using installed Google Chrome, run `SALON_E2E_BROWSER_CHANNEL=chrome npm run test:e2e`. The test server uses separate ports and in-memory SQLite. The restart tests use disposable files. The production readiness suite needs both builds. See the [deployment guide](docs/deploy-render.md) for the Step 3 security commands and public smoke test.

## Deployment and submission

- [Railway Free setup, persistence and verification](docs/deploy-railway.md)
- [Three-minute mobile demo script](docs/demo-script.md)
- [Half-page reflection](docs/reflection.md)
- [Prompt history](prompts.md)
- [GitHub repository](https://github.com/dhrutikpatoriya/salon-queue-management)

The public demo uses a fresh database. Use invented customer information. Share evaluator-only staff access privately and use screenshots with fixture data.
