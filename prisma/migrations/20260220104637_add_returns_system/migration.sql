/*
  Warnings:

  - The values [OPEN] on the enum `return_requests_status` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `customer_id` to the `return_requests` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `return_requests` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `return_requests` ADD COLUMN `approved_at` DATETIME(3) NULL,
    ADD COLUMN `completed_at` DATETIME(3) NULL,
    ADD COLUMN `customer_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `price_difference` DECIMAL(10, 2) NULL,
    ADD COLUMN `refund_amount` DECIMAL(10, 2) NULL,
    ADD COLUMN `refund_method` ENUM('CASH', 'BANK_TRANSFER') NULL,
    ADD COLUMN `refunded_at` DATETIME(3) NULL,
    ADD COLUMN `rejected_at` DATETIME(3) NULL,
    ADD COLUMN `rejection_reason` TEXT NULL,
    ADD COLUMN `updated_at` DATETIME(3) NOT NULL,
    MODIFY `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED') NOT NULL;

-- CreateTable
CREATE TABLE `return_items` (
    `id` VARCHAR(191) NOT NULL,
    `return_request_id` VARCHAR(191) NOT NULL,
    `order_item_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `condition` ENUM('NEW', 'LIKE_NEW', 'GOOD', 'DAMAGED', 'DEFECTIVE') NOT NULL,
    `exchange_product_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `return_items_return_request_id_idx`(`return_request_id`),
    INDEX `return_items_order_item_id_idx`(`order_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `return_request_images` (
    `id` VARCHAR(191) NOT NULL,
    `return_request_id` VARCHAR(191) NOT NULL,
    `image_url` VARCHAR(255) NOT NULL,
    `image_type` ENUM('CUSTOMER_PRODUCT', 'CUSTOMER_DEFECT', 'STAFF_RECEIVED', 'STAFF_INSPECTION', 'OTHER') NOT NULL,
    `uploaded_by` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `return_request_images_return_request_id_idx`(`return_request_id`),
    INDEX `return_request_images_uploaded_by_idx`(`uploaded_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `return_requests_customer_id_idx` ON `return_requests`(`customer_id`);

-- CreateIndex
CREATE INDEX `return_requests_type_idx` ON `return_requests`(`type`);

-- AddForeignKey
ALTER TABLE `return_requests` ADD CONSTRAINT `return_requests_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_items` ADD CONSTRAINT `return_items_return_request_id_fkey` FOREIGN KEY (`return_request_id`) REFERENCES `return_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_items` ADD CONSTRAINT `return_items_order_item_id_fkey` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_items` ADD CONSTRAINT `return_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_items` ADD CONSTRAINT `return_items_exchange_product_id_fkey` FOREIGN KEY (`exchange_product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_request_images` ADD CONSTRAINT `return_request_images_return_request_id_fkey` FOREIGN KEY (`return_request_id`) REFERENCES `return_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `return_request_images` ADD CONSTRAINT `return_request_images_uploaded_by_fkey` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
