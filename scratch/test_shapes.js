const assert = require('assert');

function makeClassList() {
  const classes = new Set();
  return {
    add: (...names) => names.forEach(name => classes.add(name)),
    remove: (...names) => names.forEach(name => classes.delete(name)),
    contains: name => classes.has(name),
    toString: () => [...classes].join(' ')
  };
}

function makeCanvas(onFillText = () => {}) {
  return {
    width: 800,
    height: 600,
    style: {},
    addEventListener: () => {},
    parentElement: {
      getBoundingClientRect: () => ({ width: 800, height: 600 })
    },
    getContext: () => ({
      scale: () => {},
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      fill: () => {},
      stroke: () => {},
      arc: () => {},
      save: () => {},
      restore: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      fillText: text => onFillText(text),
      setTransform: () => {},
      drawImage: () => {}
    })
  };
}

function makeUi() {
  const toast = {
    textContent: '',
    classList: makeClassList()
  };

  return {
    pieceCount: { textContent: '1' },
    cutCount: { textContent: '0' },
    undoBtn: { disabled: true },
    redoBtn: { disabled: true },
    resetBtn: { disabled: false },
    muteBtn: { innerHTML: '🔊 Sound', classList: makeClassList() },
    toast,
    shapeSelect: { value: 'star' },
    roundBar: { style: { display: 'flex' } },
    roundBadge: { textContent: '' },
    totalScore: { textContent: '0' },
    targetChips: { innerHTML: '' },
    currentPiecesContainer: { style: { display: 'flex' } },
    currentChips: { innerHTML: '' },
    roundStatusBox: { className: '', classList: makeClassList() },
    roundStatusText: { textContent: '', innerHTML: '' },
    nextRoundBtn: { style: { display: 'none' } },
    retryRoundBtn: { style: {} }
  };
}

global.window = {
  addEventListener: () => {},
  devicePixelRatio: 1,
  navigator: {}
};
global.document = {
  addEventListener: () => {}
};
global.performance = { now: () => 0 };
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};

const Game = require('../src/game.js');
const Shapes = require('../src/shapes.js');
const Physics = require('../src/physics.js');
const Geometry = require('../src/geometry.js');
const ui = makeUi();
const game = new Game.GameApp(makeCanvas(), ui);

const drawnLabels = [];
const labelContext = makeCanvas(text => drawnLabels.push(text)).getContext('2d');
const labelTestPiece = new Physics.Piece([
  { x: 100, y: 100 },
  { x: 180, y: 100 },
  { x: 180, y: 160 },
  { x: 100, y: 160 }
]);
game.pieces = [labelTestPiece];
game.round = 59;
game.drawPiece(labelContext, labelTestPiece);
assert.strictEqual(drawnLabels.length, 1, 'piece percentage should still appear before round 60');
game.round = 60;
game.drawPiece(labelContext, labelTestPiece);
assert.strictEqual(drawnLabels.length, 1, 'piece percentage should be hidden from round 60 onward');
game.round = 89;
game.updateHUD();
assert.strictEqual(ui.currentPiecesContainer.style.display, 'flex', 'Current row should remain visible before round 90');
game.round = 90;
game.updateHUD();
assert.strictEqual(ui.currentPiecesContainer.style.display, 'none', 'Current row should be hidden starting at round 90');

const requiredShapes = [
  'createRandomHardPolygon',
  'createBlob',
  'createDroplet',
  'createLeaf',
  'createFlower',
  'createPill',
  'createPeanut',
  'createRibbon',
  'createSpiral',
  'createSunburst',
  'createHexStar'
];
const requiredHardShapes = [
  'createHardWisp',
  'createHardTalon',
  'createHardDrift',
  'createHardRift',
  'createHardLobe',
  'createHardTear',
  'createHardSaw',
  'createHardFang',
  'createHardHook',
  'createHardGash',
  'createHardCurl',
  'createHardScallop',
  'createHardRook',
  'createHardDart',
  'createHardSkew'
];

const rankedEasyShapes = ['star', 'fish', 'heart', 'diamond'];
const rankedHardShapes = ['hardWisp', 'hardTalon', 'hardRift'];

for (const name of rankedEasyShapes) {
  assert.ok(Shapes.SHAPE_DIFFICULTY[name] <= 2, `${name} should be in the easy-to-medium tier`);
}

for (const name of rankedHardShapes) {
  assert.ok(Shapes.SHAPE_DIFFICULTY[name] >= 4, `${name} should be in a late-game hard tier`);
}

