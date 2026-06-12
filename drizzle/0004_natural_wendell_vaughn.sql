ALTER TABLE `users` MODIFY COLUMN `subscriptionTier` enum('free','pro','sharp','syndicate') NOT NULL DEFAULT 'free';--> statement-breakpoint
ALTER TABLE `users` ADD `isFoundingMember` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `foundingMemberSince` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `foundingMemberNumber` int;--> statement-breakpoint
ALTER TABLE `users` ADD `referralCode` varchar(16);--> statement-breakpoint
ALTER TABLE `users` ADD `referredBy` varchar(16);