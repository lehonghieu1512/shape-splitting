/**
 * PolySlice Geometry Engine
 * Robust 2D polygon mathematics and slicing algorithms.
 * Handles both convex and concave simple polygons.
 */

(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.PolySlice = root.PolySlice || {};
    root.PolySlice.Geometry = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const EPS = 1e-5;

  /**
   * Computes the signed area of a 2D polygon using the Shoelace formula.
   * Positive = Counter-Clockwise (CCW), Negative = Clockwise (CW).
   */
  function polygonArea(poly) {
    if (!poly || poly.length < 3) return 0;
    let area = 0;
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
    }
    return area / 2;
  }

  /**
   * Ensures the polygon vertices are oriented Counter-Clockwise (CCW).
   */
  function ensureCCW(poly) {
    if (polygonArea(poly) < 0) {
      return poly.slice().reverse();
    }
    return poly.slice();
  }

  /**
   * Calculates the geometric centroid (center of mass) of a polygon.
   */
  function polygonCentroid(poly) {
    if (!poly || poly.length === 0) return { x: 0, y: 0 };
    if (poly.length === 1) return { x: poly[0].x, y: poly[0].y };
    if (poly.length === 2) return { x: (poly[0].x + poly[1].x) / 2, y: (poly[0].y + poly[1].y) / 2 };

    let cx = 0;
    let cy = 0;
    let signedArea = 0;
    const n = poly.length;

    for (let i = 0; i < n; i++) {
      const p0 = poly[i];
      const p1 = poly[(i + 1) % n];
      const a = p0.x * p1.y - p1.x * p0.y;
      signedArea += a;
      cx += (p0.x + p1.x) * a;
      cy += (p0.y + p1.y) * a;
    }

    signedArea *= 0.5;
    if (Math.abs(signedArea) < 1e-7) {
      // Fallback to arithmetic mean if area is near zero
      let sx = 0, sy = 0;
      for (const p of poly) { sx += p.x; sy += p.y; }
      return { x: sx / n, y: sy / n };
    }

    cx /= (6 * signedArea);
    cy /= (6 * signedArea);
    return { x: cx, y: cy };
  }

  /**
   * Computes axis-aligned bounding box for a polygon.
   */
  function polygonBounds(poly) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    for (const p of poly) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  /**
   * Ray casting algorithm to test if a 2D point is inside a polygon.
   */
  function pointInPolygon(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect = ((yi > p.y) !== (yj > p.y)) &&
        (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Removes duplicate consecutive vertices and near-collinear points.
   */
  function cleanPolygon(pts, distEps = 1e-3) {
    if (!pts || pts.length < 3) return pts || [];
    const res = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (res.length === 0) {
        res.push(p);
      } else {
        const last = res[res.length - 1];
        if (Math.hypot(p.x - last.x, p.y - last.y) > distEps) {
          res.push(p);
        }
      }
    }
    // Check wrap-around
    if (res.length > 2 && Math.hypot(res[0].x - res[res.length - 1].x, res[0].y - res[res.length - 1].y) < distEps) {
      res.pop();
    }

    // Remove collinear points
    if (res.length < 3) return res;
    const finalPts = [];
    const len = res.length;
    for (let i = 0; i < len; i++) {
      const prev = res[(i - 1 + len) % len];
      const curr = res[i];
      const next = res[(i + 1) % len];
      const cross = (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x);
      const d1 = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      const d2 = Math.hypot(next.x - curr.x, next.y - curr.y);
      // If collinear and continues in same direction, skip curr
      if (Math.abs(cross) / (d1 * d2 + 1e-9) < 1e-4) {
        const dot = (curr.x - prev.x) * (next.x - curr.x) + (curr.y - prev.y) * (next.y - curr.y);
        if (dot > 0) continue; // forward collinear
      }
      finalPts.push(curr);
    }
    return finalPts.length >= 3 ? finalPts : res;
  }

  /**
   * Finds intersection between line segment (p1 -> p2) and (p3 -> p4).
   */
  function lineSegmentIntersection(p1, p2, p3, p4) {
    const d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (Math.abs(d) < 1e-9) return null;

    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
    const u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / d;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return {
        point: {
          x: p1.x + t * (p2.x - p1.x),
          y: p1.y + t * (p2.y - p1.y)
        },
        t,
        u
      };
    }
    return null;
  }

  /**
   * Finds all intersection points between a cut line (or segment) and a polygon.
   */
  function findCutIntersections(poly, a, b, isSegmentOnly = false) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen < 1e-6) return [];

    const dir = { x: dx / segLen, y: dy / segLen };
    const normal = { x: -dir.y, y: dir.x };

    const intersections = [];
    const n = poly.length;

    for (let i = 0; i < n; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % n];

      let d1 = (p1.x - a.x) * normal.x + (p1.y - a.y) * normal.y;
      let d2 = (p2.x - a.x) * normal.x + (p2.y - a.y) * normal.y;
      if (Math.abs(d1) < EPS) d1 = EPS * 1.01;
      if (Math.abs(d2) < EPS) d2 = -EPS * 1.01;

      if ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) {
        const t = d1 / (d1 - d2);
        const interPt = {
          x: p1.x + t * (p2.x - p1.x),
          y: p1.y + t * (p2.y - p1.y)
        };
        const segParam = ((interPt.x - a.x) * dx + (interPt.y - a.y) * dy) / (segLen * segLen);
        if (!isSegmentOnly || (segParam >= -0.01 && segParam <= 1.01)) {
          intersections.push({
            point: interPt,
            segParam,
            edgeIndex: i
          });
        }
      }
    }
    return intersections;
  }

  /**
   * Splits any simple 2D polygon (convex or concave) along a line defined by points a and b.
   * If isSegmentOnly is true, cutting only occurs if the segment [a, b] cuts completely through.
   * Returns array of split sub-polygons (or [poly] if no cut occurs).
   */
  function splitPolygon(poly, a, b, isSegmentOnly = false) {
    if (!poly || poly.length < 3) return [poly];
    poly = ensureCCW(poly);
    const n = poly.length;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen < 1e-6) return [poly];

    const dir = { x: dx / segLen, y: dy / segLen };
    const normal = { x: -dir.y, y: dir.x };

    // Infinitesimal perturbation on boundary vertices that lie exactly on the line
    const dists = poly.map(p => {
      let d = (p.x - a.x) * normal.x + (p.y - a.y) * normal.y;
      if (Math.abs(d) < EPS) d = EPS * 1.01;
      return d;
    });

    let hasPos = false, hasNeg = false;
    for (let d of dists) {
      if (d > 0) hasPos = true;
      else hasNeg = true;
    }
    if (!hasPos || !hasNeg) return [poly];

    const boundary = [];
    const cutPoints = [];

    for (let i = 0; i < n; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % n];
      const d1 = dists[i];
      const d2 = dists[(i + 1) % n];

      boundary.push({ pt: p1, isCut: false });

      if ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) {
        const t = d1 / (d1 - d2);
        const interPt = {
          x: p1.x + t * (p2.x - p1.x),
          y: p1.y + t * (p2.y - p1.y)
        };
        const segParam = ((interPt.x - a.x) * dx + (interPt.y - a.y) * dy) / (segLen * segLen);
        const proj = (interPt.x - a.x) * dir.x + (interPt.y - a.y) * dir.y;

        const cutNode = {
          pt: interPt,
          isCut: true,
          proj,
          segParam
        };
        boundary.push(cutNode);
        cutPoints.push(cutNode);
      }
    }

    if (cutPoints.length < 2) return [poly];

    // If segment-only cutting, verify that at least one pair of cut points is spanned by the segment
    if (isSegmentOnly) {
      const validCuts = cutPoints.filter(cp => cp.segParam >= -0.01 && cp.segParam <= 1.01);
      if (validCuts.length < 2) return [poly];
    }

    // Sort cut points along direction of cut line
    cutPoints.sort((c1, c2) => c1.proj - c2.proj);

    // Chords are internal line segments between consecutive cut points inside the polygon
    const chords = [];
    for (let i = 0; i < cutPoints.length - 1; i++) {
      const c1 = cutPoints[i];
      const c2 = cutPoints[i + 1];

      if (isSegmentOnly) {
        if (c1.segParam < -0.01 || c2.segParam > 1.01) continue;
      }

      const mid = { x: (c1.pt.x + c2.pt.x) / 2, y: (c1.pt.y + c2.pt.y) / 2 };
      if (pointInPolygon(mid, poly)) {
        chords.push({ c1, c2 });
      }
    }

    if (chords.length === 0) return [poly];

    // Build planar directed graph
    const V = boundary.length;
    const adj = Array.from({ length: V }, () => []);

    // 1. Boundary edges
    for (let i = 0; i < V; i++) {
      const next = (i + 1) % V;
      const edx = boundary[next].pt.x - boundary[i].pt.x;
      const edy = boundary[next].pt.y - boundary[i].pt.y;
      adj[i].push({ to: next, angle: Math.atan2(edy, edx) });
    }

    // 2. Chords (bidirectional)
    for (const chord of chords) {
      const idx1 = boundary.indexOf(chord.c1);
      const idx2 = boundary.indexOf(chord.c2);
      if (idx1 !== -1 && idx2 !== -1) {
        const cdx = chord.c2.pt.x - chord.c1.pt.x;
        const cdy = chord.c2.pt.y - chord.c1.pt.y;
        adj[idx1].push({ to: idx2, angle: Math.atan2(cdy, cdx) });
        adj[idx2].push({ to: idx1, angle: Math.atan2(-cdy, -cdx) });
      }
    }

    // Helper: find next outgoing edge with smallest clockwise angle from reverse incoming edge
    function getNextEdge(u, v) {
      const pu = boundary[u].pt;
      const pv = boundary[v].pt;
      const backAngle = Math.atan2(pu.y - pv.y, pu.x - pv.x);
      let bestEdge = null;
      let minDiff = Infinity;
      for (const e of adj[v]) {
        let diff = backAngle - e.angle;
        while (diff <= 0) diff += 2 * Math.PI;
        while (diff > 2 * Math.PI) diff -= 2 * Math.PI;
        if (diff < minDiff) {
          minDiff = diff;
          bestEdge = e;
        }
      }
      return bestEdge;
    }

    // Traverse planar faces
    const visited = new Set();
    const faces = [];

    for (let u = 0; u < V; u++) {
      for (const e of adj[u]) {
        const key = `${u}->${e.to}`;
        if (visited.has(key)) continue;

        const faceIndices = [];
        let curU = u;
        let curV = e.to;
        let valid = true;

        while (!visited.has(`${curU}->${curV}`)) {
          visited.add(`${curU}->${curV}`);
          faceIndices.push(curU);
          const nextEdge = getNextEdge(curU, curV);
          if (!nextEdge) {
            valid = false;
            break;
          }
          curU = curV;
          curV = nextEdge.to;
          if (curU === u && curV === e.to) break;
          if (faceIndices.length > V * 3) {
            valid = false;
            break;
          }
        }

        if (valid && faceIndices.length >= 3) {
          const pts = faceIndices.map(idx => boundary[idx].pt);
          const cleaned = cleanPolygon(pts);
          const area = polygonArea(cleaned);
          // Positive area denotes internal CCW face
          if (area > 1.0) {
            faces.push(cleaned);
          }
        }
      }
    }

    return faces.length > 0 ? faces : [poly];
  }

  return {
    polygonArea,
    ensureCCW,
    polygonCentroid,
    polygonBounds,
    pointInPolygon,
    cleanPolygon,
    lineSegmentIntersection,
    findCutIntersections,
    splitPolygon
  };
});

