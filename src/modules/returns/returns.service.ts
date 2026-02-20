// src/modules/returns/returns.service.ts
import { ReturnRequest, ReturnStatus, ReturnType } from '@prisma/client';
import {
    returnsRepository,
    GetReturnsFilter,
    PaginatedReturns,
    ReturnRequestWithRelations,
} from './returns.repository';
import { ordersRepository } from '../orders/orders.repository';
import { inventoryRepository } from '../inventory/inventory.repository';
import { productsRepository } from '../products/products.repository';
import {
    NotFoundError,
    BadRequestError,
    ForbiddenError,
} from '../../utils/errorHandler';
import { prisma } from '../../config/database';
import { uploadToSupabase, deleteFromSupabase, extractPathFromUrl, validateImageFile } from '../../utils/upload';

/**
 * Business rules constants
 */
const RETURN_DEADLINE_DAYS = 7;
const EXCHANGE_DEADLINE_DAYS = 15;
const WARRANTY_MONTHS = 6;

const IMAGE_RULES = {
    CUSTOMER: {
        MIN: 1,
        MAX: 5,
    },
    STAFF: {
        MIN: 0,
        MAX: 10,
    },
};

class ReturnsService {
    /**
     * Create return request with images
     * Business logic:
     * - Validate order eligibility
     * - Check time limits
     * - Upload images
     * - Create return request + items + images in transaction
     */
    async createReturn(
        customerId: string,
        data: {
            orderId: string;
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
        },
        files?: Express.Multer.File[]
    ): Promise<ReturnRequestWithRelations> {
        // Step 1: Validate images
        if (!files || files.length < IMAGE_RULES.CUSTOMER.MIN) {
            throw new BadRequestError(`Vui lòng upload ít nhất ${IMAGE_RULES.CUSTOMER.MIN} ảnh sản phẩm`);
        }

        if (files.length > IMAGE_RULES.CUSTOMER.MAX) {
            throw new BadRequestError(`Chỉ được upload tối đa ${IMAGE_RULES.CUSTOMER.MAX} ảnh`);
        }

        // Validate each file
        files.forEach(file => validateImageFile(file, 5));

        // Step 2: Validate order eligibility
        await this.validateReturnEligibility(data.orderId, customerId, data.type);

        // Step 3: Validate items
        await this.validateReturnItems(data.orderId, data.items);

        // Step 4: If EXCHANGE, validate exchange product
        if (data.type === 'EXCHANGE') {
            for (const item of data.items) {
                if (item.exchangeProductId) {
                    await this.validateExchangeProduct(item.exchangeProductId);
                }
            }
        }

        // Step 5: Calculate warranty expiration if WARRANTY
        let warrantyExpiredAt: Date | undefined;
        if (data.type === 'WARRANTY') {
            const order = await ordersRepository.findById(data.orderId);
            if (order) {
                warrantyExpiredAt = new Date(order.updatedAt);
                warrantyExpiredAt.setMonth(warrantyExpiredAt.getMonth() + WARRANTY_MONTHS);
            }
        }

        // Step 6: Upload images to Supabase
        const imageUrls = await Promise.all(
            files.map(file => uploadToSupabase(file, 'return-requests'))
        );

        // Step 7: Create return request + items + images in transaction
        const returnRequest = await prisma.$transaction(async (tx) => {
            // Create return request
            const request = await tx.returnRequest.create({
                data: {
                    orderId: data.orderId,
                    customerId,
                    type: data.type,
                    status: 'PENDING',
                    channel: 'IN_STORE',
                    reason: data.reason,
                    description: data.description,
                    warrantyExpiredAt,
                },
            });

            // Create return items
            await tx.returnItem.createMany({
                data: data.items.map((item) => ({
                    returnRequestId: request.id,
                    orderItemId: item.orderItemId,
                    productId: item.productId,
                    quantity: item.quantity,
                    condition: item.condition as any,
                    exchangeProductId: item.exchangeProductId,
                })),
            });

            // Create images
            await tx.returnRequestImage.createMany({
                data: imageUrls.map(result => ({
                    returnRequestId: request.id,
                    imageUrl: result.url,
                    imageType: 'CUSTOMER_PRODUCT',
                    uploadedBy: customerId,
                })),
            });

            return request;
        });

        // Step 8: Return with relations
        const created = await returnsRepository.findById(returnRequest.id);
        if (!created) {
            throw new Error('Failed to retrieve created return request');
        }

        return created;
    }

