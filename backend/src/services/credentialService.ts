import { production } from '../config/environment.js';
import { createHash, timingSafeEqual } from 'node:crypto';
import { argon2id, hash, verify, type HashOptions } from 'argon2';
import { db } from '../db/database.js';

export type AccountId = 'owner' | 'reception' | `barber:${string}`;
type Credential = { hash: string; secret?: never } | { secret: string; hash?: never };

const hashOptions: HashOptions = { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };
const retainedHistory = 5;
// Fingerprint of the retired development template value for the denylist.
const retiredTemplate = "9ffb11ba6b3bfa2394f6646c8755956dbe389cd13315745817178e5df8f2baf7";
const legacyBarbers = ['ravi', 'amit', 'imran'];

function barberEnvironment(): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(process.env.BARBER_CREDENTIALS || '{}');
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch {
    // Invalid configuration cannot authenticate a barber.
  }
  return {};
}

function environmentCredential(id: AccountId) {
  const staff = process.env.STAFF_PIN?.trim();
  if (id === 'reception') return staff && staff.length >= 4 && staff.length <= 128 ? staff : undefined;
  const barbers = barberEnvironment();
  if (id === 'owner') {
    const owner = process.env.OWNER_PASSWORD;
    if (!owner?.trim() || owner.length < 12 || owner.length > 256 ||
        owner === staff || Object.values(barbers).includes(owner)) return;
    return owner;
  }
  const barber = id.slice('barber:'.length);
  const credential = Object.hasOwn(barbers, barber) ? barbers[barber] : undefined;
  if (typeof credential === 'string' && credential.trim() && credential.length >= 4 && credential.length <= 128 &&
      Object.values(barbers).filter((value) => value === credential).length === 1) return credential;
}

export function credentialAccounts(): Array<{ id: AccountId; name?: string }> {
  const table = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'barbers'").get();
  const barbers = table
    ? db.prepare('SELECT id, name FROM barbers ORDER BY name, id').all() as Array<{ id: string; name: string }>
    : legacyBarbers.map((id) => ({ id, name: id }));
  return [
    { id: 'owner' }, { id: 'reception' },
    ...barbers.map(({ id, name }) => ({ id: `barber:${id}` as const, name })),
  ];
}

function storedHash(id: AccountId) {
  return (db.prepare('SELECT password_hash FROM account_credentials WHERE account_id = ?').get(id) as { password_hash: string } | undefined)?.password_hash;
}

function loadCredential(id: AccountId): Credential | undefined {
  const stored = storedHash(id);
  if (stored !== undefined) return { hash: stored };
  if (production) return undefined;
  const secret = environmentCredential(id);
  if (secret !== undefined) return { secret };
}

export function isCredentialConfigured(id: AccountId): boolean {
  const credential = loadCredential(id);
  return Boolean(credential && (credential.hash === undefined || credential.hash.startsWith('$argon2id$')));
}

function digest(value: string) {
  return createHash('sha256').update(value).digest();
}

export function credentialVersion(id: AccountId) {
  const credential = loadCredential(id);
  if (!credential) return;
  return digest(credential.hash !== undefined ? 'stored:' + credential.hash : 'env:' + credential.secret).toString('hex');
}

async function matches(credential: Credential, value: string) {
  if (credential.hash === undefined) return timingSafeEqual(digest(credential.secret), digest(value));
  if (!credential.hash.startsWith('$argon2id$')) return false;
  try {
    return await verify(credential.hash, value);
  } catch {
    // A bad stored record fails closed, even if an environment credential exists.
    return false;
  }
}

export async function verifyAccount(id: AccountId, input: unknown) {
  const version = credentialVersion(id);
  const credential = loadCredential(id);
  if (!credential || !version) return { status: 'unavailable' } as const;
  if (typeof input !== 'string' || input.length > 256 ||
      !await matches(credential, id === 'reception' ? input.trim() : input) ||
      credentialVersion(id) !== version) return { status: 'invalid' } as const;
  return { status: 'valid', version } as const;
}

