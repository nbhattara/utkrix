ALTER TABLE `course_assignments`
  ADD COLUMN `module_id` INTEGER NULL,
  ADD INDEX `course_assignments_module_id_idx`(`module_id`);

CREATE TABLE `course_modules` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `course_id` INTEGER NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `course_modules_course_id_sort_order_idx`(`course_id`, `sort_order`),
  UNIQUE INDEX `course_modules_course_id_sort_order_key`(`course_id`, `sort_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `course_lessons` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `module_id` INTEGER NOT NULL,
  `title` VARCHAR(150) NOT NULL,
  `content` TEXT NOT NULL,
  `video_url` VARCHAR(2048) NULL,
  `resource_url` VARCHAR(2048) NULL,
  `attachment_key` VARCHAR(191) NULL,
  `original_file_name` VARCHAR(255) NULL,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `course_lessons_module_id_sort_order_idx`(`module_id`, `sort_order`),
  UNIQUE INDEX `course_lessons_module_id_sort_order_key`(`module_id`, `sort_order`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `course_lesson_progress` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `lesson_id` INTEGER NOT NULL,
  `student_id` INTEGER NOT NULL,
  `completed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `course_lesson_progress_student_id_completed_at_idx`(`student_id`, `completed_at`),
  UNIQUE INDEX `course_lesson_progress_lesson_id_student_id_key`(`lesson_id`, `student_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `course_assignment_submissions` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `assignment_id` INTEGER NOT NULL,
  `student_id` INTEGER NOT NULL,
  `response` TEXT NOT NULL,
  `grade` DECIMAL(6, 2) NULL,
  `feedback` TEXT NULL,
  `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `graded_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `course_assignment_submissions_student_id_submitted_at_idx`(`student_id`, `submitted_at`),
  UNIQUE INDEX `course_assignment_submissions_assignment_id_student_id_key`(`assignment_id`, `student_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `course_certificates` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `course_id` INTEGER NOT NULL,
  `student_id` INTEGER NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `issued_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `course_certificates_student_id_issued_at_idx`(`student_id`, `issued_at`),
  UNIQUE INDEX `course_certificates_code_key`(`code`),
  UNIQUE INDEX `course_certificates_course_id_student_id_key`(`course_id`, `student_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `course_assignments`
  ADD CONSTRAINT `course_assignments_module_id_fkey`
  FOREIGN KEY (`module_id`) REFERENCES `course_modules`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `course_modules`
  ADD CONSTRAINT `course_modules_course_id_fkey`
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `course_lessons`
  ADD CONSTRAINT `course_lessons_module_id_fkey`
  FOREIGN KEY (`module_id`) REFERENCES `course_modules`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `course_lesson_progress`
  ADD CONSTRAINT `course_lesson_progress_lesson_id_fkey`
  FOREIGN KEY (`lesson_id`) REFERENCES `course_lessons`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `course_lesson_progress_student_id_fkey`
  FOREIGN KEY (`student_id`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `course_assignment_submissions`
  ADD CONSTRAINT `course_assignment_submissions_assignment_id_fkey`
  FOREIGN KEY (`assignment_id`) REFERENCES `course_assignments`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `course_assignment_submissions_student_id_fkey`
  FOREIGN KEY (`student_id`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `course_certificates`
  ADD CONSTRAINT `course_certificates_course_id_fkey`
  FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `course_certificates_student_id_fkey`
  FOREIGN KEY (`student_id`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
