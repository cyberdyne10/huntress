const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DATABASE_URL || path.resolve(__dirname, '../data/huntress.sqlite');
const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

function runMigrations() {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    db.exec(sql);
  }
}

function nowIso() {
  return new Date().toISOString();
}

function seedDefaults() {
  const slotCount = db.prepare('SELECT COUNT(1) AS c FROM demo_slots').get().c;
  if (!slotCount) {
    const seedSlots = [
      { id: 'SLOT-001', date: '2026-02-15', time: '10:00', timezone: 'Africa/Lagos', capacity: 3, booked: 1 },
      { id: 'SLOT-002', date: '2026-02-15', time: '14:00', timezone: 'Africa/Lagos', capacity: 2, booked: 0 },
      { id: 'SLOT-003', date: '2026-02-16', time: '11:30', timezone: 'Africa/Lagos', capacity: 4, booked: 2 },
    ];
    const stmt = db.prepare('INSERT INTO demo_slots(id,date,time,timezone,capacity,booked,created_at) VALUES(?,?,?,?,?,?,?)');
    for (const slot of seedSlots) {
      stmt.run(slot.id, slot.date, slot.time, slot.timezone, slot.capacity, slot.booked, nowIso());
    }
  }

  const userCount = db.prepare('SELECT COUNT(1) AS c FROM users').get().c;
  if (!userCount) {
    const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@huntress.local').toLowerCase();
    const adminPass = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe!123';
    const hash = bcrypt.hashSync(adminPass, 12);
    const ts = nowIso();
    db.prepare('INSERT INTO users(email,password_hash,full_name,role,created_at,updated_at) VALUES(?,?,?,?,?,?)')
      .run(adminEmail, hash, 'Portal Admin', 'admin', ts, ts);
  }

  const snapCount = db.prepare('SELECT COUNT(1) AS c FROM status_snapshots').get().c;
  if (!snapCount) {
    db.prepare('INSERT INTO status_snapshots(component,status,message,created_at) VALUES(?,?,?,?)')
      .run('platform', 'operational', 'All systems normal', nowIso());
  }

  const incidentCount = db.prepare('SELECT COUNT(1) AS c FROM status_incidents').get().c;
  if (!incidentCount) {
    const ts = nowIso();
    db.prepare('INSERT INTO status_incidents(incident_ref,title,status,severity,started_at,resolved_at,summary,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run('INC-0001', 'Initial baseline incident record', 'resolved', 'low', ts, ts, 'Seeded baseline incident for status history.', ts, ts);
  }
}

function initDb() {
  runMigrations();
  seedDefaults();
}

module.exports = {
  db,
  initDb,
  nowIso,
};
