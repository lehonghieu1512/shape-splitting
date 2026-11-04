/**
 * PolySlice Physics & Particle Engine
 * Handles piece kinematics, separation impulses, gravity, collisions, and spark effects.
 */

(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory(require('./geometry.js'));
  } else if (typeof define === 'function' && define.amd) {
    define(['./geometry.js'], factory);
  } else {
    root.PolySlice = root.PolySlice || {};
    root.PolySlice.Physics = factory(root.PolySlice.Geometry);
  }
})(typeof self !== 'undefined' ? self : this, function (Geometry) {
  'use strict';

  // Palette of glowing vibrant colors for cut pieces
  const COLOR_PALETTE = [
    { fill: '#ff4d6d', stroke: '#ff758f', glow: 'rgba(255, 77, 109, 0.4)' },
    { fill: '#00b4d8', stroke: '#90e0ef', glow: 'rgba(0, 180, 216, 0.4)' },
    { fill: '#7209b7', stroke: '#b5179e', glow: 'rgba(114, 9, 183, 0.4)' },
    { fill: '#06d6a0', stroke: '#70e000', glow: 'rgba(6, 214, 160, 0.4)' },
    { fill: '#ffb703', stroke: '#fb8500', glow: 'rgba(255, 183, 3, 0.4)' },
    { fill: '#4cc9f0', stroke: '#4895ef', glow: 'rgba(76, 201, 240, 0.4)' },
    { fill: '#f72585', stroke: '#b5179e', glow: 'rgba(247, 37, 133, 0.4)' },
    { fill: '#10b981', stroke: '#34d399', glow: 'rgba(16, 185, 129, 0.4)' },
    { fill: '#8b5cf6', stroke: '#a78bfa', glow: 'rgba(139, 92, 246, 0.4)' },
    { fill: '#f59e0b', stroke: '#fbbf24', glow: 'rgba(245, 158, 11, 0.4)' },
    { fill: '#ec4899', stroke: '#f472b6', glow: 'rgba(236, 72, 153, 0.4)' },
    { fill: '#06b6d4', stroke: '#22d3ee', glow: 'rgba(6, 182, 212, 0.4)' }
  ];

  let nextPieceId = 1;

  class Piece {
    constructor(points, color = null) {
      this.id = nextPieceId++;
      this.points = Geometry.cleanPolygon(Geometry.ensureCCW(points), 1);
      this.area = Geometry.polygonArea(this.points);
      this.centroid = Geometry.polygonCentroid(this.points);

      // Shift points relative to centroid for smooth rotation/translation physics
      this.x = this.centroid.x;
      this.y = this.centroid.y;
      this.localPoints = this.points.map(p => ({
        x: p.x - this.x,
        y: p.y - this.y
      }));

      // Bounding radius for collision and anti-overlap detection
      this.radius = 0;
      for (const p of this.localPoints) {
        const d = Math.hypot(p.x, p.y);
        if (d > this.radius) this.radius = d;
      }

      this.vx = 0;
      this.vy = 0;
      this.angle = 0;
      this.vAngle = 0;

      // Color
      if (color) {
        this.color = color;
      } else {
        const c = COLOR_PALETTE[(this.id - 1) % COLOR_PALETTE.length];
        this.color = c;
      }

      this.isGrabbed = false;
      this.hovered = false;
    }

    /**
     * Returns the global world coordinates of all vertices.
     */
    getWorldPoints() {
      const cos = Math.cos(this.angle);
      const sin = Math.sin(this.angle);
      return this.localPoints.map(p => ({
        x: this.x + (p.x * cos - p.y * sin),
        y: this.y + (p.x * sin + p.y * cos)
      }));
    }

    applyImpulse(fx, fy, torque = 0) {
      this.vx += fx;
      this.vy += fy;
      this.vAngle += torque;
    }

    update(dt, mode, bounds) {
      if (this.isGrabbed) return;

      if (mode === 'gravity') {
        const GRAVITY = 520;
        this.vy += GRAVITY * dt;

        // Damping
        this.vx *= 0.992;
        this.vAngle *= 0.985;
      } else if (mode === 'float') {
        // Space drift
        this.vx *= 0.965;
        this.vy *= 0.965;
        this.vAngle *= 0.95;
      } else if (mode === 'slowFloat') {
        const targetSpeed = 36;
        const speed = Math.hypot(this.vx, this.vy);
        const nextSpeed = Math.min(targetSpeed, speed + 18 * dt);
        if (speed > 1e-6) {
          this.vx = (this.vx / speed) * nextSpeed;
          this.vy = (this.vy / speed) * nextSpeed;
        } else {
          const angle = Math.random() * Math.PI * 2;
          this.vx = Math.cos(angle) * nextSpeed;
          this.vy = Math.sin(angle) * nextSpeed;
        }
        this.vAngle *= 0.998;
      } else if (mode === 'fixed') {
        // Slight separation damp to zero quickly
        this.vx *= 0.88;
        this.vy *= 0.88;
        this.vAngle = 0;
      }

      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.angle += this.vAngle * dt;

      // Bounce off viewport boundaries while reserving the top HUD and bottom tray areas.
      if (bounds) {
        const margin = 20;
        const topSafeMargin = bounds.top || 120;
        const bottomSafeMargin = bounds.bottom || 120;
        const b = Geometry.polygonBounds(this.getWorldPoints());

        if (b.minX < margin) {
          this.x += margin - b.minX;
          this.vx = Math.abs(this.vx) * (mode === 'gravity' ? 0.6 : mode === 'slowFloat' ? 1 : 0.8);
        } else if (b.maxX > bounds.width - margin) {
          this.x -= b.maxX - (bounds.width - margin);
          this.vx = -Math.abs(this.vx) * (mode === 'gravity' ? 0.6 : mode === 'slowFloat' ? 1 : 0.8);
        }

        if (b.minY < topSafeMargin + margin) {
          this.y += topSafeMargin + margin - b.minY;
          this.vy = Math.abs(this.vy) * (mode === 'gravity' ? 0.6 : mode === 'slowFloat' ? 1 : 0.8);
        } else if (b.maxY > bounds.height - bottomSafeMargin - margin) {
          this.y -= b.maxY - (bounds.height - bottomSafeMargin - margin);
          this.vy = -Math.abs(this.vy) * (mode === 'gravity' ? 0.45 : mode === 'slowFloat' ? 1 : 0.8);
          if (mode === 'gravity' && Math.abs(this.vy) < 30) {
            this.vy = 0;
          }
        }
      }
    }
  }

  class Particle {
    constructor(x, y, vx, vy, color, size, life) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.color = color;
      this.size = size;
      this.maxLife = life;
      this.life = life;
    }

    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vx *= 0.94;
      this.vy *= 0.94;
      this.life -= dt;
    }

    draw(ctx) {
      if (this.life <= 0) return;
      const alpha = Math.max(0, this.life / this.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  class ParticleSystem {
    constructor() {
      this.particles = [];
    }

    emitSparks(x, y, count = 16, color = '#ffffff') {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 260;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        const size = 1.5 + Math.random() * 3.5;
        const life = 0.25 + Math.random() * 0.45;
        this.particles.push(new Particle(x, y, vx, vy, color, size, life));
      }
    }

    emitConfetti(x, y, count = 60) {
      const colors = ['#f72585', '#7209b7', '#4cc9f0', '#06d6a0', '#ffb703', '#ffffff'];
      for (let i = 0; i < count; i++) {
        const angle = (Math.random() - 0.5) * Math.PI - Math.PI / 2;
        const speed = 150 + Math.random() * 350;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = 3 + Math.random() * 4;
        const life = 1.0 + Math.random() * 1.0;
        this.particles.push(new Particle(x, y, vx, vy, color, size, life));
      }
    }

    update(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.update(dt);
        if (p.life <= 0) {
          this.particles.splice(i, 1);
        }
      }
    }

    draw(ctx) {
      for (const p of this.particles) {
        p.draw(ctx);
      }
    }

    clear() {
      this.particles = [];
    }
  }

  function segmentsIntersect(p1, p2, p3, p4) {
    const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (Math.abs(d) < 1e-9) return false;
    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
    const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / d;
    return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999;
  }

  function checkPolygonsOverlap(polyA, polyB) {
    if (!polyA || !polyB || polyA.length < 3 || polyB.length < 3) return false;

    // Fast AABB check first
    const bA = Geometry.polygonBounds(polyA);
    const bB = Geometry.polygonBounds(polyB);
    if (bA.maxX < bB.minX || bA.minX > bB.maxX || bA.maxY < bB.minY || bA.minY > bB.maxY) {
      return false;
    }

    // Edge intersection check
    const lenA = polyA.length;
    const lenB = polyB.length;
    for (let i = 0; i < lenA; i++) {
      const a1 = polyA[i];
      const a2 = polyA[(i + 1) % lenA];
      for (let j = 0; j < lenB; j++) {
        const b1 = polyB[j];
        const b2 = polyB[(j + 1) % lenB];
        if (segmentsIntersect(a1, a2, b1, b2)) {
          return true;
        }
      }
    }

    // Point in polygon check (one entirely inside the other)
    if (Geometry.pointInPolygon(polyA[0], polyB) || Geometry.pointInPolygon(polyB[0], polyA)) {
      return true;
    }

    return false;
  }

  /**
   * Resolves overlaps between all pairs of pieces so they never intersect.
   */
  function resolvePieceCollisions(pieces, mode) {
    const n = pieces.length;
    if (n < 2) return;

    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < n; i++) {
        const pA = pieces[i];
        for (let j = i + 1; j < n; j++) {
          const pB = pieces[j];

          const dx = pB.x - pA.x;
          const dy = pB.y - pA.y;
          const dist = Math.hypot(dx, dy);

          // Bounding circle reject
          if (dist >= (pA.radius + pB.radius)) continue;

          const polyA = pA.getWorldPoints();
          const polyB = pB.getWorldPoints();

          if (checkPolygonsOverlap(polyA, polyB)) {
            if (mode === 'slowFloat') {
              const boundsA = Geometry.polygonBounds(polyA);
              const boundsB = Geometry.polygonBounds(polyB);
              const overlapX = Math.min(boundsA.maxX, boundsB.maxX) - Math.max(boundsA.minX, boundsB.minX);
              const overlapY = Math.min(boundsA.maxY, boundsB.maxY) - Math.max(boundsA.minY, boundsB.minY);
              const separationX = overlapX <= overlapY ? (dx >= 0 ? 1 : -1) : 0;
              const separationY = overlapX <= overlapY ? 0 : (dy >= 0 ? 1 : -1);
              const centerDistance = Math.hypot(dx, dy);
              const normalX = centerDistance > 1e-4 ? dx / centerDistance : separationX;
              const normalY = centerDistance > 1e-4 ? dy / centerDistance : separationY;
              const inverseMassA = pA.isGrabbed ? 0 : 1;
              const inverseMassB = pB.isGrabbed ? 0 : 1;
              const inverseMassTotal = inverseMassA + inverseMassB;

              if (inverseMassTotal > 0) {
                const separation = Math.min(1.5, Math.max(0.1, Math.min(overlapX, overlapY) + 1));
                pA.x -= separationX * separation * inverseMassA / inverseMassTotal;
                pA.y -= separationY * separation * inverseMassA / inverseMassTotal;
                pB.x += separationX * separation * inverseMassB / inverseMassTotal;
                pB.y += separationY * separation * inverseMassB / inverseMassTotal;

                const relativeNormalSpeed = (pB.vx - pA.vx) * normalX + (pB.vy - pA.vy) * normalY;
                if (relativeNormalSpeed < 0) {
                  const restitution = 1;
                  const impulse = -(1 + restitution) * relativeNormalSpeed / inverseMassTotal;
                  pA.vx -= impulse * inverseMassA * normalX;
                  pA.vy -= impulse * inverseMassA * normalY;
                  pB.vx += impulse * inverseMassB * normalX;
                  pB.vy += impulse * inverseMassB * normalY;
                }
              }
              continue;
            }

            const nx = dist > 1e-4 ? dx / dist : (Math.random() - 0.5);
            const ny = dist > 1e-4 ? dy / dist : (Math.random() - 0.5);
            const len = Math.hypot(nx, ny) || 1;
            const unx = nx / len;
            const uny = ny / len;

            const pushDist = 0.1;
            if (!pA.isGrabbed) {
              pA.x -= unx * pushDist;
              pA.y -= uny * pushDist;
              pA.vx -= unx * 10;
              pA.vy -= uny * 10;
            }
            if (!pB.isGrabbed) {
              pB.x += unx * pushDist;
              pB.y += uny * pushDist;
              pB.vx += unx * 10;
              pB.vy += uny * 10;
            }
          }
        }
      }
    }
  }

  return {
    Piece: Piece,
    ParticleSystem: ParticleSystem,
    COLOR_PALETTE: COLOR_PALETTE,
    checkPolygonsOverlap: checkPolygonsOverlap,
    resolvePieceCollisions: resolvePieceCollisions
  };
});

