const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM_EMAIL;
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
const ADMIN_NOTIFY_EMAILS = (process.env.ADMIN_NOTIFY_EMAILS || '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

if (!RESEND_API_KEY || !FROM) {
  console.warn(
    "AVIS: falten RESEND_API_KEY o RESEND_FROM_EMAIL. " +
    "No s'enviaran els correus de verificacio, rebuig ni notificacio a l'admin."
  );
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

async function send({ to, subject, html }) {
  if (!resend) return;
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error('Error enviant correu amb Resend:', err);
  }
}

async function sendVerificationEmail({ to, nom, token }) {
  const url = `${PUBLIC_BASE_URL}/api/auth/verificar-email?token=${encodeURIComponent(token)}`;
  await send({
    to,
    subject: 'Confirma el teu correu — Portal de tiquets UAUU',
    html: `
      <p>Hola ${nom},</p>
      <p>Hem rebut la teva sol·licitud d'accés al portal de tiquets. Confirma que aquest és el teu correu:</p>
      <p><a href="${url}">Confirmar el meu correu</a></p>
      <p>Un cop confirmat, un administrador revisarà la sol·licitud.</p>
    `
  });
}

async function sendAdminNotificationEmail({ nom, email, missatge }) {
  if (!ADMIN_NOTIFY_EMAILS.length) return;
  const url = `${PUBLIC_BASE_URL}/solicituds-admin.html`;
  await send({
    to: ADMIN_NOTIFY_EMAILS,
    subject: `Nova sol·licitud d'accés: ${nom}`,
    html: `
      <p>${nom} (${email}) ha sol·licitat accés al portal de tiquets.</p>
      <p><strong>Missatge:</strong> ${missatge || '—'}</p>
      <p><a href="${url}">Revisar sol·licituds pendents</a></p>
    `
  });
}

async function sendRejectedEmail({ to, nom }) {
  await send({
    to,
    subject: 'Sobre la teva sol·licitud d\'accés — Portal de tiquets UAUU',
    html: `
      <p>Hola ${nom},</p>
      <p>De moment no podem donar-te accés al portal de tiquets. Si creus que és un error, contacta amb l'equip digital.</p>
    `
  });
}

module.exports = { sendVerificationEmail, sendAdminNotificationEmail, sendRejectedEmail };
