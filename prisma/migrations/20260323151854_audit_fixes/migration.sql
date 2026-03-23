/*
  Warnings:

  - You are about to alter the column `min_spend` on the `membership_tiers` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Decimal(15,2)`.
  - You are about to alter the column `unit_price` on the `order_items` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(15,2)`.
  - You are about to alter the column `deposit_amount` on the `orders` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(15,2)`.
  - You are about to alter the column `total_amount` on the `orders` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(15,2)`.
  - You are about to alter the column `discount_amount` on the `orders` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(15,2)`.
  - You are about to alter the column `amount` on the `payments` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(15,2)`.
  - You are about to alter the column `price` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(15,2)`.
  - You are about to alter the column `price_difference` on the `return_requests` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(15,2)`.
  - You are about to alter the column `refund_amount` on the `return_requests` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(15,2)`.
  - You are about to alter the column `final_amount` on the `return_requests` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(15,2)`.
  - You are about to alter the column `spend_in_period` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Decimal(15,2)`.
  - You are about to alter the column `total_spent` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `Decimal(15,2)`.

*/
-- DropIndex
DROP INDEX `orders_order_type_idx` ON `orders`;

-- DropIndex
DROP INDEX `orders_status_idx` ON `orders`;

-- DropIndex
DROP INDEX `products_deleted_at_idx` ON `products`;

-- DropIndex
DROP INDEX `products_type_idx` ON `products`;

-- AlterTable
ALTER TABLE `membership_tiers` MODIFY `min_spend` DECIMAL(15, 2) NOT NULL;

-- AlterTable
ALTER TABLE `order_items` MODIFY `unit_price` DECIMAL(15, 2) NOT NULL;

-- AlterTable
ALTER TABLE `orders` MODIFY `deposit_amount` DECIMAL(15, 2) NULL,
    MODIFY `total_amount` DECIMAL(15, 2) NOT NULL,
    MODIFY `discount_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `payments` MODIFY `amount` DECIMAL(15, 2) NOT NULL;

-- AlterTable
ALTER TABLE `products` MODIFY `price` DECIMAL(15, 2) NOT NULL;

-- AlterTable
ALTER TABLE `return_requests` MODIFY `price_difference` DECIMAL(15, 2) NULL,
    MODIFY `refund_amount` DECIMAL(15, 2) NULL,
    MODIFY `final_amount` DECIMAL(15, 2) NULL;

-- AlterTable
ALTER TABLE `users` MODIFY `spend_in_period` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    MODIFY `total_spent` DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `system_settings` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `value` TEXT NOT NULL,
    `type` ENUM('STRING', 'NUMBER', 'BOOLEAN', 'JSON') NOT NULL DEFAULT 'STRING',
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `system_settings_key_key`(`key`),
    INDEX `system_settings_key_idx`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `orders_order_type_status_payment_status_idx` ON `orders`(`order_type`, `status`, `payment_status`);

-- CreateIndex
CREATE INDEX `products_category_id_type_deleted_at_idx` ON `products`(`category_id`, `type`, `deleted_at`);
