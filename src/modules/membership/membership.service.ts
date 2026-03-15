// src/modules/membership/membership.service.ts
import { MembershipTier } from '@prisma/client';
import { membershipRepository, PaginatedHistory, GetHistoryFilter } from './membership.repository';
import { NotFoundError, BadRequestError } from '../../utils/errorHandler';
import { CreateTierInput, UpdateTierInput } from '../../validations/zod/membership.schema';

export interface MembershipStatus {
    tier: string | null;
    tierId: string | null;
    discountPercent: number;
    warrantyMonths: number;
    returnDays: number;
    exchangeDays: number;
    totalSpent: number;
    spendInPeriod: number;
    periodStartDate: Date | null;
    periodEndDate: Date | null;
    nextTier: string | null;
    nextTierId: string | null;
    amountToNextTier: number | null;
}

class MembershipService {
    // ─── Tier management (Admin) ────────────────────────────────────────────────

    async createTier(data: CreateTierInput): Promise<MembershipTier> {
        return membershipRepository.createTier({
            name: data.name,
            minSpend: data.minSpend,
            discountPercent: data.discountPercent,
            warrantyMonths: data.warrantyMonths,
            returnDays: data.returnDays,
            exchangeDays: data.exchangeDays,
            periodDays: data.periodDays,
            sortOrder: data.sortOrder,
        });
    }

    async getAllTiers() {
        return membershipRepository.findAllTiers();
    }

    async getTierById(id: string): Promise<MembershipTier> {
        const tier = await membershipRepository.findTierById(id);
        if (!tier) throw new NotFoundError('Membership tier not found');
        return tier;
    }

    async updateTier(id: string, data: UpdateTierInput): Promise<MembershipTier> {
        await this.getTierById(id);
        return membershipRepository.updateTier(id, data);
    }

    async deleteTier(id: string): Promise<void> {
        await this.getTierById(id);
        const userCount = await membershipRepository.countUsersInTier(id);
        if (userCount > 0) {
            throw new BadRequestError(
                `Cannot delete tier: ${userCount} user(s) currently hold this tier`
            );
        }
        await membershipRepository.deleteTier(id);
    }

    // ─── Customer membership status ─────────────────────────────────────────────

    async getMembershipStatus(userId: string): Promise<MembershipStatus> {
        const user = await membershipRepository.findUserWithTier(userId);
        if (!user) throw new NotFoundError('User not found');

        const allTiers = await membershipRepository.findAllTiersSorted();
        const currentTier = user.membershipTier ?? null;

        // Calculate nextTier and amountToNextTier
        let nextTier: MembershipTier | null = null;
        if (currentTier) {
            const higherTiers = allTiers.filter(
                (t) => Number(t.minSpend) > Number(currentTier.minSpend)
            );
            nextTier = higherTiers.length > 0 ? higherTiers[0] : null;
        } else {
            // No tier yet — lowest tier is the target
            nextTier = allTiers.length > 0 ? allTiers[0] : null;
        }

        const spendInPeriod = Number(user.spendInPeriod);
        const amountToNextTier = nextTier
            ? Math.max(0, Number(nextTier.minSpend) - spendInPeriod)
            : null;

        // Calculate period end date
        let periodEndDate: Date | null = null;
        if (user.periodStartDate && currentTier) {
            periodEndDate = new Date(user.periodStartDate);
            periodEndDate.setDate(periodEndDate.getDate() + currentTier.periodDays);
        }

        return {
            tier: currentTier?.name ?? null,
            tierId: currentTier?.id ?? null,
            discountPercent: currentTier ? Number(currentTier.discountPercent) : 0,
            warrantyMonths: currentTier?.warrantyMonths ?? 6,
            returnDays: currentTier?.returnDays ?? 7,
            exchangeDays: currentTier?.exchangeDays ?? 15,
            totalSpent: Number(user.totalSpent),
            spendInPeriod,
            periodStartDate: user.periodStartDate,
            periodEndDate,
            nextTier: nextTier?.name ?? null,
            nextTierId: nextTier?.id ?? null,
            amountToNextTier,
        };
    }

    // ─── Record spend & recalculate tier (called after order COMPLETED) ─────────

    async recordSpend(userId: string, amount: number): Promise<void> {
        const user = await membershipRepository.findUserWithTier(userId);
        if (!user) return;

        const now = new Date();
        const allTiers = await membershipRepository.findAllTiersSorted();
        if (allTiers.length === 0) return;

        // Determine current period state
        const currentTier = user.membershipTier;
        const periodDays = currentTier?.periodDays ?? 365;

        let spendInPeriod: number;
        let periodStartDate: Date;
        let reason = 'ORDER_COMPLETED';

        const periodExpired =
            !user.periodStartDate ||
            now.getTime() > user.periodStartDate.getTime() + periodDays * 24 * 60 * 60 * 1000;

        if (periodExpired) {
            // Start a new period — only count this order's amount
            spendInPeriod = amount;
            periodStartDate = now;
            reason = 'PERIOD_RESET';
        } else {
            spendInPeriod = Number(user.spendInPeriod) + amount;
            periodStartDate = user.periodStartDate!;
        }

        const totalSpent = Number(user.totalSpent) + amount;

        // Calculate eligible tier: highest tier whose minSpend ≤ spendInPeriod
        const eligibleTiers = allTiers.filter((t) => Number(t.minSpend) <= spendInPeriod);
        const newTier = eligibleTiers.length > 0 ? eligibleTiers[eligibleTiers.length - 1] : null;

        // Persist membership update
        await membershipRepository.updateUserMembership(userId, {
            totalSpent,
            spendInPeriod,
            periodStartDate,
            membershipTierId: newTier?.id ?? null,
            tierUpdatedAt: now,
        });

        // Log tier change if tier actually changed
        const oldTierId = user.membershipTierId ?? null;
        const newTierId = newTier?.id ?? null;
        if (oldTierId !== newTierId && newTierId !== null) {
            await membershipRepository.createHistory({
                userId,
                oldTierId,
                newTierId,
                reason,
            });
        }
    }

    // ─── Get user tier for discount/return calculations ──────────────────────────

    async getUserTier(userId: string): Promise<MembershipTier | null> {
        const user = await membershipRepository.findUserWithTier(userId);
        return user?.membershipTier ?? null;
    }

    // ─── History ────────────────────────────────────────────────────────────────

    async getHistory(filter: GetHistoryFilter): Promise<PaginatedHistory> {
        return membershipRepository.getPaginatedHistory(filter);
    }

    async getMyHistory(userId: string, page: number, limit: number): Promise<PaginatedHistory> {
        return membershipRepository.getPaginatedHistory({ userId, page, limit });
    }
}

export const membershipService = new MembershipService();
