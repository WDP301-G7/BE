// src/modules/payments/gateways/vnpay.gateway.ts
import { vnpayConfig } from '../../../config/vnpay.config';
import { VNPayPaymentParams, VNPayIPNParams } from '../../../types/payment.types';
import { VNPay, ignoreLogger, ProductCode, VnpLocale, HashAlgorithm } from 'vnpay';

/**
 * VNPay Gateway - Handles payment URL generation and signature verification using 'vnpay' library
 */
export class VNPayGateway {
    private vnpayInstance: VNPay;

    constructor() {
        this.vnpayInstance = new VNPay({
            tmnCode: vnpayConfig.tmnCode ?? '',
            secureSecret: vnpayConfig.hashSecret ?? '',
            vnpayHost: vnpayConfig.vnpayHost,
            testMode: vnpayConfig.testMode,
            hashAlgorithm: HashAlgorithm.SHA512,
            enableLog: true,
            loggerFn: ignoreLogger,
        });
    }

    /**
     * Generate payment URL for VNPay
     */
    createPaymentUrl(params: VNPayPaymentParams): string {
        // vnpay library automatically handles:
        // - Sorting parameters
        // - Creating signature (SecureHash)
        // - Date formatting (CreateDate, ExpireDate)
        // - IP address handling
        // Ensure IP is valid IPv4 or use default
        let ipAddr = params.ipAddr;
        if (ipAddr === '::1' || !ipAddr) ipAddr = '127.0.0.1';

        const paymentUrl = this.vnpayInstance.buildPaymentUrl({
            vnp_Amount: params.amount,
            vnp_IpAddr: ipAddr,
            vnp_TxnRef: params.orderId,
            vnp_OrderInfo: params.orderInfo,
            vnp_OrderType: ProductCode.Other,
            vnp_ReturnUrl: params.returnUrl || vnpayConfig.returnUrl || '',
            vnp_Locale: VnpLocale.VN, // 'vn' or 'en'
            vnp_BankCode: params.bankCode, // Optional
        });

        return paymentUrl;
    }

    /**
     * Verify Return URL signature
     */
    verifyReturnUrl(params: VNPayPaymentParams): boolean {
        try {
            const verifyResult = this.vnpayInstance.verifyReturnUrl(params as any);
            return verifyResult.isSuccess;
        } catch (error) {
            return false;
        }
    }

    /**
     * Verify IPN callback signature
     */
    verifyIPNSignature(params: VNPayIPNParams): boolean {
        try {
            const verifyResult = this.vnpayInstance.verifyIpnCall(params as any);
            return verifyResult.isSuccess;
        } catch (error) {
            return false;
        }
    }

    /**
     * Parse VNPay response code to human-readable message
     */
    getResponseMessage(responseCode: string): string {
        const messages: Record<string, string> = {
            '00': 'Giao dịch thành công',
            '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).',
            '09': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking tại ngân hàng.',
            '10': 'Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
            '11': 'Giao dịch không thành công do: Đã hết hạn chờ thanh toán. Xin quý khách vui lòng thực hiện lại giao dịch.',
            '12': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng bị khóa.',
            '13': 'Giao dịch không thành công do Quý khách nhập sai mật khẩu xác thực giao dịch (OTP). Xin quý khách vui lòng thực hiện lại giao dịch.',
            '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch',
            '51': 'Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch.',
            '65': 'Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày.',
            '70': 'Giao dịch không thành công do: Ngân hàng thanh toán không hỗ trợ giao dịch hoặc thông tin giao dịch không hợp lệ.',
            '72': 'Giao dịch không thành công do: Tài khoản merchant chưa được kích hoạt hoặc chưa cấu hình đầy đủ.',
            '75': 'Ngân hàng thanh toán đang bảo trì.',
            '79': 'Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán quá số lần quy định. Xin quý khách vui lòng thực hiện lại giao dịch',
            '97': 'Chữ ký không hợp lệ',
            '99': 'Các lỗi khác (lỗi còn lại, không có trong danh sách mã lỗi đã liệt kê)',
        };

        return messages[responseCode] || 'Lỗi không xác định';
    }
}

export const vnpayGateway = new VNPayGateway();