// src/types/payment.types.ts
import { PaymentMethod, PaymentStatusEnum } from '@prisma/client';

/**
 * VNPay payment request parameters
 */
export interface VNPayPaymentParams {
    orderId: string;
    amount: number;
    orderInfo: string;
    returnUrl: string;
    ipAddr: string;
    bankCode?: string; // Optional: NCB, VCB, etc.
}

/**
 * VNPay IPN (Instant Payment Notification) callback params
 */
export interface VNPayIPNParams {
    vnp_TmnCode: string;
    vnp_Amount: string;
    vnp_BankCode: string;
    vnp_BankTranNo: string;
    vnp_CardType: string;
    vnp_PayDate: string;
    vnp_OrderInfo: string;
    vnp_TransactionNo: string;
    vnp_ResponseCode: string;
    vnp_TransactionStatus: string;
    vnp_TxnRef: string;
    vnp_SecureHashType?: string; // Optional for delete operator
    vnp_SecureHash?: string; // Optional for delete operator
    [key: string]: string | undefined; // Allow additional fields
}

/**
 * Payment creation response
 */
export interface PaymentCreateResponse {
    paymentUrl: string;
    paymentId: string;
    orderId: string;
    amount: number;
}

/**
 * Payment verification result
 */
export interface PaymentVerificationResult {
    isValid: boolean;
    orderId: string;
    amount: number;
    transactionId: string;
    responseCode: string;
    message: string;
}

/**
 * Payment record for database
 */
export interface CreatePaymentData {
    orderId: string;
    method: PaymentMethod;
    amount: number;
    status: PaymentStatusEnum;
}
