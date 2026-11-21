CREATE TABLE `course_enrollments` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `course_id` INTEGER NOT NULL,
  `student_id` INTEGER NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `course_enrollments_course_id_student_id_key` (`course_id`, `student_id`),
  INDEX `course_enrollments_student_id_created_at_idx` (`student_id`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `course_enrollments_course_id_fkey`
    FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `course_enrollments_student_id_fkey`
    FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `course_announcements` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `course_id` INTEGER NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `body` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `course_announcements_course_id_created_at_idx` (`course_id`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `course_announcements_course_id_fkey`
    FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `course_materials` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `course_id` INTEGER NOT NULL,
  `kind` VARCHAR(20) NOT NULL DEFAULT 'note',
  `title` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `url` VARCHAR(2048) NULL,
  `attachment_key` VARCHAR(191) NULL,
  `original_file_name` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `course_materials_course_id_created_at_idx` (`course_id`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `course_materials_course_id_fkey`
    FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `course_assignments` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `course_id` INTEGER NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `instructions` TEXT NOT NULL,
  `due_at` DATETIME(3) NULL,
  `attachment_key` VARCHAR(191) NULL,
  `original_file_name` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `course_assignments_course_id_due_at_idx` (`course_id`, `due_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `course_assignments_course_id_fkey`
    FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
