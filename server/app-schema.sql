CREATE TABLE IF NOT EXISTS `profiles` (
  `user_id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `public_id` CHAR(10) NOT NULL UNIQUE,
  `nickname` VARCHAR(40) NOT NULL,
  `guardian_pin_hash` VARCHAR(255) NOT NULL,
  `guardian_approved_at` TIMESTAMP(3) NULL,
  `guardian_failed_attempts` INT NOT NULL DEFAULT 0,
  `guardian_locked_until` TIMESTAMP(3) NULL,
  `account_status` VARCHAR(16) NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS `account_intents` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `kind` VARCHAR(16) NOT NULL,
  `nonce` VARCHAR(64) NOT NULL,
  `nickname` VARCHAR(40) NOT NULL,
  `expires_at` TIMESTAMP(3) NOT NULL,
  `used_at` TIMESTAMP(3) NULL,
  `completed_at` TIMESTAMP(3) NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `account_intents_user_idx` (`user_id`),
  INDEX `account_intents_expiry_idx` (`expires_at`),
  CONSTRAINT `account_intents_user_fk` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `recovery_credentials` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `user_id` VARCHAR(36) NOT NULL,
  `digest` CHAR(64) NOT NULL UNIQUE,
  `issued_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `used_at` TIMESTAMP(3) NULL,
  CONSTRAINT `recovery_credentials_user_fk` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `works` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `owner_user_id` VARCHAR(36) NOT NULL,
  `title` VARCHAR(80) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'published',
  `current_version_id` VARCHAR(36) NULL,
  `source_work_id` VARCHAR(36) NULL,
  `source_version_id` VARCHAR(36) NULL,
  `root_work_id` VARCHAR(36) NULL,
  `published_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `hidden_reason` VARCHAR(120) NULL,
  INDEX `works_owner_idx` (`owner_user_id`, `status`, `published_at`),
  INDEX `works_status_idx` (`status`, `published_at`),
  INDEX `works_source_idx` (`source_version_id`),
  CONSTRAINT `works_owner_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `work_versions` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `work_id` VARCHAR(36) NOT NULL,
  `project_version` INT NOT NULL,
  `catalog_version` INT NOT NULL DEFAULT 1,
  `project_json` JSON NOT NULL,
  `thumbnail` MEDIUMBLOB NOT NULL,
  `thumbnail_mime` VARCHAR(64) NOT NULL DEFAULT 'image/webp',
  `brick_count` INT NOT NULL,
  `connection_count` INT NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `work_versions_work_idx` (`work_id`, `created_at`),
  CONSTRAINT `work_versions_work_fk` FOREIGN KEY (`work_id`) REFERENCES `works` (`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `likes` (
  `work_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`work_id`, `user_id`),
  CONSTRAINT `likes_work_fk` FOREIGN KEY (`work_id`) REFERENCES `works` (`id`) ON DELETE CASCADE,
  CONSTRAINT `likes_user_fk` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `view_uniques` (
  `work_id` VARCHAR(36) NOT NULL,
  `visitor_hash` CHAR(64) NOT NULL,
  `view_day` DATE NOT NULL,
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`work_id`, `visitor_hash`, `view_day`),
  CONSTRAINT `view_uniques_work_fk` FOREIGN KEY (`work_id`) REFERENCES `works` (`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `work_daily_metrics` (
  `work_id` VARCHAR(36) NOT NULL,
  `metric_day` DATE NOT NULL,
  `views` INT NOT NULL DEFAULT 0,
  `likes` INT NOT NULL DEFAULT 0,
  `remixes` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`work_id`, `metric_day`),
  CONSTRAINT `work_daily_metrics_work_fk` FOREIGN KEY (`work_id`) REFERENCES `works` (`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `reports` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `work_id` VARCHAR(36) NOT NULL,
  `reporter_user_id` VARCHAR(36) NOT NULL,
  `reason` VARCHAR(32) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'open',
  `created_at` TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `reports_status_idx` (`status`, `created_at`),
  CONSTRAINT `reports_work_fk` FOREIGN KEY (`work_id`) REFERENCES `works` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reports_user_fk` FOREIGN KEY (`reporter_user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
);
