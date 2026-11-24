# Hosting with persistent SQLite

The repository serves React, Express, and Socket.IO from one HTTPS origin. Start with a **fresh demo database**. Keep the local database and its backups on your Mac.

## ₹0 hosting decision

Render Free uses ephemeral storage and cannot attach a persistent disk. The application intentionally refuses to start on Render without the disk mounted at `/var/data`. In the Render dashboard, stop before selecting **Deploy Web Service** or applying the Blueprint. There is no Render Free configuration for this SQLite build that meets the persistence requirement. Render's free Postgres database expires after 30 days and would require changing the app's data layer. [Render Free limits](https://render.com/docs/free)

### Free alternative with the current SQLite build

Use one Oracle Cloud Infrastructure **Always Free** Linux VM with an Always Free boot or block volume in the tenancy's home region. Confirm both resources are marked Always Free, stay within those limits, and keep the account on the Free Tier. Capacity can be unavailable, and Oracle can reclaim idle instances. Keep an off-VM backup made with SQLite's backup API. [Oracle Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)

1. Clone this repository on the VM and install the Node version in `.node-version`. Run `npm run build:render`.
2. Create a private persistent directory such as `/srv/salon-data`, writable by a dedicated non-root app user. Set `SQLITE_DB_PATH=/srv/salon-data/salon.db` and start with an empty path. If using a separate volume, make the service depend on its mount (for example, systemd `RequiresMountsFor=/srv/salon-data`).
3. Set the production variables from the table below in a private service environment file outside the repository. On a VM, set `PORT=5001` and `PUBLIC_ORIGIN` to your actual public HTTPS origin. Run `npm start` as a systemd service. Use a TLS reverse proxy such as Caddy with a hostname you control and proxy all requests to `127.0.0.1:5001`, including WebSocket upgrades. Allow inbound HTTPS and any HTTP needed for certificate issuance. Keep port 5001 private.
4. Run the health check and phone walkthrough in section 3. After bootstrap, remove the three seed credential variables, turn bootstrap off, and restart to confirm credentials and demo data survive. Add the verified URL to the README and record the demo. This alternative has not been provisioned or verified.

## Render reference for a future paid deployment

The dashboard instructions below and `render.yaml` require a paid instance and disk. Leave them unused under the ₹0 requirement.

## 1. Create the service

1. In Render, choose **New → Web Service**, connect GitHub, and select `dhrutikpatoriya/salon-queue-management`.
2. Check the dashboard total before confirming. A paid service is required for an attached persistent disk. [Render pricing](https://render.com/pricing) · [Persistent disk requirements](https://render.com/docs/disks)
3. Enter these fields. The repository's [render.yaml](../render.yaml) is an equivalent Blueprint if you prefer **New → Blueprint**. Use one method.

| Dashboard field | Enter |
|---|---|
| Name | `salon-queue-demo`, or an available name of your choice |
| Branch | `main` |
| Root Directory | Leave blank to use the repository root |
| Runtime | Node |
| Region | Choose the nearest offered region for your audience |
| Instance Type | Starter, one instance |
| Build Command | `npm run build:render` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Auto-Deploy | Off for the initial release |
| Advanced → Add Disk | Name `salon-data`, mount `/var/data`, size **1 GB** |

The Node version comes from `.node-version`. Do not configure a different `NODE_VERSION` in the dashboard. The disk is available at runtime, so initialization belongs to the start command. [Render web service fields](https://render.com/docs/web-services) · [Runtime disk availability](https://render.com/docs/disks)

## 2. Set production environment variables

Add the following in the service's **Environment** section before the first deploy. Generate independent credentials in a password manager, using at least 20 random characters including letters for each. Paste them only into the dashboard or evaluator's private handoff.

| Key | Value or action |
|---|---|
| `NODE_ENV` | `production` |
| `SQLITE_DB_PATH` | `/var/data/salon.db` |
| `BOOTSTRAP_CREDENTIALS` | `true` for the first start |
| `ENABLE_DEV_TEST` | `false` |
| `STAFF_PIN` | Fresh reception passcode |
| `OWNER_PASSWORD` | Separate owner password |
| `BARBER_CREDENTIALS` | A JSON object with the keys `ravi`, `amit`, and `imran`, each mapped to a distinct private passcode |
| `PORT` and `RENDER_EXTERNAL_URL` | Leave to Render |
| `PUBLIC_ORIGIN` | Leave unset for the built-in Render URL. For a future custom domain, enter its exact HTTPS origin and use that origin for the demo. |

Leave `DEV_TEST_SECRET` and all local/test variables unset. Using the service's default domain needs no DNS work. The production entry point requires an HTTPS origin, a writable mounted disk on Render, and database-backed staff credentials. It rejects foreign browser origins for HTTP and Socket.IO. [Render environment variables](https://render.com/docs/environment-variables) · [Render WebSockets](https://render.com/docs/websocket)

## 3. Deploy, verify and publish the URL

1. Select **Deploy Web Service**. Confirm the disk is attached and wait for the deploy to go live. In Logs, check for the listener message and any startup error. Review the deploy commit against GitHub.
2. Copy the generated HTTPS address from the Render dashboard. For example, in a terminal set `LIVE_URL` by typing the actual address when prompted:

   ```sh
   printf 'Actual HTTPS URL from Render: '
   read -r LIVE_URL
   curl -fsS "${LIVE_URL%/}/api/health"
   ```

   Expect HTTP 200 with database status `connected`. Open the URL on your phone using mobile data, then reload `/display` and `/barber/ravi` to check direct routes.
3. Sign in to `/admin`, `/reception`, and the Barber Portal privately. During salon hours, join with dummy data, call the ticket from Reception, then Start and Complete service in Barber View. Check that My Status and the public TV update. Check the public TV for token-only customer information.
4. In Render, set `BOOTSTRAP_CREDENTIALS=false` and remove `STAFF_PIN`, `BARBER_CREDENTIALS`, and `OWNER_PASSWORD` from the service environment after verifying sign-in. Deploy the settings change and verify sign-in, the dummy ticket, and settings survived. A deploy or restart ends existing sessions.
5. Confirm `POST /api/dev/call-customer/nonexistent` returns 404. Publish the **actual verified URL** directly below the README title. Record and link the demo video. Share evaluator-only demo credentials privately.

If the service refuses to start, check the environment and disk configuration in Render. Keep the mounted disk in place. For future changes, make a consistent SQLite backup with the SQLite backup API and keep an encrypted copy outside the disk. Test a restore on a disposable copy and keep real data out of the public demo. Render disk deploys may briefly interrupt service. [Render disk behavior](https://render.com/docs/disks) · [SQLite backup API](https://www.sqlite.org/backup.html)

## Local verification commands

From the repository root, run:

```sh
npm run build:render
npm --prefix backend run test:production
npm --prefix backend run test:credentials
npm --prefix backend run test:step4
npm --prefix backend run test:step5
npm --prefix backend run test:step6
NODE_ENV=test SALON_E2E_RUN_ID=release-review SALON_PERSISTENCE_TEST_DIR='' \
  node --import ./tests/e2e/clock.mjs backend/dist/tests/verifyStep3.js
NODE_ENV=test SALON_E2E_RUN_ID=release-review SALON_PERSISTENCE_TEST_DIR='' \
  node --import ./tests/e2e/clock.mjs backend/dist/tests/securityIntegrationReview.js
SALON_E2E_BROWSER_CHANNEL=chrome npm run test:e2e
```

Production readiness tests start the compiled server with a disposable SQLite file. The real Render mount, HTTPS edge, and a public phone connection must be verified after deployment.