assert.ok(game.shapeDifficultyTier === 1, 'game should start at tier 1');
game.round = 5;
game.updateDifficultyTier();
assert.ok(game.shapeDifficultyTier === 1, 'rounds 1 through 5 should use tier 1');
game.round = 6;
game.updateDifficultyTier();
assert.ok(game.shapeDifficultyTier === 2, 'round 6 should advance to tier 2');
game.round = 1;
game.generateRound(18);
assert.ok(game.shapeDifficultyTier === 4, 'round 18 should use tier 4 even when selected directly');
assert.strictEqual(Shapes.SHAPE_DIFFICULTY[game.selectedShape], 4, 'round 18 should select a hard shape');

const shapeTierRules = [
  [21, 1],
  [25, 1],
  [26, 2],
  [31, 3],
  [36, 4],
  [40, 4],
  [41, 1]
];
for (const [roundNumber, expectedTier] of shapeTierRules) {
  game.updateDifficultyTier(roundNumber);
  assert.strictEqual(game.shapeDifficultyTier, expectedTier, `round ${roundNumber} should repeat the 20-round shape tier cycle`);
}

const targetRules = [
  [1, 2, 10],
  [5, 2, 10],
  [6, 3, 10],
  [10, 3, 10],
  [11, 4, 5],
  [20, 5, 5],
  [21, 2, 10],
  [25, 2, 10],
  [26, 3, 10],
  [30, 3, 10],
  [31, 4, 5],
  [40, 5, 5],
  [41, 2, 10]
];

for (const [roundNumber, expectedCount, increment] of targetRules) {
  const targets = game.createRoundTargets(roundNumber);
  assert.strictEqual(targets.length, expectedCount, `round ${roundNumber} should request ${expectedCount} percentages`);
  assert.strictEqual(targets.reduce((sum, value) => sum + value, 0), 100, `round ${roundNumber} targets should total 100%`);
  assert.ok(targets.every(value => value > 0 && value % increment === 0), `round ${roundNumber} targets should use ${increment}% increments`);
}

const floatSpeedRules = [
  [21, 18],
  [22, 22.5],
  [23, 27],
  [24, 31.5],
  [25, 36],
  [26, 18],
  [30, 36],
  [31, 18],
  [40, 36],
  [41, 22.5],
  [45, 40.5],
  [46, 27],
  [50, 45],
  [51, 31.5]
];

for (const [roundNumber, expectedSpeed] of floatSpeedRules) {
  const boostedSpeed = expectedSpeed * 1.265;
  assert.ok(Math.abs(game.getRoundFloatSpeed(roundNumber) - boostedSpeed) < 0.001, `round ${roundNumber} should use the faster scheduled floating speed`);
  game.generateRound(roundNumber);
  const pieceSpeed = Math.hypot(game.pieces[0].vx, game.pieces[0].vy);
  assert.ok(Math.abs(pieceSpeed - boostedSpeed) < 0.001, `round ${roundNumber} pieces should start at the faster scheduled speed`);
}

for (const name of requiredShapes) {
  assert.strictEqual(typeof Shapes[name], 'function', `${name} should exist`);
  const poly = Shapes[name](400, 300, 120, 120);
  assert.ok(Array.isArray(poly) && poly.length >= 3, `${name} should return a polygon`);
}

const randomHardOne = Shapes.createRandomHardPolygon(400, 300, 160, 130);
const randomHardTwo = Shapes.createRandomHardPolygon(400, 300, 160, 130);
assert.notDeepStrictEqual(randomHardOne, randomHardTwo, 'random hard shape should differ each time it is generated');
assert.strictEqual(Shapes.SHAPE_DIFFICULTY.randomHard, 4, 'random hard should be classified as tier 4');
assert.ok(Shapes.HARD_SHAPES.includes('randomHard'), 'random hard should be included in the hard-shape registry');

for (const name of requiredHardShapes) {
  assert.strictEqual(typeof Shapes[name], 'function', `${name} should exist`);
  const poly = Shapes[name](400, 300, 120, 120);
  assert.ok(Array.isArray(poly) && poly.length >= 3, `${name} should return a polygon`);
  const hardKey = name.replace(/^createHard/, 'hard');
  assert.ok(Shapes.HARD_SHAPES.includes(hardKey), `${name} should be marked as a hard shape`);
}

game.showChallengeToast('🎉 ROUND CLEAR!');
assert.strictEqual(ui.toast.classList.contains('visible'), true, 'toast should be visible after showChallengeToast');

game.nextRound();
assert.strictEqual(ui.toast.classList.contains('visible'), false, 'toast should hide when next round starts');