    /**
     * Validate order eligibility for return/exchange/warranty
     */
    private async validateReturnEligibility(
        orderId: string,
        customerId: string,
        type: ReturnType
    ): Promise<void> {
        // 1. Check order exists
        const order = await ordersRepository.findById(orderId);
        if (!order) {
            throw new NotFoundError('Đơn hàng không tồn tại');
        }

        // 2. Check order belongs to customer
        if (order.customerId !== customerId) {
            throw new ForbiddenError('Bạn chỉ có thể tạo yêu cầu đổi/trả cho đơn hàng của mình');
        }

        // 3. Check order status
        if (order.status !== 'COMPLETED') {
            throw new BadRequestError('Chỉ đơn hàng đã hoàn thành mới được đổi/trả');
        }

        // 4. Check order type (không cho đổi/trả đơn PRESCRIPTION)
        if (order.orderType === 'PRESCRIPTION') {
            throw new BadRequestError('Không thể đổi/trả kính theo toa');
        }

        // 5. Check time limits
        const completedDate = order.updatedAt;
        const now = new Date();
        const daysPassed = Math.floor((now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24));

        if (type === 'RETURN' && daysPassed > RETURN_DEADLINE_DAYS) {
            throw new BadRequestError(`Đã quá thời hạn trả hàng (${RETURN_DEADLINE_DAYS} ngày)`);
        }

        if (type === 'EXCHANGE' && daysPassed > EXCHANGE_DEADLINE_DAYS) {
            throw new BadRequestError(`Đã quá thời hạn đổi hàng (${EXCHANGE_DEADLINE_DAYS} ngày)`);
        }

        if (type === 'WARRANTY') {
            const warrantyExpired = new Date(completedDate);
            warrantyExpired.setMonth(warrantyExpired.getMonth() + WARRANTY_MONTHS);
            if (now > warrantyExpired) {
                throw new BadRequestError(`Đã hết hạn bảo hành (${WARRANTY_MONTHS} tháng)`);
            }
        }

        // 6. Check no active return request
        const hasActive = await returnsRepository.hasActiveReturnRequest(orderId);
        if (hasActive) {
            throw new BadRequestError('Đơn hàng đã có yêu cầu đổi/trả đang xử lý');
        }
    }

    /**
     * Validate return items
     */
    private async validateReturnItems(
        orderId: string,
        items: Array<{ orderItemId: string; productId: string; quantity: number }>
    ): Promise<void> {
        const order = await ordersRepository.findById(orderId);
        if (!order) {
            throw new NotFoundError('Order not found');
        }

        for (const item of items) {
            // Check order item exists
            const orderItem = order.orderItems.find(oi => oi.id === item.orderItemId);
            if (!orderItem) {
                throw new BadRequestError(`Order item ${item.orderItemId} không tồn tại trong đơn hàng`);
            }

            // Check product matches
            if (orderItem.productId !== item.productId) {
                throw new BadRequestError('Sản phẩm không khớp với đơn hàng');
            }

            // Check quantity
            if (item.quantity > orderItem.quantity) {
                throw new BadRequestError(`Số lượng trả vượt quá số lượng đã mua`);
            }

            // Check product type (không cho trả SERVICE)
            const product = await productsRepository.findById(item.productId);
            if (product && product.type === 'SERVICE') {
                throw new BadRequestError('Không thể đổi/trả sản phẩm dịch vụ');
            }
        }
    }

