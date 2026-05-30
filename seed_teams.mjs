import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const TEAMS = [
  [108,'Los Angeles Angels','LAA','Angels','AL West','AL','Angel Stadium',96,95,97,'grass'],
  [109,'Arizona Diamondbacks','ARI','D-backs','NL West','NL','Chase Field',103,104,101,'grass'],
  [110,'Baltimore Orioles','BAL','Orioles','AL East','AL','Oriole Park at Camden Yards',101,99,100,'grass'],
  [111,'Boston Red Sox','BOS','Red Sox','AL East','AL','Fenway Park',104,106,103,'grass'],
  [112,'Chicago Cubs','CHC','Cubs','NL Central','NL','Wrigley Field',100,98,100,'grass'],
  [113,'Cincinnati Reds','CIN','Reds','NL Central','NL','Great American Ball Park',106,112,104,'turf'],
  [114,'Cleveland Guardians','CLE','Guardians','AL Central','AL','Progressive Field',97,95,98,'grass'],
  [115,'Colorado Rockies','COL','Rockies','NL West','NL','Coors Field',115,120,112,'grass'],
  [116,'Detroit Tigers','DET','Tigers','AL Central','AL','Comerica Park',95,93,96,'grass'],
  [117,'Houston Astros','HOU','Astros','AL West','AL','Daikin Park',98,97,99,'turf'],
  [118,'Kansas City Royals','KC','Royals','AL Central','AL','Kauffman Stadium',99,98,100,'turf'],
  [119,'Los Angeles Dodgers','LAD','Dodgers','NL West','NL','Dodger Stadium',97,96,98,'grass'],
  [120,'Washington Nationals','WSH','Nationals','NL East','NL','Nationals Park',100,101,100,'grass'],
  [121,'New York Mets','NYM','Mets','NL East','NL','Citi Field',96,94,97,'grass'],
  [133,'Oakland Athletics','ATH','Athletics','AL West','AL','Sutter Health Park',95,88,96,'grass'],
  [134,'Pittsburgh Pirates','PIT','Pirates','NL Central','NL','PNC Park',97,96,98,'grass'],
  [135,'San Diego Padres','SD','Padres','NL West','NL','Petco Park',92,88,94,'grass'],
  [136,'Seattle Mariners','SEA','Mariners','AL West','AL','T-Mobile Park',94,91,95,'turf'],
  [137,'San Francisco Giants','SF','Giants','NL West','NL','Oracle Park',91,87,93,'grass'],
  [138,'St. Louis Cardinals','STL','Cardinals','NL Central','NL','Busch Stadium',99,98,100,'grass'],
  [139,'Tampa Bay Rays','TB','Rays','AL East','AL','Tropicana Field',98,97,99,'turf'],
  [140,'Texas Rangers','TEX','Rangers','AL West','AL','Globe Life Field',102,105,101,'turf'],
  [141,'Toronto Blue Jays','TOR','Blue Jays','AL East','AL','Rogers Centre',103,104,102,'turf'],
  [142,'Minnesota Twins','MIN','Twins','AL Central','AL','Target Field',99,98,100,'grass'],
  [143,'Philadelphia Phillies','PHI','Phillies','NL East','NL','Citizens Bank Park',104,108,103,'grass'],
  [144,'Atlanta Braves','ATL','Braves','NL East','NL','Truist Park',101,102,100,'grass'],
  [145,'Chicago White Sox','CWS','White Sox','AL Central','AL','Guaranteed Rate Field',101,103,100,'grass'],
  [146,'Miami Marlins','MIA','Marlins','NL East','NL','loanDepot park',96,93,97,'turf'],
  [147,'New York Yankees','NYY','Yankees','AL East','AL','Yankee Stadium',103,108,101,'grass'],
  [158,'Milwaukee Brewers','MIL','Brewers','NL Central','NL','American Family Field',100,99,100,'turf'],
];

const conn = await mysql.createConnection(process.env.DATABASE_URL);
let seeded = 0;
for (const [teamId, name, abbreviation, shortName, division, league, venue, pfRuns, pfHR, pfHits, surface] of TEAMS) {
  await conn.execute(
    `INSERT INTO mlb_teams (teamId, name, abbreviation, shortName, division, league, venue, parkFactorRuns, parkFactorHR, parkFactorHits, surface)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name=VALUES(name), abbreviation=VALUES(abbreviation), shortName=VALUES(shortName), division=VALUES(division), league=VALUES(league), venue=VALUES(venue)`,
    [teamId, name, abbreviation, shortName, division, league, venue, pfRuns, pfHR, pfHits, surface]
  );
  seeded++;
}
await conn.end();
console.log(`Seeded ${seeded} teams successfully`);
