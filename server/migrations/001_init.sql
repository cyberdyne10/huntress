PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'client',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_jti TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS demo_slots (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  timezone TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  booked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_ref TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  full_name TEXT,
  email TEXT,
  company TEXT,
  size TEXT,
  message TEXT,
  score INTEGER,
  band TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  source TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS demo_bookings (
  id TEXT PRIMARY KEY,
  slot_id TEXT NOT NULL,
  lead_id INTEGER,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  attendees INTEGER NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(slot_id) REFERENCES demo_slots(id),
  FOREIGN KEY(lead_id) REFERENCES leads(id)
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  payload_json TEXT,
  status TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS threat_feed_items (
  id TEXT PRIMARY KEY,
  threat TEXT NOT NULL,
  severity TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  mitre_tags TEXT,
  published_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS status_incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_ref TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  severity TEXT NOT NULL,
  started_at TEXT NOT NULL,
  resolved_at TEXT,
  summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS status_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  component TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crm_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER,
  direction TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(lead_id) REFERENCES leads(id)
);

CREATE INDEX IF NOT EXISTS idx_demo_slots_date ON demo_slots(date);
CREATE INDEX IF NOT EXISTS idx_bookings_slot_id ON demo_bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notification_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_status_incidents_status ON status_incidents(status);
