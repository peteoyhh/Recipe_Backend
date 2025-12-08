const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendVerificationCode = async (email, code) => {
  const msg = {
    to: email,
    from: 'hanxiaoyuinus@gmail.com',
    subject: 'RecipeGenie - Email Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">RecipeGenie Email Verification</h2>
        <p>Your verification code is:</p>
        <h1 style="color: #764ba2; letter-spacing: 5px; font-size: 32px;">${code}</h1>
        <p>This code will expire in 10 minutes.</p>
        <p style="color: #888;">If you did not request this code, please ignore this email.</p>
      </div>
    `
  };
  return sgMail.send(msg);
};

const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

module.exports = { sendVerificationCode, generateCode };