game.round = 1;
game.generateRound(21);
assert.strictEqual(game.round, 21, 'generating a selected round should update the game round');
assert.strictEqual(ui.roundBadge.textContent, 'Round 21', 'generating a selected round should update the round indicator');
assert.strictEqual(game.getActivePhysicsMode(), 'slowFloat', 'round 21 should enable slow floating physics');
assert.strictEqual(game.shapeDifficultyTier, 1, 'round 21 should restart the shape difficulty cycle');
assert.strictEqual(Shapes.SHAPE_DIFFICULTY[game.selectedShape], 1, 'round 21 should select from the first difficulty tier');
const initialFloatSpeed = Math.hypot(game.pieces[0].vx, game.pieces[0].vy);
assert.ok(Math.abs(initialFloatSpeed - 22.77) < 0.001, 'round 21 pieces should begin at the faster slowest floating speed');

game.round = 69;
game.loadShape('star');
const round69StarRadius = game.pieces[0].radius;
game.round = 70;
game.loadShape('star');
assert.ok(Math.abs(game.pieces[0].radius - round69StarRadius * 0.5) < 0.001, 'all shapes should be half-size starting at round 70');

game.loadShape('hardWisp');
const hardWisp = game.pieces[0];
let hardWispBounds = Geometry.polygonBounds(hardWisp.getWorldPoints());
assert.ok(hardWispBounds.minY >= 172 && hardWispBounds.maxY <= 438, 'round-21 Hard Wisp should fit inside the play area with rotation clearance');
hardWisp.vx = 0;
hardWisp.vy = -36;
hardWisp.vAngle = 0.12;
let verticalReversals = 0;
for (let frame = 0; frame < 30; frame++) {
  const previousVy = hardWisp.vy;
  hardWisp.update(0.05, 'slowFloat', { width: 800, height: 600, top: 120, bottom: 110 });
  if (previousVy * hardWisp.vy < 0) verticalReversals++;
}
assert.ok(verticalReversals <= 1, 'round-21 Hard Wisp should not rapidly flick between boundaries');
hardWispBounds = Geometry.polygonBounds(hardWisp.getWorldPoints());
assert.ok(hardWispBounds.minY >= 140 && hardWispBounds.maxY <= 470, 'rotating Hard Wisp should remain within the safe play area');

const roundShapeNames = [...Object.keys(Shapes.SHAPE_DIFFICULTY), 'hexagon', 'octagon', 'triangle'];
for (const shapeName of roundShapeNames) {
  game.loadShape(shapeName);
  const piece = game.pieces[0];
  assert.ok(piece.radius <= 127.001, `${shapeName} should fit inside the round-21 rotation-safe area`);
  for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
    piece.angle = angle;
    const bounds = Geometry.polygonBounds(piece.getWorldPoints());
    assert.ok(bounds.minX >= 40 && bounds.maxX <= 760, `${shapeName} should stay within horizontal safe bounds`);
    assert.ok(bounds.minY >= 172 && bounds.maxY <= 438, `${shapeName} should stay within vertical safe bounds`);
  }
}

game.width = 320;
game.height = 320;
for (const shapeName of roundShapeNames) {
  game.loadShape(shapeName);
  const piece = game.pieces[0];
  assert.ok(piece.radius <= 14.1, `${shapeName} should fit the minimum-size round-21 safe area`);
  for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
    piece.angle = angle;
    const bounds = Geometry.polygonBounds(piece.getWorldPoints());
    assert.ok(bounds.minX >= 20 && bounds.maxX <= 300, `${shapeName} should fit minimum-width bounds when rotated`);
    assert.ok(bounds.minY >= 140 && bounds.maxY <= 190, `${shapeName} should fit minimum-height bounds when rotated`);
  }
}
game.width = 800;
game.height = 600;

const playBounds = { width: 400, height: 400, top: 120, bottom: 110 };
const makeBoundaryPiece = (x, y, vx, vy) => {
  const piece = new Physics.Piece([
    { x: x - 10, y: y - 5 },
    { x: x + 10, y: y - 5 },
    { x, y: y + 5 }
  ]);
  piece.vx = vx;
  piece.vy = vy;
  return piece;
};

const rightPiece = makeBoundaryPiece(375, 200, 18, 0);
rightPiece.update(0.5, 'slowFloat', playBounds);
assert.ok(rightPiece.vx < 0, 'slow-float pieces should bounce off the right boundary');
assert.ok(Math.max(...rightPiece.getWorldPoints().map(point => point.x)) <= 380.001, 'right-bounced piece should stay inside the boundary');

const leftPiece = makeBoundaryPiece(25, 200, -18, 0);
leftPiece.update(0.5, 'slowFloat', playBounds);
assert.ok(leftPiece.vx > 0, 'slow-float pieces should bounce off the left boundary');

