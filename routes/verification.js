const User = require('../models/user');
const { sendVerificationCode, generateCode } = require('../utils/email');

const pendingVerifications = new Map();

module.exports = function (router) {

  router.route('/auth/send-code')
    .post(async (req, res) => {
      try {
        const { email } = req.body;

        if (!email) {
          return res.status(400).json({ message: 'Email is required', success: false });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
          return res.status(400).json({ message: 'Email already registered', success: false });
        }

        const code = generateCode();
        const expires = new Date(Date.now() + 10 * 60 * 1000);

        pendingVerifications.set(email, { code, expires });

        await sendVerificationCode(email, code);

        res.json({ message: 'Verification code sent', success: true });

      } catch (error) {
        console.error('Send code error:', error);
        res.status(500).json({ message: 'Failed to send verification code', success: false });
      }
    });

  router.route('/auth/verify-code')
    .post(async (req, res) => {
      try {
        const { email, code } = req.body;

        if (!email || !code) {
          return res.status(400).json({ message: 'Email and code are required', success: false });
        }

        const pending = pendingVerifications.get(email);

        if (!pending) {
          return res.status(400).json({ message: 'No verification code found. Please request a new one.', success: false });
        }

        if (new Date() > pending.expires) {
          pendingVerifications.delete(email);
          return res.status(400).json({ message: 'Verification code expired', success: false });
        }

        if (pending.code !== code) {
          return res.status(400).json({ message: 'Invalid verification code', success: false });
        }

        pendingVerifications.set(email, { ...pending, verified: true });

        res.json({ message: 'Email verified successfully', success: true });

      } catch (error) {
        console.error('Verify code error:', error);
        res.status(500).json({ message: 'Failed to verify code', success: false });
      }
    });

  router.route('/auth/check-verification')
    .post(async (req, res) => {
      try {
        const { email } = req.body;
        const pending = pendingVerifications.get(email);
        
        if (pending && pending.verified && new Date() <= pending.expires) {
          return res.json({ verified: true, success: true });
        }
        
        res.json({ verified: false, success: true });
      } catch (error) {
        res.status(500).json({ message: 'Failed to check verification', success: false });
      }
    });

  return router;
};

module.exports.pendingVerifications = pendingVerifications;
