import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.NODE_ENV === 'test'
  ? ':memory:'
  : path.resolve(__dirname, '../../salon.db');

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

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
