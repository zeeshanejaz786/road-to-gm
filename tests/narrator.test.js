// Narrator logic checks. node tests/narrator.test.js
const RTG = require('../js/engine.js');
const N = require('../js/narrator.js');

let failures = 0;
function check(name, cond, extra) {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`);
  if (!cond) failures++;
}

// start position: nothing hangs, material even
{
  const g = new RTG.Game();
  check('startpos no white hangers', N.hangingSquares(g, RTG.WHITE).length === 0);
  check('startpos no black hangers', N.hangingSquares(g, RTG.BLACK).length === 0);
  check('startpos material 39 each',
    N.materialCount(g, RTG.WHITE) === 39 && N.materialCount(g, RTG.BLACK) === 39,
    N.materialCount(g, RTG.WHITE) + '/' + N.materialCount(g, RTG.BLACK));
}

// white queen attacked down the file by a rook, undefended -> hanging
{
  const g = new RTG.Game('3rk3/8/8/8/3Q4/8/8/4K3 w - - 0 1');
  const d4 = RTG.parseSquare('d4'), d8 = RTG.parseSquare('d8');
  const atk = N.findAttackers(g, d4, RTG.BLACK);
  check('rook d8 attacks queen d4', atk.indexOf(d8) >= 0, atk.map(RTG.algebraic).join(','));
  const hang = N.hangingSquares(g, RTG.WHITE);
  check('white queen is hanging', hang.indexOf(d4) >= 0, hang.map(RTG.algebraic).join(','));
}

// a defended piece is NOT hanging
{
  // black rook d8 attacks white queen d4, white rook d1 defends it
  const g = new RTG.Game('3rk3/8/8/8/3Q4/8/8/3RK3 w - - 0 1');
  const hang = N.hangingSquares(g, RTG.WHITE);
  check('defended queen not hanging', hang.indexOf(RTG.parseSquare('d4')) < 0);
}

// describePiece mentions the piece name and is a string
{
  const g = new RTG.Game();
  const txt = N.describePiece(g, RTG.parseSquare('g1'), RTG.WHITE);
  check('describe knight mentions Knight', /Knight/.test(txt), (txt || '').slice(0, 40));
}

// explainBoard runs and mentions the goal
{
  const g = new RTG.Game();
  const txt = N.explainBoard(g, RTG.WHITE);
  check('explainBoard mentions the goal', /trap the enemy King/i.test(txt));
}

// explainMove does not corrupt game state and returns a reason
{
  const g = new RTG.Game('6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1');
  const before = g.fen();
  const m = g.moveFromUci('e1e8'); // back-rank mate
  const txt = N.explainMove(g, m, RTG.WHITE, 1, 'Re8#');
  check('explainMove state intact', g.fen() === before, g.fen());
  check('explainMove flags checkmate', /checkmate/i.test(txt), txt.slice(0, 60));
}

// free capture detection: undefended black bishop attacked by white rook
{
  const g = new RTG.Game('4k3/8/8/1b6/8/8/8/1R2K3 w - - 0 1');
  const enemyHang = N.hangingSquares(g, RTG.BLACK);
  check('black bishop b5 hangs to rook', enemyHang.indexOf(RTG.parseSquare('b5')) >= 0,
    enemyHang.map(RTG.algebraic).join(','));
}

console.log(failures ? `\n${failures} FAILURES` : '\nall passed');
process.exit(failures ? 1 : 0);
