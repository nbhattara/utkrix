CREATE TABLE `support_conversations` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `channel` ENUM('admin', 'moderator') NOT NULL,
  `user_id` INTEGER NULL,
  `guest_identity_hash` CHAR(64) NULL,
  `guest_name` VARCHAR(100) NULL,
  `guest_email` VARCHAR(254) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `support_conversations_user_id_channel_key`(`user_id`, `channel`),
  UNIQUE INDEX `support_conversations_guest_identity_hash_channel_key`(`guest_identity_hash`, `channel`),
  INDEX `support_conversations_channel_updated_at_idx`(`channel`, `updated_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `support_conversations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `support_messages` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `conversation_id` INTEGER NOT NULL,
  `sender_user_id` INTEGER NULL,
  `sender_type` ENUM('guest', 'user', 'staff') NOT NULL,
  `sender_name` VARCHAR(100) NOT NULL,
  `body` TEXT NOT NULL,
  `notification_sent_at` DATETIME(3) NULL,
  `notification_failed` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `support_messages_conversation_id_created_at_idx`(`conversation_id`, `created_at`),
  INDEX `support_messages_sender_user_id_idx`(`sender_user_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `support_messages_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `support_conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `support_messages_sender_user_id_fkey` FOREIGN KEY (`sender_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
