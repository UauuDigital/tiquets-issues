const nodemailer = require('nodemailer');

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, NOTIFY_EMAIL } = process.env;
const emailEnabled = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && NOTIFY_EMAIL);

let mailer = null;
if (emailEnabled) {
  mailer = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
} else {
  console.warn(
    'AVIS: falten variables SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS, NOTIFY_EMAIL). ' +
    'No s\'enviaran correus de notificació dels tiquets nous.'
  );
}

async function notifyByEmail({ title, url, number, repoLabel }) {
  if (!mailer) return;
  try {
    await mailer.sendMail({
      from: SMTP_USER,
      to: NOTIFY_EMAIL,
      subject: `[${repoLabel}] Nou tiquet #${number}: ${title}`,
      text: `S'ha creat un tiquet nou a "${repoLabel}".\n\n${title}\n\n${url}`
    });
  } catch (err) {
    console.error('Error enviant la notificació per correu:', err);
  }
}

module.exports = { notifyByEmail };
