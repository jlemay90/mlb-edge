CREATE TABLE `parlay_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` date NOT NULL,
	`type` enum('power','value','lotto','highvalue','hrprop') NOT NULL,
	`legs` json NOT NULL,
	`combined_odds` int NOT NULL,
	`total_legs` int NOT NULL DEFAULT 0,
	`reasoning` text,
	`result` enum('pending','win','loss','push') DEFAULT 'pending',
	`legs_won` int DEFAULT 0,
	`legs_lost` int DEFAULT 0,
	`loss_analysis` text,
	`postgame_debrief` text,
	`generated_at` int unsigned NOT NULL,
	`graded_at` int unsigned,
	CONSTRAINT `parlay_cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `parlay_legs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parlay_card_id` int NOT NULL,
	`game_pk` int NOT NULL,
	`game_date` date NOT NULL,
	`home_team` varchar(100),
	`away_team` varchar(100),
	`market` enum('moneyline','runline','total','prop') NOT NULL,
	`pick` varchar(200) NOT NULL,
	`pick_label` varchar(300),
	`odds` int NOT NULL,
	`edge_score` float,
	`model_probability` float,
	`reasoning` text,
	`result` enum('pending','win','loss','push') DEFAULT 'pending',
	`actual_outcome` varchar(200),
	CONSTRAINT `parlay_legs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `parlay_model_feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` date NOT NULL,
	`parlay_type` enum('power','value','lotto','highvalue','hrprop') NOT NULL,
	`market_type` varchar(50),
	`missed_reason` text,
	`data_signals` text,
	`improvement_note` text,
	`created_at` int unsigned NOT NULL,
	CONSTRAINT `parlay_model_feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_parlay_date` ON `parlay_cards` (`date`);--> statement-breakpoint
CREATE INDEX `idx_parlay_type` ON `parlay_cards` (`type`);--> statement-breakpoint
CREATE INDEX `idx_leg_parlay` ON `parlay_legs` (`parlay_card_id`);--> statement-breakpoint
CREATE INDEX `idx_leg_game` ON `parlay_legs` (`game_pk`);--> statement-breakpoint
CREATE INDEX `idx_feedback_date` ON `parlay_model_feedback` (`date`);