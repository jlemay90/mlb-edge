ALTER TABLE `users` ADD `stripeCustomerId` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `stripeSubscriptionId` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionTier` enum('free','pro','sharp') DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionStatus` varchar(30) DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionPeriodEnd` timestamp;