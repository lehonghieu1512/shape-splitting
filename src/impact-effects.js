(function (root, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else {
    root.PolySlice = root.PolySlice || {};
    root.PolySlice.ImpactEffects = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function smoothstep(value) {
    const t = clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  }

  class ImpactEffects {
    constructor() {
      this.impacts = [];
    }

    trigger(event) {
      const intensity = clamp(event.strength / 72, 0, 1);
      if (intensity <= 0) return;

      this.impacts.push({
        pieceA: event.pieceA,
        pieceB: event.pieceB,
        point: event.point,
        normal: event.normal,
        intensity,
        age: 0,
        duration: 0.46,
        particleAngles: [-0.9, 0, 0.9].map(offset => Math.atan2(event.normal.y, event.normal.x) + offset)
      });
    }

    update(dt) {
      for (let index = this.impacts.length - 1; index >= 0; index--) {
        const impact = this.impacts[index];
        impact.age += dt;
        if (impact.age >= impact.duration) this.impacts.splice(index, 1);
      }
    }

    getPieceVisual(piece) {
      const deformations = [];
      let glowStrength = 0;

      for (const impact of this.impacts) {
        if (impact.pieceA !== piece && impact.pieceB !== piece) continue;
        const envelope = 1 - smoothstep(impact.age / impact.duration);
        const amount = impact.intensity * envelope;
        deformations.push({
          normal: impact.normal,
          compression: 0.12 * amount,
          stretch: 0.07 * amount
        });
        glowStrength = Math.min(1, glowStrength + amount);
      }

      return { deformations, glowStrength };
    }

    draw(ctx) {
      for (const impact of this.impacts) {
        const progress = clamp(impact.age / impact.duration, 0, 1);
        const eased = smoothstep(progress);
        const fade = (1 - eased) * impact.intensity;
        const radius = 4 + eased * (18 + impact.intensity * 20);
        const colors = [impact.pieceA.color.stroke, impact.pieceB.color.stroke];

        for (let index = 0; index < colors.length; index++) {
          ctx.save();
          ctx.globalAlpha = fade * 0.65;
          ctx.strokeStyle = colors[index];
          ctx.shadowColor = colors[index];
          ctx.shadowBlur = 7 + impact.intensity * 8;
          ctx.lineWidth = 1.2 + impact.intensity;
          ctx.beginPath();
          ctx.arc(impact.point.x, impact.point.y, Math.max(1, radius - index * 3), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        if (impact.intensity > 0.25) {
          const travel = eased * (12 + impact.intensity * 10);
          for (let index = 0; index < impact.particleAngles.length; index++) {
            const angle = impact.particleAngles[index];
            ctx.save();
            ctx.globalAlpha = fade;
            ctx.fillStyle = colors[index % colors.length];
            ctx.beginPath();
            ctx.arc(
              impact.point.x + Math.cos(angle) * travel,
              impact.point.y + Math.sin(angle) * travel,
              1 + impact.intensity * (1 - progress),
              0,
              Math.PI * 2
            );
            ctx.fill();
            ctx.restore();
          }
        }
      }
    }
  }

  return ImpactEffects;
});
