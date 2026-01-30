// test-vnpay.ts
import crypto from 'crypto';
import qs from 'qs';

// 1. Config - REAL Sandbox Credentials from your .env
const tmnCode = '6U32JLCU';
const secretKey = '90CSR72BXNZ42SXLKJRML4G3O96C0FM6';
const vnpUrl = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
const returnUrl = 'https://rusty-stockish-janel.ngrok-free.dev/api/payments/vnpay/return';

// 2. Mock Data
const orderId = `TEST_${Date.now()}`;
const amount = 100000; // 100,000 VND
const ipAddr = '127.0.0.1';

// Helper: Format date to VNPay format (yyyyMMddHHmmss)
function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

const createDate = formatDate(new Date());
const expireDate = formatDate(new Date(Date.now() + 15 * 60 * 1000));

// 3. Logic (Copy EXACTLY from vnpay.gateway.ts)
function sortObject(obj: any) {
    const sorted: any = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
        sorted[key] = obj[key];
    }
    return sorted;
}

// Params - orderInfo KHÔNG DẤU (quan trọng!)
const vnpParams: any = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: tmnCode.trim(),
    vnp_Locale: 'vn',
    vnp_CurrCode: 'VND',
    vnp_TxnRef: orderId,
    vnp_OrderInfo: 'Thanh toan don hang test', // ✅ KHÔNG DẤU
    vnp_OrderType: 'other',
    vnp_Amount: Math.round(amount * 100), // ✅ Ensure integer
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: createDate,
    vnp_ExpireDate: expireDate,
};

// Sort
const sortedParams = sortObject(vnpParams);

// Create Sign Data - encode: false
const signData = qs.stringify(sortedParams, { encode: false });

// Hash with trimmed secret
const hmac = crypto.createHmac('sha512', secretKey.trim());
const secureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

// Add Hash
sortedParams.vnp_SecureHash = secureHash;

// Final URL - encode: false
const queryString = qs.stringify(sortedParams, { encode: false });
const finalUrl = `${vnpUrl}?${queryString}`;

console.log('---------------------------------------------------');
console.log('✅ TEST VNPAY URL GENERATOR');
console.log('---------------------------------------------------');
console.log('TMN Code:', tmnCode);
console.log('Secret Key:', secretKey);
console.log('Sign Data (Raw):', signData);
console.log('Secure Hash:', secureHash);
console.log('---------------------------------------------------');
console.log('👇 COPY THIS URL TO BROWSER TO TEST 👇');
console.log(finalUrl);
console.log('---------------------------------------------------');
