-- Schema initial : uniquement pour une base D1 neuve et vide.
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`machine_id` text NOT NULL,
	`section_id` text NOT NULL,
	`name` text NOT NULL,
	`key` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`machine_id`) REFERENCES `machines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `machines` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'Machine CNC' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`image` text DEFAULT '' NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sections` (
	`id` text PRIMARY KEY NOT NULL,
	`machine_id` text NOT NULL,
	`name` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`machine_id`) REFERENCES `machines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);

CREATE TABLE `admin_accounts` (
	`username` text PRIMARY KEY NOT NULL,
	`salt` text NOT NULL,
	`hash` text NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`locked_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`username`) REFERENCES `admin_accounts`(`username`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `class_files` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`class_id` text NOT NULL,
	`name` text NOT NULL,
	`key` text NOT NULL,
	`size` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `class_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `school_classes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `class_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `school_classes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `class_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `school_classes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `school_classes` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`username` text,
	`salt` text,
	`hash` text,
	`failed` integer DEFAULT 0 NOT NULL,
	`locked_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `school_classes_username_unique` ON `school_classes` (`username`);
CREATE TABLE `student_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`class_id` text NOT NULL,
	`salt` text NOT NULL,
	`hash` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`failed` integer DEFAULT 0 NOT NULL,
	`locked_until` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `school_classes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `students_username_unique` ON `students` (`username`);
ALTER TABLE `students` ADD `must_change_password` integer DEFAULT 0 NOT NULL;
ALTER TABLE `admin_accounts` ADD `role` text DEFAULT 'owner' NOT NULL;
ALTER TABLE `documents` ADD `url` text DEFAULT '' NOT NULL;
CREATE TABLE `document_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `school_classes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `folder_files` (
	`id` text PRIMARY KEY NOT NULL,
	`folder_id` text NOT NULL,
	`class_id` text NOT NULL,
	`name` text NOT NULL,
	`key` text NOT NULL,
	`size` integer NOT NULL,
	FOREIGN KEY (`folder_id`) REFERENCES `document_folders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`class_id`) REFERENCES `school_classes`(`id`) ON UPDATE no action ON DELETE cascade
);
