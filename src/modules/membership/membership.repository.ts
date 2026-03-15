// src/modules/membership/membership.repository.ts
import { MembershipTier, MembershipHistory, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

export type TierWithStats = MembershipTier & { _count: { users: number } };

export type HistoryWithRelations = Prisma.MembershipHistoryGetPayload<{
    include: {
        user: { select: { id: true; fullName: true; email: true } };
        oldTier: { select: { id: true; name: true } };
        newTier: { select: { id: true; name: true } };
    };
}>;

export interface PaginatedHistory {
    data: HistoryWithRelations[];
    meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface GetHistoryFilter {
    page?: number;
    limit?: number;
    userId?: string;
    reason?: string;
    startDate?: Date;
    endDate?: Date;
}

class MembershipRepository {
    // ─── Tiers ─────────────────────────────────────────────────────────────────

    async createTier(data: Prisma.MembershipTierCreateInput): Promise<MembershipTier> {
        return prisma.membershipTier.create({ data });
    }

    async findAllTiers(): Promise<TierWithStats[]> {
        return prisma.membershipTier.findMany({
            orderBy: { sortOrder: 'asc' },
            include: { _count: { select: { users: true } } },
        });
    }

    async findTierById(id: string): Promise<MembershipTier | null> {
        return prisma.membershipTier.findUnique({ where: { id } });
    }

    async updateTier(id: string, data: Prisma.MembershipTierUpdateInput): Promise<MembershipTier> {
        return prisma.membershipTier.update({ where: { id }, data });
    }

    async deleteTier(id: string): Promise<MembershipTier> {
        return prisma.membershipTier.delete({ where: { id } });
    }

    async countUsersInTier(tierId: string): Promise<number> {
        return prisma.user.count({ where: { membershipTierId: tierId } });
    }

    /** Get all tiers ordered by minSpend ASC — used for tier calculation */
    async findAllTiersSorted(): Promise<MembershipTier[]> {
        return prisma.membershipTier.findMany({ orderBy: { minSpend: 'asc' } });
    }

    // ─── User membership ────────────────────────────────────────────────────────

    async findUserWithTier(userId: string) {
        return prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                membershipTierId: true,
                totalSpent: true,
                spendInPeriod: true,
                periodStartDate: true,
                tierUpdatedAt: true,
                membershipTier: true,
            },
        });
    }

    async updateUserMembership(
        userId: string,
        data: {
            membershipTierId?: string | null;
            totalSpent?: number;
            spendInPeriod?: number;
            periodStartDate?: Date;
            tierUpdatedAt?: Date;
        }
    ) {
        return prisma.user.update({ where: { id: userId }, data });
    }

    // ─── History ────────────────────────────────────────────────────────────────

    async createHistory(data: {
        userId: string;
        oldTierId: string | null;
        newTierId: string;
        reason: string;
    }): Promise<MembershipHistory> {
        return prisma.membershipHistory.create({ data });
    }

    async getPaginatedHistory(filter: GetHistoryFilter): Promise<PaginatedHistory> {
        const page = filter.page ?? 1;
        const limit = filter.limit ?? 20;
        const skip = (page - 1) * limit;

        const where: Prisma.MembershipHistoryWhereInput = {};
        if (filter.userId) where.userId = filter.userId;
        if (filter.reason) where.reason = filter.reason;
        if (filter.startDate || filter.endDate) {
            where.changedAt = {};
            if (filter.startDate) where.changedAt.gte = filter.startDate;
            if (filter.endDate) where.changedAt.lte = filter.endDate;
        }

        const include = {
            user: { select: { id: true, fullName: true, email: true } },
            oldTier: { select: { id: true, name: true } },
            newTier: { select: { id: true, name: true } },
        } as const;

        const [data, total] = await Promise.all([
            prisma.membershipHistory.findMany({
                where,
                include,
                orderBy: { changedAt: 'desc' },
                skip,
                take: limit,
            }),
            prisma.membershipHistory.count({ where }),
        ]);

        return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }
}

export const membershipRepository = new MembershipRepository();
