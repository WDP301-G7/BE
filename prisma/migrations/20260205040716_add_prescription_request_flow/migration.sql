-- AlterTable
ALTER TABLE `orders` ADD COLUMN `expires_at` DATETIME(3) NULL,
    ADD COLUMN `pickup_store_id` VARCHAR(191) NULL,
    ADD COLUMN `quoted_at` DATETIME(3) NULL,
    MODIFY `status` ENUM('NEW', 'CONFIRMED', 'WAITING_CUSTOMER', 'WAITING_PRODUCT', 'PROCESSING', 'READY', 'COMPLETED', 'CANCELLED', 'EXPIRED') NOT NULL;

-- AlterTable
ALTER TABLE `prescriptions` ADD COLUMN `left_eye_axis` INTEGER NULL,
    ADD COLUMN `left_eye_cylinder` DECIMAL(4, 2) NULL,
    ADD COLUMN `left_eye_sphere` DECIMAL(4, 2) NULL,
    ADD COLUMN `pupillary_distance` DECIMAL(4, 1) NULL,
    ADD COLUMN `right_eye_axis` INTEGER NULL,
    ADD COLUMN `right_eye_cylinder` DECIMAL(4, 2) NULL,
    ADD COLUMN `right_eye_sphere` DECIMAL(4, 2) NULL;

-- CreateTable
CREATE TABLE `prescription_requests` (
    `id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `store_id` VARCHAR(191) NOT NULL,
    `consultation_type` ENUM('PHONE', 'IN_STORE') NOT NULL,
    `symptoms` TEXT NULL,
    `status` ENUM('PENDING', 'CONTACTING', 'QUOTED', 'ACCEPTED', 'REJECTED', 'LOST', 'EXPIRED', 'SCHEDULED') NOT NULL,
    `contacted_at` DATETIME(3) NULL,
    `contact_notes` TEXT NULL,
    `handled_by` VARCHAR(191) NULL,
    `order_id` VARCHAR(191) NULL,
    `appointment_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `expires_at` DATETIME(3) NULL,

    UNIQUE INDEX `prescription_requests_order_id_key`(`order_id`),
    INDEX `prescription_requests_customer_id_idx`(`customer_id`),
    INDEX `prescription_requests_store_id_idx`(`store_id`),
    INDEX `prescription_requests_status_idx`(`status`),
    INDEX `prescription_requests_handled_by_idx`(`handled_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `prescription_request_images` (
    `id` VARCHAR(191) NOT NULL,
    `request_id` VARCHAR(191) NOT NULL,
    `image_url` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `prescription_request_images_request_id_idx`(`request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_pickup_store_id_fkey` FOREIGN KEY (`pickup_store_id`) REFERENCES `stores`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prescription_requests` ADD CONSTRAINT `prescription_requests_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prescription_requests` ADD CONSTRAINT `prescription_requests_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prescription_requests` ADD CONSTRAINT `prescription_requests_handled_by_fkey` FOREIGN KEY (`handled_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prescription_requests` ADD CONSTRAINT `prescription_requests_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `prescription_request_images` ADD CONSTRAINT `prescription_request_images_request_id_fkey` FOREIGN KEY (`request_id`) REFERENCES `prescription_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
