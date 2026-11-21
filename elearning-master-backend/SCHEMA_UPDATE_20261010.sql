-- Additive schema changes for email verification, account lifecycle, quiz attempts,
-- and administrative audit logs. Existing accounts remain verified and active.
ALTER TABLE `users`
  ADD COLUMN `email_verified` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `token_version` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `deactivated_at` DATETIME(3) NULL;

CREATE TABLE `auth_tokens` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `user_id` INTEGER NOT NULL,
  `purpose` VARCHAR(32) NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `auth_tokens_token_hash_key` (`token_hash`),
  INDEX `auth_tokens_user_id_purpose_idx` (`user_id`, `purpose`),
  PRIMARY KEY (`id`),
  CONSTRAINT `auth_tokens_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `quiz_attempts` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `quiz_id` INTEGER NOT NULL,
  `user_id` INTEGER NOT NULL,
  `answers` JSON NOT NULL,
  `score` DECIMAL(5,2) NOT NULL,
  `passed` BOOLEAN NOT NULL,
  `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `quiz_attempts_quiz_id_user_id_submitted_at_idx` (`quiz_id`, `user_id`, `submitted_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `quiz_attempts_quiz_id_fkey`
    FOREIGN KEY (`quiz_id`) REFERENCES `quizzes` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `quiz_attempts_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `audit_logs` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `actor_user_id` INTEGER NULL,
  `action` VARCHAR(100) NOT NULL,
  `target_type` VARCHAR(100) NOT NULL,
  `target_id` VARCHAR(100) NULL,
  `result` VARCHAR(32) NOT NULL,
  `metadata` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `audit_logs_actor_user_id_created_at_idx` (`actor_user_id`, `created_at`),
  INDEX `audit_logs_target_type_target_id_created_at_idx` (`target_type`, `target_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
