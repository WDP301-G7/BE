// src/config/vnpay.config.ts
import dotenv from 'dotenv';

dotenv.config();

export const vnpayConfig = {
    tmnCode: process.env.VNPAY_TMN_CODE,
    hashSecret: process.env.VNPAY_HASH_SECRET,
    url: process.env.VNPAY_URL,
    returnUrl: process.env.VNPAY_RETURN_URL,
    ipnUrl: process.env.VNPAY_IPN_URL,
    frontendUrl: process.env.FRONTEND_URL,
    vnpayHost: process.env.VNPAY_HOST || 'https://sandbox.vnpayment.vn', // Default to sandbox if env is missing
    testMode: process.env.NODE_ENV !== 'production', // Auto-detect mode
};

// Validate required config
const requiredFields = ['tmnCode', 'hashSecret', 'url', 'returnUrl', 'frontendUrl'] as const;
for (const field of requiredFields) {
    if (!vnpayConfig[field]) {
        throw new Error(`Missing required VNPay config: ${field}`);
    }
}
