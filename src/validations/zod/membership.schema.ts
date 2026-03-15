// src/validations/zod/membership.schema.ts
import { z } from 'zod';

// ─── Tier CRUD ────────────────────────────────────────────────────────────────

export const createTierSchema = z.object({
    body: z.object({
        name: z.string().min(1).max(50),
        minSpend: z.number().min(0),
        discountPercent: z.number().min(0).max(100).default(0),
        warrantyMonths: z.number().int().min(1).default(6),
        returnDays: z.number().int().min(1).default(7),
        exchangeDays: z.number().int().min(1).default(15),
        periodDays: z.number().int().min(1).default(365),
        sortOrder: z.number().int().min(0).default(0),
    }),
});

export const updateTierSchema = z.object({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
        name: z.string().min(1).max(50).optional(),
        minSpend: z.number().min(0).optional(),
        discountPercent: z.number().min(0).max(100).optional(),
        warrantyMonths: z.number().int().min(1).optional(),
        returnDays: z.number().int().min(1).optional(),
        exchangeDays: z.number().int().min(1).optional(),
        periodDays: z.number().int().min(1).optional(),
        sortOrder: z.number().int().min(0).optional(),
    }),
});

export const tierIdParamSchema = z.object({
    params: z.object({ id: z.string().uuid() }),
});

// ─── History query ─────────────────────────────────────────────────────────────

export const getMembershipHistoryQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        userId: z.string().uuid().optional(),
        reason: z.string().optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
    }),
});

// ─── Types ─────────────────────────────────────────────────────────────────────

export type CreateTierInput = z.infer<typeof createTierSchema>['body'];
export type UpdateTierInput = z.infer<typeof updateTierSchema>['body'];
export type GetMembershipHistoryQuery = z.infer<typeof getMembershipHistoryQuerySchema>['query'];
