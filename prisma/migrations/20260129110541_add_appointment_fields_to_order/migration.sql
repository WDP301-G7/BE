-- AlterTable
ALTER TABLE `orders` ADD COLUMN `appointment_date` DATETIME(3) NULL,
    ADD COLUMN `appointment_note` TEXT NULL,
    MODIFY `expected_ready_date` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `brand` VARCHAR(100) NULL,
    ADD COLUMN `deleted_at` DATETIME(3) NULL,
    ADD COLUMN `sku` VARCHAR(50) NULL;

-- CreateIndex
CREATE INDEX `products_deleted_at_idx` ON `products`(`deleted_at`);
