const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const nodemailer = require('nodemailer');
const AppError = require('../utils/AppError');
const emailBrandName = process.env.EMAIL_BRAND_NAME || 'UtkriX Technologies';

const getTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) {
    throw new AppError('Email delivery is not configured. Configure SMTP settings and retry.', 503);
  }

  const port = Number(SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new AppError('SMTP_PORT must be a valid TCP port.', 503);
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
};

const getFrontendUrl = () => {
  const frontendUrl = process.env.FRONTEND_URL;
  if (!frontendUrl) {
    throw new AppError('FRONTEND_URL must be configured for account emails', 503);
  }

  try {
    return new URL(frontendUrl).origin;
  } catch {
    throw new AppError('FRONTEND_URL must be a valid URL', 503);
  }
};

const assertEmailConfigured = () => {
  getTransporter();
  getFrontendUrl();
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

const renderEmail = ({ preview, title, intro, body, actionUrl, actionLabel }) => `
  <!doctype html>
  <html lang="en">
    <body style="margin:0;padding:0;background-color:#f2f5f7;color:#243746;font-family:Arial,Helvetica,sans-serif;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f2f5f7;padding:32px 12px;">
        <tr><td align="center">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #dfe6eb;">
            <tr><td style="padding:22px 32px;background-color:#123b4a;color:#ffffff;font-size:18px;font-weight:bold;">
              ${escapeHtml(emailBrandName)}
            </td></tr>
            <tr><td style="padding:32px;">
              <h1 style="margin:0 0 18px;color:#183b4e;font-size:24px;line-height:1.3;">${escapeHtml(title)}</h1>
              <p style="margin:0 0 18px;font-size:15px;line-height:1.65;">${escapeHtml(intro)}</p>
              ${body}
              ${actionUrl ? `<p style="margin:26px 0;"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:13px 22px;background-color:#176b63;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;">${escapeHtml(actionLabel)}</a></p>` : ''}
              <p style="margin:26px 0 0;font-size:14px;line-height:1.6;color:#52636d;">Regards,<br>${escapeHtml(emailBrandName)} Team</p>
            </td></tr>
            <tr><td style="padding:16px 32px;border-top:1px solid #e5eaee;color:#687780;font-size:12px;line-height:1.5;">
              This is an automated message from ${escapeHtml(emailBrandName)}. Please do not share one-time codes or password reset links.
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
  </html>
`;

const sendAccountEmail = async ({ to, subject, actionPath, token, actionName, expiresIn }) => {
  const transporter = getTransporter();
  const actionUrl = new URL(getFrontendUrl());
  actionUrl.hash = `/${actionPath}?token=${encodeURIComponent(token)}`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text: `Use this one-time ${actionName} token within ${expiresIn}: ${token}\n\nOr open: ${actionUrl.toString()}`,
    html: renderEmail({
      preview: `Your ${actionName} instructions`,
      title: subject,
      intro: `Use the button below to complete your ${actionName}.`,
      body: `<div style="margin:22px 0;padding:18px;background-color:#f2f5f7;border-left:4px solid #176b63;"><p style="margin:0 0 8px;color:#52636d;font-size:13px;">Your one-time code</p><strong style="font-size:20px;letter-spacing:1px;color:#183b4e;">${escapeHtml(token)}</strong></div><p style="margin:0;font-size:14px;line-height:1.6;color:#52636d;">This code expires in ${escapeHtml(expiresIn)}. If you did not request this, you can safely ignore this email.</p>`,
      actionUrl: actionUrl.toString(),
      actionLabel: 'Continue securely',
    }),
  });
};

const sendContactMessage = async ({ name, email, phone, subject, message }) => {
  const transporter = getTransporter();
  const recipient = process.env.CONTACT_TO || process.env.SMTP_USER;
  if (!recipient) {
    throw new AppError('Contact email recipient is not configured.', 503);
  }

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone || 'Not provided');
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message);

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: recipient,
    replyTo: { name, address: email },
    subject: 'New contact form message',
    text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}\nSubject: ${subject}\n\n${message}`,
    html: renderEmail({
      preview: `New inquiry from ${name}`,
      title: 'New website inquiry',
      intro: 'A visitor submitted the contact form. Reply directly to this email to respond.',
      body: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;border-collapse:collapse;font-size:14px;"><tr><td style="padding:9px;border-bottom:1px solid #e5eaee;font-weight:bold;">Name</td><td style="padding:9px;border-bottom:1px solid #e5eaee;">${safeName}</td></tr><tr><td style="padding:9px;border-bottom:1px solid #e5eaee;font-weight:bold;">Email</td><td style="padding:9px;border-bottom:1px solid #e5eaee;">${safeEmail}</td></tr><tr><td style="padding:9px;border-bottom:1px solid #e5eaee;font-weight:bold;">Phone</td><td style="padding:9px;border-bottom:1px solid #e5eaee;">${safePhone}</td></tr><tr><td style="padding:9px;border-bottom:1px solid #e5eaee;font-weight:bold;">Subject</td><td style="padding:9px;border-bottom:1px solid #e5eaee;">${safeSubject}</td></tr></table><div style="padding:16px;background-color:#f2f5f7;font-size:14px;line-height:1.65;">${safeMessage.replace(/\r?\n/g, '<br>')}</div>`,
    }),
  });
};

