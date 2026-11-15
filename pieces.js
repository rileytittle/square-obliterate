// Piece table. Each family has a fixed weight; all rotations in a family share it equally.
// These odds are shown in-game and are the only thing that decides which pieces you get
// (apart from the public fit guarantee in game.js).
(function () {
  function parse(rows) {
    const cells = [];
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') cells.push([x, y]); }));
    return cells;
  }

  function rotate(cells) {
    const r = cells.map(([x, y]) => [-y, x]);
    const minX = Math.min(...r.map(c => c[0]));
    const minY = Math.min(...r.map(c => c[1]));
    return r.map(([x, y]) => [x - minX, y - minY]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  }

  function key(cells) { return cells.map(c => c.join(',')).join(';'); }

  function allRotations(cells) {
    const out = [];
    const seen = new Set();
    let cur = rotate(rotate(rotate(rotate(cells)))); // normalise
    for (let i = 0; i < 4; i++) {
      const k = key(cur);
      if (!seen.has(k)) { seen.add(k); out.push(cur); }
      cur = rotate(cur);
    }
    return out;
  }

  const FAMILIES = [
    { name: 'Single',        weight: 2,  shape: ['#'] },
    { name: 'Domino',        weight: 4,  shape: ['##'] },
    { name: 'Line 3',        weight: 7,  shape: ['###'] },
    { name: 'Line 4',        weight: 6,  shape: ['####'] },
    { name: 'Line 5',        weight: 4,  shape: ['#####'] },
    { name: 'Corner 3',      weight: 7,  shape: ['##', '#.'] },
    { name: 'Square 2×2',    weight: 8,  shape: ['##', '##'] },
    { name: 'Square 3×3',    weight: 3,  shape: ['###', '###', '###'] },
    { name: 'Rectangle 2×3', weight: 5,  shape: ['###', '###'] },
    { name: 'L 4',           weight: 7,  shape: ['#.', '#.', '##'] },
    { name: 'J 4',           weight: 7,  shape: ['.#', '.#', '##'] },
    { name: 'T',             weight: 7,  shape: ['###', '.#.'] },
    { name: 'S',             weight: 5,  shape: ['.##', '##.'] },
    { name: 'Z',             weight: 5,  shape: ['##.', '.##'] },
    { name: 'Big corner',    weight: 5,  shape: ['###', '#..', '#..'] },
  ];

  const COLORS = ['#ff5d73', '#ffb547', '#ffe066', '#5ee08a', '#3fd0e0', '#5b8cff', '#b06bff', '#ff7ad9'];

  const PIECES = [];
  FAMILIES.forEach((f, fi) => {
    const rots = allRotations(parse(f.shape));
    rots.forEach(cells => {
      const w = Math.max(...cells.map(c => c[0])) + 1;
      const h = Math.max(...cells.map(c => c[1])) + 1;
      PIECES.push({ family: f.name, familyIndex: fi, weight: f.weight / rots.length, cells, w, h });
    });
  });

  window.SO_PIECES = { FAMILIES, PIECES, COLORS };
})();
