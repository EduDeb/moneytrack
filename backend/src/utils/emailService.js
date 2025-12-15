const nodemailer = require('nodemailer');

// Criar transporter baseado no ambiente
const createTransporter = () => {
  // Em produção, usar configuração SMTP real
  if (process.env.NODE_ENV === 'production') {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true para 465, false para outros
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  // Em desenvolvimento, usar Ethereal (email de teste)
  // Ou usar configuração local se disponível
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  // Fallback: criar conta de teste Ethereal
  return null;
};

// Template base de email
const baseTemplate = (content) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MoneyTrack</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 500px; border-collapse: collapse;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 14px; display: inline-flex; align-items: center; justify-content: center;">
                <span style="color: white; font-size: 28px; font-weight: bold;">$</span>
              </div>
              <h1 style="margin: 16px 0 0 0; font-size: 24px; font-weight: 700; color: #1f2937;">MoneyTrack</h1>
            </td>
          </tr>

          <!-- Content Card -->
          <tr>
            <td style="background: white; border-radius: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); padding: 40px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 32px;">
              <p style="margin: 0; font-size: 13px; color: #9ca3af;">
                Este email foi enviado automaticamente pelo MoneyTrack.
              </p>
              <p style="margin: 8px 0 0 0; font-size: 13px; color: #9ca3af;">
                Se você não solicitou esta ação, ignore este email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// Template de reset de senha
const passwordResetTemplate = (userName, resetUrl) => {
  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1f2937; text-align: center;">
      Redefinição de Senha
    </h2>
    <p style="margin: 0 0 24px 0; font-size: 15px; color: #6b7280; line-height: 1.6; text-align: center;">
      Olá${userName ? ` ${userName}` : ''},<br>
      Recebemos uma solicitação para redefinir sua senha.
    </p>
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
      <tr>
        <td align="center" style="padding: 8px 0 24px 0;">
          <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px;">
            Redefinir Senha
          </a>
        </td>
      </tr>
    </table>
    <p style="margin: 0 0 16px 0; font-size: 14px; color: #9ca3af; text-align: center;">
      Ou copie e cole este link no seu navegador:
    </p>
    <p style="margin: 0 0 24px 0; font-size: 13px; color: #3b82f6; word-break: break-all; text-align: center; background: #f3f4f6; padding: 12px; border-radius: 8px;">
      ${resetUrl}
    </p>
    <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 8px;">
      <p style="margin: 0; font-size: 13px; color: #9ca3af; text-align: center;">
        <strong>Importante:</strong> Este link expira em 30 minutos.
      </p>
    </div>
  `;
  return baseTemplate(content);
};

// Template de confirmação de mudança de senha
const passwordChangedTemplate = (userName) => {
  const content = `
    <div style="text-align: center;">
      <div style="width: 56px; height: 56px; background: #dcfce7; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
        <span style="color: #22c55e; font-size: 28px;">✓</span>
      </div>
    </div>
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1f2937; text-align: center;">
      Senha Alterada com Sucesso
    </h2>
    <p style="margin: 0 0 24px 0; font-size: 15px; color: #6b7280; line-height: 1.6; text-align: center;">
      Olá${userName ? ` ${userName}` : ''},<br>
      Sua senha foi alterada com sucesso.
    </p>
    <div style="background: #fef3c7; border-radius: 10px; padding: 16px; margin-top: 16px;">
      <p style="margin: 0; font-size: 14px; color: #92400e; text-align: center;">
        <strong>Não foi você?</strong><br>
        Se você não fez essa alteração, entre em contato conosco imediatamente.
      </p>
    </div>
  `;
  return baseTemplate(content);
};

// Template de boas-vindas
const welcomeTemplate = (userName) => {
  const content = `
    <div style="text-align: center;">
      <div style="width: 56px; height: 56px; background: #dbeafe; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
        <span style="color: #3b82f6; font-size: 28px;">🎉</span>
      </div>
    </div>
    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #1f2937; text-align: center;">
      Bem-vindo ao MoneyTrack!
    </h2>
    <p style="margin: 0 0 24px 0; font-size: 15px; color: #6b7280; line-height: 1.6; text-align: center;">
      Olá ${userName},<br>
      Sua conta foi criada com sucesso! Estamos felizes em ter você conosco.
    </p>
    <p style="margin: 0 0 24px 0; font-size: 15px; color: #6b7280; line-height: 1.6; text-align: center;">
      Com o MoneyTrack você pode:
    </p>
    <ul style="margin: 0 0 24px 24px; padding: 0; font-size: 14px; color: #6b7280; line-height: 1.8;">
      <li>Controlar suas receitas e despesas</li>
      <li>Acompanhar seus investimentos</li>
      <li>Gerenciar suas dívidas</li>
      <li>Definir e alcançar metas financeiras</li>
      <li>Visualizar relatórios detalhados</li>
    </ul>
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
      <tr>
        <td align="center">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px;">
            Acessar Minha Conta
          </a>
        </td>
      </tr>
    </table>
  `;
  return baseTemplate(content);
};

// Enviar email
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    let transporter = createTransporter();

    // Se não há transporter configurado, criar conta de teste
    if (!transporter) {
      console.log('[EMAIL] Criando conta de teste Ethereal...');
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || '"MoneyTrack" <noreply@moneytrack.app>',
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, '') // Fallback para texto plano
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`[EMAIL] Email enviado: ${info.messageId}`);

    // Se usando Ethereal, mostrar URL de preview
    if (info.messageId && !process.env.SMTP_HOST) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`[EMAIL] Preview URL: ${previewUrl}`);
      return { success: true, messageId: info.messageId, previewUrl };
    }

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EMAIL ERROR]', error.message);
    throw error;
  }
};

// Funções específicas de email
const sendPasswordResetEmail = async (email, userName, resetToken) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

  return sendEmail({
    to: email,
    subject: 'Redefinição de Senha - MoneyTrack',
    html: passwordResetTemplate(userName, resetUrl)
  });
};

const sendPasswordChangedEmail = async (email, userName) => {
  return sendEmail({
    to: email,
    subject: 'Senha Alterada - MoneyTrack',
    html: passwordChangedTemplate(userName)
  });
};

const sendWelcomeEmail = async (email, userName) => {
  return sendEmail({
    to: email,
    subject: 'Bem-vindo ao MoneyTrack!',
    html: welcomeTemplate(userName)
  });
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendWelcomeEmail
};
