import { Request, Response } from 'express';
import { ordersRepository } from '../orders/orders.repository';
import { notificationsService } from '../notifications/notifications.service';
import { ShippingStatus } from '@prisma/client';

export class LogisticsController {
    /**
     * Tích hợp Webhook của Giao Hàng Nhanh
     * Payload sample từ GHN:
     * {
     *   "OrderCode": "GHN_12345",
     *   "Status": "ready_to_pick", "picking", "delivering", "delivered", "return", "returned"
     *   "ClientOrderCode": "order_id_123",
     *   ...
     * }
     */
    async ghnWebhook(req: Request, res: Response): Promise<void> {
        try {
            const data = req.body;
            
            // Validate Token Verification (optional but recommended)
            // const token = req.headers['token'] || req.headers['ghn-webhook-token'];
            // if (token !== process.env.GHN_WEBHOOK_SECRET) return res.status(401).send('Unauthorized');
            
            if (!data || !data.Status || (!data.ClientOrderCode && !data.OrderCode)) {
                res.status(400).json({ code: 400, message: 'Invalid payload' });
                return;
            }

            const status = data.Status;
            let orderId = data.ClientOrderCode;
            
            // Tìm order bằng ClientOrderCode (orderId) trước
            let order: any = null;
            if (orderId) {
                order = await ordersRepository.findById(orderId);
            }
            
            // Fallback: Tìm bằng OrderCode (Tracking Number) nếu không có hoặc không khớp ClientOrderCode
            if (!order && data.OrderCode) {
                const orderFromPrisma = await import('../../config/database').then(m => 
                    m.prisma.order.findFirst({ where: { trackingNumber: data.OrderCode } })
                );
                if (orderFromPrisma) {
                    order = await ordersRepository.findById(orderFromPrisma.id);
                    orderId = order?.id;
                }
            }

            if (!order) {
                res.status(404).json({ code: 404, message: 'Order not found' });
                return;
            }

            let newShippingStatus: ShippingStatus | null = null;
            let shouldUpdateOrderToCompleted = false;
            let notificationMessage = '';
            
            // Map GHN Status to our internal ShippingStatus
            switch(status) {
                case 'picking':
                    newShippingStatus = 'PICKING';
                    break;
                case 'delivering':
                    newShippingStatus = 'DELIVERING';
                    notificationMessage = `Đơn hàng #${orderId.slice(0, 8)} của bạn đang được giao đến bạn. Vui lòng chú ý điện thoại.`;
                    break;
                case 'delivered':
                    newShippingStatus = 'DELIVERED';
                    shouldUpdateOrderToCompleted = true; // Auto complete order when successfully delivered
                    notificationMessage = `Đơn hàng #${orderId.slice(0, 8)} đã được giao thành công. Cảm ơn bạn đã mua sắm!`;
                    break;
                case 'cancel':
                case 'return':
                case 'returned':
                    newShippingStatus = 'RETURNED';
                    notificationMessage = `Đơn hàng #${orderId.slice(0, 8)} giao không thành công và đang được hoàn trả.`;
                    break;
            }

            // Update in DB
            if (newShippingStatus && newShippingStatus !== order.shippingStatus) {
                await ordersRepository.update(orderId, {
                    shippingStatus: newShippingStatus,
                    ...(shouldUpdateOrderToCompleted ? { status: 'COMPLETED' } : {})
                });

                // Send Notification
                if (notificationMessage) {
                    await notificationsService.sendToUser(order.customerId, {
                        type: newShippingStatus === 'DELIVERED' ? 'ORDER_DELIVERED' : 'ORDER_DELIVERING',
                        title: 'Cập nhật giao hàng',
                        message: notificationMessage,
                        data: { orderId, trackingNumber: data.OrderCode },
                    });
                }
            }

            res.status(200).json({ code: 200, message: 'OK' });
        } catch (error) {
            console.error('GHN Webhook Error:', error);
            res.status(500).json({ code: 500, message: 'Internal Server Error' });
        }
    }
}

export const logisticsController = new LogisticsController();