const sendSupportNotification = async ({ channel, name, email, message }) => {
  const transporter = getTransporter();
  const recipient = process.env.CONTACT_TO || process.env.SMTP_USER;
  if (!recipient) {
    throw new AppError('Contact email recipient is not configured.', 503);
  }

  const safeName = escapeHtml(name);
  const safeMessage = escapeHtml(message);
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: recipient,
    replyTo: { name, address: email },
    subject: `New website message for the ${channel} team`,
    text: `New message for the ${channel} team\nFrom: ${name} <${email}>\n\n${message}`,
    html: renderEmail({
      preview: `New ${channel} support message`,
      title: `New ${channel} support message`,
      intro: `A visitor sent a message to the ${channel} team. Reply directly to this email to respond.`,
      body: `<p style="margin:0 0 12px;font-size:14px;"><strong>From:</strong> ${safeName} &lt;${escapeHtml(email)}&gt;</p><div style="padding:16px;background-color:#f2f5f7;font-size:14px;line-height:1.65;">${safeMessage.replace(/\r?\n/g, '<br>')}</div>`,
    }),
  });
};

const sendSupportReplyNotification = async ({ to, name, channel, message }) => {
  const transporter = getTransporter();
  const safeMessage = escapeHtml(message);
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: 'A new reply to your UtkriX support conversation',
    text: `${name} replied in your ${channel} support conversation:\n\n${message}`,
    html: renderEmail({
      preview: 'A new reply is waiting in your support conversation',
      title: 'New support reply',
      intro: `${name} replied in your ${channel} support conversation.`,
      body: `<div style="padding:16px;background-color:#f2f5f7;font-size:14px;line-height:1.65;">${safeMessage.replace(/\r?\n/g, '<br>')}</div>`,
    }),
  });
};

const sendEmailVerification = (user, token) => sendAccountEmail({
  to: user.email,
  subject: 'Verify your E-Learning account',
  actionPath: 'verify-email',
  token,
  actionName: 'email verification',
  expiresIn: '24 hours',
});

const sendPasswordReset = (user, token) => sendAccountEmail({
  to: user.email,
  subject: 'Reset your E-Learning password',
  actionPath: 'password-reset',
  token,
  actionName: 'password reset',
  expiresIn: '1 hour',
});

const sendInstructorApproval = async (user) => {
  const transporter = getTransporter();
  const frontendUrl = getFrontendUrl();
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: user.email,
    subject: 'Congratulations! Your Instructor Account Has Been Approved',
    text: `Dear ${user.name},\n\nYour instructor account on Utkrista Shikshya has been approved by the administrator.\n\nYou can now create and publish courses on the platform.\n\nLogin to your dashboard at ${frontendUrl} to get started.\n\nBest regards,\nUtkrista Shikshya Team`,
    html: renderEmail({
      preview: 'Your instructor account has been approved',
      title: 'Your instructor account is approved',
      intro: `Hello ${user.name}, your instructor account has been approved. You can now create and publish courses.`,
      body: '<p style="font-size:14px;line-height:1.65;">Sign in to your dashboard to set up your first course and share it with learners.</p>',
      actionUrl: frontendUrl,
      actionLabel: 'Open your dashboard',
    }),
  });
};

module.exports = {
  assertEmailConfigured,
  sendEmailVerification,
  sendPasswordReset,
  sendContactMessage,
  sendSupportNotification,
  sendSupportReplyNotification,
  sendInstructorApproval,
};
