// src/modules/payments/payments.controller.ts
import { Request, Response, NextFunction } from 'express';
import { paymentsService } from './payments.service';
import { apiResponse } from '../../utils/apiResponse';
import { VNPayIPNParams } from '../../types/payment.types';
import { vnpayConfig } from '../../config/vnpay.config';

class PaymentsController {
    /**
     * @route   POST /api/payments/:orderId/create
     * @desc    Create payment and get payment URL
     * @access  Private (Customer)
     */
    async createPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const orderId = req.params.orderId as string;
            const userId = (req as any).user.userId; // From auth middleware
            let ipAddr = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
                || req.socket.remoteAddress
                || '127.0.0.1';

            // ✅ QUAN TRỌNG: Convert ::1 (IPv6) → 127.0.0.1 (IPv4)
            if (ipAddr === '::1' || ipAddr === '::ffff:127.0.0.1') {
                ipAddr = '127.0.0.1';
            }

            // ✅ Remove IPv6 prefix nếu có
            ipAddr = ipAddr.replace('::ffff:', '');


            const result = await paymentsService.createPayment(orderId, userId, ipAddr);

            res.status(200).json(
                apiResponse.success(result, 'Payment URL generated successfully')
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/payments/vnpay/ipn
     * @desc    VNPay IPN (Instant Payment Notification) webhook
     * @access  Public (Called by VNPay server)
     */
    async handleVNPayIPN(req: Request, res: Response): Promise<void> {
        try {
            const params = req.query as unknown as VNPayIPNParams;

            const result = await paymentsService.handleVNPayIPN(params);

            if (result.isValid && result.responseCode === '00') {
                // Success response to VNPay
                res.status(200).json({ RspCode: '00', Message: 'Success' });
            } else {
                // Error response to VNPay
                res.status(200).json({
                    RspCode: result.responseCode,
                    Message: result.message,
                });
            }
        } catch (error) {
            // Always return 200 to VNPay to avoid retry
            res.status(200).json({ RspCode: '99', Message: 'Internal error' });
        }
    }

    /**
     * @route   GET /api/payments/vnpay/return
     * @desc    Handle redirect from VNPay
     * @access  Public
     */
    async handleVNPayReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const params = req.query as unknown as VNPayIPNParams;
            const result = await paymentsService.handleVNPayReturn(params);

            const isSuccess = result.isValid && result.responseCode === '00';
            const { vnp_TxnRef, vnp_ResponseCode, vnp_Amount, vnp_TransactionNo } = params;

            // Build dynamic deeplink if configured
            let finalDeeplink = '';
            if (vnpayConfig.appDeeplink) {
                const amount = vnp_Amount ? parseInt(vnp_Amount) / 100 : 0;
                const queryParams = new URLSearchParams({
                    orderId: vnp_TxnRef,
                    transactionId: vnp_TransactionNo || '',
                    amount: amount.toString(),
                    paymentMethod: 'vnpay',
                    status: isSuccess ? 'success' : 'fail',
                    responseCode: vnp_ResponseCode
                }).toString();

                // Ensure we handle cases where appDeeplink might already have query params
                const separator = vnpayConfig.appDeeplink.includes('?') ? '&' : '?';
                finalDeeplink = `${vnpayConfig.appDeeplink}${separator}${queryParams}`;
            }

            res.setHeader('Content-Type', 'text/html');
            res.send(`
                <div style="text-align: center; padding: 50px; font-family: sans-serif;">
                    <h1 style="color: ${isSuccess ? '#4CAF50' : '#F44336'}">
                        ${isSuccess ? 'Thanh toán thành công' : 'Thanh toán thất bại'}
                    </h1>
                    <p>Mã đơn hàng: <b>${vnp_TxnRef}</b></p>
                    <p>Mã lỗi: ${vnp_ResponseCode}</p>
                    ${!isSuccess ? `<p>Lý do: ${result.message}</p>` : ''}
                    
                    ${finalDeeplink
                    ? `
                        <a href="${finalDeeplink}" style="padding: 10px 20px; background: #2196F3; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; display: inline-block;">
                            Quay về ứng dụng
                        </a>
                        <script>
                            // Auto redirect to app
                            setTimeout(function() {
                                window.location.href = "${finalDeeplink}";
                            }, 1500);
                        </script>
                        `
                    : `
                        <a href="${vnpayConfig.frontendUrl ?? ''}/orders/${vnp_TxnRef}" style="padding: 10px 20px; background: #2196F3; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; display: inline-block;">
                            Quay về đơn hàng
                        </a>
                        `
                }
                    
                    <br/><br/>
                    <a href="/api-docs" style="color: #666; font-size: 14px;">Swagger API</a>
                </div>
            `);
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/payments/:id
     * @desc    Get payment details
     * @access  Private
     */
    async getPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const paymentId = req.params.id as string;

            const payment = await paymentsService.getPaymentById(paymentId);

            res.status(200).json(apiResponse.success(payment, 'Payment retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/payments/order/:orderId
     * @desc    Get payment by order ID
     * @access  Private
     */
    async getPaymentByOrderId(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const orderId = req.params.orderId as string;

            const payment = await paymentsService.getPaymentByOrderId(orderId);

            res.status(200).json(apiResponse.success(payment, 'Payment retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }
}

export const paymentsController = new PaymentsController();
