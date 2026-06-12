CREATE TABLE `referral_redemptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referral_code` varchar(16) NOT NULL,
	`referrer_user_id` int NOT NULL,
	`referred_user_id` int NOT NULL,
	`reward_granted` boolean NOT NULL DEFAULT false,
	`created_at` int unsigned NOT NULL,
	CONSTRAINT `referral_redemptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `referral_redemptions_referred_user_id_unique` UNIQUE(`referred_user_id`)
);
--> statement-breakpoint
CREATE TABLE `user_bets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`description` varchar(300) NOT NULL,
	`bet_type` enum('moneyline','runline','total','prop','parlay','other') NOT NULL DEFAULT 'other',
	`odds` int NOT NULL,
	`stake_cents` int NOT NULL,
	`parlay_card_id` int,
	`result` enum('pending','win','loss','push','void') NOT NULL DEFAULT 'pending',
	`payout_cents` int,
	`placed_at` int unsigned NOT NULL,
	`settled_at` int unsigned,
	`notes` text,
	CONSTRAINT `user_bets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_referral_referrer` ON `referral_redemptions` (`referrer_user_id`);--> statement-breakpoint
CREATE INDEX `idx_userbets_user` ON `user_bets` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_userbets_result` ON `user_bets` (`result`);