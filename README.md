# ⚡ PolySlice - Shape Splitting Game

An interactive, physics-based 2D shape slicing web game built with vanilla JavaScript, HTML5 Canvas, and procedural Web Audio API synthesis.

---

## 🎯 Target Percent Round Challenge (Featured Mode)

In each round:
1. **Commanded Percentages**: You are given a shape and a set of random target percentages summing to 100% (e.g. `[ 60.0%, 40.0% ]` or `[ 45.0%, 35.0%, 20.0% ]`).
2. **Precision Slicing**: You must slice the shape so that the resulting pieces match both the **commanded count** and the **target percentages**.
3. **⚠️ Over-Slice Penalty**: If you cut the shape into **more pieces** than the commanded count, the round fails and you receive **0 points**! You can press **Undo** (`Ctrl+Z`) or **Retry** to correct your cut.
4. **Scoring & Stars**:
   - Matching pieces within $\ge 80\%$ accuracy clears the round!
   - 🌟 $\ge 95\%$ accuracy: ⭐⭐⭐ (3 Stars)
   - 🌟 $\ge 88\%$ accuracy: ⭐⭐ (2 Stars)
   - 🌟 $\ge 80\%$ accuracy: ⭐ (1 Star)
   - Points earned: $\text{Base } (1000) + \text{Accuracy Bonus } (10 \times \text{Accuracy}) + \text{Round Bonus } (100 \times \text{Round})$.
5. **Advancing**: When you clear a round, the game celebrates with confetti, sound chimes, and advances to the next round with a new shape and fresh target percentages!

---

## 🎨 Extended Shape Library (20+ Shapes)

- **Creatures & Icons**: 🐟 Ocean Fish, 💖 Heart, 👻 Arcade Ghost, 🍄 Mushroom, 🛸 UFO Saucer, ☁️ Puffy Cloud
- **Weapons & Symbols**: ⚡ Lightning Bolt, 👑 Royal Crown, ⚔️ Knight Sword, 🛡️ Hero Shield, 💎 Diamond Gem, ⭐ 5-Point Star, 🌙 Crescent Moon, 🏹 Arrow, ➕ Cross
- **Geometric & Architectural**: 🏠 House, ⚙️ Mechanical Gear, ⬡ Hexagon, 🛑 Octagon, 🔺 Triangle, 🌀 Procedural Irregular Polygon

---

## 🎮 How to Play

1. **Aim & Slice**: Click and drag your mouse across any piece to aim your laser blade. Release to cut.
2. **Continuous Slicing**: You can continuously slice any resulting piece into smaller shards.
3. **Move Pieces**: Hold **Shift + Drag** (or right-click drag) to pick up and move any piece around.
4. **Shortcuts**:
   - `Ctrl+Z` (or `Cmd+Z`) to **Undo** cuts.
   - `Ctrl+Y` (or `Cmd+Y`) to **Redo** cuts.
   - `R` to **Reset / Retry** the round.
   - `M` to **Mute / Unmute** procedural audio.

---

## 🚀 How to Run

Open directly in any browser without installation:
- Double-click [`index.html`](file:///Users/hieule/Projects/Shape%20splitting/index.html).
- Or run a local server:
  ```bash
  python3 -m http.server 3000
  # Or: npm start
  ```
  Then visit `http://localhost:3000`.
