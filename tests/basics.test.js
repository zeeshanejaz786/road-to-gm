// Verify every First Steps lesson is actually solvable on the rules engine.
// node tests/basics.test.js
const RTG = require('../js/engine.js');

// load lesson data (basics.js is browser-flavored; shim the globals it wants)
global.window = { RTG: RTG, RTGSound: {} };
require('../js/basics.js');
const LESSONS = global.window.RTG_LESSONS;

let failures = 0;
function check(name, cond, extra) {
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`);
  if (!cond) failures++;
}

function forceWhite(g) {
  const parts = g.fen().split(' ');
  parts[1] = 'w'; parts[3] = '-';
  return new RTG.Game(parts.join(' '));
}

// BFS: can the drill collect all stars / capture all enemies within maxPlies?
function bfsSolvable(fen, starsAlg, wantCaptureAll, maxPlies) {
  const stars = (starsAlg || []).map(RTG.parseSquare);
  const start = { fen, left: stars.slice() };
  const seen = new Set();
  let frontier = [start];
  for (let ply = 0; ply <= maxPlies; ply++) {
    for (const node of frontier) {
      const g = new RTG.Game(node.fen);
      let enemies = 0;
      for (let sq = 0; sq < 128; sq++) {
        if (!(sq & 0x88) && g.board[sq] && (g.board[sq] & 8)) enemies++;
      }
      if (wantCaptureAll ? enemies === 0 : node.left.length === 0) return true;
    }
    const next = [];
    for (const node of frontier) {
      const g0 = new RTG.Game(node.fen);
      for (const m of g0.legalMoves()) {
        const g = new RTG.Game(node.fen);
        g.make(m);
        const g2 = forceWhite(g);
        const to = RTG.mvTo(m);
        const left = node.left.filter(s => s !== to);
        const key = g2.fen().split(' ')[0] + '|' + left.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ fen: g2.fen(), left });
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return false;
}

for (const l of LESSONS) {
  // every fen must load
  let g;
  try { g = new RTG.Game(l.fen); } catch (e) {
    check(`${l.id} fen loads`, false, e.message);
    continue;
  }
  check(`${l.id} fen loads`, true);

  switch (l.type) {
    case 'clicksquares':
      check(`${l.id} targets valid`, l.targets.every(t => RTG.parseSquare(t) >= 0));
      break;
    case 'collect':
      check(`${l.id} stars reachable`, bfsSolvable(l.fen, l.stars, false, 6));
      break;
    case 'capture':
      check(`${l.id} all enemies capturable`, bfsSolvable(l.fen, [], true, 6));
      break;
    case 'escape': {
      check(`${l.id} starts in check`, g.inCheck());
      check(`${l.id} has escapes`, g.legalMoves().length > 0);
      break;
    }
    case 'mate1': {
      let mates = 0;
      for (const m of g.legalMoves()) {
        g.make(m);
        const st = g.status();
        if (st.over && st.reason === 'checkmate') mates++;
        g.unmake();
      }
      check(`${l.id} mate-in-1 exists`, mates > 0, `${mates} mating move(s)`);
      break;
    }
    case 'castle':
      check(`${l.id} castling available`, g.legalMoves().some(m => m & RTG.F_CASTLE));
      break;
    case 'promote':
      check(`${l.id} promotion available`, g.legalMoves().some(m => m & RTG.F_PROMO));
      break;
    case 'ep':
      check(`${l.id} en passant available`, g.legalMoves().some(m => m & RTG.F_EP));
      break;
    case 'text':
      break;
    default:
      check(`${l.id} known type`, false, l.type);
  }
}

console.log(failures ? `\n${failures} FAILURES` : `\nall ${LESSONS.length} lessons verified`);
process.exit(failures ? 1 : 0);
