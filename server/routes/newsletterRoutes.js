const express = require('express');
const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const { awardCoins } = require('../utils/coins');

const router = express.Router();

const NEWSLETTER_REWARD = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/subscribe', async (req, res) => {
  try {
    const { email, userId } = req.body;
    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, error: 'Email không hợp lệ' });
    }

    let alreadySubscribed = false;
    try {
      await NewsletterSubscriber.create({ email, userId: userId || null });
    } catch (err) {
      if (err.code === 11000) alreadySubscribed = true;
      else throw err;
    }

    if (userId) {
      await awardCoins({
        userId,
        reason: 'NEWSLETTER_SUBSCRIBE',
        refId: 'newsletter-subscribe',
        amount: NEWSLETTER_REWARD,
        note: 'Đăng ký nhận bản tin Luméa',
      });
    }

    res.json({ success: true, alreadySubscribed });
  } catch (err) {
    console.error('newsletter subscribe error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
