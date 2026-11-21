CREATE TABLE `stats_metrics` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `label` VARCHAR(100) NOT NULL,
    `source` ENUM('manual', 'users', 'students', 'instructors', 'courses', 'publishedCourses', 'projects', 'publishedProjects', 'teamMembers') NOT NULL DEFAULT 'manual',
    `manual_value` VARCHAR(50) NULL,
    `prefix` VARCHAR(20) NOT NULL DEFAULT '',
    `suffix` VARCHAR(20) NOT NULL DEFAULT '',
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `is_published` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `stats_metrics_is_published_display_order_idx`(`is_published`, `display_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
