'use strict';
/* ===== Static game data ===== */
const CAP = 200;          // salary cap in $M
const ROSTER_MAX = 53;
const NUM_WEEKS = 17;
const DIV_NAMES = ['East', 'North', 'South', 'West'];

// city, nickname, abbr, primary, secondary, mascot species, mascot hat
const TEAM_DATA = [
  // AFC East
  ['Buffalo', 'Bills', 'BUF', '#00338d', '#c60c30', 'bull', 'none'],
  ['Miami', 'Dolphins', 'MIA', '#008e97', '#fc4c02', 'fish', 'none'],
  ['New England', 'Patriots', 'NE', '#002244', '#c60c30', 'person', 'tricorn'],
  ['New York', 'Jets', 'NYJ', '#125740', '#ffffff', 'robot', 'none'],
  // AFC North
  ['Baltimore', 'Ravens', 'BAL', '#241773', '#9e7c0c', 'bird', 'none'],
  ['Cincinnati', 'Bengals', 'CIN', '#fb4f14', '#111111', 'cat', 'none'],
  ['Cleveland', 'Browns', 'CLE', '#ff3c00', '#5a3a1d', 'dog', 'none'],
  ['Pittsburgh', 'Steelers', 'PIT', '#ffb612', '#101820', 'person', 'hardhat'],
  // AFC South
  ['Houston', 'Texans', 'HOU', '#03202f', '#a71930', 'bull', 'cowboy'],
  ['Indianapolis', 'Colts', 'IND', '#002c5f', '#a2aaad', 'horse', 'none'],
  ['Jacksonville', 'Jaguars', 'JAX', '#006778', '#d7a22a', 'cat', 'none'],
  ['Tennessee', 'Titans', 'TEN', '#0c2340', '#4b92db', 'person', 'helmet'],
  // AFC West
  ['Denver', 'Broncos', 'DEN', '#fb4f14', '#002244', 'horse', 'none'],
  ['Kansas City', 'Chiefs', 'KC', '#e31837', '#ffb81c', 'dog', 'none'],
  ['Las Vegas', 'Raiders', 'LV', '#a5acaf', '#111111', 'person', 'pirate'],
  ['Los Angeles', 'Chargers', 'LAC', '#0080c6', '#ffc20e', 'horse', 'none'],
  // NFC East
  ['Dallas', 'Cowboys', 'DAL', '#003594', '#869397', 'person', 'cowboy'],
  ['New York', 'Giants', 'NYG', '#0b2265', '#a71930', 'person', 'tophat'],
  ['Philadelphia', 'Eagles', 'PHI', '#004c54', '#a5acaf', 'bird', 'none'],
  ['Washington', 'Commanders', 'WAS', '#5a1414', '#ffb612', 'person', 'cap'],
  // NFC North
  ['Chicago', 'Bears', 'CHI', '#0b162a', '#c83803', 'bear', 'none'],
  ['Detroit', 'Lions', 'DET', '#0076b6', '#b0b7bc', 'cat', 'none'],
  ['Green Bay', 'Packers', 'GB', '#203731', '#ffb612', 'person', 'cheese'],
  ['Minnesota', 'Vikings', 'MIN', '#4f2683', '#ffc62f', 'person', 'viking'],
  // NFC South
  ['Atlanta', 'Falcons', 'ATL', '#a71930', '#111111', 'bird', 'none'],
  ['Carolina', 'Panthers', 'CAR', '#0085ca', '#101820', 'cat', 'none'],
  ['New Orleans', 'Saints', 'NO', '#d3bc8d', '#101820', 'person', 'tophat'],
  ['Tampa Bay', 'Buccaneers', 'TB', '#d50a0a', '#34302b', 'person', 'pirate'],
  // NFC West
  ['Arizona', 'Cardinals', 'ARI', '#97233f', '#111111', 'bird', 'none'],
  ['Los Angeles', 'Rams', 'LAR', '#003594', '#ffa300', 'bull', 'none'],
  ['San Francisco', '49ers', 'SF', '#aa0000', '#b3995d', 'person', 'cap'],
  ['Seattle', 'Seahawks', 'SEA', '#002244', '#69be28', 'bird', 'none'],
];

const SPECIES = ['bear', 'bird', 'cat', 'dog', 'horse', 'bull', 'robot', 'person', 'fish'];
const HATS = ['none', 'cap', 'cowboy', 'crown', 'pirate', 'viking', 'tophat', 'cheese', 'hardhat', 'helmet', 'tricorn'];
const ACCS = ['none', 'pompoms', 'flag', 'finger', 'megaphone'];
const CHEERS = {
  jump: ['Hype Man', 'Gains hype 50% faster from big plays'],
  spin: ['Spinner', 'Hype fades slower during the game'],
  dance: ['Dancer', 'Your team starts every game with 25 hype'],
  wave: ['Wave Leader', '+1 to every player rating, always'],
};
const MASCOT_FIRST = ['Rocky', 'Bruno', 'Blitz', 'Sparky', 'Chomper', 'Slugger', 'Fang', 'Duke', 'Gizmo', 'Turbo',
  'Captain', 'Thunder', 'Buddy', 'Zippy', 'Moose', 'Pepper', 'Ace', 'Biscuit', 'Scrappy', 'Boomer'];

