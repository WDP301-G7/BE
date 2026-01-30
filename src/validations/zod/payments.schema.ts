// src/validations/zod/payments.schema.ts
import { z } from 'zod';

/**
 * Schema for creating payment
 */
export const createPaymentSchema = z.object({
    params: z.object({
        orderId: z.string().uuid('Invalid order ID'),
    }),
});

/**
 * Schema for VNPay IPN callback
 * Note: VNPay sends data as query params, so we validate query
 */
export const vnpayIPNSchema = z.object({
    query: z.object({
        vnp_TmnCode: z.string(),
        vnp_Amount: z.string(),
        vnp_BankCode: z.string().optional(),
        vnp_BankTranNo: z.string().optional(),
        vnp_CardType: z.string().optional(),
        vnp_PayDate: z.string(),
        vnp_OrderInfo: z.string(),
        vnp_TransactionNo: z.string(),
        vnp_ResponseCode: z.string(),
        vnp_TransactionStatus: z.string(),
        vnp_TxnRef: z.string(),
        vnp_SecureHashType: z.string().optional(),
        vnp_SecureHash: z.string(),
    }),
});
