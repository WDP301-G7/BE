// src/modules/reviews/reviews.repository.ts
import { Review, ReviewStatus, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface CreateReviewData {
    orderItemId: string;
    orderId: string;
    productId: string;
    customerId: string;
    rating: number;
    comment?: string;
    editableUntil: Date;
    imageUrls?: string[];
}

export interface UpdateReviewData {
    rating?: number;
    comment?: string | null;
}

export interface GetReviewsFilter {
    page?: number;
    limit?: number;
    status?: ReviewStatus;
    productId?: string;
    customerId?: string;
    rating?: number;
    startDate?: Date;
    endDate?: Date;
}

export interface GetProductReviewsFilter {
    rating?: number;
    hasImages?: boolean;
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'rating';
    sortOrder?: 'asc' | 'desc';
}

export interface PaginatedReviews {
    data: ReviewWithRelations[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface RatingSummary {
    productId: string;
    productName: string;
    avgRating: number;
    totalReviews: number;
    distribution: {
        '1': number;
        '2': number;
        '3': number;
        '4': number;
        '5': number;
    };
}

export type ReviewWithRelations = Prisma.ReviewGetPayload<{
    include: {
        customer: {
            select: {
                id: true;
                fullName: true;
                avatarUrl: true;
            };
        };
        replier: {
            select: {
                id: true;
                fullName: true;
                role: true;
            };
        };
        images: true;
        product: {
            select: {
                id: true;
                name: true;
                type: true;
            };
        };
    };
}>;

class ReviewsRepository {
    // ─── Prisma ORM: CRUD ────────────────────────────────────────────────────

    /**
     * Create review with images in a single transaction
     * Using Prisma ORM – standard CRUD
     */
    async create(data: CreateReviewData): Promise<ReviewWithRelations> {
        return await prisma.$transaction(async (tx) => {
            const review = await tx.review.create({
                data: {
                    orderItemId: data.orderItemId,
                    orderId: data.orderId,
                    productId: data.productId,
                    customerId: data.customerId,
                    rating: data.rating,
                    comment: data.comment,
                    editableUntil: data.editableUntil,
                    status: 'PUBLISHED',
                },
            });

            if (data.imageUrls && data.imageUrls.length > 0) {
                await tx.reviewImage.createMany({
                    data: data.imageUrls.map((url, index) => ({
                        reviewId: review.id,
                        imageUrl: url,
                        sortOrder: index,
                    })),
                });
            }

            return await tx.review.findUnique({
                where: { id: review.id },
                include: this.defaultInclude,
            }) as ReviewWithRelations;
        });
    }

    /**
     * Find review by ID with relations
     * Using Prisma ORM – simple lookup
     */
    async findById(id: string): Promise<ReviewWithRelations | null> {
        return await prisma.review.findUnique({
            where: { id },
            include: this.defaultInclude,
        });
    }

    /**
     * Find review by OrderItem ID
     * Using Prisma ORM – unique constraint lookup
     */
    async findByOrderItemId(orderItemId: string): Promise<Review | null> {
        return await prisma.review.findUnique({
            where: { orderItemId },
        });
    }

    /**
     * Update review content and optionally replace images
     * Using Prisma ORM – standard update
     */
    async update(
        id: string,
        data: UpdateReviewData,
        newImageUrls?: string[]
    ): Promise<ReviewWithRelations> {
        return await prisma.$transaction(async (tx) => {
            await tx.review.update({
                where: { id },
                data: {
                    ...(data.rating !== undefined && { rating: data.rating }),
                    ...(data.comment !== undefined && { comment: data.comment }),
                },
            });

            if (newImageUrls !== undefined) {
                // Delete all existing images then re-create
                await tx.reviewImage.deleteMany({ where: { reviewId: id } });

                if (newImageUrls.length > 0) {
                    await tx.reviewImage.createMany({
                        data: newImageUrls.map((url, index) => ({
                            reviewId: id,
                            imageUrl: url,
                            sortOrder: index,
                        })),
                    });
                }
            }

            return await tx.review.findUnique({
                where: { id },
                include: this.defaultInclude,
            }) as ReviewWithRelations;
        });
    }

    /**
     * Save reply to review
     * Using Prisma ORM – simple update
     */
    async saveReply(
        id: string,
        replyContent: string,
        repliedBy: string
    ): Promise<ReviewWithRelations> {
        return await prisma.review.update({
            where: { id },
            data: {
                replyContent,
                repliedBy,
                repliedAt: new Date(),
            },
            include: this.defaultInclude,
        });
    }

    /**
     * Update review status (hide/show)
     * Using Prisma ORM – simple update
     */
    async updateStatus(id: string, status: ReviewStatus): Promise<Review> {
        return await prisma.review.update({
            where: { id },
            data: {
                status,
                ...(status === 'HIDDEN' && { deletedAt: new Date() }),
                ...(status === 'PUBLISHED' && { deletedAt: null }),
            },
        });
    }

    /**
     * Hard delete review (ADMIN only)
     * Using Prisma ORM – cascade deletes images
     */
    async hardDelete(id: string): Promise<void> {
        await prisma.review.delete({ where: { id } });
    }

    /**
     * Get reviews by product with filters and pagination
     * Using Prisma ORM – filtered queries are well supported
     */
    async findByProductId(
        productId: string,
        filter: GetProductReviewsFilter
    ): Promise<PaginatedReviews> {
        const page = filter.page ?? 1;
        const limit = filter.limit ?? 10;
        const skip = (page - 1) * limit;

        const where: Prisma.ReviewWhereInput = {
            productId,
            status: 'PUBLISHED',
            deletedAt: null,
            ...(filter.rating !== undefined && { rating: filter.rating }),
            ...(filter.hasImages === true && {
                images: { some: {} },
            }),
            ...(filter.hasImages === false && {
                images: { none: {} },
            }),
        };

        const orderBy: Prisma.ReviewOrderByWithRelationInput = {
            [filter.sortBy ?? 'createdAt']: filter.sortOrder ?? 'desc',
        };

        const [data, total] = await Promise.all([
            prisma.review.findMany({
                where,
                include: this.defaultInclude,
                orderBy,
                skip,
                take: limit,
            }),
            prisma.review.count({ where }),
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
     * Get all reviews with filters (admin/manager)
     * Using Prisma ORM – filtered admin queries
     */
    async findAll(filter: GetReviewsFilter): Promise<PaginatedReviews> {
        const page = filter.page ?? 1;
        const limit = filter.limit ?? 10;
        const skip = (page - 1) * limit;

        const where: Prisma.ReviewWhereInput = {
            ...(filter.status !== undefined && { status: filter.status }),
            ...(filter.productId && { productId: filter.productId }),
            ...(filter.customerId && { customerId: filter.customerId }),
            ...(filter.rating !== undefined && { rating: filter.rating }),
            ...(filter.startDate && {
                createdAt: { gte: filter.startDate },
            }),
            ...(filter.endDate && {
                createdAt: { lte: filter.endDate },
            }),
        };

        const [data, total] = await Promise.all([
            prisma.review.findMany({
                where,
                include: this.defaultInclude,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.review.count({ where }),
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
     * Get eligible OrderItems for a customer (COMPLETED orders, not yet reviewed,
     * within 30 days, FRAME/LENS only)
     * Using Prisma ORM – join is manageable
     */
    async findEligibleOrderItems(customerId: string): Promise<
        Array<{
            orderItemId: string;
            orderId: string;
            productId: string;
            productName: string;
            productType: string;
            unitPrice: number;
            quantity: number;
            orderCompletedAt: Date;
            deadline: Date;
        }>
    > {
        const REVIEW_DEADLINE_DAYS = 30;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - REVIEW_DEADLINE_DAYS);

        const orderItems = await prisma.orderItem.findMany({
            where: {
                order: {
                    customerId,
                    status: 'COMPLETED',
                    updatedAt: { gte: cutoffDate },
                },
                product: {
                    type: { in: ['FRAME', 'LENS'] },
                    deletedAt: null,
                },
                review: null,
            },
            include: {
                order: { select: { id: true, updatedAt: true } },
                product: { select: { id: true, name: true, type: true } },
            },
            orderBy: { order: { updatedAt: 'desc' } },
        });

        return orderItems.map((item) => {
            const deadline = new Date(item.order.updatedAt);
            deadline.setDate(deadline.getDate() + REVIEW_DEADLINE_DAYS);
            return {
                orderItemId: item.id,
                orderId: item.orderId,
                productId: item.productId,
                productName: item.product.name,
                productType: item.product.type,
                unitPrice: Number(item.unitPrice),
                quantity: item.quantity,
                orderCompletedAt: item.order.updatedAt,
                deadline,
            };
        });
    }

    /**
     * Get reviews written by a customer
     * Using Prisma ORM – simple filtered query
     */
    async findByCustomerId(customerId: string, page: number, limit: number): Promise<PaginatedReviews> {
        const skip = (page - 1) * limit;
        const where: Prisma.ReviewWhereInput = { customerId };

        const [data, total] = await Promise.all([
            prisma.review.findMany({
                where,
                include: this.defaultInclude,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.review.count({ where }),
        ]);

        return {
            data,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    }

    // ─── Raw SQL: Aggregations ───────────────────────────────────────────────

    /**
     * Get rating summary for a product
     * Using Raw SQL – requires GROUP BY + COUNT aggregation
     */
    async getRatingSummary(productId: string): Promise<RatingSummary | null> {
        const rows = await prisma.$queryRaw<
            Array<{
                product_id: string;
                product_name: string;
                avg_rating: number | null;
                total_reviews: bigint;
                star_5: bigint;
                star_4: bigint;
                star_3: bigint;
                star_2: bigint;
                star_1: bigint;
            }>
        >`
            SELECT
                p.id           AS product_id,
                p.name         AS product_name,
                ROUND(AVG(r.rating), 2) AS avg_rating,
                COUNT(r.id)    AS total_reviews,
                SUM(CASE WHEN r.rating = 5 THEN 1 ELSE 0 END) AS star_5,
                SUM(CASE WHEN r.rating = 4 THEN 1 ELSE 0 END) AS star_4,
                SUM(CASE WHEN r.rating = 3 THEN 1 ELSE 0 END) AS star_3,
                SUM(CASE WHEN r.rating = 2 THEN 1 ELSE 0 END) AS star_2,
                SUM(CASE WHEN r.rating = 1 THEN 1 ELSE 0 END) AS star_1
            FROM products p
            LEFT JOIN reviews r
                ON  r.product_id = p.id
                AND r.status     = 'PUBLISHED'
                AND r.deleted_at IS NULL
            WHERE p.id = ${productId}
            GROUP BY p.id, p.name
        `;

        if (!rows.length) return null;

        const row = rows[0];
        return {
            productId: row.product_id,
            productName: row.product_name,
            avgRating: row.avg_rating ? Number(row.avg_rating) : 0,
            totalReviews: Number(row.total_reviews),
            distribution: {
                '1': Number(row.star_1),
                '2': Number(row.star_2),
                '3': Number(row.star_3),
                '4': Number(row.star_4),
                '5': Number(row.star_5),
            },
        };
    }

    /**
     * Get rating stats for multiple products (manager dashboard)
     * Using Raw SQL – aggregation + ranking
     */
    async getProductsRatingStats(productIds?: string[]): Promise<RatingSummary[]> {
        const rows = await prisma.$queryRaw<
            Array<{
                product_id: string;
                product_name: string;
                avg_rating: number | null;
                total_reviews: bigint;
                star_5: bigint;
                star_4: bigint;
                star_3: bigint;
                star_2: bigint;
                star_1: bigint;
            }>
        >`
            SELECT
                p.id           AS product_id,
                p.name         AS product_name,
                ROUND(AVG(r.rating), 2) AS avg_rating,
                COUNT(r.id)    AS total_reviews,
                SUM(CASE WHEN r.rating = 5 THEN 1 ELSE 0 END) AS star_5,
                SUM(CASE WHEN r.rating = 4 THEN 1 ELSE 0 END) AS star_4,
                SUM(CASE WHEN r.rating = 3 THEN 1 ELSE 0 END) AS star_3,
                SUM(CASE WHEN r.rating = 2 THEN 1 ELSE 0 END) AS star_2,
                SUM(CASE WHEN r.rating = 1 THEN 1 ELSE 0 END) AS star_1
            FROM products p
            LEFT JOIN reviews r
                ON  r.product_id = p.id
                AND r.status     = 'PUBLISHED'
                AND r.deleted_at IS NULL
            WHERE p.deleted_at IS NULL
                AND (${productIds ? Prisma.sql`p.id IN (${Prisma.join(productIds)})` : Prisma.sql`1=1`})
            GROUP BY p.id, p.name
            HAVING COUNT(r.id) > 0
            ORDER BY avg_rating DESC, total_reviews DESC
        `;

        return rows.map((row) => ({
            productId: row.product_id,
            productName: row.product_name,
            avgRating: row.avg_rating ? Number(row.avg_rating) : 0,
            totalReviews: Number(row.total_reviews),
            distribution: {
                '1': Number(row.star_1),
                '2': Number(row.star_2),
                '3': Number(row.star_3),
                '4': Number(row.star_4),
                '5': Number(row.star_5),
            },
        }));
    }

    // ─── Default include ─────────────────────────────────────────────────────

    private readonly defaultInclude = {
        customer: {
            select: {
                id: true,
                fullName: true,
                avatarUrl: true,
            },
        },
        replier: {
            select: {
                id: true,
                fullName: true,
                role: true,
            },
        },
        images: true,
        product: {
            select: {
                id: true,
                name: true,
                type: true,
            },
        },
    } satisfies Prisma.ReviewInclude;
}

export const reviewsRepository = new ReviewsRepository();
