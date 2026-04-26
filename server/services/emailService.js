const nodemailer = require("nodemailer");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;

  if (!host || !user || !pass) return null;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

function getFromAddress() {
  return process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER || "noreply@blustup.local";
}

function getBaseUrl() {
  return process.env.BASE_URL || process.env.APP_URL || "http://localhost:3000";
}

async function sendMail(to, subject, html) {
  const transport = getTransporter();

  if (!transport) {
    console.log("─── EMAIL (SMTP not configured, printing to console) ───");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(html);
    console.log("────────────────────────────────────────────────────────");
    return { consoleFallback: true };
  }

  return transport.sendMail({
    from: getFromAddress(),
    to,
    subject,
    html,
  });
}

async function sendVerificationEmail(email, token) {
  const link = `${getBaseUrl()}/#verify-email?token=${encodeURIComponent(token)}`;
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
      <h2 style="color:#111827;">Verify your email</h2>
      <p>Welcome to Blustup! Click the button below to verify your email address.</p>
      <p style="margin:24px 0;">
        <a href="${link}" style="display:inline-block;padding:12px 28px;background:#111827;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Verify Email</a>
      </p>
      <p style="font-size:13px;color:#6b7280;">If the button doesn't work, copy and paste this link: ${link}</p>
    </div>
  `;

  return sendMail(email, "Verify your email — Blustup", html);
}

async function sendPasswordResetEmail(email, token) {
  const link = `${getBaseUrl()}/#reset-password?token=${encodeURIComponent(token)}`;
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
      <h2 style="color:#111827;">Reset your password</h2>
      <p>We received a request to reset your password. Click the button below to choose a new password. This link expires in 1 hour.</p>
      <p style="margin:24px 0;">
        <a href="${link}" style="display:inline-block;padding:12px 28px;background:#111827;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Reset Password</a>
      </p>
      <p style="font-size:13px;color:#6b7280;">If you didn't request this, you can safely ignore this email.</p>
      <p style="font-size:13px;color:#6b7280;">Direct link: ${link}</p>
    </div>
  `;

  return sendMail(email, "Reset your password — Blustup", html);
}

module.exports = {
  sendMail,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
