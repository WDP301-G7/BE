// src/modules/payments/payments.service.ts
import { Payment, PaymentMethod, PaymentStatusEnum } from '@prisma/client';
import { paymentsRepository } from './payments.repository';
import { vnpayGateway } from './gateways/vnpay.gateway';
import { vnpayConfig } from '../../config/vnpay.config';
import { ordersService } from '../orders/orders.service';
import {
    VNPayPaymentParams,
    VNPayIPNParams,
    PaymentCreateResponse,
    PaymentVerificationResult,
} from '../../types/payment.types';
import { NotFoundError, BadRequestError } from '../../utils/errorHandler';

class PaymentsService {
    /**
     * Create payment and generate payment URL
     */
    async createPayment(
        orderId: string,
        userId: string,
        ipAddr: string
    ): Promise<PaymentCreateResponse> {
        // 1. Get order details
        const order = await ordersService.getOrderById(orderId, userId, 'CUSTOMER');
        if (!order) {
            throw new NotFoundError('Order not found');
        }

        // 2. Validate order status
        // Allow NEW (regular orders) or WAITING_CUSTOMER (prescription orders)
        if (order.status !== 'NEW' && order.status !== 'WAITING_CUSTOMER') {
            throw new BadRequestError('Order must be in NEW or WAITING_CUSTOMER status to create payment');
        }

        // 3. Check if payment already exists
        const existingPayment = await paymentsRepository.findByOrderId(orderId);
        if (existingPayment && existingPayment.status === 'SUCCESS') {
            throw new BadRequestError('Payment already completed for this order');
        }

        // 4. Create payment record
        const payment = await paymentsRepository.create({
            orderId,
            method: 'VNPAY' as PaymentMethod,
            amount: Number(order.totalAmount),
            status: 'PENDING' as PaymentStatusEnum,
        });

        // 5. Generate VNPay payment URL
        // ✅ OrderInfo: CHỈ dùng ASCII characters (a-z, 0-9, space)
        const orderInfo = `Payment for order ${order.id}`;
        const vnpayParams: VNPayPaymentParams = {
            orderId: order.id,
            amount: Number(order.totalAmount),
            orderInfo: orderInfo,
            returnUrl: vnpayConfig.returnUrl ?? '',
            ipAddr,
            // bankCode: 'VNPAYQR', // Force NCB bank for testing
        };

        const paymentUrl = vnpayGateway.createPaymentUrl(vnpayParams);

        return {
            paymentUrl,
            paymentId: payment.id,
            orderId: order.id,
            amount: Number(order.totalAmount),
        };
    }

    /**
     * Handle VNPay IPN (Instant Payment Notification) callback
     */
    async handleVNPayIPN(params: VNPayIPNParams): Promise<PaymentVerificationResult> {
        // 1. Verify signature
        const isValidSignature = vnpayGateway.verifyIPNSignature(params);
        if (!isValidSignature) {
            return {
                isValid: false,
                orderId: params.vnp_TxnRef,
                amount: 0,
                transactionId: '',
                responseCode: '97',
                message: 'Invalid signature',
            };
        }

        // 2. Extract data
        const orderId = params.vnp_TxnRef;
        const amount = parseInt(params.vnp_Amount) / 100; // Convert back from VNPay format
        const responseCode = params.vnp_ResponseCode;
        const transactionId = params.vnp_TransactionNo;

        // 3. Get payment record
        const payment = await paymentsRepository.findByOrderId(orderId);
        if (!payment) {
            return {
                isValid: false,
                orderId,
                amount,
                transactionId,
                responseCode: '01',
                message: 'Payment not found',
            };
        }

        // 4. Check if already processed (idempotency)
        if (payment.status === 'SUCCESS') {
            return {
                isValid: true,
                orderId,
                amount,
                transactionId,
                responseCode: '00',
                message: 'Payment already processed',
            };
        }

        // 4b. Verify amount matches (Security check)
        if (amount !== Number(payment.amount)) {
            return {
                isValid: false,
                orderId,
                amount,
                transactionId,
                responseCode: '04', // Mismatch amount
                message: 'Amount mismatch',
            };
        }

        // 5. Process payment based on response code
        if (responseCode === '00') {
            // Payment successful
            return await this.processPaymentSuccess(payment, orderId, amount, transactionId, responseCode);
        } else {
            // Payment failed
            await paymentsRepository.updateStatus(payment.id, 'FAILED');

            return {
                isValid: true,
                orderId,
                amount,
                transactionId,
                responseCode,
                message: vnpayGateway.getResponseMessage(responseCode),
            };
        }
    }

