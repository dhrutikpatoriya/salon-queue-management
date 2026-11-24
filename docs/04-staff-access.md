# Staff Access and credential initialization

The owner can change the reception passcode, a barber passcode, or the owner password in **Owner Settings → Staff Access and Security**. Enter the current owner password and the new credential twice. Each change checks the current owner password for that request. A successful change signs out every session for the affected account. Other accounts stay signed in.

## Initialize credentials explicitly

Use the existing `STAFF_PIN`, `OWNER_PASSWORD`, and `BARBER_CREDENTIALS` settings. The barber setting is a JSON object keyed by the existing barber IDs. Set values in a Git-ignored local `.env` or the host’s backend secret settings. Existing installations can keep using valid environment credentials for accounts that have not been initialized.

1. Stop the app connected to the intended database and make a consistent SQLite backup. Confirm the database location before running the command. The current local default is `backend/salon.db`.
2. From the repository root, build the backend and run the explicit initializer with the intended database environment.

   ```sh
   npm --prefix backend run build
   npm --prefix backend run credentials:bootstrap
   ```

3. The command reports the number of newly initialized accounts. It fails if required starting credentials are missing or invalid. A successful rerun skips existing accounts and preserves changes made in the dashboard. Sign in again if the accounts were just initialized.

For production, complete the Step 7 persistent storage setup before running the command. Run it in a controlled shell on the host with the same storage and environment that the app will use, before exposing the service. Set `NODE_ENV=production` and provide independent, strong initial credentials for all accounts that still need initialization. The owner password needs at least 16 characters. A staff passcode needs at least 14 characters, or a randomly chosen PIN of 10–32 digits. Common defaults, repeated values, and simple sequences are rejected. For a fresh database the initializer knows the default roster, and normal app startup seeds the roster. The initializer itself only creates or fills the credential tables.

Use this invocation in that production shell after the build:

```sh
NODE_ENV=production npm --prefix backend run credentials:bootstrap
```

Verify each sign-in after initialization. Bootstrap secrets may then be removed from the host once every account has a database-backed credential. An existing hash always takes precedence over the environment, including after a dashboard change. Never pass credentials in command-line arguments, query strings, or frontend environment variables.

## Storage and sessions

SQLite stores Argon2id hashes with independent salts. Each account keeps its five most recent retired hashes to block reuse alongside the current credentials. Backups contain these hashes and require the same access controls as the active database. Keep a backup before changing the owner password or applying deployment changes. After restoring an older backup, verify the active credentials and rotate any that were retired after that backup.

Sessions and rate limits live in process memory. A restart requires sign-in and resets the rate-limit counters. Run one app instance with the current architecture. A future multi-instance deployment would need shared rate limits and an explicit session strategy. Credential changes check the database version so old sessions lose access on their next authorized request.

## Set a barber PIN for the first time

In **Owner Settings → Staff Access and Security**, choose **Set PIN or passcode** beside Ravi, Amit, or Imran. Enter the current owner password, then enter a fresh PIN twice and save. A numeric PIN needs 10–32 digits and must avoid obvious patterns. The barber can sign in immediately at `/barber/ravi`, `/barber/amit`, or `/barber/imran`. After the first save the action becomes **Change PIN or passcode**. The owner can use this workflow even when `BARBER_CREDENTIALS` is empty. Bulk bootstrap is optional for individual setup.
