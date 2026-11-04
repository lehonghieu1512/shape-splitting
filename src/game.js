/**
 * PolySlice Game Engine
 * Manages canvas rendering, mouse/touch dragging, laser slicing, challenge modes, and undo/redo.
 */

(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory(
      require('./geometry.js'),
      require('./shapes.js'),
      require('./audio.js'),
      require('./physics.js')
    );
  } else if (typeof define === 'function' && define.amd) {
    define(['./geometry.js', './shapes.js', './audio.js', './physics.js'], factory);
  } else {
    root.PolySlice = root.PolySlice || {};
    root.PolySlice.Game = factory(
      root.PolySlice.Geometry,
      root.PolySlice.Shapes,
      root.PolySlice.Audio,
      root.PolySlice.Physics
    );
  }
})(typeof self !== 'undefined' ? self : this, function (Geometry, Shapes, Audio, Physics) {
  'use strict';

  class GameApp {
    constructor(canvas, uiElements) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.ui = uiElements || {};

      this.width = canvas.width;
      this.height = canvas.height;
      this.dpr = window.devicePixelRatio || 1;

      // Pieces & Physics
      this.pieces = [];
      this.particleSystem = new Physics.ParticleSystem();
      this.physicsMode = 'float'; // 'float', 'gravity', 'fixed'

      // Cutting state
      this.isDragging = false;
      this.dragStart = null;
      this.dragCurrent = null;
      this.cutStyle = 'dragRelease'; // 'dragRelease', 'continuous'
      this.beamMode = 'segment'; // 'segment', 'fullLine'
      this.cutsCount = 0;
      this.initialArea = 1;

      // History for Undo / Redo
      this.history = [];
      this.redoStack = [];

      // Game Modes: 'percentChallenge' (default), 'sandbox', 'customDraw'
      this.gameMode = 'percentChallenge';
      this.selectedShape = 'star';
      this.shapeDifficultyTier = 1;

      // Percent Challenge Round State
      this.round = 1;
      this.totalScore = 0;
      this.roundTargetPercentages = [50, 50];
      this.roundStatus = 'in_progress'; // 'in_progress', 'passed', 'failed_oversliced', 'failed_accuracy'
      this.roundAccuracy = 0;
      this.roundScoreEarned = 0;
      this.autoAdvanceTimer = null;
      this.toastTimer = null;

      // Custom Draw mode state
      this.customPoints = [];
      this.isDrawingCustom = false;

      // Piece manipulation
      this.grabbedPiece = null;
      this.grabOffset = { x: 0, y: 0 };
      this.hoveredPiece = null;

      // Animation
      this.lastTime = performance.now();
      this.rafId = null;

      this.initEvents();
      this.resizeCanvas();
      this.generateRound(this.round);
      this.animate = this.animate.bind(this);
      this.rafId = requestAnimationFrame(this.animate);
    }

    resizeCanvas() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      this.width = Math.max(320, Math.floor(rect.width));
      this.height = Math.max(320, Math.floor(rect.height));

      this.dpr = window.devicePixelRatio || 1;
      this.canvas.width = this.width * this.dpr;
      this.canvas.height = this.height * this.dpr;
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;

      this.ctx.scale(this.dpr, this.dpr);
    }

    initEvents() {
      window.addEventListener('resize', () => {
        this.resizeCanvas();
      });

      const getPos = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        return {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
      };

      // Mouse events
      this.canvas.addEventListener('mousedown', (e) => {
        const pos = getPos(e);
        this.handlePointerDown(pos, e.button, e.shiftKey);
      });

      window.addEventListener('mousemove', (e) => {
        if (!this.canvas) return;
        const pos = getPos(e);
        this.handlePointerMove(pos);
      });

      window.addEventListener('mouseup', (e) => {
        if (!this.canvas) return;
        const pos = getPos(e);
        this.handlePointerUp(pos);
      });

      // Touch events
      this.canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) {
          const rect = this.canvas.getBoundingClientRect();
          const pos = {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top
          };
          this.handlePointerDown(pos, 0, false);
        }
        e.preventDefault();
      }, { passive: false });

      this.canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
          const rect = this.canvas.getBoundingClientRect();
          const pos = {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top
          };
          this.handlePointerMove(pos);
        }
        e.preventDefault();
      }, { passive: false });

      this.canvas.addEventListener('touchend', (e) => {
        this.handlePointerUp(this.dragCurrent || this.dragStart);
        e.preventDefault();
      }, { passive: false });

      // Keyboard shortcuts
      window.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

        if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
          if (e.shiftKey) this.redo();
          else this.undo();
          e.preventDefault();
        } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
          this.redo();
          e.preventDefault();
        } else if (e.key === 'r' || e.key === 'R') {
          this.resetShape();
        } else if (e.key === 'm' || e.key === 'M') {
          this.toggleSound();
        }
      });
    }

    handlePointerDown(pos, button, shiftKey) {
      // Audio activation on first interaction
      Audio.getContext();

      // Custom Draw mode: add point
      if (this.gameMode === 'customDraw') {
        this.addCustomPoint(pos);
        return;
      }

      // If Shift-click or right-click: grab piece to move it
      if (shiftKey || button === 2) {
        const clickedPiece = this.findPieceAt(pos);
        if (clickedPiece) {
          this.grabbedPiece = clickedPiece;
          this.grabbedPiece.isGrabbed = true;
          this.grabOffset = { x: pos.x - clickedPiece.x, y: pos.y - clickedPiece.y };
          return;
        }
      }

      // Normal slicing drag
      this.isDragging = true;
      this.dragStart = { x: pos.x, y: pos.y };
      this.dragCurrent = { x: pos.x, y: pos.y };

      Audio.playSwoosh();
    }

    handlePointerMove(pos) {
      if (this.grabbedPiece) {
        this.grabbedPiece.x = pos.x - this.grabOffset.x;
        this.grabbedPiece.y = pos.y - this.grabOffset.y;
        this.grabbedPiece.vx = 0;
        this.grabbedPiece.vy = 0;
        return;
      }

      if (this.isDragging) {
        const prev = this.dragCurrent;
        this.dragCurrent = { x: pos.x, y: pos.y };

        // Continuous / Live slice mode
        if (this.cutStyle === 'continuous' && prev) {
          const dist = Math.hypot(pos.x - prev.x, pos.y - prev.y);
          if (dist > 15) {
            this.executeSlice(prev, pos, true);
          }
        }
      } else {
        // Hover inspection
        this.hoveredPiece = this.findPieceAt(pos);
        for (const p of this.pieces) {
          p.hovered = (p === this.hoveredPiece);
        }
      }
    }

    handlePointerUp(pos) {
      if (this.grabbedPiece) {
        this.grabbedPiece.isGrabbed = false;
        this.grabbedPiece = null;
      }

      if (this.isDragging) {
        this.isDragging = false;
        if (this.dragStart && (pos || this.dragCurrent)) {
          const end = pos || this.dragCurrent;
          const dist = Math.hypot(end.x - this.dragStart.x, end.y - this.dragStart.y);
          if (dist > 12) {
            this.executeSlice(this.dragStart, end, false);
          }
        }
        this.dragStart = null;
        this.dragCurrent = null;
      }
    }

    findPieceAt(point) {
      for (let i = this.pieces.length - 1; i >= 0; i--) {
        const p = this.pieces[i];
        if (Geometry.pointInPolygon(point, p.getWorldPoints())) {
          return p;
        }
      }
      return null;
    }

    /**
     * Executes a cut across all pieces using the line from a to b.
     */
    executeSlice(a, b, isContinuous = false) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 5) return;

      const isSegmentOnly = (this.beamMode === 'segment') || isContinuous;

      // Extend slightly so edge-to-edge drags cut reliably
      let cutA = a;
      let cutB = b;
      if (isSegmentOnly) {
        const ext = 8;
        const ux = (dx / len) * ext;
        const uy = (dy / len) * ext;
        cutA = { x: a.x - ux, y: a.y - uy };
        cutB = { x: b.x + ux, y: b.y + uy };
      } else {
        // Full screen beam
        const screenDiag = Math.hypot(this.width, this.height);
        const ux = (dx / len) * screenDiag;
        const uy = (dy / len) * screenDiag;
        cutA = { x: a.x - ux, y: a.y - uy };
        cutB = { x: a.x + ux, y: a.y + uy };
      }

      const cutNormal = { x: -dy / len, y: dx / len };

      let cutOccurred = false;
      const nextPieces = [];
      const newlyCreatedPieces = [];

      // Save state for undo before modifying pieces
      const preSliceSnapshot = this.clonePiecesState();

      for (const piece of this.pieces) {
        const worldPoly = piece.getWorldPoints();
        const splitPolys = Geometry.splitPolygon(worldPoly, cutA, cutB, isSegmentOnly);

        if (splitPolys.length > 1) {
          cutOccurred = true;

          // Emit sparks at intersection points
          const inters = Geometry.findCutIntersections(worldPoly, cutA, cutB, isSegmentOnly);
          for (const inter of inters) {
            this.particleSystem.emitSparks(inter.point.x, inter.point.y, 22, piece.color.stroke);
          }

          // Create new sub-pieces
          for (let i = 0; i < splitPolys.length; i++) {
            const subPoly = splitPolys[i];
            const subPiece = new Physics.Piece(subPoly);

            // Compute signed distance from subpiece centroid to the cut line
            // Points with d > 0 are on the positive side of cutNormal; d < 0 are on the negative side
            const d = (subPiece.centroid.x - cutA.x) * cutNormal.x + (subPiece.centroid.y - cutA.y) * cutNormal.y;
            let sign = d >= 0 ? 1 : -1;
            if (Math.abs(d) < 1e-4) {
              sign = (i % 2 === 0) ? 1 : -1;
            }

            const outDirX = cutNormal.x * sign;
            const outDirY = cutNormal.y * sign;

            // Immediate separation offset so the split shapes do not overlap each other
            // 16px shift each creates a 32px clear gap between the pieces
            const GAP_OFFSET = 16;
            subPiece.x += outDirX * GAP_OFFSET;
            subPiece.y += outDirY * GAP_OFFSET;

            // Smooth outward velocity impulse so they continue moving apart cleanly
            const activePhysicsMode = this.getActivePhysicsMode();
            const impulseSpeed = activePhysicsMode === 'slowFloat' ? this.getRoundFloatSpeed() * (2 / 3) :
              (activePhysicsMode === 'fixed' ? 35 : (activePhysicsMode === 'gravity' ? 65 : 85));
            subPiece.vx = piece.vx * 0.3 + outDirX * impulseSpeed;
            subPiece.vy = piece.vy * 0.3 + outDirY * impulseSpeed;
            subPiece.vAngle = 0; // zero initial angular velocity to prevent tumbling into each other

            nextPieces.push(subPiece);
            newlyCreatedPieces.push(subPiece);
          }
        } else {
          nextPieces.push(piece);
        }
      }

      if (cutOccurred) {
        this.saveHistory(preSliceSnapshot);
        this.pieces = nextPieces;
        this.cutsCount++;
        this.redoStack = [];

        Audio.playSlice(this.pieces.length);
        this.evaluateRound();
        this.updateHUD();
      }
    }

    updateDifficultyTier(roundNumber = this.round) {
      const round = Math.max(1, Math.floor(roundNumber));
      this.shapeDifficultyTier = Math.min(4, 1 + Math.floor((round - 1) / 5));
    }

    getShapeChoicesForCurrentDifficulty() {
      const difficultyMap = Shapes.SHAPE_DIFFICULTY || {};
      const currentTier = this.shapeDifficultyTier || 1;
      const sameTier = Object.keys(difficultyMap).filter(name => difficultyMap[name] === currentTier);
      if (sameTier.length > 0) return sameTier;
      return Object.keys(difficultyMap).filter(name => difficultyMap[name] <= currentTier);
    }

    getActivePhysicsMode() {
      if (this.gameMode === 'percentChallenge' && this.round >= 21) return 'slowFloat';
      return this.physicsMode;
    }

    getRoundFloatSpeed(roundNumber = this.round) {
      const round = Math.max(21, Math.floor(roundNumber));
      const cycleStep = (round - 21) % 5;
      return 18 + cycleStep * 4.5;
    }

    createRoundTargets(roundNumber) {
      const round = Math.max(1, Math.floor(roundNumber));
      const cycleRound = ((round - 1) % 20) + 1;
      const count = 2 + Math.floor((cycleRound - 1) / 5);
      const increment = cycleRound <= 10 ? 10 : 5;
      const units = 100 / increment;
      const boundaries = Array.from({ length: units - 1 }, (_, index) => index + 1);

      for (let index = boundaries.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [boundaries[index], boundaries[swapIndex]] = [boundaries[swapIndex], boundaries[index]];
      }

      const cuts = boundaries.slice(0, count - 1).sort((a, b) => a - b);
      const targets = [];
      let previous = 0;
      for (const cut of [...cuts, units]) {
        targets.push((cut - previous) * increment);
        previous = cut;
      }
      return targets.sort((a, b) => b - a);
    }

    saveHistory(snapshot) {
      this.history.push({
        pieces: snapshot,
        cutsCount: this.cutsCount
      });
      if (this.history.length > 30) {
        this.history.shift();
      }
    }

    clonePiecesState() {
      return this.pieces.map(p => ({
        points: p.getWorldPoints(),
        vx: p.vx,
        vy: p.vy,
        angle: p.angle,
        vAngle: p.vAngle,
        color: p.color
      }));
    }

    restorePiecesState(snapshot) {
      this.pieces = snapshot.map(data => {
        const piece = new Physics.Piece(data.points, data.color);
        piece.vx = data.vx;
        piece.vy = data.vy;
        piece.angle = data.angle;
        piece.vAngle = data.vAngle;
        return piece;
      });
    }

    undo() {
      if (this.history.length === 0) return;
      const currentSnapshot = {
        pieces: this.clonePiecesState(),
        cutsCount: this.cutsCount
      };
      this.redoStack.push(currentSnapshot);

      const prev = this.history.pop();
      this.restorePiecesState(prev.pieces);
      this.cutsCount = prev.cutsCount;

      Audio.playPop();
      this.evaluateRound();
      this.updateHUD();
    }

    redo() {
      if (this.redoStack.length === 0) return;
      const currentSnapshot = {
        pieces: this.clonePiecesState(),
        cutsCount: this.cutsCount
      };
      this.history.push(currentSnapshot);

      const next = this.redoStack.pop();
      this.restorePiecesState(next.pieces);
      this.cutsCount = next.cutsCount;

      Audio.playPop();
      this.evaluateRound();
      this.updateHUD();
    }

    resetShape() {
      this.particleSystem.clear();
      this.history = [];
      this.redoStack = [];
      this.cutsCount = 0;
      this.loadShape(this.selectedShape);
      Audio.playPop();
    }

    loadShape(shapeName) {
      this.selectedShape = shapeName;
      this.history = [];
      this.redoStack = [];
      this.cutsCount = 0;

      const cx = this.width / 2;
      const cy = this.height / 2;
      const minDim = Math.min(this.width, this.height);
      const radius = minDim * 0.32;

      let poly = [];

      switch (shapeName) {
        case 'star':
          poly = Shapes.createStar(cx, cy, radius, radius * 0.44, 5);
          break;
        case 'fish':
          poly = Shapes.createFish(cx, cy, radius * 2.2, radius * 1.3);
          break;
        case 'heart':
          poly = Shapes.createHeart(cx, cy, radius * 1.8);
          break;
        case 'lightning':
          poly = Shapes.createLightningBolt(cx, cy, radius * 1.6, radius * 2.1);
          break;
        case 'moon':
          poly = Shapes.createCrescentMoon(cx, cy, radius * 1.1);
          break;
        case 'ghost':
          poly = Shapes.createGhost(cx, cy, radius * 1.6, radius * 2.0);
          break;
        case 'crown':
          poly = Shapes.createCrown(cx, cy, radius * 2.0, radius * 1.6);
          break;
        case 'diamond':
          poly = Shapes.createDiamond(cx, cy, radius * 1.6, radius * 2.1);
          break;
        case 'ufo':
          poly = Shapes.createUFO(cx, cy, radius * 2.2, radius * 1.4);
          break;
        case 'mushroom':
          poly = Shapes.createMushroom(cx, cy, radius * 2.0, radius * 1.8);
          break;
        case 'shield':
          poly = Shapes.createShield(cx, cy, radius * 1.5, radius * 1.9);
          break;
        case 'sword':
          poly = Shapes.createSword(cx, cy, radius * 1.8, radius * 2.2);
          break;
        case 'cloud':
          poly = Shapes.createCloud(cx, cy, radius * 2.1, radius * 1.5);
          break;
        case 'gear':
          poly = Shapes.createGear(cx, cy, radius, radius * 0.72, 8);
          break;
        case 'house':
          poly = Shapes.createHouse(cx, cy, radius * 1.8, radius * 2.0);
          break;
        case 'hexagon':
          poly = Shapes.createRegularPolygon(cx, cy, radius, 6);
          break;
        case 'octagon':
          poly = Shapes.createRegularPolygon(cx, cy, radius, 8);
          break;
        case 'triangle':
          poly = Shapes.createRegularPolygon(cx, cy, radius * 1.1, 3);
          break;
        case 'cross':
          poly = Shapes.createCross(cx, cy, radius * 1.8, radius * 0.6);
          break;
        case 'arrow':
          poly = Shapes.createArrow(cx, cy, radius * 1.7, radius * 1.9);
          break;
        case 'blob':
          poly = Shapes.createBlob(cx, cy, radius * 2.1, radius * 1.7);
          break;
        case 'droplet':
          poly = Shapes.createDroplet(cx, cy, radius * 1.7, radius * 2.2);
          break;
        case 'leaf':
          poly = Shapes.createLeaf(cx, cy, radius * 1.8, radius * 2.4);
          break;
        case 'flower':
          poly = Shapes.createFlower(cx, cy, radius * 1.9, radius * 1.9);
          break;
        case 'pill':
          poly = Shapes.createPill(cx, cy, radius * 2.1, radius * 1.4);
          break;
        case 'peanut':
          poly = Shapes.createPeanut(cx, cy, radius * 2.0, radius * 1.4);
          break;
        case 'ribbon':
          poly = Shapes.createRibbon(cx, cy, radius * 2.2, radius * 1.7);
          break;
        case 'spiral':
          poly = Shapes.createSpiral(cx, cy, radius * 1.8, radius * 1.8);
          break;
        case 'sunburst':
          poly = Shapes.createSunburst(cx, cy, radius * 2.0, radius * 2.0);
          break;
        case 'hexStar':
          poly = Shapes.createHexStar(cx, cy, radius);
          break;
        case 'hardWisp':
          poly = Shapes.createHardWisp(cx, cy, radius * 2.2, radius * 1.8);
          break;
        case 'hardTalon':
          poly = Shapes.createHardTalon(cx, cy, radius * 2.0, radius * 2.2);
          break;
        case 'hardDrift':
          poly = Shapes.createHardDrift(cx, cy, radius * 2.1, radius * 1.9);
          break;
        case 'hardRift':
          poly = Shapes.createHardRift(cx, cy, radius * 2.0, radius * 2.0);
          break;
        case 'hardLobe':
          poly = Shapes.createHardLobe(cx, cy, radius * 2.2, radius * 1.8);
          break;
        case 'hardTear':
          poly = Shapes.createHardTear(cx, cy, radius * 2.0, radius * 2.1);
          break;
        case 'hardSaw':
          poly = Shapes.createHardSaw(cx, cy, radius * 2.1, radius * 1.9);
          break;
        case 'hardFang':
          poly = Shapes.createHardFang(cx, cy, radius * 1.9, radius * 2.1);
          break;
        case 'hardHook':
          poly = Shapes.createHardHook(cx, cy, radius * 2.1, radius * 1.8);
          break;
        case 'hardGash':
          poly = Shapes.createHardGash(cx, cy, radius * 2.1, radius * 1.9);
          break;
        case 'hardCurl':
          poly = Shapes.createHardCurl(cx, cy, radius * 2.0, radius * 2.1);
          break;
        case 'hardScallop':
          poly = Shapes.createHardScallop(cx, cy, radius * 2.0, radius * 1.8);
          break;
        case 'hardRook':
          poly = Shapes.createHardRook(cx, cy, radius * 2.1, radius * 1.8);
          break;
        case 'hardDart':
          poly = Shapes.createHardDart(cx, cy, radius * 2.0, radius * 2.0);
          break;
        case 'hardSkew':
          poly = Shapes.createHardSkew(cx, cy, radius * 2.1, radius * 1.8);
          break;
        case 'randomHard':
          poly = Shapes.createRandomHardPolygon(cx, cy, radius * 2.1, radius * 1.9);
          break;
        case 'irregular':
          poly = Shapes.createRandomPolygon(cx, cy, radius, 8, 0.65);
          break;
        default:
          poly = Shapes.createStar(cx, cy, radius, radius * 0.44, 5);
      }

      if (this.gameMode === 'percentChallenge' && this.round >= 21) {
        const clearance = Math.min(32, Math.max(0, Math.min(this.width - 40, this.height - 270) * 0.1));
        const safeLeft = 20 + clearance;
        const safeRight = this.width - 20 - clearance;
        const safeTop = 140 + clearance;
        const safeBottom = this.height - 130 - clearance;
        const safeCenterX = (safeLeft + safeRight) / 2;
        const safeCenterY = (safeTop + safeBottom) / 2;
        const centroid = Geometry.polygonCentroid(poly);
        const radius = Math.max(...poly.map(point => Math.hypot(point.x - centroid.x, point.y - centroid.y)));
        const fitScale = Math.min(1, Math.max(0, Math.min(safeRight - safeLeft, safeBottom - safeTop) - 12) / (radius * 2));

        poly = poly.map(point => ({
          x: safeCenterX + (point.x - centroid.x) * fitScale,
          y: safeCenterY + (point.y - centroid.y) * fitScale
        }));
      }

      this.pieces = [new Physics.Piece(poly)];
      this.initialArea = this.pieces[0].area;
      this.updateHUD();
      this.split50Score = null;
    }

    // Custom Draw Mode
    startCustomDraw() {
      this.gameMode = 'customDraw';
      this.customPoints = [];
      this.pieces = [];
      this.cutsCount = 0;
      this.updateHUD();
    }

    addCustomPoint(pt) {
      if (this.customPoints.length > 2) {
        const first = this.customPoints[0];
        if (Math.hypot(pt.x - first.x, pt.y - first.y) < 24) {
          this.finishCustomDraw();
          return;
        }
      }
      this.customPoints.push(pt);
      Audio.playPop();
    }

    finishCustomDraw() {
      if (this.customPoints.length < 3) return;
      const poly = Geometry.cleanPolygon(Geometry.ensureCCW(this.customPoints), 4);
      this.pieces = [new Physics.Piece(poly)];
      this.initialArea = this.pieces[0].area;
      this.customPoints = [];
      this.gameMode = 'sandbox';
      this.updateHUD();
      Audio.playSuccess();
    }

    clearCustomDraw() {
      this.customPoints = [];
    }

          // Target Percentages Round Challenge Logic
          generateRound(roundNumber) {
            this.hideChallengeToast();
            this.round = roundNumber;

            this.updateDifficultyTier(roundNumber);
            const shapePool = this.getShapeChoicesForCurrentDifficulty();
            this.selectedShape = shapePool[Math.floor(Math.random() * shapePool.length)] || 'star';
            this.roundTargetPercentages = this.createRoundTargets(roundNumber);
            this.roundStatus = 'in_progress';
            this.roundAccuracy = 0;
            this.roundScoreEarned = 0;

            if (this.autoAdvanceTimer) {
              clearTimeout(this.autoAdvanceTimer);
              this.autoAdvanceTimer = null;
            }

            this.loadShape(this.selectedShape);
            if (roundNumber >= 21) {
              const floatSpeed = this.getRoundFloatSpeed(roundNumber);
              for (const piece of this.pieces) {
                const angle = Math.random() * Math.PI * 2;
                const speed = floatSpeed;
                piece.vx = Math.cos(angle) * speed;
                piece.vy = Math.sin(angle) * speed;
                piece.vAngle = (Math.random() - 0.5) * 0.12;
              }
            }
            this.updateHUD();
          }

          nextRound() {
            if (this.autoAdvanceTimer) {
              clearTimeout(this.autoAdvanceTimer);
              this.autoAdvanceTimer = null;
            }
            this.hideChallengeToast();
            this.round++;
            this.generateRound(this.round);
            Audio.playPop();
          }

          retryRound() {
            if (this.autoAdvanceTimer) {
              clearTimeout(this.autoAdvanceTimer);
              this.autoAdvanceTimer = null;
            }
            this.hideChallengeToast();
            this.roundStatus = 'in_progress';
            this.roundAccuracy = 0;
            this.roundScoreEarned = 0;
            this.resetShape();
            this.updateHUD();
          }

          evaluateRound() {
            if (this.gameMode !== 'percentChallenge') return;

            const k = this.roundTargetPercentages.length;
            const m = this.pieces.length;

            const totalArea = this.pieces.reduce((sum, p) => sum + p.area, 0);
            const userPcts = this.pieces
              .map(p => Number(((p.area / totalArea) * 100).toFixed(1)))
              .sort((a, b) => b - a);

            // Oversliced check: if pieces > commanded percentages, receive 0 points!
            if (m > k) {
              this.roundStatus = 'failed_oversliced';
              this.roundScoreEarned = 0;
              Audio.playFail();
              this.showChallengeToast(`❌ OVER-SLICED! ${m} pieces > target ${k}. 0 points! Press Undo (Ctrl+Z) or Retry.`);
              return;
            }

            if (m === k) {
              let totalDeviation = 0;
              for (let i = 0; i < k; i++) {
                totalDeviation += Math.abs(userPcts[i] - this.roundTargetPercentages[i]);
              }

              const accuracy = Math.max(0, 100 - totalDeviation);
              this.roundAccuracy = accuracy;

              if (accuracy >= 80) {
                this.roundStatus = 'passed';
                let stars = 1;
                if (accuracy >= 94) stars = 3;
                else if (accuracy >= 87) stars = 2;

                const points = Math.round(1000 + accuracy * 10 + this.round * 100);
                this.roundScoreEarned = points;
                this.totalScore += points;
                this.updateDifficultyTier(this.round);

                Audio.playSuccess();
                this.particleSystem.emitConfetti(this.width / 2, this.height * 0.35, stars * 35);
                this.showChallengeToast(`🎉 ROUND ${this.round} CLEARED! Accuracy: ${accuracy.toFixed(1)}% (+${points} pts) ⭐x${stars}`);

                if (this.autoAdvanceTimer) clearTimeout(this.autoAdvanceTimer);
                this.autoAdvanceTimer = setTimeout(() => {
                  if (this.roundStatus === 'passed' && this.gameMode === 'percentChallenge') {
                    this.nextRound();
                  }
                }, 3200);
              } else {
                this.roundStatus = 'failed_accuracy';
                this.roundScoreEarned = 0;
                Audio.playFail();
                this.showChallengeToast(`Accuracy ${accuracy.toFixed(1)}% is below 80%. Press Undo to try again!`);
              }
            } else {
              this.roundStatus = 'in_progress';
            }
          }

          hideChallengeToast() {
            if (this.ui.toast) {
              clearTimeout(this.toastTimer);
              this.toastTimer = null;
              this.ui.toast.classList.remove('visible');
            }
          }

          showChallengeToast(message) {
            if (this.ui.toast) {
              this.ui.toast.textContent = message;
              this.ui.toast.classList.add('visible');
              clearTimeout(this.toastTimer);
              this.toastTimer = setTimeout(() => {
                this.ui.toast.classList.remove('visible');
              }, 4000);
            }
          }

          updateHUD() {
            if (this.ui.pieceCount) {
              this.ui.pieceCount.textContent = this.pieces.length;
            }
            if (this.ui.cutCount) {
              this.ui.cutCount.textContent = this.cutsCount;
            }
            if (this.ui.undoBtn) {
              this.ui.undoBtn.disabled = this.history.length === 0;
            }
            if (this.ui.redoBtn) {
              this.ui.redoBtn.disabled = this.redoStack.length === 0;
            }

            if (this.ui.shapeSelect) {
              this.ui.shapeSelect.value = this.selectedShape;
            }

            // Percent Challenge Round Bar
            if (this.gameMode === 'percentChallenge') {
              if (this.ui.roundBar) this.ui.roundBar.style.display = 'flex';
              if (this.ui.roundBadge) this.ui.roundBadge.textContent = `Round ${this.round}`;
              if (this.ui.totalScore) this.ui.totalScore.textContent = this.totalScore.toLocaleString();

              if (this.ui.targetChips) {
                this.ui.targetChips.innerHTML = this.roundTargetPercentages
                  .map(t => `<span class="chip target">🎯 ${t}%</span>`)
                  .join('');
              }

              const totalArea = this.pieces.reduce((sum, p) => sum + p.area, 0);
              const userPcts = this.pieces
                .map(p => Number(((p.area / totalArea) * 100).toFixed(1)))
                .sort((a, b) => b - a);

              if (this.ui.currentChips) {
                this.ui.currentChips.innerHTML = userPcts.map((pct, idx) => {
                  let matchClass = 'piece';
                  if (idx < this.roundTargetPercentages.length) {
                    const diff = Math.abs(pct - this.roundTargetPercentages[idx]);
                    if (diff <= 3.0) matchClass += ' match-good';
                    else if (diff <= 8.0) matchClass += ' match-warn';
                  }
                  return `<span class="chip ${matchClass}">${pct}%</span>`;
                }).join('');
              }

              const k = this.roundTargetPercentages.length;
              const m = this.pieces.length;
              if (this.ui.roundStatusBox && this.ui.roundStatusText) {
                this.ui.roundStatusBox.className = 'round-status-box';

                if (this.roundStatus === 'passed') {
                  this.ui.roundStatusBox.classList.add('passed');
                  this.ui.roundStatusText.innerHTML = `🎉 <strong>CLEARED!</strong> Accuracy: ${this.roundAccuracy.toFixed(1)}% (+${this.roundScoreEarned} pts)`;
                } else if (this.roundStatus === 'failed_oversliced') {
                  this.ui.roundStatusBox.classList.add('oversliced');
                  this.ui.roundStatusText.innerHTML = `❌ <strong>OVER-SLICED!</strong> (${m} pieces > target ${k}). 0 points! Press Undo or Retry.`;
                } else if (this.roundStatus === 'failed_accuracy') {
                  this.ui.roundStatusBox.classList.add('oversliced');
                  this.ui.roundStatusText.innerHTML = `⚠️ <strong>ACCURACY LOW (${this.roundAccuracy.toFixed(1)}%)</strong>. Press Undo to try again.`;
                } else {
                  if (m === 1) {
                    this.ui.roundStatusText.textContent = `Slice shape into ${k} pieces matching the targets!`;
                  } else {
                    this.ui.roundStatusText.textContent = `Pieces: ${m} / ${k}. ${k - m > 0 ? `Need ${k - m} more piece(s)` : ''}`;
                  }
                }
              }

              if (this.ui.nextRoundBtn) {
                this.ui.nextRoundBtn.style.display = (this.roundStatus === 'passed') ? 'inline-flex' : 'none';
              }
            } else {
              if (this.ui.roundBar) this.ui.roundBar.style.display = 'none';
            }

            // Smallest & Largest pieces
            if (this.pieces.length > 0 && this.ui.statsDetail) {
              const totalArea = this.pieces.reduce((sum, p) => sum + p.area, 0);
              let minArea = Infinity, maxArea = -Infinity;
              for (const p of this.pieces) {
                if (p.area < minArea) minArea = p.area;
                if (p.area > maxArea) maxArea = p.area;
              }
              const minPct = ((minArea / totalArea) * 100).toFixed(1);
              const maxPct = ((maxArea / totalArea) * 100).toFixed(1);
              this.ui.statsDetail.textContent = `Min: ${minPct}% | Max: ${maxPct}%`;
            }
          }

          setPhysicsMode(mode) {
            this.physicsMode = mode;
            // In fixed mode, reset velocities
            if (mode === 'fixed') {
              for (const p of this.pieces) {
                p.vx = 0;
                p.vy = 0;
                p.vAngle = 0;
              }
            }
          }

          setCutStyle(style) {
            this.cutStyle = style;
          }

          setBeamMode(mode) {
            this.beamMode = mode;
          }

          setGameMode(mode) {
            this.gameMode = mode;
            if (mode === 'customDraw') {
              this.startCustomDraw();
            } else if (mode === 'percentChallenge') {
              this.generateRound(this.round);
            } else {
              this.resetShape();
            }
            this.updateHUD();
          }

          toggleSound() {
            const isMuted = Audio.toggleMute();
            if (this.ui.muteBtn) {
              this.ui.muteBtn.innerHTML = isMuted ? '🔇 Muted' : '🔊 Sound';
              this.ui.muteBtn.classList.toggle('muted', isMuted);
            }
            return isMuted;
          }

          // Animation & Render Loop
          animate(timestamp) {
            const dt = Math.min(0.05, (timestamp - this.lastTime) / 1000);
            this.lastTime = timestamp;

            this.update(dt);
            this.render();

            this.rafId = requestAnimationFrame(this.animate);
          }

          update(dt) {
            const bounds = {
              width: this.width,
              height: this.height,
              top: 120,
              bottom: 110
            };
            const activePhysicsMode = this.getActivePhysicsMode();
            const slowFloatSpeed = this.getRoundFloatSpeed();
            for (const p of this.pieces) {
              p.update(dt, activePhysicsMode, bounds, slowFloatSpeed);
            }
            Physics.resolvePieceCollisions(this.pieces, activePhysicsMode);
            this.particleSystem.update(dt);
          }

          render() {
            const ctx = this.ctx;
            ctx.clearRect(0, 0, this.width, this.height);

            // 1. Draw subtle background grid
            this.drawBackgroundGrid(ctx);

            // 2. Draw all pieces
            for (const piece of this.pieces) {
              this.drawPiece(ctx, piece);
            }

            // 3. Draw particles
            this.particleSystem.draw(ctx);

            // 4. Draw Custom Draw guide lines if in custom draw mode
            if (this.gameMode === 'customDraw') {
              this.drawCustomDrawPreview(ctx);
            }

            // 5. Draw Laser Slicing Line Preview if dragging
            if (this.isDragging && this.dragStart && this.dragCurrent) {
              this.drawLaserBeam(ctx, this.dragStart, this.dragCurrent);
            }
          }

          drawBackgroundGrid(ctx) {
            const gridSize = 40;
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
            ctx.lineWidth = 1;

            for (let x = 0; x < this.width; x += gridSize) {
              ctx.beginPath();
              ctx.moveTo(x, 0);
              ctx.lineTo(x, this.height);
              ctx.stroke();
            }
            for (let y = 0; y < this.height; y += gridSize) {
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.lineTo(this.width, y);
              ctx.stroke();
            }

            // Center crosshair / origin mark
            const cx = this.width / 2;
            const cy = this.height / 2;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
            ctx.beginPath();
            ctx.arc(cx, cy, 3, 0, Math.PI * 2);
            ctx.stroke();

            ctx.restore();
          }

          drawPiece(ctx, piece) {
            const pts = piece.getWorldPoints();
            if (pts.length < 3) return;

            ctx.save();

            // Path
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
              ctx.lineTo(pts[i].x, pts[i].y);
            }
            ctx.closePath();

            // Shadow & Fill
            if (piece.hovered) {
              ctx.shadowColor = piece.color.glow;
              ctx.shadowBlur = 18;
            } else {
              ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
              ctx.shadowBlur = 8;
              ctx.shadowOffsetY = 4;
            }

            // Piece fill with gradient
            const bounds = Geometry.polygonBounds(pts);
            const grad = ctx.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
            grad.addColorStop(0, piece.color.fill);
            grad.addColorStop(1, piece.color.stroke);
            ctx.fillStyle = grad;
            ctx.fill();

            // Stroke
            ctx.shadowBlur = piece.hovered ? 12 : 2;
            ctx.shadowColor = piece.color.stroke;
            ctx.strokeStyle = piece.hovered ? '#ffffff' : piece.color.stroke;
            ctx.lineWidth = piece.hovered ? 3 : 2;
            ctx.lineJoin = 'round';
            ctx.stroke();

            // Piece area percentage label (only if piece is large enough)
            const totalArea = this.pieces.reduce((s, p) => s + p.area, 0);
            const pct = (piece.area / totalArea) * 100;
            if (bounds.width > 36 && bounds.height > 24) {
              const center = piece.centroid;
              // World coordinates of centroid
              const cos = Math.cos(piece.angle);
              const sin = Math.sin(piece.angle);
              const wx = piece.x;
              const wy = piece.y;

              ctx.fillStyle = '#ffffff';
              ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
              ctx.shadowBlur = 4;
              ctx.font = '600 11px system-ui, -apple-system, sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(`${pct.toFixed(1)}%`, wx, wy);
            }

            ctx.restore();
          }

          drawLaserBeam(ctx, start, end) {
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const len = Math.hypot(dx, dy);
            if (len < 2) return;

            const isSegmentOnly = (this.beamMode === 'segment');
            let p1 = start;
            let p2 = end;

            if (!isSegmentOnly) {
              const screenDiag = Math.hypot(this.width, this.height);
              const ux = (dx / len) * screenDiag;
              const uy = (dy / len) * screenDiag;
              p1 = { x: start.x - ux, y: start.y - uy };
              p2 = { x: start.x + ux, y: start.y + uy };
            }

            ctx.save();

            // 1. Wide outer neon glow
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = '#00f0ff';
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 18;
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.stroke();

            // 2. Crisp inner white core
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = '#ffffff';
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 6;
            ctx.lineWidth = 2;
            ctx.stroke();

            // 3. Start & End points / Crosshair grips
            ctx.fillStyle = '#00f0ff';
            ctx.beginPath();
            ctx.arc(start.x, start.y, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(end.x, end.y, 5, 0, Math.PI * 2);
            ctx.fill();

            // 4. Highlight intersection points with any pieces
            for (const piece of this.pieces) {
              const worldPoly = piece.getWorldPoints();
              const inters = Geometry.findCutIntersections(worldPoly, p1, p2, isSegmentOnly);
              for (const inter of inters) {
                ctx.beginPath();
                ctx.arc(inter.point.x, inter.point.y, 6, 0, Math.PI * 2);
                ctx.fillStyle = '#ff0055';
                ctx.shadowColor = '#ff0055';
                ctx.shadowBlur = 14;
                ctx.fill();

                ctx.beginPath();
                ctx.arc(inter.point.x, inter.point.y, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
              }
            }

            ctx.restore();
          }

          drawCustomDrawPreview(ctx) {
            if (this.customPoints.length === 0) return;

            ctx.save();
            ctx.strokeStyle = '#06d6a0';
            ctx.fillStyle = 'rgba(6, 214, 160, 0.2)';
            ctx.lineWidth = 2;
            ctx.shadowColor = '#06d6a0';
            ctx.shadowBlur = 8;

            ctx.beginPath();
            ctx.moveTo(this.customPoints[0].x, this.customPoints[0].y);
            for (let i = 1; i < this.customPoints.length; i++) {
              ctx.lineTo(this.customPoints[i].x, this.customPoints[i].y);
            }
            ctx.stroke();

            // Draw point handles
            for (let i = 0; i < this.customPoints.length; i++) {
              const pt = this.customPoints[i];
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, i === 0 ? 7 : 4, 0, Math.PI * 2);
              ctx.fillStyle = i === 0 ? '#ffb703' : '#ffffff';
              ctx.fill();
              ctx.stroke();
            }

            ctx.restore();
          }
        }

        return {
          GameApp
        };
      });