const FIRST = ['Jaxon', 'Marcus', 'Tyrell', 'DeShawn', 'Colt', 'Brock', 'Mateo', 'Zane', 'Kobe', 'Dante', 'Jalen', 'Cooper', 'Rex', 'Tanner',
  'Malik', 'Ezra', 'Bryce', 'Cade', 'Devin', 'Elijah', 'Finn', 'Gunner', 'Hudson', 'Isaiah', 'Jamal', 'Kai', 'Landon', 'Micah', 'Nico', 'Omar',
  'Pierce', 'Quinn', 'Reggie', 'Silas', 'Trey', 'Vince', 'Wyatt', 'Xavier', 'Yusuf', 'Zeke', 'Andre', 'Barry', 'Calvin', 'Darius', 'Emmett',
  'Felix', 'Grant', 'Hank', 'Ivan', 'Jonah', 'Kenny', 'Lamar', 'Mack', 'Nate', 'Otis', 'Pablo', 'Rashad', 'Sonny', 'Tobias', 'Victor', 'Walt',
  'Dexter', 'Chase', 'Beau', 'Cyrus', 'Dominic', 'Eli', 'Frankie', 'Gideon', 'Hector', 'Jett', 'Knox', 'Leo', 'Mason', 'Nolan', 'Orion',
  'Preston', 'Ronan', 'Shane', 'Tate', 'Vaughn', 'Wade', 'Axel', 'Bruno', 'Clay', 'Dax', 'Enzo', 'Fletcher', 'Gage', 'Heath', 'Ike', 'Jude'];
const LAST = ['Walker', 'Jackson', 'Reed', 'Brooks', 'Stone', 'Cruz', 'Blaze', 'Mercer', 'Hawkins', 'Bishop', 'Cole', 'Dunn', 'Ellis', 'Fox', 'Gray',
  'Hayes', 'Irving', 'Jensen', 'Knight', 'Lopez', 'Monroe', 'Nash', 'Ortiz', 'Price', 'Quarles', 'Ramsey', 'Sutton', 'Tucker', 'Underwood', 'Vega',
  'Whitfield', 'Young', 'Zimmer', 'Archer', 'Booker', 'Callahan', 'Dorsey', 'Easton', 'Frost', 'Gaines', 'Holloway', 'Ingram', 'Jefferson', 'Kemp',
  'Lawson', 'Maddox', 'Norwood', 'Oakes', 'Pruitt', 'Rowe', 'Sinclair', 'Thorne', 'Vance', 'Wells', 'York', 'Baptiste', 'Crockett', 'Delgado',
  'Everett', 'Fontaine', 'Garrison', 'Hendricks', 'Ibarra', 'Jordan', 'Keller', 'Langley', 'Mathis', 'Novak', 'Okafor', 'Pickett', 'Rutledge',
  'Sandoval', 'Tillman', 'Voss', 'Washington', 'Yates', 'Zhang', 'Abbott', 'Banks', 'Chambers', 'Dixon', 'Emerson', 'Fuller', 'Graves', 'Hobbs',
  'Ivey', 'Jarrett', 'Kincaid', 'Lowry', 'McCoy', 'Odom', 'Payne', 'Quick', 'Rhodes', 'Spencer', 'Upton', 'Wolfe'];

const POS = ['QB', 'RB', 'WR', 'TE', 'OT', 'OG', 'C', 'DE', 'DT', 'LB', 'CB', 'S', 'K', 'P'];
const POS_LABEL = { QB: 'Quarterback', RB: 'Running Back', WR: 'Wide Receiver', TE: 'Tight End', OT: 'Offensive Tackle', OG: 'Offensive Guard', C: 'Center',
  DE: 'Defensive End', DT: 'Defensive Tackle', LB: 'Linebacker', CB: 'Cornerback', S: 'Safety', K: 'Kicker', P: 'Punter' };
const ROSTER_TEMPLATE = { QB: 3, RB: 4, WR: 7, TE: 3, OT: 4, OG: 4, C: 2, DE: 4, DT: 4, LB: 6, CB: 6, S: 4, K: 1, P: 1 }; // = 53
const STARTERS = { QB: 1, RB: 1, WR: 3, TE: 1, OT: 2, OG: 2, C: 1, DE: 2, DT: 2, LB: 3, CB: 2, S: 2, K: 1, P: 1 };
const POS_MULT = { QB: 1.7, RB: 0.7, WR: 1.0, TE: 0.75, OT: 1.1, OG: 0.7, C: 0.7, DE: 1.25, DT: 1.0, LB: 0.85, CB: 1.0, S: 0.8, K: 0.25, P: 0.22 };
const SPD_RANGE = { QB: [55, 80], RB: [78, 97], WR: [78, 98], TE: [62, 86], OT: [40, 62], OG: [40, 60], C: [40, 60],
  DE: [65, 90], DT: [52, 78], LB: [68, 90], CB: [80, 98], S: [76, 94], K: [40, 60], P: [40, 60] };
const FAT_RATE = { QB: 1.5, RB: 6, WR: 4, TE: 4, OT: 3.5, OG: 3.5, C: 3.5, DE: 5, DT: 5, LB: 4, CB: 4, S: 3, K: 0, P: 0 };
// field slots shown on depth chart (label -> position group)
const SLOTS_OFF = [['QB', 'QB'], ['RB', 'RB'], ['WR1', 'WR'], ['WR2', 'WR'], ['WR3', 'WR'], ['TE', 'TE'], ['LT', 'OT'], ['LG', 'OG'], ['C', 'C'], ['RG', 'OG'], ['RT', 'OT']];
const SLOTS_DEF = [['LE', 'DE'], ['DT', 'DT'], ['DT', 'DT'], ['RE', 'DE'], ['OLB', 'LB'], ['MLB', 'LB'], ['OLB', 'LB'], ['CB', 'CB'], ['CB', 'CB'], ['FS', 'S'], ['SS', 'S']];

const SKINS = ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a21'];
const HAIRS = ['#1b1b1b', '#3b2417', '#6b4423', '#c9a24a', '#8a8a8a', '#b5442a'];
const HAIR_STYLES = ['Bald', 'Short', 'Afro', 'Mohawk', 'Long'];
