const crypto = require('crypto');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const authorizedUserIds = ['781182099', '5974666109'];

/**
 * Validates Telegram WebApp data integrity
 * @param {string} initData - The init data from Telegram WebApp
 * @returns {Object} { isValid: boolean, user: Object | null }
 */
async function isValidTelegramData(initData) {
    const encoded = decodeURIComponent(initData);
    const data = new URLSearchParams(encoded);
    const hash = data.get('hash');
    data.delete('hash');

    const dataCheckArr = [];
    for (const [key, value] of data.entries()) {
        dataCheckArr.push(`${key}=${value}`);
    }
    dataCheckArr.sort();
    const dataCheckString = dataCheckArr.join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN);
    const calculatedHash = crypto.createHmac('sha256', secretKey.digest()).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) {
        return { isValid: false, user: null };
    }

    const user = JSON.parse(data.get('user'));
    return { isValid: true, user };
}

/**
 * Middleware to validate Telegram authentication
 */
const validateTelegramAuth = async (req, res, next) => {
    const { initData } = req.body;

    if (!initData) {
        return res.status(401).json({ error: 'Unauthorized: No initData provided' });
    }

    const { isValid, user } = await isValidTelegramData(initData);

    if (!isValid) {
        return res.status(403).json({ error: 'Forbidden: Invalid Telegram data' });
    }

    req.telegramUser = user;
    next();
};

/**
 * Middleware to check admin permissions
 */
const requireAdmin = (req, res, next) => {
    if (!req.telegramUser || !authorizedUserIds.includes(String(req.telegramUser.id))) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    next();
};

module.exports = {
    isValidTelegramData,
    validateTelegramAuth,
    requireAdmin
};