// src/modules/returns/returns.repository.ts
import { ReturnRequest, ReturnStatus, ReturnType, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

/**
 * Interface for creating return request
 */
export interface CreateReturnRequestData {
    orderId: string;
    customerId: string;
    type: ReturnType;
    reason: string;
    description?: string;
    items: Array<{
        orderItemId: string;
        productId: string;
        quantity: number;
        condition: string;
        exchangeProductId?: string;
    }>;
    warrantyExpiredAt?: Date;
}

/**
 * Interface for filter
 */
export interface GetReturnsFilter {
    page?: number;
    limit?: number;
    status?: ReturnStatus;
    type?: ReturnType;
    customerId?: string;
    orderId?: string;
    startDate?: Date;
    endDate?: Date;
}

/**
 * Paginated result
 */
export interface PaginatedReturns {
    data: ReturnRequestWithRelations[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

/**
 * Return request with all relations
 */
export type ReturnRequestWithRelations = Prisma.ReturnRequestGetPayload<{
    include: {
        order: {
            include: {
                orderItems: {
                    include: {
                        product: true;
                    };
                };
            };
        };
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
        items: {
            include: {
                product: true;
                exchangeProduct: true;
                orderItem: true;
            };
        };
        images: {
            include: {
                uploader: {
                    select: {
                        id: true;
                        fullName: true;
                        role: true;
                    };
                };
            };
        };
    };
}>;

class ReturnsRepository {
    /**
     * Create return request with items (using Prisma transaction)
     */
    async create(data: CreateReturnRequestData): Promise<ReturnRequest> {
        return await prisma.$transaction(async (tx) => {
            // Create return request
            const returnRequest = await tx.returnRequest.create({
                data: {
                    orderId: data.orderId,
                    customerId: data.customerId,
                    type: data.type,
                    status: 'PENDING',
                    channel: 'IN_STORE',
                    reason: data.reason,
                    description: data.description,
                    warrantyExpiredAt: data.warrantyExpiredAt,
                },
            });

            // Create return items
            await tx.returnItem.createMany({
                data: data.items.map((item) => ({
                    returnRequestId: returnRequest.id,
                    orderItemId: item.orderItemId,
                    productId: item.productId,
                    quantity: item.quantity,
                    condition: item.condition as any,
                    exchangeProductId: item.exchangeProductId,
                })),
            });

            return returnRequest;
        });
    }

    /**
     * Find return request by ID with all relations
     */
    async findById(id: string): Promise<ReturnRequestWithRelations | null> {
        return await prisma.returnRequest.findUnique({
            where: { id },
            include: {
                order: {
                    include: {
                        orderItems: {
                            include: {
                                product: true,
                            },
                        },
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
                handler: {
                    select: {
                        id: true,
                        fullName: true,
                        role: true,
                    },
                },
                items: {
                    include: {
                        product: true,
                        exchangeProduct: true,
                        orderItem: true,
                    },
                },
                images: {
                    include: {
                        uploader: {
                            select: {
                                id: true,
                                fullName: true,
                                role: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: 'asc',
                    },
                },
            },
        });
    }

    /**
     * Find return requests by customer ID with pagination
     */
    async findByCustomerId(customerId: string, page: number = 1, limit: number = 10): Promise<PaginatedReturns> {
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            prisma.returnRequest.findMany({
                where: { customerId },
                include: {
                    order: {
                        include: {
                            orderItems: {
                                include: {
                                    product: true,
                                },
                            },
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
                    handler: {
                        select: {
                            id: true,
                            fullName: true,
                            role: true,
                        },
                    },
                    items: {
                        include: {
                            product: true,
                            exchangeProduct: true,
                            orderItem: true,
                        },
                    },
                    images: {
                        include: {
                            uploader: {
                                select: {
                                    id: true,
                                    fullName: true,
                                    role: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.returnRequest.count({ where: { customerId } }),
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
     * Find return requests by order ID
     */
    async findByOrderId(orderId: string): Promise<ReturnRequestWithRelations[]> {
        return await prisma.returnRequest.findMany({
            where: { orderId },
            include: {
                order: {
                    include: {
                        orderItems: {
                            include: {
                                product: true,
                            },
                        },
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
                handler: {
                    select: {
                        id: true,
                        fullName: true,
                        role: true,
                    },
                },
                items: {
                    include: {
                        product: true,
                        exchangeProduct: true,
                        orderItem: true,
                    },
                },
                images: {
                    include: {
                        uploader: {
                            select: {
                                id: true,
                                fullName: true,
                                role: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Get all return requests with filters and pagination (using Prisma for simple queries)
     */
    async getReturns(filter: GetReturnsFilter): Promise<PaginatedReturns> {
        const page = filter.page || 1;
        const limit = filter.limit || 10;
        const skip = (page - 1) * limit;

        // Build where clause
        const where: Prisma.ReturnRequestWhereInput = {};

        if (filter.status) {
            where.status = filter.status;
        }

        if (filter.type) {
            where.type = filter.type;
        }

        if (filter.customerId) {
            where.customerId = filter.customerId;
        }

        if (filter.orderId) {
            where.orderId = filter.orderId;
        }

        if (filter.startDate || filter.endDate) {
            where.createdAt = {};
            if (filter.startDate) {
                where.createdAt.gte = filter.startDate;
            }
            if (filter.endDate) {
                where.createdAt.lte = filter.endDate;
            }
        }

        const [data, total] = await Promise.all([
            prisma.returnRequest.findMany({
                where,
                include: {
                    order: {
                        include: {
                            orderItems: {
                                include: {
                                    product: true,
                                },
                            },
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
                    handler: {
                        select: {
                            id: true,
                            fullName: true,
                            role: true,
                        },
                    },
                    items: {
                        include: {
                            product: true,
                            exchangeProduct: true,
                            orderItem: true,
                        },
                    },
                    images: {
                        include: {
                            uploader: {
                                select: {
                                    id: true,
                                    fullName: true,
                                    role: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.returnRequest.count({ where }),
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
     * Update return request status
     */
    async updateStatus(id: string, status: ReturnStatus): Promise<ReturnRequest> {
        return await prisma.returnRequest.update({
            where: { id },
            data: { status },
        });
    }

    /**
     * Update return request (general)
     */
    async update(id: string, data: Prisma.ReturnRequestUpdateInput): Promise<ReturnRequest> {
        return await prisma.returnRequest.update({
            where: { id },
            data,
        });
    }

    /**
     * Approve return request
     */
    async approve(id: string, handledBy: string): Promise<ReturnRequest> {
        return await prisma.returnRequest.update({
            where: { id },
            data: {
                status: 'APPROVED',
                handledBy,
                approvedAt: new Date(),
            },
        });
    }

    /**
     * Reject return request
     */
    async reject(id: string, handledBy: string, rejectionReason: string): Promise<ReturnRequest> {
        return await prisma.returnRequest.update({
            where: { id },
            data: {
                status: 'REJECTED',
                handledBy,
                rejectedAt: new Date(),
                rejectionReason,
            },
        });
    }

    /**
     * Complete return request
     */
    async complete(
        id: string,
        data: {
            handledBy: string;
            finalAmount?: number;
            refundAmount?: number;
            refundMethod?: string;
            priceDifference?: number;
        }
    ): Promise<ReturnRequest> {
        return await prisma.returnRequest.update({
            where: { id },
            data: {
                status: 'COMPLETED',
                handledBy: data.handledBy,
                completedAt: new Date(),
                finalAmount: data.finalAmount,
                refundAmount: data.refundAmount,
                refundMethod: data.refundMethod as any,
                refundedAt: data.refundAmount ? new Date() : null,
                priceDifference: data.priceDifference,
            },
        });
    }

    /**
     * Create return request image
     */
    async createImage(data: {
        returnRequestId: string;
        imageUrl: string;
        imageType: string;
        uploadedBy: string;
    }): Promise<any> {
        return await prisma.returnRequestImage.create({
            data: {
                returnRequestId: data.returnRequestId,
                imageUrl: data.imageUrl,
                imageType: data.imageType as any,
                uploadedBy: data.uploadedBy,
            },
        });
    }

    /**
     * Create multiple images
     */
    async createImages(images: Array<{
        returnRequestId: string;
        imageUrl: string;
        imageType: string;
        uploadedBy: string;
    }>): Promise<any> {
        return await prisma.returnRequestImage.createMany({
            data: images.map(img => ({
                returnRequestId: img.returnRequestId,
                imageUrl: img.imageUrl,
                imageType: img.imageType as any,
                uploadedBy: img.uploadedBy,
            })),
        });
    }

    /**
     * Delete image
     */
    async deleteImage(imageId: string): Promise<any> {
        return await prisma.returnRequestImage.delete({
            where: { id: imageId },
        });
    }

    /**
     * Find image by ID
     */
    async findImageById(imageId: string): Promise<any> {
        return await prisma.returnRequestImage.findUnique({
            where: { id: imageId },
            include: {
                returnRequest: true,
            },
        });
    }

    /**
     * Check if order has active return request
     */
    async hasActiveReturnRequest(orderId: string): Promise<boolean> {
        const count = await prisma.returnRequest.count({
            where: {
                orderId,
                status: {
                    in: ['PENDING', 'APPROVED'],
                },
            },
        });
        return count > 0;
    }

    /**
     * Get return statistics (using Raw SQL for aggregations)
     */
    async getStats(): Promise<{
        totalReturns: number;
        byStatus: Record<string, number>;
        byType: Record<string, number>;
        totalRefundAmount: number;
    }> {
        // Use Raw SQL for complex aggregations (as per project rules)
        const statusStats = await prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
            SELECT status, COUNT(*) as count
            FROM return_requests
            GROUP BY status
        `;

        const typeStats = await prisma.$queryRaw<Array<{ type: string; count: bigint }>>`
            SELECT type, COUNT(*) as count
            FROM return_requests
            GROUP BY type
        `;

        const refundStats = await prisma.$queryRaw<Array<{ total: number | null }>>`
            SELECT SUM(refund_amount) as total
            FROM return_requests
            WHERE status = 'COMPLETED' AND refund_amount IS NOT NULL
        `;

        const total = await prisma.returnRequest.count();

        return {
            totalReturns: total,
            byStatus: statusStats.reduce((acc, item) => {
                acc[item.status] = Number(item.count);
                return acc;
            }, {} as Record<string, number>),
            byType: typeStats.reduce((acc, item) => {
                acc[item.type] = Number(item.count);
                return acc;
            }, {} as Record<string, number>),
            totalRefundAmount: refundStats[0]?.total || 0,
        };
    }
}

export const returnsRepository = new ReturnsRepository();