export function strongCredential(id: AccountId, value: unknown): value is string {
  if (typeof value !== 'string' || value !== value.trim() || /[\p{Cc}\p{Cf}]/u.test(value)) return false;
  if (digest(value).toString('hex') === retiredTemplate) return false;
  const lower = value.toLowerCase();
  const compact = lower.replace(/[^a-z0-9]/g, '');
  if (/^(?:password|passcode|changeme|salon|admin|qwerty)(?:[0-9]*)$/.test(compact)) return false;
  if (/^(.)\1+$/.test(value) || (compact.length >= 4 && ('01234567890123456789'.includes(compact) || '98765432109876543210'.includes(compact)))) return false;
  if (id !== 'owner' && /^\d{10,32}$/.test(value)) return new Set(value).size >= 4;
  return value.length >= (id === 'owner' ? 16 : 14) &&
    value.length <= (id === 'owner' ? 256 : 128) && /\p{L}/u.test(value) &&
    (!/^\p{L}+$/u.test(value) || value.length >= 20);
}

export class CredentialError extends Error {
  constructor(public readonly status: number, code: string) { super(code); }
}

const insertMissing = db.transaction((entries: Array<{ id: AccountId; encoded: string }>) => {
  const insert = db.prepare('INSERT OR IGNORE INTO account_credentials(account_id, password_hash) VALUES (?, ?)');
  return entries.reduce((count, entry) => count + insert.run(entry.id, entry.encoded).changes, 0);
});

export async function bootstrapCredentials(strict = false) {
  const pending = credentialAccounts().filter(({ id }) => storedHash(id) === undefined);
  const configured = pending.map(({ id }) => {
    const secret = environmentCredential(id);
    if (secret === undefined || (strict && !strongCredential(id, secret))) {
      throw new CredentialError(400, 'bootstrapCredentialUnavailable');
    }
    return { id, secret };
  });
  if (new Set(configured.map(({ secret }) => secret)).size !== configured.length) {
    throw new CredentialError(400, 'bootstrapCredentialUnavailable');
  }
  for (const { id } of credentialAccounts()) {
    const encoded = storedHash(id);
    if (!encoded) continue;
    for (const { secret } of configured) {
      if (await matches({ hash: encoded }, secret)) throw new CredentialError(400, 'bootstrapCredentialUnavailable');
    }
  }
  const entries = [];
  for (const { id, secret } of configured) entries.push({ id, encoded: await hash(secret, hashOptions) });
  return insertMissing.immediate(entries);
}

const storeReplacement = db.transaction((id: AccountId, versions: Map<AccountId, string | undefined>, encoded: string, previous?: string) => {
  for (const [account, version] of versions) {
    if (credentialVersion(account) !== version) throw new CredentialError(409, 'securityChanged');
  }
  db.prepare(`
    INSERT INTO account_credentials(account_id, password_hash) VALUES (?, ?)
    ON CONFLICT(account_id) DO UPDATE SET password_hash = excluded.password_hash
  `).run(id, encoded);
  if (previous) db.prepare('INSERT INTO credential_history(account_id, password_hash) VALUES (?, ?)').run(id, previous);
  db.prepare(`
    DELETE FROM credential_history WHERE account_id = ? AND id NOT IN (
      SELECT id FROM credential_history WHERE account_id = ? ORDER BY id DESC LIMIT ?
    )
  `).run(id, id, retainedHistory);
});

export async function changeAccountCredential(
  id: AccountId, submitted: unknown, confirmation: unknown, verifiedOwnerVersion: string,
  ownerSessionIsCurrent: () => boolean,
) {
  const accounts = credentialAccounts();
  if (!accounts.some((account) => account.id === id)) throw new CredentialError(404, 'accountMissing');
  if (submitted !== confirmation) throw new CredentialError(400, 'confirmationMismatch');
  if (!strongCredential(id, submitted)) throw new CredentialError(400, 'weakCredential');

  const versions = new Map(accounts.map((account) => [account.id, credentialVersion(account.id)]));
  if (versions.get('owner') !== verifiedOwnerVersion) throw new CredentialError(409, 'securityChanged');
  for (const { id: account } of accounts) {
    const current = loadCredential(account);
    if (current && await matches(current, submitted)) throw new CredentialError(409, 'reusedCredential');
  }
  const history = db.prepare('SELECT password_hash FROM credential_history WHERE account_id = ?')
    .all(id) as Array<{ password_hash: string }>;
  for (const entry of history) {
    if (await matches({ hash: entry.password_hash }, submitted)) throw new CredentialError(409, 'reusedCredential');
  }

  const current = loadCredential(id);
  const previous = current?.hash ?? (current?.secret ? await hash(current.secret, hashOptions) : undefined);
  const encoded = await hash(submitted, hashOptions);
  if (!ownerSessionIsCurrent()) throw new CredentialError(401, 'sessionExpired');
  storeReplacement.immediate(id, versions, encoded, previous);
}
