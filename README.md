# Square Obliterate

A skill-based block-placement puzzle. Drag pieces onto an 8×8 board and fill rows or columns to clear them. When none of your pieces fit, the game ends.

Open `index.html` in a browser (works on phones). No build step, no dependencies.

## Fairness

- **Fixed piece odds**, listed in-game under *Fairness*.
- **One public board-aware rule, the fit guarantee:** every new tray has at least one piece that fits the board. If a roll has none, it is rerolled.
- **Nothing else feeds the generator:** no score, streak, play time, ads or spending.
- **Seeded:** each tray is rolled from `seed + tray number`, so a seed is replayable. The daily seed is shared by everyone.

## Scoring

- 1 point per square placed.
- Line clears: `10 × lines² × combo`.
- Combo goes up on each clearing placement and resets after 3 placements in a row with no clear.
- Clearing the whole board: +300.

## Files

- `pieces.js`: piece shapes and weights
- `game.js`: rules, generator, input and rendering
- `style.css`, `index.html`: UI
