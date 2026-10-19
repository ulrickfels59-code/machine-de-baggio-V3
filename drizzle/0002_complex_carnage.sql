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