    /**
     * Validate exchange product availability
     */
    private async validateExchangeProduct(productId: string): Promise<void> {
        const product = await productsRepository.findById(productId);
        if (!product) {
            throw new NotFoundError('Sản phẩm muốn đổi không tồn tại');
        }

        // Check inventory
        const availableQty = await inventoryRepository.getTotalAvailableQuantity(productId);
        if (availableQty < 1) {
            throw new BadRequestError('Sản phẩm muốn đổi không còn hàng');
        }
    }

    /**
     * Get return request by ID
     */
    async getReturnById(
        returnId: string,
        userId: string,
        userRole: string
    ): Promise<ReturnRequestWithRelations> {
        const returnRequest = await returnsRepository.findById(returnId);
        if (!returnRequest) {
            throw new NotFoundError('Yêu cầu đổi/trả không tồn tại');
        }

        // Authorization: Customer can only view their own requests
        if (userRole === 'CUSTOMER' && returnRequest.customerId !== userId) {
            throw new ForbiddenError('Bạn chỉ có thể xem yêu cầu của mình');
        }

        return returnRequest;
    }

    /**
     * Get customer's return requests
     */
    async getMyReturns(customerId: string, page: number, limit: number): Promise<PaginatedReturns> {
        return await returnsRepository.findByCustomerId(customerId, page, limit);
    }

    /**
     * Get all return requests (Operation/Admin)
     */
    async getAllReturns(filter: GetReturnsFilter): Promise<PaginatedReturns> {
        return await returnsRepository.getReturns(filter);
    }

    /**
     * Approve return request (Operation)
     * Business logic:
     * - Check status is PENDING
     * - If EXCHANGE, calculate price difference
     * - Update status to APPROVED
     */
    async approveReturn(returnId: string, handledBy: string): Promise<ReturnRequest> {
        const returnRequest = await returnsRepository.findById(returnId);
        if (!returnRequest) {
            throw new NotFoundError('Yêu cầu đổi/trả không tồn tại');
        }

        if (returnRequest.status !== 'PENDING') {
            throw new BadRequestError('Chỉ có thể phê duyệt yêu cầu đang chờ xử lý');
        }

        // If EXCHANGE, calculate price difference
        let priceDifference: number | undefined;
        if (returnRequest.type === 'EXCHANGE') {
            priceDifference = await this.calculatePriceDifference(returnRequest);
        }

        // Update status
        const updated = await returnsRepository.approve(returnId, handledBy);

        // Update price difference if EXCHANGE
        if (priceDifference !== undefined) {
            await returnsRepository.update(returnId, { priceDifference });
        }

        return updated;
    }

    /**
     * Calculate price difference for exchange
     */
    private async calculatePriceDifference(returnRequest: ReturnRequestWithRelations): Promise<number> {
        let totalOldPrice = 0;
        let totalNewPrice = 0;

        for (const item of returnRequest.items) {
            // Old product price
            const oldPrice = Number(item.product.price) * item.quantity;
            totalOldPrice += oldPrice;

            // New product price
            if (item.exchangeProductId) {
                const newProduct = await productsRepository.findById(item.exchangeProductId);
                if (newProduct) {
                    const newPrice = Number(newProduct.price) * item.quantity;
                    totalNewPrice += newPrice;
                }
            }
        }

        return totalNewPrice - totalOldPrice;
    }

    /**
     * Reject return request (Operation)
     */
    async rejectReturn(
        returnId: string,
        handledBy: string,
        rejectionReason: string
    ): Promise<ReturnRequest> {
        const returnRequest = await returnsRepository.findById(returnId);
        if (!returnRequest) {
            throw new NotFoundError('Yêu cầu đổi/trả không tồn tại');
        }

        if (returnRequest.status !== 'PENDING') {
            throw new BadRequestError('Chỉ có thể từ chối yêu cầu đang chờ xử lý');
        }

        return await returnsRepository.reject(returnId, handledBy, rejectionReason);
    }

