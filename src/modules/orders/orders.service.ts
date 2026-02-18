// src/modules/orders/orders.service.ts
import { Order, OrderStatus } from '@prisma/client';
import {
    ordersRepository,
    CreateOrderData,
    GetOrdersFilter,
    PaginatedOrders,
    OrderWithRelations,
} from './orders.repository';
import { inventoryRepository } from '../inventory/inventory.repository';
import { productsRepository } from '../products/products.repository';
import {
    NotFoundError,
    BadRequestError,
    ForbiddenError,
    AppError,
} from '../../utils/errorHandler';
import { prisma } from '../../config/database';
import { CreateOrderInput, ConfirmOrderInput } from '../../validations/zod/orders.schema';

/**
 * Allowed status transitions
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    NEW: ['CONFIRMED', 'CANCELLED'],
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
        // Step 1: Validate combo (1 FRAME + 1 LENS + 0-N SERVICE)
        await this.validateOrderCombo(data.items);

        // Step 2: Get products and calculate total
        const productsMap = new Map();
        for (const item of data.items) {
            const product = await productsRepository.findById(item.productId);
            if (!product) {
                throw new NotFoundError(`Product with ID ${item.productId} not found`);
            }
            productsMap.set(item.productId, product);
        }

        // Step 3: Check stock availability (across all stores)
        // For IN_STOCK orders, we need to ensure products are available
        for (const item of data.items) {
            const product = productsMap.get(item.productId);

            // Skip SERVICE products (no inventory)
            if (product.type === 'SERVICE') continue;

            const availableQty = await inventoryRepository.getTotalAvailableQuantity(item.productId);
            if (availableQty < item.quantity) {
                throw new BadRequestError(
                    `Insufficient stock for product "${product.name}". Available: ${availableQty}, Requested: ${item.quantity}`
                );
            }
        }

        // Step 4: Calculate total amount
        const totalAmount = data.items.reduce((sum, item) => {
            const product = productsMap.get(item.productId);
            return sum + Number(product.price) * item.quantity;
        }, 0);

        // Step 5: Create order in database
        const orderData: CreateOrderData = {
            customerId,
            orderType: 'IN_STOCK',
            totalAmount,
            items: data.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: Number(productsMap.get(item.productId).price),
            })),
        };

        const order = await ordersRepository.create(orderData);

        // Step 6: Return order with relations
        const createdOrder = await ordersRepository.findById(order.id);
        if (!createdOrder) {
            throw new Error('Failed to retrieve created order');
        }

        return createdOrder;
    }

    /**
     * Validate order combo: Must have exactly 1 FRAME + 1 LENS
     */
    private async validateOrderCombo(
        items: Array<{ productId: string; quantity: number }>
    ): Promise<void> {
        const productTypes: Record<string, number> = {
            FRAME: 0,
            LENS: 0,
            SERVICE: 0,
        };

        for (const item of items) {
            const product = await productsRepository.findById(item.productId);
            if (!product) {
                throw new NotFoundError(`Product with ID ${item.productId} not found`);
            }

            if (product.type in productTypes) {
                productTypes[product.type] += item.quantity;
            }
        }

        // Validation rules
        if (productTypes.FRAME !== 1) {
            throw new BadRequestError('Order must have exactly 1 FRAME');
        }

        if (productTypes.LENS !== 1) {
            throw new BadRequestError('Order must have exactly 1 LENS');
        }

        // SERVICE is optional (0-N allowed)
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
                    await inventoryRepository.reserve(inv.id, toReserve);
                    remainingQty -= toReserve;
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
        return await ordersRepository.setAppointment(orderId, date, appointmentNote);
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

        // Validate transition
        this.validateStatusTransition(order.status, 'PROCESSING');

        // Update status and assign staff if not assigned
        return await ordersRepository.update(orderId, {
            status: 'PROCESSING',
            ...((!order.handledBy && { handledBy: staffId })),
        });
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

        this.validateStatusTransition(order.status, 'READY');

        return await ordersRepository.updateStatus(orderId, 'READY');
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
        const updateOperations: Array<(tx: any) => Promise<any>> = [];

        // Check and calculate inventory updates
        for (const item of order.orderItems) {
            if (item.product.type === 'SERVICE') continue;

            const inventories = await inventoryRepository.getByProduct(item.productId);
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
            return await prisma.$transaction(async (tx) => {
                // 1. Update order status
                const completedOrder = await tx.order.update({
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

                return completedOrder;
            }, {
                maxWait: 5000,
                timeout: 15000 // Increased timeout
            });
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

        // Customer can only cancel NEW, CONFIRMED, WAITING_CUSTOMER
        if (userRole === 'CUSTOMER') {
            const allowedStatuses: OrderStatus[] = ['NEW', 'CONFIRMED', 'WAITING_CUSTOMER'];
            if (!allowedStatuses.includes(order.status)) {
                throw new BadRequestError(
                    'You can only cancel orders in NEW, CONFIRMED, or WAITING_CUSTOMER status. Please contact support.'
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
        return await ordersRepository.updateStatus(orderId, 'CANCELLED');

        // TODO: Process refund via payment service
    }

    /**
     * Unreserve inventory for cancelled order
     */
    private async unreserveInventoryForOrder(order: OrderWithRelations): Promise<void> {
        for (const item of order.orderItems) {
            if (item.product.type === 'SERVICE') continue;

            const inventories = await inventoryRepository.getByProduct(item.productId);

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
    async getAssignedOrders(staffId: string): Promise<OrderWithRelations[]> {
        return await ordersRepository.findByStaffId(staffId);
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
        const updateOperations: Array<(tx: any) => Promise<any>> = [];

        // Check and calculate inventory updates
        for (const item of order.orderItems) {
            if (item.product.type === 'SERVICE') continue;

            const inventories = await inventoryRepository.getByProduct(item.productId);
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
            return await prisma.$transaction(async (tx) => {
                // Update order status with completion note
                const completedOrder = await tx.order.update({
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

                return completedOrder;
            }, {
                maxWait: 5000,
                timeout: 15000,
            });
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
     * Handle payment success for prescription orders
     * - Update order status: WAITING_CUSTOMER → CONFIRMED
     * - Update payment status: UNPAID → PAID
     * - Update prescription request status: QUOTED → ACCEPTED
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

        // Update order and prescription request in transaction
        return await prisma.$transaction(async (tx) => {
            // Update order
            const updatedOrder = await tx.order.update({
                where: { id: orderId },
                data: {
                    paymentStatus: 'PAID',
                    status: order.status === 'WAITING_CUSTOMER' ? 'CONFIRMED' : order.status,
                },
            });

            // Update prescription request if exists
            if (order.prescriptionRequest) {
                await tx.prescriptionRequest.update({
                    where: { id: order.prescriptionRequest.id },
                    data: {
                        status: 'ACCEPTED',
                    },
                });
            }

            return updatedOrder;
        });
    }

    /**
     * Expire unpaid orders
     * - Find orders past expiresAt
     * - Update order status: WAITING_CUSTOMER → EXPIRED
     * - Update prescription request status: QUOTED → EXPIRED
     */
    async expireUnpaidOrders(): Promise<{ expiredCount: number }> {
        const now = new Date();

        // Find expired orders
        const expiredOrders = await prisma.order.findMany({
            where: {
                status: 'WAITING_CUSTOMER',
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
}

export const ordersService = new OrdersService();
