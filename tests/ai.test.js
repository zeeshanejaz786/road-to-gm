// AI + rules sanity tests. Usage: node tests/ai.test.js
const RTG = require('../js/engine.js');
const AI = require('../js/ai.js');

let failures = 0;
function check(name, cond, extra) {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`);
  if (!cond) failures++;
}

// ---- rules edge cases -------------------------------------------------
{
  // SAN basics
  const g = new RTG.Game();
  const m = g.moveFromUci('e2e4');
  check('SAN e4', g.san(m) === 'e4', g.san(m));
  g.make(m);
  const m2 = g.moveFromUci('e7e5');
  g.make(m2);
  const m3 = g.moveFromUci('g1f3');
  check('SAN Nf3', g.san(m3) === 'Nf3', g.san(m3));
}
{
  // castling SAN + rights lost when rook captured
  const g = new RTG.Game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const oo = g.moveFromUci('e1g1');
  check('white O-O legal', oo !== 0);
  check('SAN O-O', g.san(oo) === 'O-O', g.san(oo));
  const g2 = new RTG.Game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  g2.make(g2.moveFromUci('a1a8')); // Rxa8 captures black a-rook
  check('black loses O-O-O after Rxa8', (g2.castling & 8) === 0);
  check('black keeps O-O after Rxa8', (g2.castling & 4) !== 0);
}
{
  // en passant pin: exd6 e.p. would expose king -> illegal
  const g = new RTG.Game('8/8/8/K2pP2q/8/8/8/7k w - d6 0 1');
  // white king a5, pawn e5, black pawn d5 (just double-pushed), black queen h5
  const ep = g.moveFromUci('e5d6');
  check('ep capture illegal when pinned', ep === 0);
}
{
  // promotion
  const g = new RTG.Game('8/P7/8/8/8/8/8/K6k w - - 0 1');
  const promo = g.moveFromUci('a7a8q');
  check('promotion legal', promo !== 0);
  check('promotion SAN', g.san(promo) === 'a8=Q+' || g.san(promo) === 'a8=Q', g.san(promo));
  g.make(promo);
  check('queen on a8', RTG.pieceType(g.board[0x70]) === RTG.QUEEN);
}
{
  // stalemate
  const g = new RTG.Game('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  const st = g.status();
  check('stalemate detected', st.over && st.reason === 'stalemate', st.reason);
}
{
  // checkmate
  const g = new RTG.Game('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1');
  const st = g.status();
  check('checkmate detected', st.over && st.reason === 'checkmate', st.reason);
}
{
  // threefold repetition
  const g = new RTG.Game();
  const seq = ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8'];
  for (const u of seq) g.make(g.moveFromUci(u));
  const st = g.status();
  check('threefold detected', st.over && st.reason === 'threefold repetition', st.reason);
}
{
  // insufficient material K+B vs K
  const g = new RTG.Game('8/8/8/3k4/8/3BK3/8/8 w - - 0 1');
  check('K+B vs K draw', g.status().over && g.status().reason === 'insufficient material');
  // K+R vs K is NOT insufficient
  const g2 = new RTG.Game('8/8/8/3k4/8/3RK3/8/8 w - - 0 1');
  check('K+R vs K not draw', !g2.status().over);
}

// ---- AI tactical tests --------------------------------------------------
{
  // mate in 1: back rank
  const g = new RTG.Game('6k1/5ppp/8/8/8/8/8/4R2K w - - 0 1');
  const r = AI.think(g, { timeMs: 2000, maxDepth: 6 });
  check('finds Re8# (mate in 1)', RTG.uci(r.move) === 'e1e8', RTG.uci(r.move) + ' score=' + r.score);
  check('reports mate 1', r.mate === 1, 'mate=' + r.mate);
}
{
  // mate in 1: scholar's mate
  const g = new RTG.Game('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4');
  const r = AI.think(g, { timeMs: 2000, maxDepth: 6 });
  check('finds Qxf7#', RTG.uci(r.move) === 'h5f7', RTG.uci(r.move));
}
{
  // KR vs K corner: forced mate in 3 (verified: no M2 exists, 1...Rh2 2.Kb1 Rh1+ 3.Ka2 escapes)
  const g = new RTG.Game('8/8/8/8/8/2k5/1r6/K7 b - - 0 1');
  const r = AI.think(g, { timeMs: 3000, maxDepth: 8 });
  check('finds forced mate (KR vs K)', r.mate === 3, 'mate=' + r.mate + ' best=' + RTG.uci(r.move) + ' score=' + r.score);
}
{
  // free queen: Nxd5
  const g = new RTG.Game('4k3/8/8/3q4/8/2N5/8/4K3 w - - 0 1');
  const r = AI.think(g, { timeMs: 1500, maxDepth: 6 });
  check('takes free queen Nxd5', RTG.uci(r.move) === 'c3d5', RTG.uci(r.move));
}
{
  // queen attacked by undefended rook: Qxa2 best
  const g = new RTG.Game('4k3/8/8/8/8/8/r2Q4/4K3 w - - 0 1');
  const r = AI.think(g, { timeMs: 1500, maxDepth: 6 });
  check('saves queen via Qxa2', RTG.uci(r.move) === 'd2a2', RTG.uci(r.move));
}
{
  // search must not corrupt game state
  const g = new RTG.Game('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3');
  const before = g.fen();
  AI.think(g, { timeMs: 800, maxDepth: 20 });
  check('state intact after search', g.fen() === before);
}
{
  // speed check: depth reached from startpos in 1s
  const g = new RTG.Game();
  const r = AI.think(g, { timeMs: 1000, maxDepth: 30 });
  check('depth >= 5 in 1s from startpos', r.depth >= 5, `depth=${r.depth} nodes=${r.nodes} time=${r.time}ms`);
}
{
  // every bot returns a legal move quickly
  const g = new RTG.Game();
  g.make(g.moveFromUci('e2e4'));
  for (const bot of AI.BOTS) {
    const t0 = Date.now();
    const m = AI.pickBotMove(g, bot, ['e4'], null);
    const legal = g.legalMoves().includes(m);
    check(`bot ${bot.name} legal move`, legal, `${RTG.uci(m)} in ${Date.now() - t0}ms`);
  }
}

console.log(failures ? `\n${failures} FAILURES` : '\nall passed');
process.exit(failures ? 1 : 0);