    /**
     * Complete return request (Staff)
     * Business logic:
     * - Check status is APPROVED
     * - Upload images if provided
     * - Update inventory
     * - Update status to COMPLETED
     */
    async completeReturn(
        returnId: string,
        staffId: string,
        data: {
            refundAmount?: number;
            refundMethod?: string;
            completionNote?: string;
        },
        files?: Express.Multer.File[]
    ): Promise<ReturnRequest> {
        const returnRequest = await returnsRepository.findById(returnId);
        if (!returnRequest) {
            throw new NotFoundError('Yêu cầu đổi/trả không tồn tại');
        }

        if (returnRequest.status !== 'APPROVED') {
            throw new BadRequestError('Chỉ có thể hoàn tất yêu cầu đã được phê duyệt');
        }

        // Validate files if provided
        if (files && files.length > 0) {
            if (files.length > IMAGE_RULES.STAFF.MAX) {
                throw new BadRequestError(`Chỉ được upload tối đa ${IMAGE_RULES.STAFF.MAX} ảnh`);
            }
            files.forEach(file => validateImageFile(file, 5));
        }

        // Upload images if provided
        let imageUrls: Array<{ url: string; path: string }> = [];
        if (files && files.length > 0) {
            imageUrls = await Promise.all(
                files.map(file => uploadToSupabase(file, 'return-requests'))
            );
        }

        // Transaction: Update return + Upload images + Update inventory
        return await prisma.$transaction(async (tx) => {
            // 1. Update return request
            const updated = await tx.returnRequest.update({
                where: { id: returnId },
                data: {
                    status: 'COMPLETED',
                    handledBy: staffId,
                    completedAt: new Date(),
                    refundAmount: data.refundAmount,
                    refundMethod: data.refundMethod as any,
                    refundedAt: data.refundAmount ? new Date() : null,
                },
            });

            // 2. Save images
            if (imageUrls.length > 0) {
                await tx.returnRequestImage.createMany({
                    data: imageUrls.map(result => ({
                        returnRequestId: returnId,
                        imageUrl: result.url,
                        imageType: 'STAFF_INSPECTION',
                        uploadedBy: staffId,
                    })),
                });
            }

            // 3. Update inventory based on type
            if (returnRequest.type === 'RETURN' || returnRequest.type === 'EXCHANGE') {
                await this.updateInventoryForReturn(returnRequest, tx);
            }

            return updated;
        });
    }

    /**
     * Update inventory when return is completed
     */
    private async updateInventoryForReturn(
        returnRequest: ReturnRequestWithRelations,
        tx: any
    ): Promise<void> {
        for (const item of returnRequest.items) {
            // Skip SERVICE products
            if (item.product.type === 'SERVICE') continue;

            // Only add back to inventory if condition is good
            if (item.condition === 'NEW' || item.condition === 'LIKE_NEW' || item.condition === 'GOOD') {
                // Find inventory to add back
                const inventories = await tx.inventory.findMany({
                    where: { productId: item.productId },
                    orderBy: { quantity: 'desc' },
                });

                if (inventories.length > 0) {
                    // Add to first inventory
                    await tx.inventory.update({
                        where: { id: inventories[0].id },
                        data: {
                            quantity: { increment: item.quantity },
                        },
                    });
                }
            }

            // If EXCHANGE, decrease new product inventory
            if (returnRequest.type === 'EXCHANGE' && item.exchangeProductId) {
                const newProductInventories = await tx.inventory.findMany({
                    where: { productId: item.exchangeProductId },
                    orderBy: { quantity: 'desc' },
                });

                if (newProductInventories.length > 0) {
                    await tx.inventory.update({
                        where: { id: newProductInventories[0].id },
                        data: {
                            quantity: { decrement: item.quantity },
                        },
                    });
                }
            }
        }
    }

