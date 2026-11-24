import { db } from './database.js';
import { getLocalTodayDate } from '../utils/timeUtils.js';

export function initializeDatabaseSchema() {
  // 1. Enable WAL mode for high concurrency
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 2. Services Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_gu TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('hair', 'beard', 'spa', 'color')),
      duration_minutes INTEGER NOT NULL CHECK(duration_minutes > 0),
      price INTEGER NOT NULL CHECK(price >= 0),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1))
    );
  `);

  // 3. Barbers Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS barbers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'busy', 'break', 'off_duty')),
      is_on_duty INTEGER NOT NULL DEFAULT 1 CHECK(is_on_duty IN (0, 1))
    );
  `);

  // 4. Queue Entries Table
  // Mandatory Correction 1: UNIQUE(created_date, token_number) enforces daily token uniqueness
  db.exec(`
    CREATE TABLE IF NOT EXISTS queue_entries (
      id TEXT PRIMARY KEY,
      token_number INTEGER NOT NULL CHECK(token_number > 0),
      token_display TEXT NOT NULL,
      customer_name TEXT NOT NULL CHECK(length(customer_name) >= 2),
      phone_number TEXT NOT NULL CHECK(length(phone_number) = 10),
      barber_preference TEXT NOT NULL,
      assigned_barber_id TEXT,
      status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting', 'called', 'in_chair', 'done', 'cancelled', 'no_show')),
      access_token TEXT NOT NULL,
      total_duration_minutes INTEGER NOT NULL CHECK(total_duration_minutes > 0),
      total_price INTEGER NOT NULL CHECK(total_price >= 0),
      is_walk_in INTEGER NOT NULL DEFAULT 0 CHECK(is_walk_in IN (0, 1)),
      created_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      called_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      cancelled_at TEXT,
      FOREIGN KEY (assigned_barber_id) REFERENCES barbers(id) ON UPDATE CASCADE ON DELETE SET NULL,
      UNIQUE(created_date, token_number)
    );
  `);

  // 5. Partial Unique Index: Only ONE active ticket per phone number per day in (waiting, called, in_chair)
  db.exec(`
    DROP INDEX IF EXISTS idx_active_phone;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_active_phone 
    ON queue_entries(created_date, phone_number) 
    WHERE status IN ('waiting', 'called', 'in_chair');
  `);

  // 6. Fast Lookup Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_queue_date_status ON queue_entries(created_date, status);
    CREATE INDEX IF NOT EXISTS idx_queue_access_token ON queue_entries(id, access_token);
  `);

  // 7. Junction Table: Services attached to each queue ticket
  db.exec(`
    CREATE TABLE IF NOT EXISTS queue_services (
      queue_id TEXT NOT NULL,
      service_id TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL CHECK(duration_minutes > 0),
      price INTEGER NOT NULL CHECK(price >= 0),
      PRIMARY KEY (queue_id, service_id),
      FOREIGN KEY (queue_id) REFERENCES queue_entries(id) ON DELETE CASCADE,
      FOREIGN KEY (service_id) REFERENCES services(id) ON UPDATE CASCADE
    );
  `);

  // 8. Salon Settings Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS salon_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Mandatory Correction 4: Safe, idempotent schema migration
  const queueColumns = db.prepare(`PRAGMA table_info(queue_entries)`).all() as Array<{ name: string }>;
  const hasIsWalkIn = queueColumns.some((c) => c.name === 'is_walk_in');
  if (!hasIsWalkIn) {
    db.exec(`ALTER TABLE queue_entries ADD COLUMN is_walk_in INTEGER NOT NULL DEFAULT 0 CHECK(is_walk_in IN (0, 1));`);
    console.log('[Database] Idempotent migration: added is_walk_in column to queue_entries');
  }

  // Seed default services if empty
  const serviceCount = db.prepare('SELECT count(*) as count FROM services').get() as { count: number };
  if (serviceCount.count === 0) {
    const insertService = db.prepare(`
      INSERT INTO services (id, name_en, name_gu, category, duration_minutes, price, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);

    const initialServices = [
      ['haircut', 'Classic Haircut', 'ક્લાસિક હેરકટ', 'hair', 30, 150],
      ['beard-trim', 'Beard Trim & Shape', 'દાઢી ટ્રીમ અને શેપ', 'beard', 15, 80],
      ['hair-spa', 'Premium Hair Spa', 'પ્રીમિયમ હેર સ્પા', 'spa', 45, 400],
      ['shave-massage', 'Royal Shave & Face Massage', 'રોયલ શેવ અને ફેસ મસાજ', 'beard', 25, 120],
      ['hair-color', 'Hair Coloring', 'હેર કલરિંગ', 'color', 40, 350],
      ['head-massage', 'Ayurvedic Head Massage', 'આયુર્વેદિક હેડ મસાજ', 'spa', 20, 100]
    ];

    const seedTransaction = db.transaction(() => {
      for (const s of initialServices) {
        insertService.run(s[0], s[1], s[2], s[3], s[4], s[5]);
      }
    });
    seedTransaction();
    console.log('[Database] Seeded initial salon services');
  }

  // Seed default barbers if empty
  const barberCount = db.prepare('SELECT count(*) as count FROM barbers').get() as { count: number };
  if (barberCount.count === 0) {
    const insertBarber = db.prepare(`
      INSERT INTO barbers (id, name, status, is_on_duty)
      VALUES (?, ?, ?, 1)
    `);

    const initialBarbers = [
      ['ravi', 'Ravi', 'available'],
      ['amit', 'Amit', 'available'],
      ['imran', 'Imran', 'available']
    ];

    const seedBarbersTransaction = db.transaction(() => {
      for (const b of initialBarbers) {
        insertBarber.run(b[0], b[1], b[2]);
      }
    });
    seedBarbersTransaction();
    console.log('[Database] Seeded initial barbers');
  }

  // Seed salon settings
  db.prepare(`
    INSERT OR IGNORE INTO salon_settings (key, value) VALUES
    ('is_open', '1'),
    ('open_time', '09:00'),
    ('close_time', '21:00'),
    ('online_joining_enabled', '1')
  `).run();

  // Close uncompleted leftover tickets from previous calendar days as 'no_show' without deleting records
  const today = getLocalTodayDate();
  db.prepare(`
    UPDATE queue_entries 
    SET status = 'no_show' 
    WHERE created_date < ? AND status IN ('waiting', 'called')
  `).run(today);

  console.log('[Database] Schema initialization and integrity checks verified');
}
