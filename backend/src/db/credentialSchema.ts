import { db } from './database.js';

export function initializeCredentialSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS account_credentials (
      account_id TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS credential_history (
      id INTEGER PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES account_credentials(account_id),
      password_hash TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_credential_history_account
      ON credential_history(account_id, id);
  `);
}