    /**
     * Cancel return request (Customer)
     */
    async cancelReturn(returnId: string, userId: string, userRole: string): Promise<ReturnRequest> {
        const returnRequest = await returnsRepository.findById(returnId);
        if (!returnRequest) {
            throw new NotFoundError('Yêu cầu đổi/trả không tồn tại');
        }

        // Authorization
        if (userRole === 'CUSTOMER' && returnRequest.customerId !== userId) {
            throw new ForbiddenError('Bạn chỉ có thể hủy yêu cầu của mình');
        }

        // Customer can only cancel PENDING
        if (userRole === 'CUSTOMER' && returnRequest.status !== 'PENDING') {
            throw new BadRequestError('Chỉ có thể hủy yêu cầu đang chờ xử lý');
        }

        // Staff/Operation/Admin can cancel PENDING or APPROVED
        if (returnRequest.status === 'COMPLETED' || returnRequest.status === 'REJECTED') {
            throw new BadRequestError('Không thể hủy yêu cầu đã hoàn tất hoặc đã bị từ chối');
        }

        return await returnsRepository.updateStatus(returnId, 'REJECTED');
    }

    /**
     * Upload images to return request
     */
    async uploadImages(
        returnRequestId: string,
        userId: string,
        userRole: string,
        imageType: string,
        files: Express.Multer.File[]
    ): Promise<any[]> {
        // Check return request exists
        const returnRequest = await this.getReturnById(returnRequestId, userId, userRole);

        // Customer can only upload when PENDING
        if (userRole === 'CUSTOMER' && returnRequest.status !== 'PENDING') {
            throw new BadRequestError('Chỉ có thể upload ảnh khi yêu cầu đang chờ xử lý');
        }

        // Validate files
        const maxImages = userRole === 'CUSTOMER' ? IMAGE_RULES.CUSTOMER.MAX : IMAGE_RULES.STAFF.MAX;
        if (files.length > maxImages) {
            throw new BadRequestError(`Chỉ được upload tối đa ${maxImages} ảnh`);
        }

        files.forEach(file => validateImageFile(file, 5));

        // Upload to Supabase
        const imageUrls = await Promise.all(
            files.map(file => uploadToSupabase(file, 'return-requests'))
        );

        // Save to database
        const images = await returnsRepository.createImages(
            imageUrls.map(result => ({
                returnRequestId,
                imageUrl: result.url,
                imageType: imageType as any,
                uploadedBy: userId,
            }))
        );

        return images;
    }

    /**
     * Delete image
     */
    async deleteImage(imageId: string, userId: string, userRole: string): Promise<void> {
        const image = await returnsRepository.findImageById(imageId);
        if (!image) {
            throw new NotFoundError('Ảnh không tồn tại');
        }

        // Authorization
        if (userRole === 'CUSTOMER') {
            if (image.uploadedBy !== userId) {
                throw new ForbiddenError('Bạn chỉ có thể xóa ảnh của mình');
            }
            if (image.returnRequest.status !== 'PENDING') {
                throw new BadRequestError('Chỉ có thể xóa ảnh khi yêu cầu đang chờ xử lý');
            }
        }

        // Delete from Supabase
        const filePath = extractPathFromUrl(image.imageUrl);
        if (filePath) {
            await deleteFromSupabase(filePath);
        }

        // Delete from database
        await returnsRepository.deleteImage(imageId);
    }

    /**
     * Get statistics (Admin)
     */
    async getStats(): Promise<{
        totalReturns: number;
        byStatus: Record<string, number>;
        byType: Record<string, number>;
        totalRefundAmount: number;
    }> {
        return await returnsRepository.getStats();
    }

    /**
     * Force update status (Admin only)
     */
    async forceUpdateStatus(returnId: string, status: ReturnStatus): Promise<ReturnRequest> {
        const returnRequest = await returnsRepository.findById(returnId);
        if (!returnRequest) {
            throw new NotFoundError('Yêu cầu đổi/trả không tồn tại');
        }

        return await returnsRepository.updateStatus(returnId, status);
    }
}

export const returnsService = new ReturnsService();
