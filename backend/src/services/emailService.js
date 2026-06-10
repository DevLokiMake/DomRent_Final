import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password
  },
});

const isConfigured = () => !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);

export const sendPasswordResetEmail = async (toEmail, resetLink) => {
  if (!isConfigured()) {
    console.warn('[email] EMAIL_USER / EMAIL_PASS not set — skipping email');
    return;
  }

  await transporter.sendMail({
    from: `"DomRent" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Сброс пароля DomRent',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:16px">
        <h2 style="color:#0f172a;margin-bottom:8px">Сброс пароля</h2>
        <p style="color:#64748b;margin-bottom:24px">Вы запросили сброс пароля для аккаунта DomRent.</p>
        <a href="${resetLink}"
           style="display:inline-block;padding:14px 28px;background:#f43f5e;color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:15px">
          Сбросить пароль
        </a>
        <p style="color:#94a3b8;margin-top:24px;font-size:13px">
          Ссылка действительна 1 час. Если вы не запрашивали сброс — проигнорируйте это письмо.
        </p>
      </div>
    `,
  });
};
