/* ============================================================
   Road to GM — the Narrator: explains a position in plain English
   for players who are brand new to chess. Pure functions on a Game.
   ============================================================ */
(function () {
  'use strict';
  var R = (typeof module !== 'undefined' && module.exports)
    ? require('./engine.js')
    : window.RTG;

  var WHITE = R.WHITE, BLACK = R.BLACK, BLACK_FLAG = R.BLACK_FLAG;
  var PAWN = R.PAWN, KNIGHT = R.KNIGHT, BISHOP = R.BISHOP, ROOK = R.ROOK, QUEEN = R.QUEEN, KING = R.KING;

  var NAMES = ['', 'Pawn', 'Knight', 'Bishop', 'Rook', 'Queen', 'King'];
  var VAL = [0, 1, 3, 3, 5, 9, 0]; // material points (king not counted)
  var MOVE_RULE = {
    1: 'one square straight forward, and captures one square diagonally',
    2: 'in an L-shape, and it can jump over other pieces',
    3: 'diagonally, as far as the path is clear',
    4: 'in straight lines up, down, or sideways',
    5: 'in any straight line or diagonal — the most powerful piece',
    6: 'one single square in any direction'
  };

  var KN = [14, 18, 31, 33, -14, -18, -31, -33];
  var KG = [1, -1, 16, -16, 15, 17, -15, -17];
  var BD = [15, 17, -15, -17];
  var RD = [1, -1, 16, -16];

  function name(code) { return NAMES[code & 7]; }
  function sq(s) { return R.algebraic(s); }
  function colorOf(code) { return (code & BLACK_FLAG) ? BLACK : WHITE; }
  function owner(code, userColor) { return colorOf(code) === userColor ? 'your' : 'their'; }
  function Owner(code, userColor) { return colorOf(code) === userColor ? 'Your' : 'Their'; }

  // join ["a1","b2","c3"] -> "a1, b2 and c3"
  function joinList(arr) {
    if (!arr.length) return '';
    if (arr.length === 1) return arr[0];
    if (arr.length === 2) return arr[0] + ' and ' + arr[1];
    return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
  }

  // every square holding a piece of `byColor` that attacks `target`
  function findAttackers(g, target, byColor) {
    var b = g.board, res = [], flag = byColor ? BLACK_FLAG : 0, t, p, ty, i;
    if (byColor === WHITE) {
      if (!((target - 15) & 0x88) && b[target - 15] === PAWN) res.push(target - 15);
      if (!((target - 17) & 0x88) && b[target - 17] === PAWN) res.push(target - 17);
    } else {
      if (!((target + 15) & 0x88) && b[target + 15] === (PAWN | 8)) res.push(target + 15);
      if (!((target + 17) & 0x88) && b[target + 17] === (PAWN | 8)) res.push(target + 17);
    }
    for (i = 0; i < 8; i++) { t = target + KN[i]; if (!(t & 0x88) && b[t] === (KNIGHT | flag)) res.push(t); }
    for (i = 0; i < 8; i++) { t = target + KG[i]; if (!(t & 0x88) && b[t] === (KING | flag)) res.push(t); }
    for (i = 0; i < 4; i++) {
      t = target + BD[i];
      while (!(t & 0x88)) { p = b[t]; if (p) { if ((p & BLACK_FLAG) === flag) { ty = p & 7; if (ty === BISHOP || ty === QUEEN) res.push(t); } break; } t += BD[i]; }
    }
    for (i = 0; i < 4; i++) {
      t = target + RD[i];
      while (!(t & 0x88)) { p = b[t]; if (p) { if ((p & BLACK_FLAG) === flag) { ty = p & 7; if (ty === ROOK || ty === QUEEN) res.push(t); } break; } t += RD[i]; }
    }
    return res;
  }

  function isDefended(g, s, byColor) { return findAttackers(g, s, byColor).length > 0; }

  // squares of `color` that are attacked and not defended (free to grab)
  function hangingSquares(g, color) {
    var b = g.board, out = [], enemy = color ^ 1;
    for (var s = 0; s < 128; s++) {
      if (s & 0x88) continue;
      var p = b[s];
      if (!p || colorOf(p) !== color) continue;
      if ((p & 7) === KING) continue;
      if (findAttackers(g, s, enemy).length && !findAttackers(g, s, color).length) out.push(s);
    }
    return out;
  }

  function materialCount(g, color) {
    var b = g.board, total = 0;
    for (var s = 0; s < 128; s++) {
      if (s & 0x88) continue;
      var p = b[s];
      if (p && colorOf(p) === color) total += VAL[p & 7];
    }
    return total;
  }

  // ---- describe a single piece the player has clicked ----------------
  function describePiece(g, s, userColor) {
    var code = g.board[s];
    if (!code) return null;
    var mine = colorOf(code) === userColor;
    var legal = g.legalMoves();
    var quiet = [], caps = [];
    for (var i = 0; i < legal.length; i++) {
      if (R.mvFrom(legal[i]) !== s) continue;
      var to = R.mvTo(legal[i]);
      if (legal[i] & R.F_CAP) {
        var victimSq = to;
        if (legal[i] & R.F_EP) victimSq = userColor === WHITE ? to - 16 : to + 16;
        caps.push({ to: to, victim: g.board[victimSq] });
      } else quiet.push(to);
    }
    var enemy = colorOf(code) ^ 1;
    var attackers = findAttackers(g, s, enemy);
    var defenders = findAttackers(g, s, colorOf(code));

    var parts = [];
    parts.push('<b>' + Owner(code, userColor) + ' ' + name(code) + ' on ' + sq(s) + '.</b> ' +
      'A ' + name(code) + ' moves ' + MOVE_RULE[code & 7] + '.');

    if (mine) {
      if (quiet.length) {
        parts.push('Right now it can move to <b>' + joinList(quiet.map(sq)) + '</b> — those are the highlighted squares.');
      } else if (!caps.length) {
        parts.push('It has nowhere to go this turn.');
      }
      if (caps.length) {
        var capTxt = caps.map(function (c) { return name(c.victim) + ' on ' + sq(c.to); });
        parts.push('💥 It can capture the <b>' + joinList(capTxt) + '</b>!');
      }
      if (attackers.length) {
        var atk = g.board[attackers[0]];
        var warn = '⚠️ Careful: this ' + name(code) + ' is being attacked by ' +
          owner(atk, userColor) + ' ' + name(atk) + ' on ' + sq(attackers[0]) + '.';
        if (!defenders.length) warn += ' Nothing is guarding it, so it could be taken for free — move it or defend it.';
        else warn += ' It is defended, so a trade is possible but not a free loss.';
        parts.push(warn);
      }
    } else {
      // an enemy piece: help them see the threat it poses
      parts.push('This is an enemy piece. Watch what squares it controls.');
      if (attackers.length) {
        parts.push('Good news: you are attacking it with ' + attackers.length + ' of your pieces.');
      }
    }
    return parts.join('<br>');
  }

  // ---- read the whole board -------------------------------------------
  function explainBoard(g, userColor) {
    var enemy = userColor ^ 1;
    var parts = [];

    // 1. the ever-present reminder of the goal
    parts.push('<b>The goal never changes:</b> trap the enemy King (checkmate) while keeping yours safe. ' +
      'Every move should do one of these: attack the King, win material, make your pieces stronger, or protect your own stuff.');

    // 2. check status
    if (g.inCheck(userColor)) {
      parts.push('🚨 <b>Your King is in check!</b> You must fix it this move: move the King, block the line, or capture the checker.');
    } else if (g.inCheck(enemy)) {
      parts.push('You are giving check — the opponent has to respond to it.');
    }

    // 3. material
    var mine = materialCount(g, userColor), theirs = materialCount(g, enemy);
    var diff = mine - theirs;
    if (diff === 0) parts.push('Material is even (' + mine + ' points each). Pawn=1, Knight=Bishop=3, Rook=5, Queen=9.');
    else if (diff > 0) parts.push('You are <b>ahead by ' + diff + ' point' + (diff > 1 ? 's' : '') + '</b> of material. Good — trading pieces evenly will keep that lead.');
    else parts.push('You are <b>behind by ' + (-diff) + ' point' + (-diff > 1 ? 's' : '') + '</b>. Look for a chance to win material back, and avoid more trades for now.');

    // 4. your hanging pieces
    var myHang = hangingSquares(g, userColor);
    if (myHang.length) {
      var h = myHang.map(function (s) { return name(g.board[s]) + ' on ' + sq(s); });
      parts.push('⚠️ <b>In danger:</b> your ' + joinList(h) + ' ' + (myHang.length > 1 ? 'are' : 'is') +
        ' attacked and undefended. Rescue ' + (myHang.length > 1 ? 'them' : 'it') + ' before the opponent grabs ' + (myHang.length > 1 ? 'them' : 'it') + ' for free.');
    }

    // 5. free captures for you
    var theirHang = hangingSquares(g, enemy).filter(function (s) {
      return findAttackers(g, s, userColor).length > 0;
    });
    if (theirHang.length) {
      var f = theirHang.map(function (s) { return name(g.board[s]) + ' on ' + sq(s); });
      parts.push('💰 <b>Free to take:</b> their ' + joinList(f) + ' ' + (theirHang.length > 1 ? 'are' : 'is') +
        ' hanging. Check that your capture is safe, then grab it!');
    }

    // 6. phase advice
    if (g.fullmove <= 8) {
      parts.push('It is still the opening. Get your Knights and Bishops off the back row toward the center, then castle your King to safety.');
    } else if (!myHang.length && !theirHang.length) {
      parts.push('Nothing is hanging. Improve your worst-placed piece, or line up an attack on something the opponent cares about.');
    }
    return parts.join('<br><br>');
  }

  // ---- explain WHY a suggested move is good ---------------------------
  function explainMove(g, move, userColor, mateIn, san) {
    var from = R.mvFrom(move), to = R.mvTo(move), pt = R.mvPiece(move);
    var lead = 'Play <b>' + (san || '') + '</b>: move your ' + name(pt | (userColor ? 8 : 0)) +
      ' from ' + sq(from) + ' to ' + sq(to) + '.';
    var reasons = [];

    // was the moving piece in danger before?
    var wasHanging = findAttackers(g, from, userColor ^ 1).length > 0 &&
      findAttackers(g, from, userColor).length === 0 && pt !== KING;

    var captured = R.mvCaptured(move);
    g.make(move);
    var givesCheck = g.inCheck(userColor ^ 1);
    var nowSafe = findAttackers(g, to, userColor ^ 1).length === 0 ||
      findAttackers(g, to, userColor).length > 0;
    g.unmake();

    if (mateIn && mateIn > 0) {
      reasons.push(mateIn === 1 ? 'It is checkmate — you win right now!' : 'It forces checkmate in ' + mateIn + ' moves.');
    }
    if (move & R.F_PROMO) reasons.push('Your pawn reaches the end and becomes a brand-new Queen.');
    if (move & R.F_CASTLE) reasons.push('It castles, tucking your King safely into the corner and waking up a Rook.');
    if (captured) {
      var vName = NAMES[captured];
      if (VAL[captured] >= VAL[pt]) reasons.push('It wins material by capturing their ' + vName + '.');
      else reasons.push('It captures their ' + vName + '.');
    }
    if (givesCheck && !(mateIn > 0)) reasons.push('It attacks the enemy King (check), forcing a reply.');
    if (wasHanging) reasons.push('It rescues a piece that was under attack.');
    if (!captured && !(move & R.F_CASTLE) && (pt === KNIGHT || pt === BISHOP)) {
      var backRank = userColor === WHITE ? 0 : 7;
      if ((from >> 4) === backRank && g.fullmove <= 10) {
        reasons.push('It develops a piece toward the center, getting you ready to castle.');
      }
    }
    if (!nowSafe) reasons.push('(Heads up: the piece can be attacked there — make sure you are happy with the trade.)');
    if (!reasons.length) reasons.push('It is the strongest move here: it quietly improves your position and keeps everything safe.');

    return lead + '<br><b>Why:</b> ' + reasons.join(' ');
  }

  var api = {
    pieceName: function (code) { return name(code); },
    describePiece: describePiece,
    explainBoard: explainBoard,
    explainMove: explainMove,
    hangingSquares: hangingSquares,
    findAttackers: findAttackers,
    materialCount: materialCount
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.RTGNarrator = api;
}());
