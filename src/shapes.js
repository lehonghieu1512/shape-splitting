/**
 * PolySlice Shape Presets & Generators
 * Generates various convex, concave, and procedural 2D shapes.
 */

(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory(require('./geometry.js'));
  } else if (typeof define === 'function' && define.amd) {
    define(['./geometry.js'], factory);
  } else {
    root.PolySlice = root.PolySlice || {};
    root.PolySlice.Shapes = factory(root.PolySlice.Geometry);
  }
})(typeof self !== 'undefined' ? self : this, function (Geometry) {
  'use strict';

  const SHAPE_DIFFICULTY = Object.freeze({
    star: 1,
    fish: 1,
    heart: 1,
    diamond: 1,
    lightning: 1,
    moon: 2,
    ghost: 2,
    crown: 2,
    shield: 2,
    arrow: 2,
    cross: 2,
    ufo: 2,
    mushroom: 2,
    gear: 2,
    cloud: 2,
    sword: 2,
    house: 2,
    blob: 3,
    droplet: 3,
    leaf: 3,
    flower: 3,
    pill: 3,
    peanut: 3,
    ribbon: 3,
    spiral: 3,
    sunburst: 3,
    hexStar: 3,
    irregular: 3,
    hardWisp: 4,
    hardTalon: 4,
    hardDrift: 4,
    hardRift: 4,
    hardLobe: 4,
    hardTear: 4,
    hardSaw: 4,
    hardFang: 4,
    hardHook: 4,
    hardGash: 4,
    hardCurl: 4,
    hardScallop: 4,
    hardRook: 4,
    hardDart: 4,
    hardSkew: 4
  });

  function createRegularPolygon(cx, cy, radius, sides) {
    const pts = [];
    const step = (Math.PI * 2) / sides;
    const startAngle = -Math.PI / 2;
    for (let i = 0; i < sides; i++) {
      const angle = startAngle + i * step;
      pts.push({
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle)
      });
    }
    return Geometry.ensureCCW(pts);
  }

  function createStar(cx, cy, rOuter, rInner, points = 5) {
    const pts = [];
    const step = Math.PI / points;
    const startAngle = -Math.PI / 2;
    for (let i = 0; i < points * 2; i++) {
      const angle = startAngle + i * step;
      const r = i % 2 === 0 ? rOuter : rInner;
      pts.push({
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle)
      });
    }
    return Geometry.ensureCCW(pts);
  }

  function createDiamond(cx, cy, width, height) {
    const pts = [
      { x: cx, y: cy - height / 2 },
      { x: cx + width / 2, y: cy },
      { x: cx, y: cy + height / 2 },
      { x: cx - width / 2, y: cy }
    ];
    return Geometry.ensureCCW(pts);
  }

  function createHeart(cx, cy, size) {
    const pts = [];
    const steps = 40;
    // Parametric heart curve:
    // x = 16 sin^3(t)
    // y = -(13 cos(t) - 5 cos(2t) - 2 cos(3t) - cos(4t))
    const scale = size / 34;
    for (let i = 0; i < steps; i++) {
      const t = (i * Math.PI * 2) / steps;
      const sinT = Math.sin(t);
      const x = 16 * Math.pow(sinT, 3);
      const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      pts.push({
        x: cx + x * scale,
        y: cy + y * scale + 6 * scale
      });
    }
    return Geometry.cleanPolygon(Geometry.ensureCCW(pts), 2);
  }

  function createCrescentMoon(cx, cy, radius) {
    const R = radius;
    const r = radius * 0.85;
    const d = radius * 0.45;

    // Exact analytical intersection of outer circle and inner circle
    const x0 = (R * R - r * r + d * d) / (2 * d);
    const y0Sq = Math.max(0, R * R - x0 * x0);
    const y0 = Math.sqrt(y0Sq);

    const theta1 = Math.atan2(y0, x0);
    const theta2 = Math.atan2(y0, x0 - d);

    const rawPts = [];
    const steps = 32;

    // 1. Outer arc: from -theta1 to +theta1
    for (let i = 0; i <= steps; i++) {
      const angle = -theta1 + (2 * theta1 * i) / steps;
        rawPts.push({
          x: R * Math.cos(angle),
          y: R * Math.sin(angle)
        });
      }

      // 2. Inner arc: from +theta2 down to -theta2
      for (let i = steps; i >= 0; i--) {
      const angle = -theta2 + (2 * theta2 * i) / steps;
          rawPts.push({
            x: d + r * Math.cos(angle),
            y: r * Math.sin(angle)
          });
        }

        // Rotate slightly (-20 deg) for a natural night-sky tilt, and center at (cx, cy)
        const tilt = -Math.PI / 9;
        const cosT = Math.cos(tilt);
        const sinT = Math.sin(tilt);

        const rotated = rawPts.map(p => ({
          x: p.x * cosT - p.y * sinT,
          y: p.x * sinT + p.y * cosT
        }));

        const bounds = Geometry.polygonBounds(rotated);
        const shiftX = cx - (bounds.minX + bounds.maxX) / 2;
        const shiftY = cy - (bounds.minY + bounds.maxY) / 2;

        const centered = rotated.map(p => ({
          x: p.x + shiftX,
          y: p.y + shiftY
        }));

        return Geometry.cleanPolygon(Geometry.ensureCCW(centered), 0.5);
      }

      function createGear(cx, cy, rOuter, rInner, teeth = 8) {
        const pts = [];
        const count = teeth * 4;
        const step = (Math.PI * 2) / count;
        for (let i = 0; i < count; i++) {
          const angle = i * step;
          const mod = i % 4;
          const r = (mod === 1 || mod === 2) ? rOuter : rInner;
          pts.push({
            x: cx + r * Math.cos(angle),
            y: cy + r * Math.sin(angle)
          });
        }
        return Geometry.ensureCCW(pts);
      }

      function createShield(cx, cy, width, height) {
        const w = width / 2;
        const h = height / 2;
        const pts = [
          { x: cx - w, y: cy - h },
          { x: cx + w, y: cy - h },
          { x: cx + w, y: cy },
          { x: cx + w * 0.7, y: cy + h * 0.65 },
          { x: cx, y: cy + h },
          { x: cx - w * 0.7, y: cy + h * 0.65 },
          { x: cx - w, y: cy }
        ];
        return Geometry.ensureCCW(pts);
      }

      function createCross(cx, cy, size, thickness) {
        const s = size / 2;
        const t = thickness / 2;
        const pts = [
          { x: cx - t, y: cy - s },
          { x: cx + t, y: cy - s },
          { x: cx + t, y: cy - t },
          { x: cx + s, y: cy - t },
          { x: cx + s, y: cy + t },
          { x: cx + t, y: cy + t },
          { x: cx + t, y: cy + s },
          { x: cx - t, y: cy + s },
          { x: cx - t, y: cy + t },
          { x: cx - s, y: cy + t },
          { x: cx - s, y: cy - t },
          { x: cx - t, y: cy - t }
        ];
        return Geometry.ensureCCW(pts);
      }

      function createArrow(cx, cy, width, height) {
        const w = width / 2;
        const h = height / 2;
        const shaftW = w * 0.45;
        const pts = [
          { x: cx, y: cy - h },
          { x: cx + w, y: cy },
          { x: cx + shaftW, y: cy },
          { x: cx + shaftW, y: cy + h },
          { x: cx - shaftW, y: cy + h },
          { x: cx - shaftW, y: cy },
          { x: cx - w, y: cy }
        ];
        return Geometry.ensureCCW(pts);
      }

      function createLightningBolt(cx, cy, width, height) {
        const w = width / 2;
        const h = height / 2;
        const pts = [
          { x: cx - w * 0.2, y: cy - h },
          { x: cx + w * 0.6, y: cy - h },
          { x: cx - w * 0.1, y: cy - h * 0.1 },
          { x: cx + w * 0.7, y: cy - h * 0.1 },
          { x: cx - w * 0.8, y: cy + h },
          { x: cx - w * 0.1, y: cy + h * 0.15 },
          { x: cx - w * 0.7, y: cy + h * 0.15 }
        ];
        return Geometry.ensureCCW(pts);
      }

      function createFish(cx, cy, length, height) {
        const l = length / 2;
        const h = height / 2;
        const pts = [
          { x: cx + l, y: cy },
          { x: cx + l * 0.6, y: cy - h * 0.7 },
          { x: cx, y: cy - h },
          { x: cx - l * 0.5, y: cy - h * 0.6 },
          { x: cx - l * 0.7, y: cy - h * 0.15 },
          { x: cx - l, y: cy - h * 0.9 },
          { x: cx - l * 0.85, y: cy },
          { x: cx - l, y: cy + h * 0.9 },
          { x: cx - l * 0.7, y: cy + h * 0.15 },
          { x: cx - l * 0.5, y: cy + h * 0.6 },
          { x: cx, y: cy + h },
          { x: cx + l * 0.6, y: cy + h * 0.7 }
        ];
        return Geometry.ensureCCW(pts);
      }

      function createGhost(cx, cy, width, height) {
        const w = width / 2;
        const h = height / 2;
        const pts = [];
        const steps = 16;
        for (let i = 0; i <= steps; i++) {
          const angle = Math.PI + (i * Math.PI) / steps;
          pts.push({
            x: cx + w * Math.cos(angle),
            y: cy - h * 0.3 + w * Math.sin(angle)
          });
        }
        pts.push({ x: cx + w, y: cy + h });
        pts.push({ x: cx + w * 0.66, y: cy + h * 0.75 });
        pts.push({ x: cx + w * 0.33, y: cy + h });
        pts.push({ x: cx, y: cy + h * 0.75 });
        pts.push({ x: cx - w * 0.33, y: cy + h });
        pts.push({ x: cx - w * 0.66, y: cy + h * 0.75 });
        pts.push({ x: cx - w, y: cy + h });
        return Geometry.cleanPolygon(Geometry.ensureCCW(pts), 2);
      }

      function createCrown(cx, cy, width, height) {
        const w = width / 2;
        const h = height / 2;
        const pts = [
          { x: cx - w, y: cy - h * 0.8 },
          { x: cx - w * 0.5, y: cy - h * 0.2 },
          { x: cx, y: cy - h },
          { x: cx + w * 0.5, y: cy - h * 0.2 },
          { x: cx + w, y: cy - h * 0.8 },
          { x: cx + w * 0.8, y: cy + h },
          { x: cx - w * 0.8, y: cy + h }
        ];
        return Geometry.ensureCCW(pts);
      }

      function createMushroom(cx, cy, width, height) {
        const w = width / 2;
        const h = height / 2;
        const pts = [];
        const steps = 18;
        for (let i = 0; i <= steps; i++) {
          const angle = Math.PI + (i * Math.PI) / steps;
          pts.push({
            x: cx + w * Math.cos(angle),
            y: cy - h * 0.15 + (h * 0.75) * Math.sin(angle)
          });
        }
        pts.push({ x: cx + w * 1.05, y: cy - h * 0.15 });
        pts.push({ x: cx + w * 0.45, y: cy - h * 0.05 });
        pts.push({ x: cx + w * 0.4, y: cy + h });
        pts.push({ x: cx - w * 0.4, y: cy + h });
        pts.push({ x: cx - w * 0.45, y: cy - h * 0.05 });
        pts.push({ x: cx - w * 1.05, y: cy - h * 0.15 });
        return Geometry.cleanPolygon(Geometry.ensureCCW(pts), 2);
      }

      function createUFO(cx, cy, width, height) {
        const w = width / 2;
        const h = height / 2;
        const pts = [];
        for (let i = 0; i <= 10; i++) {
          const angle = Math.PI + (i * Math.PI) / 10;
          pts.push({
            x: cx + (w * 0.45) * Math.cos(angle),
            y: cy - h * 0.2 + (h * 0.65) * Math.sin(angle)
          });
        }
        pts.push({ x: cx + w, y: cy - h * 0.05 });
        pts.push({ x: cx + w * 0.6, y: cy + h * 0.4 });
        pts.push({ x: cx - w * 0.6, y: cy + h * 0.4 });
        pts.push({ x: cx - w, y: cy - h * 0.05 });
        return Geometry.cleanPolygon(Geometry.ensureCCW(pts), 2);
      }

      function createHouse(cx, cy, width, height) {
        const w = width / 2;
        const h = height / 2;
        const pts = [
          { x: cx, y: cy - h },
          { x: cx + w * 0.5, y: cy - h * 0.45 },
          { x: cx + w * 0.5, y: cy - h * 0.8 },
          { x: cx + w * 0.7, y: cy - h * 0.8 },
          { x: cx + w * 0.7, y: cy - h * 0.25 },
          { x: cx + w, y: cy },
          { x: cx + w * 0.85, y: cy },
          { x: cx + w * 0.85, y: cy + h },
          { x: cx - w * 0.85, y: cy + h },
          { x: cx - w * 0.85, y: cy },
          { x: cx - w, y: cy }
        ];
        return Geometry.ensureCCW(pts);
      }

      function createSword(cx, cy, width, height) {
        const w = width / 2;
        const h = height / 2;
        const bladeW = w * 0.28;
        const guardW = w * 0.95;
        const guardH = h * 0.12;
        const hiltW = w * 0.18;
        const pommelR = w * 0.26;
        const pts = [
          { x: cx, y: cy - h },
          { x: cx + bladeW, y: cy - h * 0.8 },
          { x: cx + bladeW, y: cy + h * 0.35 },
          { x: cx + guardW, y: cy + h * 0.35 },
          { x: cx + guardW, y: cy + h * 0.35 + guardH },
          { x: cx + hiltW, y: cy + h * 0.35 + guardH },
          { x: cx + hiltW, y: cy + h * 0.82 },
          { x: cx + pommelR, y: cy + h * 0.82 },
          { x: cx, y: cy + h },
          { x: cx - pommelR, y: cy + h * 0.82 },
          { x: cx - hiltW, y: cy + h * 0.82 },
          { x: cx - hiltW, y: cy + h * 0.35 + guardH },
          { x: cx - guardW, y: cy + h * 0.35 + guardH },
          { x: cx - guardW, y: cy + h * 0.35 },
          { x: cx - bladeW, y: cy + h * 0.35 },
          { x: cx - bladeW, y: cy - h * 0.8 }
        ];
        return Geometry.cleanPolygon(Geometry.ensureCCW(pts), 2);
      }

      function createCloud(cx, cy, width, height) {
        const w = width / 2;
        const h = height / 2;
        const pts = [];
        const steps = 36;
        for (let i = 0; i < steps; i++) {
          const angle = (i * Math.PI * 2) / steps;
          const r = 1 + 0.25 * Math.sin(3 * angle);
          let px = cx + w * 0.85 * r * Math.cos(angle);
          let py = cy + h * 0.7 * r * Math.sin(angle);
          if (py > cy + h * 0.45) py = cy + h * 0.45;
          pts.push({ x: px, y: py });
        }
        return Geometry.cleanPolygon(Geometry.ensureCCW(pts), 3);
      }

      function createHardRadialPolygon(cx, cy, width, height, radiusFn, steps = 56) {
        const pts = [];
        const w = width / 2;
        const h = height / 2;
        for (let i = 0; i < steps; i++) {
          const theta = (i / steps) * Math.PI * 2;
          const r = radiusFn(theta);
          pts.push({
            x: cx + Math.cos(theta) * w * r,
            y: cy + Math.sin(theta) * h * r
          });
        }
        return Geometry.cleanPolygon(Geometry.ensureCCW(pts), 2);
      }

      function createHardWisp(cx, cy, width, height) {
        return createHardRadialPolygon(cx, cy, width, height, (theta) => {
          const asym = theta > Math.PI ? 0.18 : -0.12;
          return 0.92 + 0.32 * Math.sin(3 * theta + 0.8) + 0.18 * Math.cos(7 * theta) + asym;
        });
      }

      function createHardTalon(cx, cy, width, height) {
        return createHardRadialPolygon(cx, cy, width, height, (theta) => {
          const tip = theta < 0.9 ? 0.24 : 0;
          return 0.86 + 0.35 * Math.sin(2 * theta + 1.2) + 0.2 * Math.cos(9 * theta) + tip;
        });
      }

      function createHardDrift(cx, cy, width, height) {
        return createHardRadialPolygon(cx, cy, width, height, (theta) => {
          const bias = theta > Math.PI * 0.8 ? 0.3 : -0.2;
          return 0.76 + 0.3 * Math.sin(4 * theta - 1.5) + 0.18 * Math.cos(5 * theta + 1.3) + bias;
        });
      }

      function createHardRift(cx, cy, width, height) {
        return createHardRadialPolygon(cx, cy, width, height, (theta) => {
          const notch = theta > Math.PI * 0.7 && theta < Math.PI * 1.4 ? -0.3 : 0.12;
          return 0.72 + 0.34 * Math.sin(3 * theta + 1.7) + 0.22 * Math.sin(9 * theta) + notch;
        });
      }

      function createHardLobe(cx, cy, width, height) {
        return createHardRadialPolygon(cx, cy, width, height, (theta) => {
          return 0.82 + 0.38 * Math.sin(2 * theta + 2.3) + 0.24 * Math.cos(6 * theta - 1.1) + (Math.sin(theta * 5) * 0.2);
        });
      }

      function createHardTear(cx, cy, width, height) {
        return createHardRadialPolygon(cx, cy, width, height, (theta) => {
          const offset = theta > 1.3 && theta < 4.9 ? 0.24 : -0.12;
          return 0.7 + 0.28 * Math.sin(4 * theta + 0.8) + 0.2 * Math.cos(11 * theta) + offset;
        });
      }

      function createHardSaw(cx, cy, width, height) {
        return createHardRadialPolygon(cx, cy, width, height, (theta) => {
          const serration = 0.2 * Math.sin(12 * theta + 0.5);
          return 0.78 + 0.36 * Math.sin(2 * theta + 0.4) + serration;
        });
      }

      function createHardFang(cx, cy, width, height) {
        return createHardRadialPolygon(cx, cy, width, height, (theta) => {
          const fang = theta > 0.6 && theta < 2.2 ? 0.22 : -0.08;
          return 0.8 + 0.32 * Math.sin(3 * theta - 0.9) + 0.25 * Math.cos(10 * theta) + fang;
        });
      }

      function createHardHook(cx, cy, width, height) {
        return createHardRadialPolygon(cx, cy, width, height, (theta) => {
          const pull = theta > 4.2 ? 0.34 : -0.12;
          return 0.84 + 0.38 * Math.sin(3 * theta + 1.8) + 0.16 * Math.cos(8 * theta) + pull;
        });
      }

      function createHardGash(cx, cy, width, height) {
        return createHardRadialPolygon(cx, cy, width, height, (theta) => {
          const slit = theta > 2.4 && theta < 5.0 ? -0.28 : 0.1;
          return 0.74 + 0.42 * Math.sin(theta * 2.5 + 1.5) + 0.2 * Math.sin(8 * theta) + slit;
        });
      }

      function createHardCurl(cx, cy, width, height) {
        return createHardRadialPolygon(cx, cy, width, height, (theta) => {
          const curl = theta > Math.PI * 1.2 ? 0.26 : -0.08;
          return 0.78 + 0.3 * Math.sin(4 * theta + 0.6) + 0.2 * Math.cos(7 * theta + 1.8) + curl;
        });
      }

      function createHardScallop(cx, cy, width, height) {
        return createHardRadialPolygon(cx, cy, width, height, (theta) => {
          const scallop = 0.22 * Math.sin(5 * theta - 1.2);
          return 0.76 + 0.36 * Math.sin(2 * theta + 1.2) + scallop;
        });
      }

      function createHardRook(cx, cy, width, height) {
        return createHardRadialPolygon(cx, cy, width, height, (theta) => {
          const edge = theta > Math.PI * 0.9 && theta < Math.PI * 1.6 ? 0.18 : -0.16;
          return 0.8 + 0.3 * Math.sin(3 * theta + 0.5) + 0.22 * Math.cos(6 * theta) + edge;
        });
      }

      function createHardDart(cx, cy, width, height) {
        return createHardRadialPolygon(cx, cy, width, height, (theta) => {
          const point = theta < 1.1 ? 0.4 : 0;
          return 0.68 + 0.42 * Math.sin(2 * theta + 2.1) + 0.2 * Math.cos(9 * theta) + point;
        });
      }

      function createHardSkew(cx, cy, width, height) {
        return createHardRadialPolygon(cx, cy, width, height, (theta) => {
          const skew = (Math.cos(theta * 2) * 0.15) + (theta > Math.PI ? 0.26 : -0.12);
          return 0.8 + 0.34 * Math.sin(3 * theta - 1.1) + 0.2 * Math.cos(7 * theta) + skew;
        });
      }

      /**
       * Generates a random, visually pleasing irregular polygon.
       */
      function createBlob(cx, cy, width, height) {
        const w = width / 2;
        const h = height / 2;
        const pts = [];
        const steps = 28;
        for (let i = 0; i < steps; i++) {
          const angle = (i / steps) * Math.PI * 2;
          const wobble = 1 + 0.24 * Math.sin(angle * 3) + 0.15 * Math.cos(angle * 5);
          pts.push({
            x: cx + w * wobble * Math.cos(angle),
            y: cy + h * wobble * Math.sin(angle)
          });
        }
        return Geometry.cleanPolygon(Geometry.ensureCCW(pts), 2);
      }

      function createDroplet(cx, cy, width, height) {
        const w = width / 2;
        const h = height / 2;
        const pts = [];
        const steps = 24;
        for (let i = 0; i < steps; i++) {
          const t = (i / steps) * Math.PI * 2;
          const r = 1 + 0.22 * Math.sin(t * 2);
          const x = Math.cos(t) * (w * r);
          const y = Math.sin(t) * (h * r);
          pts.push({
            x: cx + x,
            y: cy + y * 1.15 - h * 0.25
          });
        }
        return Geometry.cleanPolygon(Geometry.ensureCCW(pts), 2);
      }

      function createLeaf(cx, cy, width, height) {
        const w = width / 2;
        const h = height / 2;
        const pts = [
          { x: cx, y: cy - h },
          { x: cx + w * 0.9, y: cy - h * 0.25 },
          { x: cx + w * 0.7, y: cy + h * 0.85 },
          { x: cx + w * 0.25, y: cy + h },
          { x: cx - w * 0.2, y: cy + h * 0.75 },
          { x: cx - w * 0.9, y: cy + h * 0.2 },
          { x: cx - w * 0.8, y: cy - h * 0.55 }
        ];
        return Geometry.cleanPolygon(Geometry.ensureCCW(pts), 2);
      }

      function createFlower(cx, cy, width, height) {
        const w = width / 2;
        const h = height / 2;
        const petals = [];
        const petalCount = 10;
        for (let i = 0; i < petalCount; i++) {
          const angle = (Math.PI * 2 * i) / petalCount;
          const px = cx + Math.cos(angle) * (w * 0.75);
          const py = cy + Math.sin(angle) * (h * 0.75);
          petals.push({ x: px, y: py });
          petals.push({
            x: cx + Math.cos(angle + Math.PI / petalCount) * (w * 0.35),
            y: cy + Math.sin(angle + Math.PI / petalCount) * (h * 0.35)
          });
        }
        return Geometry.cleanPolygon(Geometry.ensureCCW(petals), 2);
      }

      function createPill(cx, cy, width, height) {
        const w = width / 2;
        const h = height / 2;
        const pts = [];
        const steps = 30;
        for (let i = 0; i < steps; i++) {
          const angle = (i / steps) * Math.PI * 2;
          const x = Math.cos(angle) * (w * 0.85 + 8);
          const y = Math.sin(angle) * (h * 0.75);
          pts.push({ x: cx + x, y: cy + y });
        }
        return Geometry.cleanPolygon(Geometry.ensureCCW(pts), 1.5);
      }

      function createPeanut(cx, cy, width, height) {
        const w = width / 2;
        const h = height / 2;
        const pts = [];
        const steps = 36;
        for (let i = 0; i < steps; i++) {
          const angle = (i / steps) * Math.PI * 2;
          const r = 1 + 0.4 * Math.sin(angle * 2);
          pts.push({
            x: cx + Math.cos(angle) * w * r,
            y: cy + Math.sin(angle) * h * 0.7 * r * 0.9
          });
        }
        return Geometry.cleanPolygon(Geometry.ensureCCW(pts), 2);
      }

      function createRibbon(cx, cy, width, height) {
        const w = width / 2;
        const h = height / 2;
        const pts = [
          { x: cx - w, y: cy - h * 0.3 },
          { x: cx - w * 0.2, y: cy - h },
          { x: cx + w * 0.55, y: cy - h * 0.45 },
          { x: cx + w, y: cy - h * 0.1 },
          { x: cx + w * 0.65, y: cy + h * 0.5 },
          { x: cx, y: cy + h },
          { x: cx - w * 0.7, y: cy + h * 0.45 },
          { x: cx - w, y: cy + h * 0.15 }
        ];
        return Geometry.cleanPolygon(Geometry.ensureCCW(pts), 2);
      }

      function createSpiral(cx, cy, width, height) {
        const w = width / 2;
        const h = height / 2;
        const pts = [];
        const turns = 2.6;
        for (let i = 0; i <= 42; i++) {
          const t = (i / 42) * (Math.PI * 2 * turns);
          const r = (w * 0.85) * (1 - (t / (Math.PI * 2 * turns)) * 0.85);
          pts.push({
            x: cx + Math.cos(t) * r,
            y: cy + Math.sin(t) * r * (h / w)
          });
        }
        return Geometry.cleanPolygon(Geometry.ensureCCW(pts), 2);
      }

      function createSunburst(cx, cy, width, height) {
        const w = width / 2;
        const h = height / 2;
        const pts = [];
        const spokes = 12;
        for (let i = 0; i < spokes; i++) {
          const angle = (i / spokes) * Math.PI * 2;
          pts.push({ x: cx + Math.cos(angle) * w * 0.2, y: cy + Math.sin(angle) * h * 0.2 });
          pts.push({ x: cx + Math.cos(angle + Math.PI / spokes) * w * 0.95, y: cy + Math.sin(angle + Math.PI / spokes) * h * 0.95 });
        }
        return Geometry.cleanPolygon(Geometry.ensureCCW(pts), 2);
      }

      function createHexStar(cx, cy, radius) {
        const pts = [];
        const points = 6;
        const inner = radius * 0.48;
        for (let i = 0; i < points * 2; i++) {
          const angle = -Math.PI / 2 + (i * Math.PI) / points;
          const r = i % 2 === 0 ? radius : inner;
          pts.push({
            x: cx + r * Math.cos(angle),
            y: cy + r * Math.sin(angle)
          });
        }
        return Geometry.cleanPolygon(Geometry.ensureCCW(pts), 2);
      }

      function createRandomPolygon(cx, cy, radius, vertexCount = 7, irregularity = 0.5) {
        const pts = [];
        const angles = [];
        for (let i = 0; i < vertexCount; i++) {
          angles.push((Math.PI * 2 * i) / vertexCount + (Math.random() - 0.5) * (Math.PI * 2 / vertexCount) * 0.7);
        }
        angles.sort((a, b) => a - b);

        for (let i = 0; i < vertexCount; i++) {
          const angle = angles[i];
          const r = radius * (1 - irregularity * 0.5 + Math.random() * irregularity);
          pts.push({
            x: cx + r * Math.cos(angle),
            y: cy + r * Math.sin(angle)
          });
        }
        return Geometry.cleanPolygon(Geometry.ensureCCW(pts), 2);
      }

      const HARD_SHAPES = Object.freeze([
        'hardWisp',
        'hardTalon',
        'hardDrift',
        'hardRift',
        'hardLobe',
        'hardTear',
        'hardSaw',
        'hardFang',
        'hardHook',
        'hardGash',
        'hardCurl',
        'hardScallop',
        'hardRook',
        'hardDart',
        'hardSkew'
      ]);

      return {
        HARD_SHAPES,
        SHAPE_DIFFICULTY,
        createRegularPolygon: createRegularPolygon,
        createStar: createStar,
        createDiamond: createDiamond,
        createHeart: createHeart,
        createCrescentMoon: createCrescentMoon,
        createGear: createGear,
        createShield: createShield,
        createCross: createCross,
        createArrow: createArrow,
        createLightningBolt: createLightningBolt,
        createFish: createFish,
        createGhost: createGhost,
        createCrown: createCrown,
        createMushroom: createMushroom,
        createUFO: createUFO,
        createHouse: createHouse,
        createSword: createSword,
        createCloud: createCloud,
        createHardWisp: createHardWisp,
        createHardTalon: createHardTalon,
        createHardDrift: createHardDrift,
        createHardRift: createHardRift,
        createHardLobe: createHardLobe,
        createHardTear: createHardTear,
        createHardSaw: createHardSaw,
        createHardFang: createHardFang,
        createHardHook: createHardHook,
        createHardGash: createHardGash,
        createHardCurl: createHardCurl,
        createHardScallop: createHardScallop,
        createHardRook: createHardRook,
        createHardDart: createHardDart,
        createHardSkew: createHardSkew,
        createBlob: createBlob,
        createDroplet: createDroplet,
        createLeaf: createLeaf,
        createFlower: createFlower,
        createPill: createPill,
        createPeanut: createPeanut,
        createRibbon: createRibbon,
        createSpiral: createSpiral,
        createSunburst: createSunburst,
        createHexStar: createHexStar,
        createRandomPolygon: createRandomPolygon
      };
    });

