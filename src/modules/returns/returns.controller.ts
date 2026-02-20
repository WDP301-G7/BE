// src/modules/returns/returns.controller.ts
import { Request, Response, NextFunction } from 'express';
import { returnsService } from './returns.service';
import { apiResponse } from '../../utils/apiResponse';
import {
    CreateReturnInput,
    GetReturnsQuery,
    RejectReturnInput,
    CompleteReturnInput,
    UploadImagesInput,
    UpdateReturnStatusInput,
    createReturnSchema,
} from '../../validations/zod/returns.schema';

class ReturnsController {
    /**
     * @route   POST /api/returns
     * @desc    Create return request with images
     * @access  Private (Customer)
     */
    async createReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const customerId = req.user!.userId;
            const files = req.files as Express.Multer.File[];

            const { orderId, type, reason, description, items: itemsString } = req.body;

            if (!orderId || !type || !reason || !itemsString) {
                res.status(400).json(apiResponse.error('Missing required fields: orderId, type, reason, items', 400));
                return;
            }

            let items;
            if (typeof itemsString === 'string') {
                try {
                    items = JSON.parse(itemsString);
                } catch (e) {
                    res.status(400).json(apiResponse.error('Invalid JSON format in items field', 400));
                    return;
                }
            } else {
                items = itemsString;
            }

            const data: CreateReturnInput = {
                orderId,
                type,
                reason,
                description: description || undefined,
                items,
            };

            const validationResult = createReturnSchema.safeParse({ body: data });
            if (!validationResult.success) {
                const errors = validationResult.error.errors.map((err) => ({
                    path: err.path.join('.'),
                    message: err.message,
                }));
                res.status(400).json(apiResponse.validationError(errors));
                return;
            }

            const returnRequest = await returnsService.createReturn(customerId, data, files);

            res.status(201).json(
                apiResponse.success(returnRequest, 'Tạo yêu cầu đổi/trả thành công', 201)
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/returns/my
     * @desc    Get customer's return requests
     * @access  Private (Customer)
     */
    async getMyReturns(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const customerId = req.user!.userId;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            const result = await returnsService.getMyReturns(customerId, page, limit);

            res.status(200).json(apiResponse.success(result, 'Lấy danh sách yêu cầu thành công'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/returns/:id
     * @desc    Get return request by ID
     * @access  Private
     */
    async getReturnById(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const returnId = req.params.id as string;
            const userId = req.user!.userId;
            const userRole = req.user!.role;

            const returnRequest = await returnsService.getReturnById(returnId, userId, userRole);

            res.status(200).json(apiResponse.success(returnRequest, 'Lấy thông tin yêu cầu thành công'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/returns
     * @desc    Get all return requests with filters (Operation/Admin)
     * @access  Private (Operation, Admin)
     */
    async getAllReturns(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const query = req.query as any as GetReturnsQuery;

            const filter = {
                page: query.page ? parseInt(query.page) : 1,
                limit: query.limit ? parseInt(query.limit) : 10,
                status: query.status,
                type: query.type,
                customerId: query.customerId,
                orderId: query.orderId,
                startDate: query.startDate ? new Date(query.startDate) : undefined,
                endDate: query.endDate ? new Date(query.endDate) : undefined,
            };

            const result = await returnsService.getAllReturns(filter);

            res.status(200).json(apiResponse.success(result, 'Lấy danh sách yêu cầu thành công'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   PUT /api/returns/:id/approve
     * @desc    Approve return request (Operation)
     * @access  Private (Operation, Admin)
     */
    async approveReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const returnId = req.params.id as string;
            const handledBy = req.user!.userId;

            const returnRequest = await returnsService.approveReturn(returnId, handledBy);

            res.status(200).json(apiResponse.success(returnRequest, 'Phê duyệt yêu cầu thành công'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   PUT /api/returns/:id/reject
     * @desc    Reject return request (Operation)
     * @access  Private (Operation, Admin)
     */
    async rejectReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const returnId = req.params.id as string;
            const handledBy = req.user!.userId;
            const data: RejectReturnInput = req.body;

            const returnRequest = await returnsService.rejectReturn(
                returnId,
                handledBy,
                data.rejectionReason
            );

            res.status(200).json(apiResponse.success(returnRequest, 'Từ chối yêu cầu thành công'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   PUT /api/returns/:id/complete
     * @desc    Complete return request (Staff)
     * @access  Private (Staff, Operation, Admin)
     */
    async completeReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const returnId = req.params.id as string;
            const staffId = req.user!.userId;
            const data: CompleteReturnInput = req.body;
            const files = req.files as Express.Multer.File[] | undefined;

            const returnRequest = await returnsService.completeReturn(returnId, staffId, data || {}, files);

            res.status(200).json(apiResponse.success(returnRequest, 'Hoàn tất xử lý yêu cầu thành công'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   DELETE /api/returns/:id
     * @desc    Cancel return request
     * @access  Private
     */
    async cancelReturn(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const returnId = req.params.id as string;
            const userId = req.user!.userId;
            const userRole = req.user!.role;

            const returnRequest = await returnsService.cancelReturn(returnId, userId, userRole);

            res.status(200).json(apiResponse.success(returnRequest, 'Hủy yêu cầu thành công'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   POST /api/returns/:id/images
     * @desc    Upload images to return request
     * @access  Private
     */
    async uploadImages(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const returnId = req.params.id as string;
            const userId = req.user!.userId;
            const userRole = req.user!.role;
            const data: UploadImagesInput = req.body;
            const files = req.files as Express.Multer.File[];

            const images = await returnsService.uploadImages(
                returnId,
                userId,
                userRole,
                data.imageType,
                files
            );

            res.status(200).json(apiResponse.success(images, 'Upload ảnh thành công'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   DELETE /api/returns/:id/images/:imageId
     * @desc    Delete image from return request
     * @access  Private
     */
    async deleteImage(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const imageId = req.params.imageId as string;
            const userId = req.user!.userId;
            const userRole = req.user!.role;

            await returnsService.deleteImage(imageId, userId, userRole);

            res.status(200).json(apiResponse.success(null, 'Xóa ảnh thành công'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   GET /api/returns/stats
     * @desc    Get return statistics
     * @access  Private (Admin)
     */
    async getStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const stats = await returnsService.getStats();

            res.status(200).json(apiResponse.success(stats, 'Lấy thống kê thành công'));
        } catch (error) {
            next(error);
        }
    }

    /**
     * @route   PUT /api/returns/:id/status
     * @desc    Force update return status (Admin only)
     * @access  Private (Admin)
     */
    async forceUpdateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const returnId = req.params.id as string;
            const data: UpdateReturnStatusInput = req.body;

            const returnRequest = await returnsService.forceUpdateStatus(returnId, data.status);

            res.status(200).json(apiResponse.success(returnRequest, 'Cập nhật trạng thái thành công'));
        } catch (error) {
            next(error);
        }
    }
}

export const returnsController = new ReturnsController();
