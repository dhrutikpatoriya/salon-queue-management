# Deploy on Railway Free

Railway documents a ₹0 plan with no card, one 0.5 GB persistent volume and US$1 of monthly usage credit. Verify the workspace actually shows **Free** and offers the volume before deploying. Stop if asked for a card, an upgrade, or paid billing. The Free service can sleep and stop serving requests when the credit runs out. Close TV tabs after the demo. An open Socket.IO connection can keep the service awake. [Railway Free plan](https://docs.railway.com/pricing/free-plan) · [Volume limits](https://docs.railway.com/volumes/reference)

1. Sign in to Railway and confirm the workspace plan. Connect GitHub and create one service from `dhrutikpatoriya/salon-queue-management`, branch `main`. If the first deploy starts automatically, its startup guards will prevent it serving until the volume, credentials and production settings are ready.
2. Open the service settings and configure the following fields. Use the repository root and one replica. [Railway service settings](https://docs.railway.com/deployments) · [Railpack Node settings](https://railpack.com/languages/node/)

   | Field | Value |
   |---|---|
   | Builder | Railpack |
   | Build Command | `npm run build:render` |
   | Start Command | `npm start` |
   | Healthcheck Path | `/api/health` |
   | Public Networking | Generate Domain |
   | Persistent volume | Attach one Free volume to this service at `/var/data` |

3. Under **Variables**, set the following. Enter secrets in Railway's private variable editor. Generate distinct random values of at least 20 characters in a password manager. The JSON barber map should contain exactly `ravi`, `amit`, and `imran`, each with a different passcode. Start with an empty volume. [Railway variable settings](https://docs.railway.com/variables) · [Railway built-in variables](https://docs.railway.com/variables/reference)

   | Variable | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `SQLITE_DB_PATH` | `/var/data/salon.db` |
   | `BOOTSTRAP_CREDENTIALS` | `true` for initial deployment |
   | `ENABLE_DEV_TEST` | `false` |
   | `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` | `10` for graceful shutdown |
   | `STAFF_PIN` | Reception passcode |
   | `OWNER_PASSWORD` | Owner password |
   | `BARBER_CREDENTIALS` | Private JSON map |

   Let Railway provide `PORT`, `RAILWAY_PROJECT_ID`, `RAILWAY_VOLUME_MOUNT_PATH`, and `RAILWAY_PUBLIC_DOMAIN`. Leave `PUBLIC_ORIGIN` and `DEV_TEST_SECRET` unset. Railpack reads the repository's `.node-version`. Railway terminates HTTPS on the generated domain and forwards HTTP and WebSocket traffic to the same service.

4. Apply the changes and deploy. Open the generated HTTPS URL on mobile data. Check `/api/health` for HTTP 200 and a connected database, then reload `/display` and `/barber/ravi` directly. Verify sign-in for owner, reception and barber. Add a dummy ticket during salon hours, call it from Reception, and watch My Status and the TV update. Confirm the developer endpoint `POST /api/dev/call-customer/nonexistent` returns 404.
5. Set `BOOTSTRAP_CREDENTIALS=false` and remove the three seed credential variables after verifying successful sign-in. Redeploy with the same attached volume. Confirm the dummy data and settings survive and the same credentials still work. Existing sessions end on restart, so sign in again.
6. Add the verified HTTPS URL directly below the README title and record the [three-minute demo](demo-script.md). Share evaluator access details privately.
