const express = require('express');
const router = express.Router();
const telegramService = require('../services/telegramService');
const logger = require('../config/logger');

// Subscription verification endpoint
router.post('/verify', async (req, res) => {
    try {
        const { telegram_user_id } = req.body;
        
        logger.info(`Subscription verification request for user ${telegram_user_id}`);
        
        const result = await telegramService.verifySubscription(telegram_user_id);
        
        logger.info(`User ${telegram_user_id} verification result:`, {
            verified: result.verified,
            status: result.status
        });
        
        res.json(result);
    } catch (error) {
        logger.error('Error verifying subscription:', error);
        res.status(500).json({ 
            error: 'Internal server error during subscription verification',
            verified: false
        });
    }
});

// Check subscription status
router.get('/status/:telegram_user_id', async (req, res) => {
    try {
        const { telegram_user_id } = req.params;
        
        logger.info(`Checking subscription status for user ${telegram_user_id}`);
        
        const result = await telegramService.checkSubscription(telegram_user_id);
        
        logger.info(`User ${telegram_user_id} subscription status:`, {
            subscribed: result.subscribed,
            status: result.status
        });
        
        res.json(result);
    } catch (error) {
        logger.error('Error checking subscription status:', error);
        res.status(500).json({ error: 'Failed to check subscription status' });
    }
});

module.exports = router;