const topPiece = makeBoundaryPiece(200, 150, 0, -18);
topPiece.update(0.5, 'slowFloat', playBounds);
assert.ok(topPiece.vy > 0, 'slow-float pieces should bounce off the top play-area boundary');

const bottomPiece = makeBoundaryPiece(200, 260, 0, 18);
bottomPiece.update(0.5, 'slowFloat', playBounds);
assert.ok(bottomPiece.vy < 0, 'slow-float pieces should bounce off the bottom play-area boundary');

for (let frame = 0; frame < 1000; frame++) {
  rightPiece.update(0.05, 'slowFloat', playBounds);
}
assert.ok(Math.hypot(rightPiece.vx, rightPiece.vy) >= 17.5, 'slow-float speed should remain steady through repeated bounces');

const wanderingPiece = makeBoundaryPiece(200, 200, 18, 0);
wanderingPiece.slowFloatTurnTimer = 10;
wanderingPiece.slowFloatTargetTurnRate = 0.3;
let previousHeading = 0;
let maximumHeadingStep = 0;
for (let frame = 0; frame < 120; frame++) {
  wanderingPiece.update(0.05, 'slowFloat', null, 18);
  const heading = Math.atan2(wanderingPiece.vy, wanderingPiece.vx);
  const headingStep = Math.atan2(Math.sin(heading - previousHeading), Math.cos(heading - previousHeading));
  maximumHeadingStep = Math.max(maximumHeadingStep, Math.abs(headingStep));
  previousHeading = heading;
}
assert.ok(previousHeading > 0.2, 'slow-float motion should gradually curve from its initial heading');
assert.ok(maximumHeadingStep < 0.03, 'slow-float heading changes should remain smooth');
assert.ok(Math.abs(Math.hypot(wanderingPiece.vx, wanderingPiece.vy) - 18) < 0.001, 'wandering should preserve the scheduled cruise speed');

const straightFloatPiece = makeBoundaryPiece(200, 200, 18, 0);
straightFloatPiece.update(0.05, 'float', playBounds);
assert.ok(Math.abs(straightFloatPiece.vy) < 0.001, 'ordinary float mode should not inherit slow-float wandering');

const collisionA = makeBoundaryPiece(130, 200, 18, 0);
const collisionB = makeBoundaryPiece(145, 200, -18, 0);
const collisionAStart = { x: collisionA.x, y: collisionA.y };
const collisionBStart = { x: collisionB.x, y: collisionB.y };
Physics.resolvePieceCollisions([collisionA, collisionB], 'slowFloat');
assert.ok(Math.hypot(collisionA.x - collisionAStart.x, collisionA.y - collisionAStart.y) <= 1.51, 'slow-float collision correction should not flick the first piece');
assert.ok(Math.hypot(collisionB.x - collisionBStart.x, collisionB.y - collisionBStart.y) <= 1.51, 'slow-float collision correction should not flick the second piece');
assert.ok(collisionA.vx < 0 && collisionB.vx > 0, 'slow-float pieces should reflect away from each other immediately');
assert.ok(Math.abs(Math.hypot(collisionA.vx, collisionA.vy) - 18) < 0.001, 'piece collision should preserve the scheduled cruise speed');
collisionA.update(0.1, 'slowFloat');
assert.ok(Math.abs(Math.hypot(collisionA.vx, collisionA.vy) - 18) < 0.001, 'piece bounce should keep the slowest cruise speed');
for (let frame = 0; frame < 5 && Physics.checkPolygonsOverlap(collisionA.getWorldPoints(), collisionB.getWorldPoints()); frame++) {
  Physics.resolvePieceCollisions([collisionA, collisionB], 'slowFloat');
}
assert.strictEqual(Physics.checkPolygonsOverlap(collisionA.getWorldPoints(), collisionB.getWorldPoints()), false, 'gradual correction should eventually resolve the overlap');

const diagonalCollisionA = makeBoundaryPiece(200, 200, 25, 25);
const diagonalCollisionB = makeBoundaryPiece(205, 205, -25, -25);
Physics.resolvePieceCollisions([diagonalCollisionA, diagonalCollisionB], 'slowFloat');
assert.ok(diagonalCollisionA.vx < 0 && diagonalCollisionA.vy < 0, 'diagonal slow-float collisions should rebound along the center direction');
assert.ok(diagonalCollisionB.vx > 0 && diagonalCollisionB.vy > 0, 'both pieces should move away after a diagonal collision');

console.log('toast lifecycle test passed');
