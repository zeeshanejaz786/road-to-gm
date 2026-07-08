// Perft validation against the standard CPW test suite.
// Usage: node tests/perft.js [quick|full]
const RTG = require('../js/engine.js');

const SUITE = [
  {
    name: 'startpos',
    fen: RTG.START_FEN,
    depths: { 1: 20, 2: 400, 3: 8902, 4: 197281, 5: 4865609 }
  },
  {
    name: 'kiwipete',
    fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    depths: { 1: 48, 2: 2039, 3: 97862, 4: 4085603 }
  },
  {
    name: 'position3',
    fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    depths: { 1: 14, 2: 191, 3: 2812, 4: 43238, 5: 674624 }
  },
  {
    name: 'position4',
    fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    depths: { 1: 6, 2: 264, 3: 9467, 4: 422333 }
  },
  {
    name: 'position5',
    fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    depths: { 1: 44, 2: 1486, 3: 62379, 4: 2103487 }
  },
  {
    name: 'position6',
    fen: 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',
    depths: { 1: 46, 2: 2079, 3: 89890, 4: 3894594 }
  }
];

const mode = process.argv[2] || 'quick';
const maxDepth = mode === 'quick' ? 3 : 99;

let failures = 0, total = 0;
const t0 = Date.now();
for (const pos of SUITE) {
  const g = new RTG.Game(pos.fen);
  for (const [d, expect] of Object.entries(pos.depths)) {
    if (+d > maxDepth) continue;
    total++;
    const start = Date.now();
    const got = g.perft(+d);
    const ms = Date.now() - start;
    const ok = got === expect;
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${pos.name} d${d}: got ${got}, expected ${expect} (${ms}ms)`);
    if (!ok) {
      console.log('  divide:', JSON.stringify(g.divide(+d)));
    }
  }
  // sanity: FEN round-trip
  if (g.fen().split(' ').slice(0, 4).join(' ') !== pos.fen.split(' ').slice(0, 4).join(' ')) {
    // ep square may be normalized away when not capturable — compare boards only
    const a = g.fen().split(' ')[0], b = pos.fen.split(' ')[0];
    if (a !== b) { console.log(`FAIL fen round-trip ${pos.name}: ${g.fen()}`); failures++; }
  }
}
console.log(`\n${total - failures}/${total} passed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
process.exit(failures ? 1 : 0);
