/**
 * Telegram Bot API service for subscription verification
 */
class TelegramService {
    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN;
        this.channelId = process.env.TELEGRAM_CHANNEL_ID;
    }

    /**
     * Check if user is subscribed to the channel
     * @param {string} telegramUserId - User's Telegram ID
     * @returns {Promise<Object>} Subscription status
     */
    async checkSubscription(telegramUserId) {
        // Development mode bypass
        if (process.env.DEVELOPMENT_MODE === 'true') {
            return {
                subscribed: true,
                message: 'Development mode: user is considered subscribed',
                development: true
            };
        }

        if (!this.botToken || !this.channelId) {
            return {
                subscribed: false,
                message: 'Telegram bot not configured properly'
            };
        }

        if (!telegramUserId) {
            return {
                subscribed: false,
                message: 'User ID required for verification'
            };
        }

        try {
            const response = await fetch(`https://api.telegram.org/bot${this.botToken}/getChatMember`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: this.channelId,
                    user_id: telegramUserId
                })
            });

            const result = await response.json();

            if (result.ok) {
                const memberStatus = result.result.status;
                const isSubscribed = ['member', 'administrator', 'creator'].includes(memberStatus);

                return {
                    subscribed: isSubscribed,
                    status: memberStatus,
                    message: isSubscribed ? 'User is subscribed' : 'User is not subscribed to the channel'
                };
            } else {
                // User not found in chat means not subscribed
                if (result.error_code === 400 && result.description.includes('user not found')) {
                    return {
                        subscribed: false,
                        message: 'User is not subscribed to the channel',
                        status: 'not_member'
                    };
                }

                throw new Error(result.description);
            }
        } catch (error) {
            console.error('Error checking subscription via Telegram API:', error);
            return {
                subscribed: false,
                message: 'Failed to verify subscription',
                error: error.message
            };
        }
    }

    /**
     * Verify subscription (alias for checkSubscription)
     * @param {string} telegramUserId - User's Telegram ID
     * @returns {Promise<Object>} Verification result
     */
    async verifySubscription(telegramUserId) {
        const result = await this.checkSubscription(telegramUserId);
        return {
            verified: result.subscribed,
            ...result
        };
    }
}

module.exports = new TelegramService();