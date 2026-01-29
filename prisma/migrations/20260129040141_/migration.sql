/*
  Warnings:

  - You are about to drop the column `shipping_address` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `shipping_name` on the `orders` table. All the data in the column will be lost.
  - You are about to drop the column `shipping_phone` on the `orders` table. All the data in the column will be lost.
  - The values [SHIPPED] on the enum `orders_status` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `shipments` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updated_at` to the `stores` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `shipments` DROP FOREIGN KEY `shipments_order_id_fkey`;

-- AlterTable
ALTER TABLE `orders` DROP COLUMN `shipping_address`,
    DROP COLUMN `shipping_name`,
    DROP COLUMN `shipping_phone`,
    MODIFY `status` ENUM('NEW', 'CONFIRMED', 'WAITING_PRODUCT', 'PROCESSING', 'READY', 'COMPLETED', 'CANCELLED') NOT NULL;

-- AlterTable
ALTER TABLE `stores` ADD COLUMN `updated_at` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `users` MODIFY `role` ENUM('CUSTOMER', 'STAFF', 'OPERATION', 'MANAGER', 'ADMIN') NOT NULL;

-- DropTable
DROP TABLE `shipments`;
