import { production } from '../config/environment.js';
import Database from 'better-sqlite3';
import path from 'path';
import { tmpdir } from 'node:os';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function rejectUnsafeFiles(filename: string) {
  for (const file of [filename, filename + '-wal', filename + '-shm', filename + '-journal']) {
    const entry = fs.lstatSync(file, { throwIfNoEntry: false });
    if (entry && (!entry.isFile() || entry.nlink !== 1)) throw new Error('Invalid SQLite file or sidecar');
  }
}

function productionDatabasePath() {
  const configured = process.env.SQLITE_DB_PATH;
  if (!configured || !path.isAbsolute(configured)) throw new Error('Production requires an absolute SQLITE_DB_PATH');
  const filename = path.resolve(configured);
  const directory = fs.realpathSync(path.dirname(filename));
  if (directory !== path.dirname(filename) || filename === path.resolve(__dirname, '../../salon.db')) {
    throw new Error('Production requires a dedicated SQLite directory');
  }
  if (process.env.RENDER === 'true') {
    // A writable directory alone could still be on Render’s ephemeral filesystem.
    if (directory !== '/var/data' || process.platform !== 'linux' ||
        !fs.readFileSync('/proc/self/mountinfo', 'utf8').split('\n').some((line) => line.split(' ')[4] === directory)) {
      throw new Error('Render persistent disk is not mounted at /var/data');
    }
  }
  fs.accessSync(directory, fs.constants.W_OK | fs.constants.X_OK);
  rejectUnsafeFiles(filename);
  return filename;
}

function databasePath() {
  const testDirectory = process.env.SALON_PERSISTENCE_TEST_DIR;
  if (testDirectory) {
    if (process.env.NODE_ENV !== 'test') throw new Error('Disposable SQLite requires test mode');
    const directory = fs.realpathSync(testDirectory);
    if (path.dirname(directory) !== fs.realpathSync(tmpdir()) ||
        !path.basename(directory).startsWith('salon-persistence-')) {
      throw new Error('Disposable SQLite requires a dedicated OS temporary directory');
    }
    const filename = path.join(directory, 'test.sqlite');
    rejectUnsafeFiles(filename);
    return filename;
  }
  if (production) return productionDatabasePath();
  return process.env.NODE_ENV === 'test' ? ':memory:' : path.resolve(__dirname, '../../salon.db');
}

const dbPath = databasePath();

export const db = new Database(dbPath);

// Enable WAL mode for optimal concurrent performance
db.pragma('journal_mode = WAL');

// Active health check executing an actual SQL query
export function checkDbHealth(): { ok: boolean; message: string } {
  try {
    const row = db.prepare('SELECT 1 as result').get() as { result: number } | undefined;
    if (row && row.result === 1) {
      return { ok: true, message: 'SQLite connection verified with test query' };
    }
    return { ok: false, message: 'Unexpected database query result' };
  } catch (error: any) {
    return { ok: false, message: error?.message || 'Database connection error' };
  }
}
