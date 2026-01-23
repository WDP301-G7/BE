// src/validations/zod/users.schema.ts
import { z } from 'zod';
import { UserRole, UserStatus } from '@prisma/client';

export const createUserSchema = z.object({
  body: z.object({
    fullName: z.string().min(2).max(150),
    email: z.string().email(),
    phone: z.string().regex(/^[0-9]{10,11}$/).optional(),
    password: z.string().min(8).max(255),
    address: z.string().max(255).optional(),
    role: z.nativeEnum(UserRole).default(UserRole.CUSTOMER),
    status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE),
    storeId: z.string().uuid().optional(),
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    fullName: z.string().min(2).max(150).optional(),
    phone: z.string().regex(/^[0-9]{10,11}$/).optional(),
    address: z.string().max(255).optional(),
    avatarUrl: z.string().url().optional(),
    role: z.nativeEnum(UserRole).optional(),
    status: z.nativeEnum(UserStatus).optional(),
    storeId: z.string().uuid().optional().nullable(),
  }),
});

export const getUserSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const getUsersQuerySchema = z.object({
  query: z
    .object({
      page: z.string().optional(),
      limit: z.string().optional(),
      role: z.nativeEnum(UserRole).optional(),
      status: z.nativeEnum(UserStatus).optional(),
      search: z.string().optional(),
      storeId: z.string().uuid().optional(),
    })
    .transform((data) => ({
      page: data.page ? parseInt(data.page, 10) : 1,
      limit: data.limit ? parseInt(data.limit, 10) : 10,
      role: data.role,
      status: data.status,
      search: data.search,
      storeId: data.storeId,
    })),
});

export type CreateUserInput = z.infer<typeof createUserSchema>['body'];
export type UpdateUserInput = z.infer<typeof updateUserSchema>['body'];
export type GetUserParams = z.infer<typeof getUserSchema>['params'];
export type GetUsersQuery = z.infer<typeof getUsersQuerySchema>['query'];
