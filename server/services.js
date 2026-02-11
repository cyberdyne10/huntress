const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { db, nowIso } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '12h';

function createJwt(user) {
  const jti = `${user.id}-${Date.now()}`;
  const token = jwt.sign({ sub: String(user.id), role: user.role, email: user.email, jti }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
  const decoded = jwt.decode(token);
  db.prepare('INSERT INTO sessions(user_id,token_jti,expires_at,created_at) VALUES(?,?,?,?)')
    .run(user.id, jti, new Date(decoded.exp * 1000).toISOString(), nowIso());
  return token;
}

function verifyJwt(token) {
  const payload = jwt.verify(token, JWT_SECRET);
  const session = db.prepare('SELECT * FROM sessions WHERE token_jti = ? AND revoked_at IS NULL').get(payload.jti);
  if (!session) throw new Error('Session revoked');
  return payload;
}

function revokeSession(jti) {
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE token_jti = ?').run(nowIso(), jti);
}

function createMailer() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_PORT) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

const mailer = createMailer();

function logNotification({ eventType, recipient, subject, payload, status, retryCount = 0, errorMessage = null }) {
  const ts = nowIso();
  db.prepare('INSERT INTO notification_logs(event_type,recipient,subject,payload_json,status,retry_count,error_message,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(eventType, recipient, subject, JSON.stringify(payload || {}), status, retryCount, errorMessage, ts, ts);
}

async function sendBookingNotification(booking, type = 'confirmation') {
  const subject = type === 'reminder' ? `Reminder: Huntress demo ${booking.slotId}` : `Booking confirmed ${booking.id}`;
  const text = `Hi ${booking.fullName}, your booking (${booking.id}) for slot ${booking.slotId} is ${type}.`;

  if (!mailer) {
    logNotification({ eventType: `booking-${type}`, recipient: booking.email, subject, payload: booking, status: 'logged-fallback' });
    return { delivered: false, mode: 'log-fallback' };
  }

  try {
    await mailer.sendMail({
      from: process.env.SMTP_FROM || 'noreply@huntress.local',
      to: booking.email,
      subject,
      text,
    });
    logNotification({ eventType: `booking-${type}`, recipient: booking.email, subject, payload: booking, status: 'sent' });
    return { delivered: true, mode: 'smtp' };
  } catch (error) {
    logNotification({
      eventType: `booking-${type}`,
      recipient: booking.email,
      subject,
      payload: booking,
      status: 'failed',
      retryCount: 1,
      errorMessage: error.message,
    });
    return { delivered: false, mode: 'smtp-failed' };
  }
}

module.exports = {
  createJwt,
  verifyJwt,
  revokeSession,
  sendBookingNotification,
};
