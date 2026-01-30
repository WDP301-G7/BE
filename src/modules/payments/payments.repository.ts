// src/modules/payments/payments.repository.ts
import { prisma } from '../../config/database';
import { Payment, PaymentStatusEnum } from '@prisma/client';
import { CreatePaymentData } from '../../types/payment.types';

class PaymentsRepository {
    /**
     * Create new payment record
     */
    async create(data: CreatePaymentData): Promise<Payment> {
        return await prisma.payment.create({
            data: {
                orderId: data.orderId,
                method: data.method,
                amount: data.amount,
                status: data.status,
            },
        });
    }

    /**
     * Find payment by ID
     */
    async findById(id: string): Promise<Payment | null> {
        return await prisma.payment.findUnique({
            where: { id },
            include: {
                order: {
                    include: {
                        customer: {
                            select: {
                                id: true,
                                email: true,
                                fullName: true,
                            },
                        },
                    },
                },
            },
        });
    }

    /**
     * Find payment by order ID
     */
    async findByOrderId(orderId: string): Promise<Payment | null> {
        return await prisma.payment.findFirst({
            where: { orderId },
            orderBy: { paidAt: 'desc' },
        });
    }

    /**
     * Update payment status
     */
    async updateStatus(
        id: string,
        status: PaymentStatusEnum,
        paidAt?: Date
    ): Promise<Payment> {
        return await prisma.payment.update({
            where: { id },
            data: {
                status,
                ...(paidAt && { paidAt }),
            },
        });
    }

    /**
     * Get payments by status
     */
    async findByStatus(status: PaymentStatusEnum): Promise<Payment[]> {
        return await prisma.payment.findMany({
            where: { status },
            include: {
                order: true,
            },
            orderBy: { paidAt: 'desc' },
        });
    }
}

export const paymentsRepository = new PaymentsRepository();
