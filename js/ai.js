/* ============================================================
   Road to GM — AI: evaluation, alpha-beta search, bot personas
   Depends on engine.js (RTG). Browser global RTGAI / Node module.
   ============================================================ */
(function () {
  'use strict';
  var RTG = (typeof module !== 'undefined' && module.exports)
    ? require('./engine.js')
    : (typeof window !== 'undefined' ? window.RTG : this.RTG);

  var WHITE = RTG.WHITE, BLACK = RTG.BLACK;
  var PAWN = RTG.PAWN, KNIGHT = RTG.KNIGHT, BISHOP = RTG.BISHOP,
    ROOK = RTG.ROOK, QUEEN = RTG.QUEEN, KING = RTG.KING;
  var F_CAP = RTG.F_CAP, F_PROMO = RTG.F_PROMO;
  var MATE = RTG.MATE;

  var VAL = [0, 100, 320, 330, 500, 900, 20000];

  // ---- piece-square tables (printed a8..h1, white POV) ----------
  var PST_PAWN = [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0];
  var PST_KNIGHT = [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50];
  var PST_BISHOP = [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20];
  var PST_ROOK = [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0];
  var PST_QUEEN = [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20];
  var PST_KING_MG = [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20];
  var PST_KING_EG = [
    -50, -40, -30, -20, -20, -30, -40, -50,
    -30, -20, -10, 0, 0, -10, -20, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -30, 0, 0, 0, 0, -30, -30,
    -50, -30, -30, -30, -30, -30, -30, -50];

  // Precompute per piece-code lookup for 0x88 squares.
  // MG[code*128+sq], EG[...]; positive = good for that piece's owner.
  var MG = new Int16Array(15 * 128), EG = new Int16Array(15 * 128);
  (function initPst() {
    var src = [null, PST_PAWN, PST_KNIGHT, PST_BISHOP, PST_ROOK, PST_QUEEN, PST_KING_MG];
    for (var type = 1; type <= 6; type++) {
      for (var sq = 0; sq < 128; sq++) {
        if (sq & 0x88) continue;
        var file = sq & 7, rank = sq >> 4;
        var wIdx = (7 - rank) * 8 + file;   // white perspective (printed table)
        var bIdx = rank * 8 + file;         // mirrored for black
        var wPst = src[type][wIdx], bPst = src[type][bIdx];
        var wEg = type === KING ? PST_KING_EG[wIdx] : wPst;
        var bEg = type === KING ? PST_KING_EG[bIdx] : bPst;
        MG[type * 128 + sq] = VAL[type] + wPst;
        EG[type * 128 + sq] = VAL[type] + wEg;
        MG[(type | 8) * 128 + sq] = VAL[type] + bPst;
        EG[(type | 8) * 128 + sq] = VAL[type] + bEg;
      }
    }
  }());

  var PASSED_BONUS = [0, 5, 10, 20, 35, 60, 100, 0]; // by relative rank

  // ---- evaluation (score from side-to-move POV) ------------------
  function evaluate(g) {
    var b = g.board;
    var mg = 0, eg = 0, phase = 0;
    var pawnFiles = [new Int8Array(8), new Int8Array(8)];
    var pawnSquares = [[], []];
    var bishops = [0, 0];
    var sq, p, type, color, file, rank, i;

    for (sq = 0; sq < 128; sq++) {
      if (sq & 0x88) continue;
      p = b[sq];
      if (!p) continue;
      type = p & 7; color = (p & 8) ? BLACK : WHITE;
      var sign = color === WHITE ? 1 : -1;
      mg += sign * MG[p * 128 + sq];
      eg += sign * EG[p * 128 + sq];
      if (type === KNIGHT || type === BISHOP) phase += 1;
      else if (type === ROOK) phase += 2;
      else if (type === QUEEN) phase += 4;
      if (type === PAWN) {
        pawnFiles[color][sq & 7]++;
        pawnSquares[color].push(sq);
      } else if (type === BISHOP) bishops[color]++;
    }
    if (phase > 24) phase = 24;

    // bishop pair
    if (bishops[WHITE] >= 2) { mg += 32; eg += 40; }
    if (bishops[BLACK] >= 2) { mg -= 32; eg -= 40; }

    // pawn structure
    for (var c = 0; c <= 1; c++) {
      var sign2 = c === WHITE ? 1 : -1;
      var mine = pawnFiles[c], theirs = pawnFiles[c ^ 1];
      for (file = 0; file < 8; file++) {
        if (mine[file] > 1) { mg -= sign2 * 14 * (mine[file] - 1); eg -= sign2 * 18 * (mine[file] - 1); }
        if (mine[file] > 0) {
          var left = file > 0 ? mine[file - 1] : 0;
          var right = file < 7 ? mine[file + 1] : 0;
          if (!left && !right) { mg -= sign2 * 12; eg -= sign2 * 14; }
        }
      }
      // passed pawns
      var list = pawnSquares[c];
      for (i = 0; i < list.length; i++) {
        sq = list[i]; file = sq & 7; rank = sq >> 4;
        var rel = c === WHITE ? rank : 7 - rank;
        var passed = true;
        // any enemy pawn on same/adjacent file ahead?
        var enemies = pawnSquares[c ^ 1];
        for (var k = 0; k < enemies.length; k++) {
          var esq = enemies[k], ef = esq & 7, er = esq >> 4;
          if (ef >= file - 1 && ef <= file + 1) {
            if (c === WHITE ? er > rank : er < rank) { passed = false; break; }
          }
        }
        if (passed) { mg += sign2 * PASSED_BONUS[rel]; eg += sign2 * (PASSED_BONUS[rel] + rel * 8); }
      }
    }

    // rooks on open files, king shield
    for (var c2 = 0; c2 <= 1; c2++) {
      var s3 = c2 === WHITE ? 1 : -1;
      var flag = c2 === BLACK ? 8 : 0;
      for (sq = 0; sq < 128; sq++) {
        if (sq & 0x88) continue;
        if (b[sq] !== (ROOK | flag)) continue;
        file = sq & 7;
        var own = pawnFiles[c2][file], opp = pawnFiles[c2 ^ 1][file];
        if (!own && !opp) mg += s3 * 14;
        else if (!own) mg += s3 * 7;
        var rel2 = c2 === WHITE ? (sq >> 4) : 7 - (sq >> 4);
        if (rel2 === 6) { mg += s3 * 18; eg += s3 * 12; } // rook on 7th
      }
      // king pawn shield (midgame)
      var ksq = g.kingSq[c2], kf = ksq & 7, kr = ksq >> 4;
      var ahead = c2 === WHITE ? 1 : -1;
      var shield = 0;
      for (var df = -1; df <= 1; df++) {
        var f2 = kf + df;
        if (f2 < 0 || f2 > 7) continue;
        var s1 = (kr + ahead) * 16 + f2, sB = (kr + 2 * ahead) * 16 + f2;
        var pawnCode = PAWN | flag;
        if (!(s1 & 0x88) && b[s1] === pawnCode) shield += 10;
        else if (!(sB & 0x88) && b[sB] === pawnCode) shield += 5;
      }
      mg += s3 * (shield - 20); // missing shield hurts
    }

    var score = Math.round((mg * phase + eg * (24 - phase)) / 24);
    score += g.turn === WHITE ? 8 : -8; // tempo
    return g.turn === WHITE ? score : -score;
  }

  // ---- search ------------------------------------------------------
  var TT_EXACT = 0, TT_LOWER = 1, TT_UPPER = 2;
  var tt = new Map();
  var killers = [];
  var historyTable = new Int32Array(15 * 128);
  var S = { stop: false, deadline: 0, nodes: 0 };

  function resetSearchState() {
    tt.clear();
    historyTable.fill(0);
  }

  function ttKey32(g) { return (g.keyLo ^ g.keyHi) | 0; }

  function scoreMove(g, m, ttMove, ply) {
    if (m === ttMove) return 10000000;
    if (m & F_PROMO) return 9000000 + VAL[RTG.mvPromo(m)];
    if (m & F_CAP) return 8000000 + VAL[RTG.mvCaptured(m)] * 10 - VAL[RTG.mvPiece(m)];
    var kl = killers[ply];
    if (kl) {
      if (m === kl[0]) return 7000000;
      if (m === kl[1]) return 6900000;
    }
    return historyTable[RTG.mvPiece(m) * 128 + RTG.mvTo(m)] | 0;
  }

  function qsearch(g, alpha, beta, ply) {
    S.nodes++;
    if ((S.nodes & 1023) === 0 && Date.now() > S.deadline) S.stop = true;
    if (S.stop) return alpha;
    var stand = evaluate(g);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (ply > 60) return alpha;

    var moves = g.genMoves(true), i, j, n = moves.length;
    var scores = [];
    for (i = 0; i < n; i++) scores.push(VAL[RTG.mvCaptured(moves[i])] * 10 - VAL[RTG.mvPiece(moves[i])] + ((moves[i] & F_PROMO) ? 5000 : 0));
    var us = g.turn;
    for (i = 0; i < n; i++) {
      // selection sort
      var bi = i;
      for (j = i + 1; j < n; j++) if (scores[j] > scores[bi]) bi = j;
      var tmp = moves[i]; moves[i] = moves[bi]; moves[bi] = tmp;
      var ts = scores[i]; scores[i] = scores[bi]; scores[bi] = ts;
      var m = moves[i];
      // delta pruning
      if (!(m & F_PROMO) && stand + VAL[RTG.mvCaptured(m)] + 200 < alpha) continue;
      g.make(m);
      if (g.isAttacked(g.kingSq[us], g.turn)) { g.unmake(); continue; }
      var v = -qsearch(g, -beta, -alpha, ply + 1);
      g.unmake();
      if (S.stop) return alpha;
      if (v > alpha) {
        alpha = v;
        if (alpha >= beta) return alpha;
      }
    }
    return alpha;
  }

  function hasNonPawnMaterial(g, color) {
    var flag = color === BLACK ? 8 : 0, b = g.board;
    for (var sq = 0; sq < 128; sq++) {
      if (sq & 0x88) continue;
      var p = b[sq];
      if (p && (p & 8) === flag) {
        var t = p & 7;
        if (t !== PAWN && t !== KING) return true;
      }
    }
    return false;
  }

  function negamax(g, depth, alpha, beta, ply, allowNull) {
    if (S.stop) return alpha;
    S.nodes++;
    if ((S.nodes & 1023) === 0 && Date.now() > S.deadline) { S.stop = true; return alpha; }

    if (ply > 0) {
      if (g.halfmove >= 100 || g.repetitionCount() >= 1) return 0;
      // mate distance pruning
      var mateAlpha = -MATE + ply, mateBeta = MATE - ply - 1;
      if (alpha < mateAlpha) alpha = mateAlpha;
      if (beta > mateBeta) beta = mateBeta;
      if (alpha >= beta) return alpha;
    }

    var inChk = g.inCheck();
    if (inChk) depth++;
    if (depth <= 0) return qsearch(g, alpha, beta, ply);

    // TT probe
    var k32 = ttKey32(g), e = tt.get(k32), ttMove = 0;
    if (e && e.lo === g.keyLo && e.hi === g.keyHi) {
      ttMove = e.move;
      if (e.depth >= depth && ply > 0) {
        var sc = e.score;
        if (sc > MATE - 1000) sc -= ply;
        else if (sc < -MATE + 1000) sc += ply;
        if (e.flag === TT_EXACT) return sc;
        if (e.flag === TT_LOWER && sc >= beta) return sc;
        if (e.flag === TT_UPPER && sc <= alpha) return sc;
      }
    }

    // null-move pruning
    if (!inChk && allowNull && depth >= 3 && ply > 0 && hasNonPawnMaterial(g, g.turn)) {
      g.makeNull();
      var nv = -negamax(g, depth - 3, -beta, -beta + 1, ply + 1, false);
      g.unmakeNull();
      if (S.stop) return alpha;
      if (nv >= beta) return beta;
    }

    var moves = g.genMoves(false), n = moves.length, i, j;
    var scores = new Array(n);
    for (i = 0; i < n; i++) scores[i] = scoreMove(g, moves[i], ttMove, ply);

    var us = g.turn, legalCount = 0, best = -Infinity, bestMove = 0;
    var flag = TT_UPPER;

    for (i = 0; i < n; i++) {
      var bi = i;
      for (j = i + 1; j < n; j++) if (scores[j] > scores[bi]) bi = j;
      var tm = moves[i]; moves[i] = moves[bi]; moves[bi] = tm;
      var tsc = scores[i]; scores[i] = scores[bi]; scores[bi] = tsc;
      var m = moves[i];

      g.make(m);
      if (g.isAttacked(g.kingSq[us], g.turn)) { g.unmake(); continue; }
      legalCount++;
      var v;
      // late move reduction
      if (legalCount > 4 && depth >= 3 && !inChk && !(m & F_CAP) && !(m & F_PROMO)) {
        v = -negamax(g, depth - 2, -alpha - 1, -alpha, ply + 1, true);
        if (v > alpha && !S.stop) v = -negamax(g, depth - 1, -beta, -alpha, ply + 1, true);
      } else {
        v = -negamax(g, depth - 1, -beta, -alpha, ply + 1, true);
      }
      g.unmake();
      if (S.stop) return alpha;

      if (v > best) { best = v; bestMove = m; }
      if (v > alpha) {
        alpha = v;
        flag = TT_EXACT;
        if (alpha >= beta) {
          flag = TT_LOWER;
          if (!(m & F_CAP)) {
            if (!killers[ply]) killers[ply] = [0, 0];
            if (killers[ply][0] !== m) { killers[ply][1] = killers[ply][0]; killers[ply][0] = m; }
            historyTable[RTG.mvPiece(m) * 128 + RTG.mvTo(m)] += depth * depth;
          }
          break;
        }
      }
    }

    if (!legalCount) return inChk ? -MATE + ply : 0;

    var stored = best;
    if (stored > MATE - 1000) stored += ply;
    else if (stored < -MATE + 1000) stored -= ply;
    if (tt.size > 400000) tt.clear();
    tt.set(k32, { lo: g.keyLo, hi: g.keyHi, depth: depth, flag: flag, score: stored, move: bestMove });
    return best;
  }

  // principal variation from TT
  function extractPv(g, firstMove, maxLen) {
    var pv = [], made = 0, m = firstMove;
    while (m && made < maxLen) {
      // verify legal
      var legal = g.legalMoves(), found = 0;
      for (var i = 0; i < legal.length; i++) if (legal[i] === m) { found = m; break; }
      if (!found) break;
      pv.push(RTG.uci(m));
      g.make(m); made++;
      var e = tt.get(ttKey32(g));
      m = (e && e.lo === g.keyLo && e.hi === g.keyHi) ? e.move : 0;
    }
    while (made--) g.unmake();
    return pv;
  }

  /**
   * think(game, opts) -> {move, score, depth, nodes, rootScores, pv, mate}
   * opts: {timeMs, maxDepth}
   * score is centipawns from the side-to-move perspective; mate = plies if forced.
   */
  function think(g, opts) {
    var timeMs = opts.timeMs || 1000;
    var maxDepth = opts.maxDepth || 30;
    S.stop = false;
    S.nodes = 0;
    S.deadline = Date.now() + timeMs;
    killers = [];
    // decay history
    for (var h = 0; h < historyTable.length; h++) historyTable[h] = historyTable[h] >> 1;

    var fenBefore = null; // debug guard (cheap): ply must balance
    var plyBefore = g.ply;

    var rootMoves = g.legalMoves();
    if (rootMoves.length === 0) return null;

    var t0 = Date.now();
    var bestMove = rootMoves[0], bestScore = -Infinity, completedDepth = 0;
    var rootScores = rootMoves.map(function (m) { return { move: m, score: -Infinity }; });

    for (var depth = 1; depth <= maxDepth; depth++) {
      var alpha = -Infinity, beta = Infinity;
      var iterBest = 0, iterScore = -Infinity;
      var iterScores = [];
      var us = g.turn;

      for (var i = 0; i < rootScores.length; i++) {
        var m = rootScores[i].move;
        g.make(m);
        var v = -negamax(g, depth - 1, -beta, -alpha, 1, true);
        g.unmake();
        if (S.stop && depth > 1) break;
        iterScores.push({ move: m, score: v });
        if (v > iterScore) { iterScore = v; iterBest = m; }
        if (v > alpha) alpha = v;
      }

      if (iterBest && (!S.stop || depth === 1 || iterScores.length === rootScores.length ||
        (iterScores.length > 0 && iterScore > -Infinity))) {
        if (!S.stop || iterScores.length === rootScores.length) {
          // full iteration completed
          bestMove = iterBest; bestScore = iterScore; completedDepth = depth;
          iterScores.sort(function (a, b) { return b.score - a.score; });
          rootScores = iterScores;
        } else if (iterScores.length > 0 && iterScores[0].score >= bestScore) {
          // partial: first (previously best) move finished and is still fine
          bestMove = iterScores.sort(function (a, b) { return b.score - a.score; })[0].move;
        }
      }
      if (S.stop) break;
      if (bestScore > MATE - 1000 && (MATE - bestScore) <= depth) break; // mate found, no need deeper
      var elapsed = Date.now() - t0;
      if (elapsed > timeMs * 0.55) break;
    }

    // safety: search must leave the game untouched
    if (g.ply !== plyBefore) {
      while (g.ply > plyBefore) g.unmake();
    }

    var mate = 0;
    if (bestScore > MATE - 1000) mate = Math.ceil((MATE - bestScore) / 2);
    else if (bestScore < -MATE + 1000) mate = -Math.ceil((MATE + bestScore) / 2);

    return {
      move: bestMove,
      score: bestScore === -Infinity ? 0 : bestScore,
      depth: completedDepth,
      nodes: S.nodes,
      time: Date.now() - t0,
      rootScores: rootScores,
      pv: extractPv(g, bestMove, 8),
      mate: mate
    };
  }

  // quick static analysis wrapper for the coach / eval bar
  function analyze(g, timeMs) {
    return think(g, { timeMs: timeMs || 600, maxDepth: 20 });
  }

  // ---- bot personalities ------------------------------------------
  var BOTS = [
    {
      id: 'pip', name: 'Pip', elo: 350, emoji: '🐣', tier: 'Beginner',
      blurb: 'Plays on vibes. Sometimes notices a free piece, mostly just moves.',
      teach: 'Board vision. Before every move ask: what changed? What is attacked?',
      params: { random: 0.6, depth: 1, time: 60, band: 300, temp: 120 }
    },
    {
      id: 'ruk', name: 'Ruk', elo: 700, emoji: '🧢', tier: 'Casual',
      blurb: 'Sees one move ahead. Grabs free pieces but walks into simple tactics.',
      teach: 'Stop hanging pieces, and take everything your opponent hangs.',
      params: { random: 0.12, depth: 1, time: 120, band: 150, temp: 60 }
    },
    {
      id: 'nia', name: 'Nia', elo: 1100, emoji: '🎯', tier: 'Club',
      blurb: 'Punishes hung pieces and knows basic openings. Wobbly under pressure.',
      teach: 'Two-move tactics: forks, pins, skewers. Count attackers and defenders.',
      params: { random: 0.05, depth: 2, time: 250, band: 90, temp: 40, book: true }
    },
    {
      id: 'boris', name: 'Boris', elo: 1500, emoji: '🎓', tier: 'Tournament',
      blurb: 'A solid club player. Finds three-move combinations and sound plans.',
      teach: 'Pawn structure, piece activity, and basic endgame technique.',
      params: { random: 0.02, depth: 3, time: 450, band: 50, temp: 25, book: true }
    },
    {
      id: 'vera', name: 'Vera', elo: 1900, emoji: '🦉', tier: 'Expert',
      blurb: 'Sharp, patient and accurate. Rarely gives you a second chance.',
      teach: 'Deep calculation and converting small advantages into wins.',
      params: { random: 0.005, depth: 14, time: 900, band: 20, temp: 12, book: true }
    },
    {
      id: 'kron', name: 'Kron', elo: 2200, emoji: '🤖', tier: 'Master',
      blurb: 'Cold and precise. Every loose move gets punished immediately.',
      teach: 'Prophylaxis. Ask what your opponent wants before you move.',
      params: { depth: 18, time: 1700, band: 0, book: true }
    },
    {
      id: 'magnus', name: 'Magnus Mode', elo: 2500, emoji: '🐐', tier: 'The Goat',
      blurb: 'Full engine strength, no mercy. The final boss of this app.',
      teach: 'Survive the opening, fight for every draw, celebrate every win.',
      params: { depth: 30, time: 3000, band: 0, book: true }
    }
  ];

  function botById(id) {
    for (var i = 0; i < BOTS.length; i++) if (BOTS[i].id === id) return BOTS[i];
    return BOTS[2];
  }

  /**
   * Pick a move for a bot. sanLine = SAN strings of game so far (for book).
   * bookProbe = optional function(sanLine) -> uci string or null.
   */
  function pickBotMove(g, bot, sanLine, bookProbe) {
    var p = bot.params;
    var legal = g.legalMoves();
    if (legal.length === 0) return 0;
    if (legal.length === 1) return legal[0];

    // opening book
    if (p.book && bookProbe && sanLine && sanLine.length < 16) {
      var bookUci = bookProbe(sanLine);
      if (bookUci) {
        var bm = g.moveFromUci(bookUci);
        if (bm) return bm;
      }
    }

    // pure blunder chance
    if (p.random && Math.random() < p.random) {
      return legal[(Math.random() * legal.length) | 0];
    }

    var r = think(g, { timeMs: p.time, maxDepth: p.depth });
    if (!r || !r.move) return legal[0];

    // imprecision: pick among near-best moves with softmax weighting
    if (p.band && r.rootScores && r.rootScores.length > 1) {
      var best = r.rootScores[0].score;
      var cands = r.rootScores.filter(function (rs) {
        return rs.score > -Infinity && best - rs.score <= p.band;
      });
      if (cands.length > 1) {
        var temp = p.temp || 30;
        var weights = cands.map(function (rs) { return Math.exp((rs.score - best) / temp); });
        var sum = weights.reduce(function (a, b) { return a + b; }, 0);
        var roll = Math.random() * sum;
        for (var i = 0; i < cands.length; i++) {
          roll -= weights[i];
          if (roll <= 0) return cands[i].move;
        }
      }
    }
    return r.move;
  }

  // score (side-to-move POV) -> white POV
  function toWhitePov(score, turn) { return turn === WHITE ? score : -score; }

  function formatScore(scoreWhitePov) {
    if (scoreWhitePov > MATE - 1000) return 'M' + Math.ceil((MATE - scoreWhitePov) / 2);
    if (scoreWhitePov < -MATE + 1000) return '-M' + Math.ceil((MATE + scoreWhitePov) / 2);
    var v = scoreWhitePov / 100;
    return (v > 0 ? '+' : '') + v.toFixed(1);
  }

  // win probability (0..100) for white from a white-POV cp score
  function winPercent(scoreWhitePov) {
    if (scoreWhitePov > MATE - 1000) return 100;
    if (scoreWhitePov < -MATE + 1000) return 0;
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * scoreWhitePov)) - 1);
  }

  var api = {
    evaluate: evaluate, think: think, analyze: analyze,
    BOTS: BOTS, botById: botById, pickBotMove: pickBotMove,
    toWhitePov: toWhitePov, formatScore: formatScore, winPercent: winPercent,
    resetSearchState: resetSearchState, VAL: VAL
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (typeof window !== 'undefined' ? window : this).RTGAI = api;
}());
