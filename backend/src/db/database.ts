import Database from 'better-sqlite3';
import path from 'path';
import { tmpdir } from 'node:os';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    for (const file of [filename, filename + '-wal', filename + '-shm', filename + '-journal']) {
      const entry = fs.lstatSync(file, { throwIfNoEntry: false });
      if (entry && (!entry.isFile() || entry.nlink !== 1)) throw new Error('Invalid disposable SQLite path');
    }
    return filename;
  }
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
