// src/modules/orders/orders.service.ts
import { Order, OrderStatus } from '@prisma/client';
import {
    ordersRepository,
    CreateOrderData,
    GetOrdersFilter,
    PaginatedOrders,
    OrderWithRelations,
} from './orders.repository';
import { inventoryRepository, InventoryWithRelations } from '../inventory/inventory.repository';
import { productsRepository } from '../products/products.repository';
import { NotFoundError, BadRequestError, ForbiddenError, AppError } from '../../utils/errorHandler';
import { prisma } from '../../config/database';
import { CreateOrderInput, ConfirmOrderInput } from '../../validations/zod/orders.schema';
import { membershipService } from '../membership/membership.service';
import { settingsService } from '../settings/settings.service';
import { notificationsService } from '../notifications/notifications.service';
import { GhnService } from '../../integrations/ghn/ghn.service';

/**
 * Allowed status transitions
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    NEW: ['CONFIRMED', 'CANCELLED'],
    PENDING_PAYMENT: ['CONFIRMED', 'CANCELLED', 'EXPIRED'],
    CONFIRMED: ['WAITING_CUSTOMER', 'CANCELLED'],
    WAITING_CUSTOMER: ['PROCESSING', 'CANCELLED'],
    WAITING_PRODUCT: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['READY', 'CANCELLED'],
    READY: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [],
    CANCELLED: [],
    EXPIRED: [],
};

class OrdersService {
    /**
     * Create new order
     * Business logic:
     * - Validate exactly 1 FRAME + 1 LENS (+ optional SERVICE)
     * - Check stock availability
     * - Create order + items in transaction
     */
    async createOrder(customerId: string, data: CreateOrderInput): Promise<OrderWithRelations> {
        // Step 1: Get products and calculate total (Batch fetch to fix N+1)
        const productIds = data.items.map(item => item.productId);
        const products = await productsRepository.findManyByIds(productIds);

        if (products.length !== new Set(productIds).size) {
            const missingId = productIds.find(id => !products.find(p => p.id === id));
            throw new NotFoundError(`Product with ID ${missingId} not found`);
        }

        const productsMap = new Map(products.map(p => [p.id, p]));

        // Step 2: Validate combo (FRAME + optional LENS) based on delivery method
        await this.validateOrderCombo(data.items, products, data.deliveryMethod);

        // Step 3: Check stock availability & Identify Pre-order
        let isPreorder = false;
        let maxLeadTime = 0;

        for (const item of data.items) {
            const product = productsMap.get(item.productId)!;

            // Skip SERVICE products (no inventory)
            if (product.type === 'SERVICE') continue;

            if (product.isPreorder) {
                isPreorder = true;
                maxLeadTime = Math.max(maxLeadTime, product.leadTimeDays || 0);
                continue; // Skip stock check for pre-order items
            }

            const availableQty = await inventoryRepository.getTotalAvailableQuantity(item.productId);
            if (availableQty < item.quantity) {
                throw new BadRequestError(
                    `Insufficient stock for product "${product.name}". Available: ${availableQty}, Requested: ${item.quantity}`
                );
            }
        }

        // Step 4: Calculate expected ready date for pre-orders
        let expectedReadyDate: Date | undefined;
        if (isPreorder && maxLeadTime > 0) {
            expectedReadyDate = new Date();
            expectedReadyDate.setDate(expectedReadyDate.getDate() + maxLeadTime);
        }

        // Step 5: Calculate total amount
        const baseAmount = data.items.reduce((sum, item) => {
            const product = productsMap.get(item.productId)!;
            return sum + Number(product.price) * item.quantity;
        }, 0);

        // Step 5b: Apply membership discount
        const membershipTier = await membershipService.getUserTier(customerId);
        let discountPercent = 0;

        if (membershipTier) {
            discountPercent = Number(membershipTier.discountPercent);
        } else {
            // Get default discount for users without a tier
            discountPercent = await settingsService.get<number>('membership.default_discount_percent', 0);
        }

        const discountAmount = Math.round(baseAmount * discountPercent / 100);
        let totalAmount = baseAmount - discountAmount;
        let shippingFee = 0;

        // Step 5c: Calculate shipping fee
        if (data.deliveryMethod === 'HOME_DELIVERY' && data.shippingDistrictId && data.shippingWardCode) {
            shippingFee = await GhnService.calculateShippingFee(
                data.shippingDistrictId,
                data.shippingWardCode,
                200
            );
            totalAmount += shippingFee;
        }

        // Step 6: Create order in database
        const orderData: CreateOrderData = {
            customerId,
            orderType: isPreorder ? 'PRE_ORDER' : 'IN_STOCK',
            totalAmount,
            discountAmount,
            membershipTierId: membershipTier?.id,
            expectedReadyDate,
            items: data.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: Number(productsMap.get(item.productId)!.price),
            })),
            deliveryMethod: data.deliveryMethod,
            shippingAddress: data.shippingAddress,
            shippingProvinceId: data.shippingProvinceId,
            shippingDistrictId: data.shippingDistrictId,
            shippingWardCode: data.shippingWardCode,
            shippingFee,
        };

        const order = await ordersRepository.create(orderData);

        // Step 7: Return order with relations
        const createdOrder = await ordersRepository.findById(order.id);
        if (!createdOrder) {
            throw new Error('Failed to retrieve created order');
        }

        // Notify OPERATION of new order
        notificationsService.broadcastToRole('OPERATION', {
            type: 'ORDER_NEW',
            title: 'Đơn hàng mới',
            message: `Có đơn hàng mới #${order.id.slice(0, 8)} vừa được tạo`,
            data: { orderId: order.id },
        });

        return createdOrder;
    }

    /**
     * Validate order combo: Frame logic + Delivery Method rule
     */
    private async validateOrderCombo(
        items: Array<{ productId: string; quantity: number }>,
        products: any[],
        deliveryMethod?: string
    ): Promise<void> {
        const productTypes: Record<'FRAME' | 'LENS', number> = {
            FRAME: 0,
            LENS: 0,
        };

        const productsMap = new Map(products.map(p => [p.id, p]));

        for (const item of items) {
            const product = productsMap.get(item.productId);
            if (!product) {
                throw new NotFoundError(`Product with ID ${item.productId} not found`);
            }

            if (product.type === 'FRAME') {
                productTypes.FRAME += item.quantity;
            } else if (product.type === 'LENS') {
                productTypes.LENS += item.quantity;
            }
        }

        // Kiểm tra tối thiểu: Phải có ít nhất Gọng hoặc Tròng
        if (productTypes.FRAME < 1 && productTypes.LENS < 1) {
            throw new BadRequestError('Đơn hàng phải chứa ít nhất 1 Gọng kính hoặc 1 Tròng kính.');
        }

        // Quy tắc Giao hàng tận nơi: Không áp dụng cho đơn có Tròng kính
        if (deliveryMethod === 'HOME_DELIVERY' && productTypes.LENS > 0) {
            throw new BadRequestError(
                'Giao hàng tận nơi (HOME_DELIVERY) chỉ áp dụng cho đơn hàng mua Gọng kính lẻ. ' +
                'Đơn hàng có Tròng kính bắt buộc phải chọn Nhận tại tiệm (PICKUP_AT_STORE) để đo khám và mài lắp.'
            );
        }
    }

    /**
     * Get order by ID
     */
    async getOrderById(orderId: string, userId: string, userRole: string): Promise<OrderWithRelations> {
        const order = await ordersRepository.findById(orderId);
        if (!order) {
            throw new NotFoundError('Order not found');
        }

        // Authorization: Customer can only view their own orders
        if (userRole === 'CUSTOMER' && order.customerId !== userId) {
            throw new ForbiddenError('You can only view your own orders');
        }

        return order;
    }

    /**
     * Get customer's orders
     */
    async getMyOrders(customerId: string, page: number, limit: number): Promise<PaginatedOrders> {
        return await ordersRepository.findByCustomerId(customerId, page, limit);
    }

    /**
     * Get all orders (Operation/Admin)
     */
    async getAllOrders(filter: GetOrdersFilter): Promise<PaginatedOrders> {
        return await ordersRepository.getOrders(filter);
    }

    /**
     * Confirm order & set appointment (Operation)
     * Business logic:
     * - Order must be CONFIRMED (already paid)
     * - Check stock availability again (double-check)
     * - Reserve inventory
     * - Set appointment
     * - Update status to WAITING_CUSTOMER
     */
    async confirmAndSetAppointment(orderId: string, data: ConfirmOrderInput): Promise<Order> {
        const order = await ordersRepository.findById(orderId);
        if (!order) {
            throw new NotFoundError('Order not found');
        }

        // Validate status
        if (order.status !== 'CONFIRMED') {
            throw new BadRequestError('Order must be in CONFIRMED status to set appointment');
        }

        // Bắt buộc thanh toán 100%
        if (order.paymentStatus !== 'PAID') {
            throw new BadRequestError('Đơn hàng phải được thanh toán 100% trước khi xác nhận và đặt lịch hẹn');
        }

        // Double-check stock availability and reserve
        await this.reserveInventoryForOrder(order);

        // Set appointment
        const appointmentDate = new Date(data.appointmentDate);
        const updatedOrder = await ordersRepository.setAppointment(
            orderId,
            appointmentDate,
            data.appointmentNote,
            data.assignedStaffId
        );

        // Notify customer of appointment
        notificationsService.sendToUser(order.customerId, {
            type: 'ORDER_APPOINTMENT_SET',
            title: 'Lịch hẹn đã được đặt',
            message: `Đơn hàng #${orderId.slice(0, 8)} có lịch hẹn vào ${appointmentDate.toLocaleDateString('vi-VN')}`,
            data: { orderId },
        });

        // Notify the assigned staff (if Operation assigned one)
        if (data.assignedStaffId) {
            notificationsService.sendToUser(data.assignedStaffId, {
                type: 'ORDER_ASSIGNED',
                title: '📌 Có đơn hàng mới được giao',
                message: `Bạn đã được phân công xử lý đơn hàng #${orderId.slice(0, 8)}`,
                data: { orderId },
            });
        }

        return updatedOrder;
    }

    /**
     * Reserve inventory for order items
     */
    private async reserveInventoryForOrder(order: OrderWithRelations): Promise<void> {
        for (const item of order.orderItems) {
            // Skip SERVICE products
            if (item.product.type === 'SERVICE') continue;

            // Find inventory with available stock
            const inventories = await inventoryRepository.getByProduct(item.productId);

            let remainingQty = item.quantity;
            for (const inv of inventories) {
                if (remainingQty <= 0) break;

                const available = inv.quantity - inv.reservedQuantity;
                if (available > 0) {
                    const toReserve = Math.min(available, remainingQty);
                    try {
                        // FIX H-01: Atomic reservation with availability check
                        await inventoryRepository.reserveWithCheck(inv.id, toReserve);
                        remainingQty -= toReserve;
                    } catch (error: any) {
                        if (error.message === 'INSUFFICIENT_STOCK') {
                            continue; // Try next store
                        }
                        throw error;
                    }
                }
            }

            if (remainingQty > 0) {
                throw new BadRequestError(
                    `Insufficient stock for product "${item.product.name}". Cannot reserve ${item.quantity} units.`
                );
            }
        }
    }

    /**
     * Update appointment
     */
    async updateAppointment(
        orderId: string,
        appointmentDate: string,
        appointmentNote?: string
    ): Promise<Order> {
        const order = await ordersRepository.findById(orderId);
        if (!order) {
            throw new NotFoundError('Order not found');
        }

        if (order.status !== 'WAITING_CUSTOMER' && order.status !== 'PROCESSING') {
            throw new BadRequestError('Can only update appointment for WAITING_CUSTOMER or PROCESSING orders');
        }

        const date = new Date(appointmentDate);
        const updated = await ordersRepository.setAppointment(orderId, date, appointmentNote);

        // Notify customer of appointment update
        notificationsService.sendToUser(order.customerId, {
            type: 'ORDER_APPOINTMENT_UPDATED',
            title: 'Lịch hẹn đã được cập nhật',
            message: `Lịch hẹn của đơn #${orderId.slice(0, 8)} đã được cập nhật thành ${date.toLocaleDateString('vi-VN')}`,
            data: { orderId },
        });

        return updated;
    }

    /**
     * Start processing order (Staff)
     */
    async startProcessing(orderId: string, staffId: string): Promise<Order> {
        const order = await ordersRepository.findById(orderId);
        if (!order) {
            throw new NotFoundError('Order not found');
        }

        if (order.status !== 'WAITING_CUSTOMER') {
            throw new BadRequestError('Order must be in WAITING_CUSTOMER status to start processing');
        }

        // Bắt buộc thanh toán 100%
        if (order.paymentStatus !== 'PAID') {
            throw new BadRequestError('Đơn hàng phải được thanh toán 100% trước khi có thể bắt đầu xử lý');
        }

        // Validate transition
        this.validateStatusTransition(order.status, 'PROCESSING');

        // Update status and assign staff if not assigned
        const updated = await ordersRepository.update(orderId, {
            status: 'PROCESSING',
            ...((!order.handledBy && { handledBy: staffId })),
        });

        // Notify customer
        notificationsService.sendToUser(order.customerId, {
            type: 'ORDER_PROCESSING',
            title: 'Đơn hàng đang được xử lý',
            message: `Đơn hàng #${orderId.slice(0, 8)} của bạn đang được xử lý`,
            data: { orderId },
        });

        return updated;
    }

    /**
     * Mark order as ready (Staff)
     */
    async markAsReady(orderId: string): Promise<Order> {
        const order = await ordersRepository.findById(orderId);
        if (!order) {
            throw new NotFoundError('Order not found');
        }

        if (order.status !== 'PROCESSING') {
            throw new BadRequestError('Order must be in PROCESSING status to mark as ready');
        }

        // Bắt buộc thanh toán 100%
        if (order.paymentStatus !== 'PAID') {
            throw new BadRequestError('Đơn hàng phải được thanh toán 100% trước khi mở lệnh giao hàng hoặc đánh dấu sẵn sàng');
        }

        this.validateStatusTransition(order.status, 'READY');

        // Giao hàng tận nơi: Đẩy đơn qua hệ thống Giao Hàng Nhanh (GHN) tự động khi đóng kiện xong
        let trackingNumber: string | null = null;
        if (order.deliveryMethod === 'HOME_DELIVERY' && order.shippingWardCode && order.shippingDistrictId) {
            try {
                trackingNumber = await GhnService.createShippingOrder({
                    orderId: order.id,
                    toName: order.customer.fullName,
                    toPhone: order.customer.phone || '0900000000',
                    toAddress: order.shippingAddress || 'Địa chỉ ẩn',
                    toWardCode: order.shippingWardCode,
                    toDistrictId: order.shippingDistrictId,
                    codAmount: 0, // Bắt 100% thanh toán trước nên COD qua bưu điện mặc định 0đ
                    weight: 200, // Ước tính 200g
                    items: order.orderItems.map(item => ({
                        name: item.product.name.substring(0, 50),
                        quantity: item.quantity,
                        price: Number(item.unitPrice)
                    }))
                });
            } catch (error: any) {
                // Ném lỗi để chặn Update Status thành READY nếu đẩy đơn GHN thất bại
                throw new BadRequestError(`Tạo đơn GHN thất bại: ${error.message}`);
            }
        }

        const updated = await ordersRepository.updateStatus(orderId, 'READY');

        if (trackingNumber) {
            await ordersRepository.update(order.id, {
                trackingNumber,
                shippingStatus: 'READY_TO_SHIP',
                shippingProvider: 'GHN'
            });
        }

        // Notify customer order is ready for pickup or shipping
        const message = order.deliveryMethod === 'HOME_DELIVERY'
            ? `Đơn hàng #${orderId.slice(0, 8)} đã được đóng gói và chuẩn bị giao cho đơn vị vận chuyển!`
            : `Đơn hàng #${orderId.slice(0, 8)} đã sẵn sàng, hãy đến cửa hàng nhận hàng!`;

        notificationsService.sendToUser(order.customerId, {
            type: 'ORDER_READY',
            title: 'Đơn hàng đã sẵn sàng',
            message,
            data: { orderId },
        });

        return updated;
    }

    /**
     * Complete order (Staff)
     * - Update status to COMPLETED
     * - Unreserve inventory
     * - Decrease actual quantity
     */
    async completeOrder(orderId: string): Promise<Order> {
        const order = await ordersRepository.findById(orderId);
        if (!order) {
            throw new NotFoundError('Order not found');
        }

        if (order.status !== 'READY') {
            throw new BadRequestError('Order must be in READY status to complete');
        }

        this.validateStatusTransition(order.status, 'COMPLETED');

        // Transaction: Update order + Update inventory
        // 1. Prepare data BEFORE transaction (Minimize DB lock time)
        const productIds = order.orderItems
            .filter(item => item.product.type !== 'SERVICE')
            .map(item => item.productId);

        const allInventories = await inventoryRepository.findManyByProducts(productIds);
        const inventoryMap = new Map<string, InventoryWithRelations[]>();
        for (const inv of allInventories) {
            if (!inventoryMap.has(inv.productId)) inventoryMap.set(inv.productId, []);
            inventoryMap.get(inv.productId)!.push(inv);
        }

        const updateOperations: Array<(tx: any) => Promise<any>> = [];

        // Check and calculate inventory updates
        for (const item of order.orderItems) {
            if (item.product.type === 'SERVICE') continue;

            const inventories = inventoryMap.get(item.productId) || [];
            // Sort by reservedQuantity desc to prioritizing using reserved stock
            inventories.sort((a, b) => b.reservedQuantity - a.reservedQuantity);

            let remainingQty = item.quantity;
            for (const inv of inventories) {
                if (remainingQty <= 0) break;

                const toProcess = Math.min(inv.reservedQuantity, remainingQty);
                if (toProcess > 0) {
                    // Queue the update operation
                    updateOperations.push((tx) =>
                        tx.inventory.update({
                            where: { id: inv.id },
                            data: {
                                quantity: { decrement: toProcess },
                                reservedQuantity: { decrement: toProcess },
                            },
                        })
                    );
                    remainingQty -= toProcess;
                }
            }

            // CRITICAL CHECK: If we haven't found enough inventory to deduct
            if (remainingQty > 0) {
                throw new BadRequestError(
                    `Insufficient inventory for product ${item.productId}. Need ${item.quantity}, found ${item.quantity - remainingQty} reserved.`
                );
            }
        }

        // Transaction: Execute all updates atomically
        try {
            const completedOrder = await prisma.$transaction(async (tx) => {
                // 1. Update order status
                const updated = await tx.order.update({
                    where: { id: orderId },
                    data: { status: 'COMPLETED' },
                });

                // 2. Execute calculated inventory updates
                for (const operation of updateOperations) {
                    await operation(tx);
                }

                // 3. Update order items status
                await tx.orderItem.updateMany({
                    where: { orderId },
                    data: { itemStatus: 'DELIVERED' },
                });

                return updated;
            }, {
                maxWait: 5000,
                timeout: 15000 // Increased timeout
            });

            // 4. Update membership spend (outside transaction — non-critical)
            try {
                await membershipService.recordSpend(order.customerId, Number(order.totalAmount));
            } catch (membershipError) {
                console.error('Membership recordSpend error (non-critical):', membershipError);
            }

            // 5. Notify customer order completed
            notificationsService.sendToUser(order.customerId, {
                type: 'ORDER_COMPLETED',
                title: 'Đơn hàng hoàn tất',
                message: `Đơn hàng #${orderId.slice(0, 8)} đã hoàn tất. Cảm ơn bạn đã mua hàng!`,
                data: { orderId },
            });

            return completedOrder;
        } catch (error: any) {
            console.error('Complete Order DB Error:', error);
            if (error instanceof AppError) throw error; // Rethrow operational errors
            throw new BadRequestError(`Database operation failed: ${error.message}`);
        }
    }

    /**
     * Cancel order
     * - Validate status
     * - Unreserve inventory if reserved
     * - Update status to CANCELLED
     * - (TODO: Process refund)
     */
    async cancelOrder(orderId: string, userId: string, userRole: string, _reason?: string): Promise<Order> {
        const order = await ordersRepository.findById(orderId);
        if (!order) {
            throw new NotFoundError('Order not found');
        }

        // Authorization
        if (userRole === 'CUSTOMER' && order.customerId !== userId) {
            throw new ForbiddenError('You can only cancel your own orders');
        }

        // Customer can only cancel NEW, PENDING_PAYMENT, CONFIRMED, WAITING_CUSTOMER
        if (userRole === 'CUSTOMER') {
            const allowedStatuses: OrderStatus[] = ['NEW', 'PENDING_PAYMENT', 'CONFIRMED', 'WAITING_CUSTOMER'];
            if (!allowedStatuses.includes(order.status)) {
                throw new BadRequestError(
                    'You can only cancel orders in NEW, PENDING_PAYMENT, CONFIRMED, or WAITING_CUSTOMER status. Please contact support.'
                );
            }
        }

        // Check if order can be cancelled
        if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
            throw new BadRequestError(`Order is already ${order.status}`);
        }

        this.validateStatusTransition(order.status, 'CANCELLED');

        // Unreserve inventory if reserved
        if (order.status === 'WAITING_CUSTOMER' || order.status === 'PROCESSING' || order.status === 'READY') {
            await this.unreserveInventoryForOrder(order);
        }

        // Update status
        const cancelled = await ordersRepository.updateStatus(orderId, 'CANCELLED');

        // Notify customer
        notificationsService.sendToUser(order.customerId, {
            type: 'ORDER_CANCELLED',
            title: 'Đơn hàng đã bị huỷ',
            message: `Đơn hàng #${orderId.slice(0, 8)} đã bị huỷ`,
            data: { orderId },
        });

        // Notify staff if order was already in processing
        if (order.status === 'PROCESSING' || order.status === 'READY') {
            notificationsService.broadcastToRole('STAFF', {
                type: 'ORDER_CANCELLED',
                title: 'Đơn hàng bị huỷ',
                message: `Đơn hàng #${orderId.slice(0, 8)} đang xử lý đã bị huỷ`,
                data: { orderId },
            });
        }

        return cancelled;

        // TODO: Process refund via payment service
    }

    /**
     * Unreserve inventory for cancelled order
     */
    private async unreserveInventoryForOrder(order: OrderWithRelations): Promise<void> {
        const productIds = order.orderItems
            .filter(item => item.product.type !== 'SERVICE')
            .map(item => item.productId);

        const allInventories = await inventoryRepository.findManyByProducts(productIds);
        const inventoryMap = new Map<string, InventoryWithRelations[]>();
        for (const inv of allInventories) {
            if (!inventoryMap.has(inv.productId)) inventoryMap.set(inv.productId, []);
            inventoryMap.get(inv.productId)!.push(inv);
        }

        for (const item of order.orderItems) {
            if (item.product.type === 'SERVICE') continue;

            const inventories = inventoryMap.get(item.productId) || [];

            let remainingQty = item.quantity;
            for (const inv of inventories) {
                if (remainingQty <= 0) break;

                const toRelease = Math.min(inv.reservedQuantity, remainingQty);
                if (toRelease > 0) {
                    await inventoryRepository.release(inv.id, toRelease);
                    remainingQty -= toRelease;
                }
            }
        }
    }

    /**
     * Get orders assigned to staff
     */
    async getAssignedOrders(staffId: string, status?: OrderStatus): Promise<OrderWithRelations[]> {
        return await ordersRepository.findByStaffId(staffId, status);
    }

    /**
     * Get order statistics
     */
    async getStats(): Promise<{
        totalOrders: number;
        byStatus: Record<string, number>;
        totalRevenue: number;
    }> {
        return await ordersRepository.getStats();
    }

    /**
     * Force update status (Admin only)
     */
    async forceUpdateStatus(orderId: string, status: OrderStatus): Promise<Order> {
        const order = await ordersRepository.findById(orderId);
        if (!order) {
            throw new NotFoundError('Order not found');
        }

        return await ordersRepository.updateStatus(orderId, status);
    }

    /**
     * Validate status transition
     */
    private validateStatusTransition(currentStatus: OrderStatus, newStatus: OrderStatus): void {
        const allowed = ALLOWED_TRANSITIONS[currentStatus];
        if (!allowed.includes(newStatus)) {
            throw new BadRequestError(
                `Cannot transition from ${currentStatus} to ${newStatus}. Allowed: ${allowed.join(', ')}`
            );
        }
    }

    /**
     * Update payment status (called by payment service/webhook)
     */
    async updatePaymentStatus(
        orderId: string,
        paymentStatus: 'UNPAID' | 'DEPOSITED' | 'PAID'
    ): Promise<Order> {
        const order = await ordersRepository.findById(orderId);
        if (!order) {
            throw new NotFoundError('Order not found');
        }

        // If payment is successful and order is NEW, update to CONFIRMED
        if (paymentStatus === 'PAID' && order.status === 'NEW') {
            return await prisma.$transaction(async (tx) => {
                const updated = await tx.order.update({
                    where: { id: orderId },
                    data: {
                        paymentStatus: 'PAID',
                        status: 'CONFIRMED',
                    },
                });
                return updated;
            });
        }

        return await ordersRepository.updatePaymentStatus(orderId, paymentStatus);
    }

    /**
     * Verify order for pickup (Staff)
     * - Validate customer phone matches
     * - Return order details for verification
     */
    async verifyOrderForPickup(orderId: string, phone: string): Promise<{
        verified: boolean;
        customer: any;
        isPaid: boolean;
        order: OrderWithRelations;
    }> {
        const order = await ordersRepository.findById(orderId);
        if (!order) {
            throw new NotFoundError('Order not found');
        }

        // Check if customer phone matches
        const customerPhone = order.customer.phone;
        const verified = customerPhone === phone;

        return {
            verified,
            customer: {
                id: order.customer.id,
                fullName: order.customer.fullName,
                phone: order.customer.phone,
                email: order.customer.email,
            },
            isPaid: order.paymentStatus === 'PAID',
            order,
        };
    }

    /**
     * Complete order with notes (Staff)
     * - Enhanced version with completion notes
     * - Track which staff completed the order
     */
    async completeOrderWithNotes(orderId: string, staffId: string, completionNote?: string): Promise<Order> {
        const order = await ordersRepository.findById(orderId);
        if (!order) {
            throw new NotFoundError('Order not found');
        }

        if (order.status !== 'READY') {
            throw new BadRequestError('Order must be in READY status to complete');
        }

        this.validateStatusTransition(order.status, 'COMPLETED');

        // Transaction: Update order + Update inventory
        const productIds = order.orderItems
            .filter(item => item.product.type !== 'SERVICE')
            .map(item => item.productId);

        const allInventories = await inventoryRepository.findManyByProducts(productIds);
        const inventoryMap = new Map<string, InventoryWithRelations[]>();
        for (const inv of allInventories) {
            if (!inventoryMap.has(inv.productId)) inventoryMap.set(inv.productId, []);
            inventoryMap.get(inv.productId)!.push(inv);
        }

        const updateOperations: Array<(tx: any) => Promise<any>> = [];

        // Check and calculate inventory updates
        for (const item of order.orderItems) {
            if (item.product.type === 'SERVICE') continue;

            const inventories = inventoryMap.get(item.productId) || [];
            inventories.sort((a, b) => b.reservedQuantity - a.reservedQuantity);

            let remainingQty = item.quantity;
            for (const inv of inventories) {
                if (remainingQty <= 0) break;

                const toProcess = Math.min(inv.reservedQuantity, remainingQty);
                if (toProcess > 0) {
                    updateOperations.push((tx) =>
                        tx.inventory.update({
                            where: { id: inv.id },
                            data: {
                                quantity: { decrement: toProcess },
                                reservedQuantity: { decrement: toProcess },
                            },
                        })
                    );
                    remainingQty -= toProcess;
                }
            }

            if (remainingQty > 0) {
                throw new BadRequestError(
                    `Insufficient inventory for product ${item.productId}. Need ${item.quantity}, found ${item.quantity - remainingQty} reserved.`
                );
            }
        }

        // Execute transaction
        try {
            const completedOrder = await prisma.$transaction(async (tx) => {
                // Update order status with completion note
                const updated = await tx.order.update({
                    where: { id: orderId },
                    data: {
                        status: 'COMPLETED',
                        handledBy: staffId,
                        appointmentNote: completionNote
                            ? `${order.appointmentNote || ''}\n[Completion] ${completionNote}`.trim()
                            : order.appointmentNote,
                    },
                });

                // Execute inventory updates
                for (const operation of updateOperations) {
                    await operation(tx);
                }

                // Update order items status
                await tx.orderItem.updateMany({
                    where: { orderId },
                    data: { itemStatus: 'DELIVERED' },
                });

                return updated;
            }, {
                maxWait: 5000,
                timeout: 15000,
            });

            // Update membership spend (outside transaction — non-critical)
            try {
                await membershipService.recordSpend(order.customerId, Number(order.totalAmount));
            } catch (membershipError) {
                console.error('Membership recordSpend error (non-critical):', membershipError);
            }

            // Notify customer order completed
            notificationsService.sendToUser(order.customerId, {
                type: 'ORDER_COMPLETED',
                title: 'Đơn hàng hoàn tất',
                message: `Đơn hàng #${orderId.slice(0, 8)} đã hoàn tất. Cảm ơn bạn đã mua hàng!`,
                data: { orderId },
            });

            return completedOrder;
        } catch (error: any) {
            console.error('Complete Order DB Error:', error);
            if (error instanceof AppError) throw error;
            throw new BadRequestError(`Database operation failed: ${error.message}`);
        }
    }

    /**
     * Get order prescription details
     * - Return prescription with eye measurements
     * - Include prescription images from request
     */
    async getOrderPrescription(orderId: string, userId: string, userRole: string): Promise<any> {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                prescription: true,
                prescriptionRequest: {
                    include: {
                        images: true,
                    },
                },
                customer: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                    },
                },
            },
        });

        if (!order) {
            throw new NotFoundError('Order not found');
        }

        // Authorization: Customer can only view their own orders
        if (userRole === 'CUSTOMER' && order.customerId !== userId) {
            throw new ForbiddenError('You can only view your own order prescriptions');
        }

        if (!order.prescription) {
            throw new NotFoundError('No prescription found for this order');
        }

        return {
            orderId: order.id,
            customer: order.customer,
            prescription: {
                id: order.prescription.id,
                rightEye: {
                    sphere: order.prescription.rightEyeSphere,
                    cylinder: order.prescription.rightEyeCylinder,
                    axis: order.prescription.rightEyeAxis,
                },
                leftEye: {
                    sphere: order.prescription.leftEyeSphere,
                    cylinder: order.prescription.leftEyeCylinder,
                    axis: order.prescription.leftEyeAxis,
                },
                pupillaryDistance: order.prescription.pupillaryDistance,
                notes: order.prescription.notes,
                prescriptionImageUrl: order.prescription.prescriptionImageUrl,
                measuredBy: order.prescription.measuredBy,
                createdAt: order.prescription.createdAt,
            },
            prescriptionRequestImages: order.prescriptionRequest?.images || [],
        };
    }

    /**
     * Handle payment success (called by payment service)
     * - Update order status to CONFIRMED
     * - Update prescription request status if applicable
     */
    async handlePaymentSuccess(orderId: string): Promise<Order> {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                prescriptionRequest: true,
            },
        });

        if (!order) {
            throw new NotFoundError('Order not found');
        }

        // Avoid unnecessary updates if already processed
        if (order.paymentStatus === 'PAID' && order.status === 'CONFIRMED') {
            return order;
        }

        const updatedOrder = await prisma.$transaction(async (tx) => {
            // 1. Update order
            const result = await tx.order.update({
                where: { id: orderId },
                data: {
                    paymentStatus: 'PAID',
                    status: (order.status === 'PENDING_PAYMENT' || order.status === 'NEW')
                        ? 'CONFIRMED'
                        : order.status,
                },
            });

            // 2. Update prescription request if exists
            if (order.prescriptionRequest && order.prescriptionRequest.status === 'QUOTED') {
                await tx.prescriptionRequest.update({
                    where: { id: order.prescriptionRequest.id },
                    data: {
                        status: 'ACCEPTED',
                    },
                });
            }

            return result;
        });

        // Notify customer of confirmed order (after transaction)
        notificationsService.sendToUser(order!.customerId, {
            type: 'ORDER_CONFIRMED',
            title: 'Đơn hàng đã xác nhận',
            message: `Đơn hàng #${orderId.slice(0, 8)} đã được xác nhận thành công`,
            data: { orderId },
        });

        return updatedOrder;
    }

    /**
     * Expire unpaid orders
     * - Find orders past expiresAt
     * - Update order status: PENDING_PAYMENT → EXPIRED
     * - Update prescription request status: QUOTED → EXPIRED
     */
    async expireUnpaidOrders(): Promise<{ expiredCount: number }> {
        const now = new Date();

        // Find expired orders
        const expiredOrders = await prisma.order.findMany({
            where: {
                status: 'PENDING_PAYMENT',
                paymentStatus: 'UNPAID',
                expiresAt: {
                    lt: now,
                },
            },
            include: {
                prescriptionRequest: true,
            },
        });

        // Update each order in transaction
        for (const order of expiredOrders) {
            await prisma.$transaction(async (tx) => {
                // Update order status
                await tx.order.update({
                    where: { id: order.id },
                    data: {
                        status: 'EXPIRED',
                    },
                });

                // Update prescription request if exists
                if (order.prescriptionRequest) {
                    await tx.prescriptionRequest.update({
                        where: { id: order.prescriptionRequest.id },
                        data: {
                            status: 'EXPIRED',
                        },
                    });
                }
            });
        }

        return { expiredCount: expiredOrders.length };
    }

    /**
     * CUSTOMER FEATURE: Confirm Receipt
     * Allow customer to manually confirm they received the order.
     * This mimics the GHN Webhook 'delivered' event.
     */
    async confirmReceipt(orderId: string, customerId: string): Promise<Order> {
        const order = await ordersRepository.findById(orderId);
        if (!order) {
            throw new NotFoundError('Order not found');
        }

        // Authorization: Check if correct customer
        if (order.customerId !== customerId) {
            throw new ForbiddenError('You can only confirm receipt for your own orders');
        }

        // Chỉ cho phép đối với đơn Giao tận nơi (Shipping orders only)
        if (order.deliveryMethod !== 'HOME_DELIVERY') {
            throw new BadRequestError('Chỉ đơn hàng giao tận nơi mới có thể chủ động xác nhận nhận hàng.');
        }

        // Business Rule: Only allow if shipped (READY)
        if (order.status !== 'READY') {
            throw new BadRequestError('Order must be in READY status (shipped) to confirm receipt');
        }

        // Complete the order (Logic: Inventory deduction, Membership spin, Notification)
        const completedOrder = await this.completeOrder(orderId);

        // Update Shipping Status to DELIVERED
        await ordersRepository.update(orderId, {
            shippingStatus: 'DELIVERED',
        });

        // Notify staff that order was completed by customer
        notificationsService.broadcastToRole('STAFF', {
            type: 'ORDER_COMPLETED',
            title: 'Khách đã nhận hàng',
            message: `Khách hàng đã xác nhận nhận hàng cho đơn #${orderId.slice(0, 8)}`,
            data: { orderId },
        });

        return completedOrder;
    }
}

export const ordersService = new OrdersService();
