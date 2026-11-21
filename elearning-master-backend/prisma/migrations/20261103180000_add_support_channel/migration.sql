ALTER TABLE `support_conversations`
  MODIFY `channel` ENUM('admin', 'moderator', 'support') NOT NULL;