    /**
     * Handle VNPay Return URL (Redirect from VNPay)
     * NOTE: This is mainly for local development where IPN might not reach localhost.
     * In production, IPN is the source of truth, but verifying here doesn't hurt.
     */
    async handleVNPayReturn(params: VNPayIPNParams): Promise<PaymentVerificationResult> {
        // 1. Verify signature
        const isValidSignature = vnpayGateway.verifyReturnUrl(params as any);
        if (!isValidSignature) {
            return {
                isValid: false,
                orderId: params.vnp_TxnRef,
                amount: 0,
                transactionId: '',
                responseCode: '97',
                message: 'Invalid signature',
            };
        }

        // 2. Extract data
        const orderId = params.vnp_TxnRef;
        const amount = parseInt(params.vnp_Amount) / 100;
        const responseCode = params.vnp_ResponseCode;
        const transactionId = params.vnp_TransactionNo;

        // 3. Get payment record
        const payment = await paymentsRepository.findByOrderId(orderId);
        if (!payment) {
            return {
                isValid: false,
                orderId,
                amount,
                transactionId,
                responseCode: '01',
                message: 'Payment not found',
            };
        }

        // 4. Check idempotency
        if (payment.status === 'SUCCESS') {
            return {
                isValid: true,
                orderId,
                amount,
                transactionId,
                responseCode: '00',
                message: 'Payment already processed',
            };
        }

        // 4b. Verify amount matches (Security check)
        if (amount !== Number(payment.amount)) {
            return {
                isValid: false,
                orderId,
                amount,
                transactionId,
                responseCode: '04',
                message: 'Amount mismatch',
            };
        }

        // 5. Process
        if (responseCode === '00') {
            return await this.processPaymentSuccess(payment, orderId, amount, transactionId, responseCode);
        } else {
            await paymentsRepository.updateStatus(payment.id, 'FAILED');
            return {
                isValid: true,
                orderId,
                amount,
                transactionId,
                responseCode,
                message: vnpayGateway.getResponseMessage(responseCode),
            };
        }
    }

    /**
     * Private: Process successful payment
     */
    private async processPaymentSuccess(
        payment: Payment,
        orderId: string,
        amount: number,
        transactionId: string,
        responseCode: string
    ): Promise<PaymentVerificationResult> {
        // Update payment status
        await paymentsRepository.updateStatus(payment.id, 'SUCCESS', new Date());

        // Check if this is a prescription order by trying to call handlePaymentSuccess
        // If it's a prescription order, it will update both order and prescription request
        // If it's a regular order, it will just update the order status
        try {
            await ordersService.handlePaymentSuccess(orderId);
        } catch (error) {
            // If handlePaymentSuccess fails (e.g., no prescription request), 
            // fall back to regular payment status update
            await ordersService.updatePaymentStatus(orderId, 'PAID');
        }

        return {
            isValid: true,
            orderId,
            amount,
            transactionId,
            responseCode,
            message: vnpayGateway.getResponseMessage(responseCode),
        };
    }

    /**
     * Get payment by ID
     */
    async getPaymentById(id: string): Promise<Payment | null> {
        return await paymentsRepository.findById(id);
    }

    /**
     * Get payment by order ID
     */
    async getPaymentByOrderId(orderId: string): Promise<Payment | null> {
        return await paymentsRepository.findByOrderId(orderId);
    }
}

export const paymentsService = new PaymentsService();
