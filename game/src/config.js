// config.js — every tuning number and colour the rest of Marisol Bay reads.
// One place for the world's size, the road grid, speeds, prices of crime and
// the sunset palette, so balancing the game never means hunting through code.

export const WORLD = {
  block: 380, // one city block, building face to building face
  road: 118, // asphalt width between blocks
  cols: 7, // blocks east-west
  rows: 6, // blocks north-south
  margin: 90, // grass/sand apron around the grid
};

// The drivable/walkable world rectangle, derived from the grid above.
export const PITCH = WORLD.block + WORLD.road;
export const WORLD_W = WORLD.margin * 2 + WORLD.cols * WORLD.block + (WORLD.cols - 1) * WORLD.road;
export const WORLD_H = WORLD.margin * 2 + WORLD.rows * WORLD.block + (WORLD.rows - 1) * WORLD.road + 340; // +340: the beach

export const PLAYER = {
  walkSpeed: 178,
  runSpeed: 252,
  radius: 13,
  maxHealth: 100,
  punchRange: 40,
  punchArc: 1.15, // radians of swing in front of the player
  punchDamage: 34,
  punchCooldown: 0.34,
};

export const CAR = {
  length: 52,
  width: 26,
  accel: 340,
  brake: 520,
  reverseAccel: 180,
  maxSpeed: 430,
  maxReverse: 130,
  grip: 7.5,
  steerRate: 2.6,
};

export const WANTED = {
  maxStars: 5,
  sightRange: 430, // how far a cop car can see the player
  loseSightAfter: 6, // seconds unseen before one star cools off
  bustRange: 34, // a foot cop this close starts the bust meter
  bustTime: 1.15, // seconds of contact that ends in BUSTED
};

export const MONEY = {
  stealCar: 25,
  missionPay: [250, 400, 750],
  bustFine: 0.25, // fraction of cash lost when busted
  wastedFine: 0.2, // fraction lost when wasted
  healCost: 0,
};

// Sunset over the bay, all game long: warm sky light on roofs, violet
// shadows, teal water. Flat colours, no images.
export const PALETTE = {
  grass: '#3f7d4e',
  grassDark: '#356b42',
  sand: '#e8c98a',
  water: '#1d7f8c',
  waterDeep: '#14616e',
  road: '#3a3f4a',
  roadEdge: '#2e323c',
  lane: '#e8d189',
  sidewalk: '#b9b3a4',
  curb: '#8f897c',
  roofA: '#c65b39',
  roofB: '#a84a63',
  roofC: '#7a4a8c',
  roofD: '#38618c',
  roofE: '#c98a3a',
  wallShade: 'rgba(43,16,64,0.35)',
  palmTrunk: '#7a5230',
  palmLeaf: '#2e8c57',
  carColors: ['#d94f30', '#e8a13a', '#3a7bd5', '#59b06a', '#e5e0d5', '#8c4a9e', '#d53a6a', '#2a9d8f', '#f2e14c', '#444a55'],
  copBody: '#eef1f4',
  copTrim: '#1d2a6a',
  playerShirt: '#ffb02e',
  playerSkin: '#a06a3b',
  pedShirts: ['#d96a4a', '#4a90d9', '#6ab04c', '#e5e0d5', '#b04a8c', '#4ad0c2', '#e8c94a', '#7a6ad9'],
};

export const DISTRICTS = [
  { name: 'CORAL DOWNTOWN', col: 3, row: 1 },
  { name: 'MARISOL BEACH', col: 3, row: 5 },
  { name: 'PORTSIDE DOCKS', col: 0, row: 4 },
  { name: 'OLD TOWN', col: 1, row: 1 },
  { name: 'PALM HEIGHTS', col: 5, row: 0 },
  { name: 'THE MARINA', col: 6, row: 5 },
];
