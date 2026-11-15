# Square Obliterate

A skill-based block-placement puzzle. Drag pieces onto an 8×8 board and fill rows or columns to clear them. When none of your pieces fit, the game ends.

Open `index.html` in a browser (works on phones). No build step, no dependencies.

## Fairness

- **Fixed piece odds**, listed in-game under *Fairness*.
- **One public board-aware rule, the solvable-tray guarantee:** every new tray can be fully placed on the board in some order, counting line clears in between. If a roll can't, it is rerolled. You only lose when earlier placements boxed you in.
- **Nothing else feeds the generator:** no score, streak, play time, ads or spending.
- **Seeded:** each tray is rolled from `seed + tray number`, so a seed is replayable. The daily seed is shared by everyone.

## Scoring

Modelled on community descriptions of the genre's usual formula. The constants are at the top of `game.js`.

- 10 points per square placed.
- A clearing move: `100 × lines bonus × streak`.
- Lines bonus: 1 line ×1, 2 ×3, 3 ×6, 4 or more ×10.
- Streak: the first clear is ×1, and each clear in a row adds ×0.5. It breaks after 3 placements without a clear.
- Clearing the whole board: +3,000.

## Files

- `pieces.js`: piece shapes and weights
- `game.js`: rules, generator, input and rendering
- `style.css`, `index.html`: UI
