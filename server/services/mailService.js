const nodemailer = require("nodemailer");

let transporterPromise = null;

function getMailConfig() {
  return {
    host: String(process.env.SMTP_HOST || "").trim(),
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "").trim().toLowerCase() === "true",
    user: String(process.env.SMTP_USER || "").trim(),
    pass: String(process.env.SMTP_PASS || "").trim(),
    from: String(process.env.REPORT_EMAIL_FROM || process.env.SMTP_FROM || "").trim(),
  };
}

function isMailConfigured() {
  const config = getMailConfig();
  return Boolean(config.host && config.user && config.pass && config.from);
}

async function getTransporter() {
  if (!isMailConfigured()) return null;
  if (!transporterPromise) {
    const config = getMailConfig();
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      })
    );
  }
  return transporterPromise;
}

async function sendMail({ to, subject, text, html }) {
  if (!isMailConfigured()) {
    return { sent: false, reason: "mail_not_configured" };
  }

  const transporter = await getTransporter();
  const config = getMailConfig();
  const info = await transporter.sendMail({
    from: config.from,
    to,
    subject,
    text,
    html,
  });

  return {
    sent: true,
    messageId: info.messageId || null,
  };
}

module.exports = {
  getMailConfig,
  isMailConfigured,
  sendMail,
};
