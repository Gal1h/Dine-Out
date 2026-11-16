-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `accountType` ENUM('admin', 'member') NOT NULL,
    `email` VARCHAR(255) NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `display_name` VARCHAR(100) NOT NULL,
    `gemini_key_encrypted` VARBINARY(512) NULL,
    `gemini_key_iv` VARBINARY(16) NULL,
    `gemini_key_tag` VARBINARY(16) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `groups` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `admin_id` CHAR(36) NOT NULL,
    `timezone` VARCHAR(40) NOT NULL DEFAULT 'Asia/Jakarta',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `group_members` (
    `group_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `role` ENUM('admin', 'mod', 'member') NOT NULL,
    `username` VARCHAR(50) NULL,
    `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `group_members_group_id_username_key`(`group_id`, `username`),
    PRIMARY KEY (`group_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `votes` (
    `id` CHAR(36) NOT NULL,
    `group_id` CHAR(36) NOT NULL,
    `store_name` VARCHAR(150) NOT NULL,
    `maps_url` VARCHAR(500) NOT NULL,
    `menu_text` TEXT NULL,
    `menu_image_path` VARCHAR(255) NULL,
    `vote_deadline` DATETIME(3) NOT NULL,
    `order_deadline` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NOT NULL,
    `updated_by` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `votes_group_id_idx`(`group_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vote_orders` (
    `id` CHAR(36) NOT NULL,
    `vote_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `vote_orders_vote_id_user_id_key`(`vote_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vote_order_items` (
    `id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NOT NULL,
    `item_type` ENUM('food', 'drink') NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `qty` SMALLINT NOT NULL,
    `note` VARCHAR(255) NULL,

    INDEX `vote_order_items_order_id_idx`(`order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_summaries` (
    `id` CHAR(36) NOT NULL,
    `vote_id` CHAR(36) NOT NULL,
    `source` ENUM('manual', 'gemini') NOT NULL,
    `created_by` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_summaries_vote_id_idx`(`vote_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_summary_items` (
    `id` CHAR(36) NOT NULL,
    `summary_id` CHAR(36) NOT NULL,
    `item_type` ENUM('food', 'drink') NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `total_qty` INTEGER NOT NULL,

    INDEX `order_summary_items_summary_id_idx`(`summary_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bills` (
    `id` CHAR(36) NOT NULL,
    `vote_id` CHAR(36) NOT NULL,
    `summary_id` CHAR(36) NOT NULL,
    `created_by` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bills_vote_id_idx`(`vote_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bill_prices` (
    `id` CHAR(36) NOT NULL,
    `bill_id` CHAR(36) NOT NULL,
    `item_type` ENUM('food', 'drink') NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `price` BIGINT NOT NULL,

    INDEX `bill_prices_bill_id_idx`(`bill_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bill_user_totals` (
    `id` CHAR(36) NOT NULL,
    `bill_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `food_total` BIGINT NOT NULL DEFAULT 0,
    `drink_total` BIGINT NOT NULL DEFAULT 0,
    `food_subsidy` BIGINT NOT NULL DEFAULT 0,
    `drink_subsidy` BIGINT NOT NULL DEFAULT 0,
    `food_payable` BIGINT NOT NULL DEFAULT 0,
    `drink_payable` BIGINT NOT NULL DEFAULT 0,
    `payable` BIGINT NOT NULL DEFAULT 0,

    UNIQUE INDEX `bill_user_totals_bill_id_user_id_key`(`bill_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `group_id` CHAR(36) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `refresh_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `groups` ADD CONSTRAINT `groups_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_members` ADD CONSTRAINT `group_members_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_members` ADD CONSTRAINT `group_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `votes` ADD CONSTRAINT `votes_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vote_orders` ADD CONSTRAINT `vote_orders_vote_id_fkey` FOREIGN KEY (`vote_id`) REFERENCES `votes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vote_orders` ADD CONSTRAINT `vote_orders_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vote_order_items` ADD CONSTRAINT `vote_order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `vote_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_summaries` ADD CONSTRAINT `order_summaries_vote_id_fkey` FOREIGN KEY (`vote_id`) REFERENCES `votes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_summaries` ADD CONSTRAINT `order_summaries_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_summary_items` ADD CONSTRAINT `order_summary_items_summary_id_fkey` FOREIGN KEY (`summary_id`) REFERENCES `order_summaries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bills` ADD CONSTRAINT `bills_vote_id_fkey` FOREIGN KEY (`vote_id`) REFERENCES `votes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bills` ADD CONSTRAINT `bills_summary_id_fkey` FOREIGN KEY (`summary_id`) REFERENCES `order_summaries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bills` ADD CONSTRAINT `bills_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bill_prices` ADD CONSTRAINT `bill_prices_bill_id_fkey` FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bill_user_totals` ADD CONSTRAINT `bill_user_totals_bill_id_fkey` FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
