-- AlterTable
ALTER TABLE `orders` ADD COLUMN `discount_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `membership_tier_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `membership_tier_id` VARCHAR(191) NULL,
    ADD COLUMN `period_start_date` DATETIME(3) NULL,
    ADD COLUMN `spend_in_period` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `tier_updated_at` DATETIME(3) NULL,
    ADD COLUMN `total_spent` DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `membership_tiers` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `min_spend` DECIMAL(12, 2) NOT NULL,
    `discount_percent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `warranty_months` INTEGER NOT NULL DEFAULT 6,
    `return_days` INTEGER NOT NULL DEFAULT 7,
    `exchange_days` INTEGER NOT NULL DEFAULT 15,
    `period_days` INTEGER NOT NULL DEFAULT 365,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `membership_tiers_sort_order_idx`(`sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_history` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `old_tier_id` VARCHAR(191) NULL,
    `new_tier_id` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(50) NOT NULL,
    `changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `membership_history_user_id_idx`(`user_id`),
    INDEX `membership_history_changed_at_idx`(`changed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `users_membership_tier_id_idx` ON `users`(`membership_tier_id`);

-- AddForeignKey
ALTER TABLE `membership_history` ADD CONSTRAINT `membership_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `membership_history` ADD CONSTRAINT `membership_history_old_tier_id_fkey` FOREIGN KEY (`old_tier_id`) REFERENCES `membership_tiers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `membership_history` ADD CONSTRAINT `membership_history_new_tier_id_fkey` FOREIGN KEY (`new_tier_id`) REFERENCES `membership_tiers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_membership_tier_id_fkey` FOREIGN KEY (`membership_tier_id`) REFERENCES `membership_tiers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_membership_tier_id_fkey` FOREIGN KEY (`membership_tier_id`) REFERENCES `membership_tiers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
