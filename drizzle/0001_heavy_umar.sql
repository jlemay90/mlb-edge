CREATE TABLE `backtest_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`market` varchar(30) NOT NULL,
	`confidenceTier` varchar(5),
	`season` int,
	`totalPicks` int DEFAULT 0,
	`wins` int DEFAULT 0,
	`losses` int DEFAULT 0,
	`pushes` int DEFAULT 0,
	`winPct` float,
	`roi` float,
	`avgEdge` float,
	`avgOdds` float,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `backtest_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mlb_games` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gamePk` int NOT NULL,
	`gameDate` date NOT NULL,
	`gameTime` varchar(20),
	`status` varchar(30) DEFAULT 'scheduled',
	`homeTeamId` int NOT NULL,
	`awayTeamId` int NOT NULL,
	`homeTeamName` varchar(100),
	`awayTeamName` varchar(100),
	`homeScore` int,
	`awayScore` int,
	`inning` int,
	`venue` varchar(100),
	`homePitcherId` int,
	`awayPitcherId` int,
	`homePitcherName` varchar(100),
	`awayPitcherName` varchar(100),
	`umpireId` int,
	`umpireName` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mlb_games_id` PRIMARY KEY(`id`),
	CONSTRAINT `mlb_games_gamePk_unique` UNIQUE(`gamePk`)
);
--> statement-breakpoint
CREATE TABLE `mlb_teams` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teamId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`abbreviation` varchar(10) NOT NULL,
	`shortName` varchar(50),
	`division` varchar(50),
	`league` varchar(10),
	`venue` varchar(100),
	`parkFactorRuns` float DEFAULT 100,
	`parkFactorHR` float DEFAULT 100,
	`parkFactorHits` float DEFAULT 100,
	`stadiumLat` float,
	`stadiumLon` float,
	`stadiumAltitudeFt` int,
	`surface` varchar(20) DEFAULT 'grass',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mlb_teams_id` PRIMARY KEY(`id`),
	CONSTRAINT `mlb_teams_teamId_unique` UNIQUE(`teamId`)
);
--> statement-breakpoint
CREATE TABLE `odds_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gamePk` int NOT NULL,
	`bookmaker` varchar(50) NOT NULL,
	`market` enum('h2h','spreads','totals','player_props') NOT NULL,
	`homePrice` int,
	`awayPrice` int,
	`spread` float,
	`total` float,
	`overPrice` int,
	`underPrice` int,
	`snapshotAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `odds_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pitcher_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`playerId` int NOT NULL,
	`playerName` varchar(100) NOT NULL,
	`teamId` int,
	`season` int NOT NULL,
	`era` float,
	`fip` float,
	`xfip` float,
	`siera` float,
	`whip` float,
	`kPer9` float,
	`bbPer9` float,
	`hrPer9` float,
	`kPct` float,
	`bbPct` float,
	`kMinusBBPct` float,
	`avgExitVeloAllowed` float,
	`barrelPctAllowed` float,
	`hardHitPctAllowed` float,
	`xba` float,
	`xslg` float,
	`xwoba` float,
	`eraVsL` float,
	`eraVsR` float,
	`eraHome` float,
	`eraAway` float,
	`eraFirst3Inn` float,
	`primaryPitch` varchar(30),
	`fastballVelo` float,
	`spinRate` float,
	`last3GamesEra` float,
	`last5GamesEra` float,
	`daysSinceLastStart` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pitcher_stats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `player_props` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gamePk` int NOT NULL,
	`gameDate` date NOT NULL,
	`playerId` int,
	`playerName` varchar(100) NOT NULL,
	`teamId` int,
	`propType` varchar(50) NOT NULL,
	`line` float NOT NULL,
	`overOdds` int,
	`underOdds` int,
	`modelProjection` float,
	`pick` enum('over','under','pass') DEFAULT 'pass',
	`edgeScore` float,
	`confidenceTier` enum('A','B','C','D') DEFAULT 'C',
	`keyFactors` json,
	`result` enum('win','loss','push','pending') DEFAULT 'pending',
	`actualValue` float,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `player_props_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `predictions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gamePk` int NOT NULL,
	`gameDate` date NOT NULL,
	`market` enum('moneyline','runline','total','prop') NOT NULL,
	`pick` varchar(100) NOT NULL,
	`pickLabel` varchar(200),
	`modelProbability` float NOT NULL,
	`impliedProbability` float,
	`edgeScore` float,
	`confidenceTier` enum('A','B','C','D') DEFAULT 'C',
	`recommendedOdds` int,
	`features` json,
	`result` enum('win','loss','push','pending') DEFAULT 'pending',
	`actualScore` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `predictions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `team_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teamId` int NOT NULL,
	`season` int NOT NULL,
	`runsPerGame` float,
	`wrcPlus` float,
	`ops` float,
	`obp` float,
	`slg` float,
	`avg` float,
	`iso` float,
	`babip` float,
	`kPct` float,
	`bbPct` float,
	`hrPerGame` float,
	`era` float,
	`fip` float,
	`xfip` float,
	`whip` float,
	`kPer9` float,
	`bbPer9` float,
	`hrPer9` float,
	`runsPerGameHome` float,
	`runsPerGameAway` float,
	`eraHome` float,
	`eraAway` float,
	`runsPerGameVsL` float,
	`runsPerGameVsR` float,
	`wins` int DEFAULT 0,
	`losses` int DEFAULT 0,
	`winPct` float,
	`lastTenW` int DEFAULT 0,
	`lastTenL` int DEFAULT 0,
	`streak` int DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `team_stats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `umpire_tendencies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`umpireName` varchar(100) NOT NULL,
	`strikeZoneSize` float DEFAULT 1,
	`kPctAboveAvg` float DEFAULT 0,
	`bbPctAboveAvg` float DEFAULT 0,
	`homeFavorScore` float DEFAULT 0,
	`pitcherFavorScore` float DEFAULT 0,
	`gamesUmpired` int DEFAULT 0,
	`avgRunsPerGame` float,
	`overPct` float,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `umpire_tendencies_id` PRIMARY KEY(`id`),
	CONSTRAINT `umpire_tendencies_umpireName_unique` UNIQUE(`umpireName`)
);
--> statement-breakpoint
CREATE TABLE `weather_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gamePk` int NOT NULL,
	`tempF` float,
	`feelsLikeF` float,
	`windSpeedMph` float,
	`windDirDeg` int,
	`windDirLabel` varchar(20),
	`humidity` int,
	`conditions` varchar(100),
	`precipChance` float,
	`runImpact` float DEFAULT 0,
	`fetchedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `weather_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `weather_cache_gamePk_unique` UNIQUE(`gamePk`)
);
--> statement-breakpoint
CREATE INDEX `idx_game_date` ON `mlb_games` (`gameDate`);--> statement-breakpoint
CREATE INDEX `idx_odds_game` ON `odds_snapshots` (`gamePk`);--> statement-breakpoint
CREATE INDEX `idx_pitcher_season` ON `pitcher_stats` (`playerId`,`season`);--> statement-breakpoint
CREATE INDEX `idx_props_game` ON `player_props` (`gamePk`);--> statement-breakpoint
CREATE INDEX `idx_pred_game` ON `predictions` (`gamePk`);--> statement-breakpoint
CREATE INDEX `idx_pred_date` ON `predictions` (`gameDate`);--> statement-breakpoint
CREATE INDEX `idx_team_season` ON `team_stats` (`teamId`,`season`);