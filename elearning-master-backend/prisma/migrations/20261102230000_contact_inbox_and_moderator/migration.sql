ALTER TABLE `users`
  MODIFY `role` ENUM('student', 'instructor', 'admin', 'moderator') NOT NULL DEFAULT 'student';

CREATE TABLE `contact_messages` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(254) NOT NULL,
  `phone` VARCHAR(16) NULL,
  `subject` VARCHAR(150) NOT NULL,
  `message` TEXT NOT NULL,
  `email_sent_at` DATETIME(3) NULL,
  `email_delivery_failed` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `contact_messages_created_at_idx`(`created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
