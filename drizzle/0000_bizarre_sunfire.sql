CREATE TABLE `files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`original_name` text NOT NULL,
	`file_path` text NOT NULL,
	`file_size` integer NOT NULL,
	`mime_type` text NOT NULL,
	`width` integer,
	`height` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `files_file_id_unique` ON `files` (`file_id`);--> statement-breakpoint
CREATE INDEX `idx_files_user` ON `files` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_files_file_id` ON `files` (`file_id`);--> statement-breakpoint
CREATE TABLE `note_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`note_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`version_no` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_note_versions_note` ON `note_versions` (`note_id`);--> statement-breakpoint
CREATE INDEX `idx_note_versions_user` ON `note_versions` (`user_id`);--> statement-breakpoint
CREATE TABLE `notebooks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`parent_id` integer,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_notebooks_user_id` ON `notebooks` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_notebooks_user_parent` ON `notebooks` (`user_id`,`parent_id`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`notebook_id` integer NOT NULL,
	`title` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`is_pinned` integer DEFAULT 0 NOT NULL,
	`is_deleted` integer DEFAULT 0 NOT NULL,
	`deleted_at` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_notes_user_notebook` ON `notes` (`user_id`,`notebook_id`);--> statement-breakpoint
CREATE INDEX `idx_notes_user_deleted` ON `notes` (`user_id`,`is_deleted`);--> statement-breakpoint
CREATE INDEX `idx_notes_user_pinned` ON `notes` (`user_id`,`is_pinned`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uid` integer NOT NULL,
	`role` text NOT NULL,
	`token` text NOT NULL,
	`ip` text NOT NULL,
	`ua` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_active_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uid` integer NOT NULL,
	`value` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_settings_uid_unique` ON `user_settings` (`uid`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`avatar` text DEFAULT '' NOT NULL,
	`reg_ip` text NOT NULL,
	`reg_ua` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);