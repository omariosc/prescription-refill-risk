-- NOTE: DO NOT drop users/sessions tables on re-deploy — it destroys all logins.
-- Only uncomment the DROP lines for a full reset.
-- DROP TABLE IF EXISTS sessions;
-- DROP TABLE IF EXISTS users;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  organization TEXT NOT NULL DEFAULT '',
  totp_secret TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'clinician' CHECK (role IN ('admin', 'clinician', 'patient', 'pending_clinician')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_email TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('app_push', 'in_app_survey', 'phone_call', 'letter', 'gp_consultation')),
  message TEXT NOT NULL,
  from_name TEXT NOT NULL DEFAULT 'Your Care Team',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  read INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_notifications_patient ON notifications(patient_email);

CREATE TABLE IF NOT EXISTS questionnaires (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_email TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  drug_name TEXT NOT NULL,
  drug_ndc TEXT,
  fill_date TEXT NOT NULL,
  completed_at TEXT,
  due_at TEXT NOT NULL,
  reminder_sent INTEGER NOT NULL DEFAULT 0,
  responses TEXT,
  effectiveness_score REAL,
  side_effects_score REAL,
  quality_of_life_score REAL,
  adherence_risk_score REAL,
  recommended_intervention TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'dismissed'))
);
CREATE INDEX IF NOT EXISTS idx_questionnaires_patient ON questionnaires(patient_email);
