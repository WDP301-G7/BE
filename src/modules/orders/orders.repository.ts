// src/modules/orders/orders.repository.ts
import { Order, OrderStatus, OrderType, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

export interface CreateOrderData {
    customerId: string;
    orderType: OrderType;
    totalAmount: number;
    items: Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
    }>;
}

export interface GetOrdersFilter {
    page?: number;
    limit?: number;
    status?: OrderStatus;
    orderType?: OrderType;
    customerId?: string;
    startDate?: Date;
    endDate?: Date;
}

export interface PaginatedOrders {
    data: OrderWithRelations[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export type OrderWithRelations = Prisma.OrderGetPayload<{
    include: {
        customer: {
            select: {
                id: true;
                fullName: true;
                email: true;
                phone: true;
            };
        };
        handler: {
            select: {
                id: true;
                fullName: true;
                role: true;
            };
        };
        orderItems: {
            include: {
                product: true;
            };
        };
        payments: true;
        prescription: true;
    };
}>;

class OrdersRepository {
    /**
     * Create new order with items (using transaction)
     */
    async create(data: CreateOrderData): Promise<Order> {
        return await prisma.$transaction(async (tx) => {
            // Create order
            const order = await tx.order.create({
                data: {
                    customerId: data.customerId,
                    orderType: data.orderType,
                    status: 'NEW',
                    paymentStatus: 'UNPAID',
                    totalAmount: data.totalAmount,
                },
            });

            // Create order items
            await tx.orderItem.createMany({
                data: data.items.map((item) => ({
                    orderId: order.id,
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    itemStatus: 'PENDING',
                })),
            });

            return order;
        });
    }

    /**
     * Find order by ID with all relations
     */
    async findById(id: string): Promise<OrderWithRelations | null> {
        return await prisma.order.findUnique({
            where: { id },
            include: {
                customer: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                    },
                },
                handler: {
                    select: {
                        id: true,
                        fullName: true,
                        role: true,
                    },
                },
                orderItems: {
                    include: {
                        product: true,
                    },
                },
                payments: true,
                prescription: true,
            },
        });
    }

    /**
     * Find orders by customer ID
     */
    async findByCustomerId(
        customerId: string,
        page: number = 1,
        limit: number = 10
    ): Promise<PaginatedOrders> {
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            prisma.order.findMany({
                where: { customerId },
                include: {
                    customer: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            phone: true,
                        },
                    },
                    handler: {
                        select: {
                            id: true,
                            fullName: true,
                            role: true,
                        },
                    },
                    orderItems: {
                        include: {
                            product: true,
                        },
                    },
                    payments: true,
                    prescription: true,
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.order.count({ where: { customerId } }),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get all orders with filters and pagination
     */
    async getOrders(filter: GetOrdersFilter): Promise<PaginatedOrders> {
        const page = filter.page || 1;
        const limit = filter.limit || 10;
        const skip = (page - 1) * limit;

        // Build where clause
        const where: Prisma.OrderWhereInput = {
            ...(filter.status && { status: filter.status }),
            ...(filter.orderType && { orderType: filter.orderType }),
            ...(filter.customerId && { customerId: filter.customerId }),
            ...(filter.startDate &&
                filter.endDate && {
                createdAt: {
                    gte: filter.startDate,
                    lte: filter.endDate,
                },
            }),
        };

        const [data, total] = await Promise.all([
            prisma.order.findMany({
                where,
                include: {
                    customer: {
                        select: {
                            id: true,
                            fullName: true,
                            email: true,
                            phone: true,
                        },
                    },
                    handler: {
                        select: {
                            id: true,
                            fullName: true,
                            role: true,
                        },
                    },
                    orderItems: {
                        include: {
                            product: true,
                        },
                    },
                    payments: true,
                    prescription: true,
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.order.count({ where }),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Update order
     */
    async update(id: string, data: Prisma.OrderUpdateInput): Promise<Order> {
        return await prisma.order.update({
            where: { id },
            data,
        });
    }

    /**
     * Update order status
     */
    async updateStatus(id: string, status: OrderStatus): Promise<Order> {
        return await prisma.order.update({
            where: { id },
            data: { status },
        });
    }

    /**
     * Update payment status
     */
    async updatePaymentStatus(
        id: string,
        paymentStatus: 'UNPAID' | 'DEPOSITED' | 'PAID'
    ): Promise<Order> {
        return await prisma.order.update({
            where: { id },
            data: { paymentStatus },
        });
    }

    /**
     * Set appointment
     */
    async setAppointment(
        id: string,
        appointmentDate: Date,
        appointmentNote?: string,
        handledBy?: string
    ): Promise<Order> {
        const expectedReadyDate = new Date(appointmentDate.getTime() + 60 * 60 * 1000); // +1 hour

        return await prisma.order.update({
            where: { id },
            data: {
                appointmentDate,
                appointmentNote,
                expectedReadyDate,
                ...(handledBy && { handledBy }),
                status: 'WAITING_CUSTOMER',
            },
        });
    }

    /**
     * Get order statistics
     */
    async getStats(): Promise<{
        totalOrders: number;
        byStatus: Record<string, number>;
        totalRevenue: number;
    }> {
        const [totalOrders, byStatus, revenueData] = await Promise.all([
            prisma.order.count(),
            prisma.order.groupBy({
                by: ['status'],
                _count: true,
            }),
            prisma.order.aggregate({
                where: {
                    status: 'COMPLETED',
                },
                _sum: {
                    totalAmount: true,
                },
            }),
        ]);

        const byStatusMap: Record<string, number> = {};
        byStatus.forEach((item) => {
            byStatusMap[item.status] = item._count;
        });

        return {
            totalOrders,
            byStatus: byStatusMap,
            totalRevenue: Number(revenueData._sum.totalAmount || 0),
        };
    }

    /**
     * Find orders assigned to staff
     */
    async findByStaffId(staffId: string, status?: OrderStatus): Promise<OrderWithRelations[]> {
        return await prisma.order.findMany({
            where: {
                handledBy: staffId,
                status: status
                    ? status
                    : { in: ['WAITING_CUSTOMER', 'PROCESSING', 'READY'] as OrderStatus[] },
            },
            include: {
                customer: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                    },
                },
                handler: {
                    select: {
                        id: true,
                        fullName: true,
                        role: true,
                    },
                },
                orderItems: {
                    include: {
                        product: true,
                    },
                },
                payments: true,
                prescription: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }
}

export const ordersRepository = new OrdersRepository();
