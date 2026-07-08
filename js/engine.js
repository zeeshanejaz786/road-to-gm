/* ============================================================
   Road to GM — chess engine (0x88 board, zobrist, SAN, perft)
   No dependencies. Works in browser (global RTG) and Node.
   ============================================================ */
(function () {
  'use strict';

  // ---- constants ------------------------------------------------
  var WHITE = 0, BLACK = 1;
  var EMPTY = 0, PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
  var BLACK_FLAG = 8; // piece code = type | (color ? 8 : 0)

  var MATE = 100000;

  // move int layout:
  // bits 0-6 from | 7-13 to | 14-16 piece type | 17-19 captured type | 20-22 promo type | 23+ flags
  var F_CAP = 1 << 23, F_DOUBLE = 1 << 24, F_EP = 1 << 25, F_CASTLE = 1 << 26, F_PROMO = 1 << 27;

  function mvFrom(m) { return m & 0x7f; }
  function mvTo(m) { return (m >> 7) & 0x7f; }
  function mvPiece(m) { return (m >> 14) & 7; }
  function mvCaptured(m) { return (m >> 17) & 7; }
  function mvPromo(m) { return (m >> 20) & 7; }

  function buildMove(from, to, piece, captured, promo, flags) {
    return from | (to << 7) | (piece << 14) | (captured << 17) | (promo << 20) | flags;
  }

  var KNIGHT_OFFS = [14, 18, 31, 33, -14, -18, -31, -33];
  var KING_OFFS = [1, -1, 16, -16, 15, 17, -15, -17];
  var BISHOP_DIRS = [15, 17, -15, -17];
  var ROOK_DIRS = [1, -1, 16, -16];

  // castling rights bits: 1 WK, 2 WQ, 4 BK, 8 BQ
  var CASTLE_MASK = new Int8Array(128).fill(15);
  CASTLE_MASK[0x04] = 15 & ~(1 | 2); // e1
  CASTLE_MASK[0x07] = 15 & ~1;       // h1
  CASTLE_MASK[0x00] = 15 & ~2;       // a1
  CASTLE_MASK[0x74] = 15 & ~(4 | 8); // e8
  CASTLE_MASK[0x77] = 15 & ~4;       // h8
  CASTLE_MASK[0x70] = 15 & ~8;       // a8

  var PIECE_LETTERS = ['', 'P', 'N', 'B', 'R', 'Q', 'K'];
  var LETTER_TO_TYPE = { p: PAWN, n: KNIGHT, b: BISHOP, r: ROOK, q: QUEEN, k: KING };

  var START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  // ---- zobrist ---------------------------------------------------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return (t ^ (t >>> 14)) >>> 0;
    };
  }
  var rng = mulberry32(0x9e3779b9);
  var Z_PIECE_LO = new Int32Array(15 * 128), Z_PIECE_HI = new Int32Array(15 * 128);
  for (var i = 0; i < 15 * 128; i++) { Z_PIECE_LO[i] = rng() | 0; Z_PIECE_HI[i] = rng() | 0; }
  var Z_CASTLE_LO = new Int32Array(16), Z_CASTLE_HI = new Int32Array(16);
  for (i = 0; i < 16; i++) { Z_CASTLE_LO[i] = rng() | 0; Z_CASTLE_HI[i] = rng() | 0; }
  var Z_EP_LO = new Int32Array(8), Z_EP_HI = new Int32Array(8);
  for (i = 0; i < 8; i++) { Z_EP_LO[i] = rng() | 0; Z_EP_HI[i] = rng() | 0; }
  var Z_SIDE_LO = rng() | 0, Z_SIDE_HI = rng() | 0;

  // ---- helpers ---------------------------------------------------
  function fileOf(sq) { return sq & 15; }
  function rankOf(sq) { return sq >> 4; }
  function algebraic(sq) {
    return String.fromCharCode(97 + fileOf(sq)) + (rankOf(sq) + 1);
  }
  function parseSquare(s) {
    if (!s || s.length < 2) return -1;
    var f = s.charCodeAt(0) - 97, r = s.charCodeAt(1) - 49;
    if (f < 0 || f > 7 || r < 0 || r > 7) return -1;
    return r * 16 + f;
  }
  function pieceColor(code) { return (code & BLACK_FLAG) ? BLACK : WHITE; }
  function pieceType(code) { return code & 7; }
  function squareColor(sq) { return ((sq >> 4) + (sq & 7)) & 1; } // 0 dark? (a1 -> 0)

  // ---- Game ------------------------------------------------------
  function Game(fen) {
    this.board = new Int8Array(128);
    this.turn = WHITE;
    this.castling = 0;
    this.ep = -1;
    this.halfmove = 0;
    this.fullmove = 1;
    this.kingSq = [0x04, 0x74];
    this.keyLo = 0; this.keyHi = 0;
    // history (parallel arrays for speed)
    this.histM = [];
    this.histCastle = [];
    this.histEp = [];
    this.histHalf = [];
    this.histKeyLo = [];
    this.histKeyHi = [];
    this.ply = 0;
    this.load(fen || START_FEN);
  }

  Game.prototype.load = function (fen) {
    var b = this.board; b.fill(0);
    var parts = fen.trim().split(/\s+/);
    var rows = parts[0].split('/');
    if (rows.length !== 8) throw new Error('bad FEN: ' + fen);
    for (var r = 0; r < 8; r++) {
      var rank = 7 - r, file = 0, row = rows[r];
      for (var k = 0; k < row.length; k++) {
        var c = row[k];
        if (c >= '1' && c <= '8') { file += c.charCodeAt(0) - 48; continue; }
        var lower = c.toLowerCase();
        var type = LETTER_TO_TYPE[lower];
        if (!type) throw new Error('bad FEN piece: ' + c);
        var color = c === lower ? BLACK : WHITE;
        var sq = rank * 16 + file;
        b[sq] = type | (color ? BLACK_FLAG : 0);
        if (type === KING) this.kingSq[color] = sq;
        file++;
      }
    }
    this.turn = (parts[1] === 'b') ? BLACK : WHITE;
    this.castling = 0;
    var cast = parts[2] || '-';
    if (cast.indexOf('K') >= 0 && b[0x04] === KING && b[0x07] === ROOK) this.castling |= 1;
    if (cast.indexOf('Q') >= 0 && b[0x04] === KING && b[0x00] === ROOK) this.castling |= 2;
    if (cast.indexOf('k') >= 0 && b[0x74] === (KING | 8) && b[0x77] === (ROOK | 8)) this.castling |= 4;
    if (cast.indexOf('q') >= 0 && b[0x74] === (KING | 8) && b[0x70] === (ROOK | 8)) this.castling |= 8;
    this.ep = -1;
    if (parts[3] && parts[3] !== '-') {
      var epSq = parseSquare(parts[3]);
      // keep ep only if an enemy... i.e. side-to-move pawn can actually capture
      if (epSq >= 0 && this.epCapturable(epSq)) this.ep = epSq;
    }
    this.halfmove = parts[4] ? parseInt(parts[4], 10) || 0 : 0;
    this.fullmove = parts[5] ? parseInt(parts[5], 10) || 1 : 1;
    this.histM.length = 0; this.histCastle.length = 0; this.histEp.length = 0;
    this.histHalf.length = 0; this.histKeyLo.length = 0; this.histKeyHi.length = 0;
    this.ply = 0;
    this.computeKey();
  };

  // is there a side-to-move pawn placed to capture on ep square?
  Game.prototype.epCapturable = function (epSq) {
    var us = this.turn;
    var ourPawn = PAWN | (us ? BLACK_FLAG : 0);
    // our pawn must sit one rank "behind" epSq from our perspective, adjacent file
    var back = us === WHITE ? epSq - 16 : epSq + 16;
    var a = back - 1, b = back + 1;
    if (!(a & 0x88) && this.board[a] === ourPawn) return true;
    if (!(b & 0x88) && this.board[b] === ourPawn) return true;
    return false;
  };

  Game.prototype.computeKey = function () {
    var lo = 0, hi = 0, b = this.board;
    for (var sq = 0; sq < 128; sq++) {
      if (sq & 0x88) continue;
      var p = b[sq];
      if (p) { var idx = p * 128 + sq; lo ^= Z_PIECE_LO[idx]; hi ^= Z_PIECE_HI[idx]; }
    }
    lo ^= Z_CASTLE_LO[this.castling]; hi ^= Z_CASTLE_HI[this.castling];
    if (this.ep >= 0) { lo ^= Z_EP_LO[this.ep & 7]; hi ^= Z_EP_HI[this.ep & 7]; }
    if (this.turn === BLACK) { lo ^= Z_SIDE_LO; hi ^= Z_SIDE_HI; }
    this.keyLo = lo | 0; this.keyHi = hi | 0;
  };

  Game.prototype.fen = function () {
    var out = [], b = this.board;
    for (var rank = 7; rank >= 0; rank--) {
      var row = '', run = 0;
      for (var file = 0; file < 8; file++) {
        var p = b[rank * 16 + file];
        if (!p) { run++; continue; }
        if (run) { row += run; run = 0; }
        var ch = PIECE_LETTERS[pieceType(p)];
        row += pieceColor(p) === BLACK ? ch.toLowerCase() : ch;
      }
      if (run) row += run;
      out.push(row);
    }
    var cast = '';
    if (this.castling & 1) cast += 'K';
    if (this.castling & 2) cast += 'Q';
    if (this.castling & 4) cast += 'k';
    if (this.castling & 8) cast += 'q';
    return out.join('/') + ' ' + (this.turn === BLACK ? 'b' : 'w') + ' ' +
      (cast || '-') + ' ' + (this.ep >= 0 ? algebraic(this.ep) : '-') + ' ' +
      this.halfmove + ' ' + this.fullmove;
  };

  // ---- attack detection -------------------------------------------
  Game.prototype.isAttacked = function (sq, by) {
    var b = this.board, i, t, p, code;
    // pawns
    if (by === WHITE) {
      t = sq - 15; if (!(t & 0x88) && b[t] === PAWN) return true;
      t = sq - 17; if (!(t & 0x88) && b[t] === PAWN) return true;
    } else {
      t = sq + 15; if (!(t & 0x88) && b[t] === (PAWN | 8)) return true;
      t = sq + 17; if (!(t & 0x88) && b[t] === (PAWN | 8)) return true;
    }
    var flag = by ? BLACK_FLAG : 0;
    // knights
    for (i = 0; i < 8; i++) {
      t = sq + KNIGHT_OFFS[i];
      if (!(t & 0x88) && b[t] === (KNIGHT | flag)) return true;
    }
    // king
    for (i = 0; i < 8; i++) {
      t = sq + KING_OFFS[i];
      if (!(t & 0x88) && b[t] === (KING | flag)) return true;
    }
    // bishop/queen rays
    for (i = 0; i < 4; i++) {
      t = sq + BISHOP_DIRS[i];
      while (!(t & 0x88)) {
        p = b[t];
        if (p) {
          if ((p & BLACK_FLAG) === flag) {
            code = p & 7;
            if (code === BISHOP || code === QUEEN) return true;
          }
          break;
        }
        t += BISHOP_DIRS[i];
      }
    }
    // rook/queen rays
    for (i = 0; i < 4; i++) {
      t = sq + ROOK_DIRS[i];
      while (!(t & 0x88)) {
        p = b[t];
        if (p) {
          if ((p & BLACK_FLAG) === flag) {
            code = p & 7;
            if (code === ROOK || code === QUEEN) return true;
          }
          break;
        }
        t += ROOK_DIRS[i];
      }
    }
    return false;
  };

  // training drills may omit kings entirely; kingSq is only trustworthy
  // when a real king sits on it
  Game.prototype.hasKing = function (color) {
    return this.board[this.kingSq[color]] === (KING | (color ? BLACK_FLAG : 0));
  };

  Game.prototype.inCheck = function (color) {
    if (color === undefined) color = this.turn;
    if (!this.hasKing(color)) return false;
    return this.isAttacked(this.kingSq[color], color ^ 1);
  };

  // ---- move generation (pseudo-legal) ------------------------------
  Game.prototype.genMoves = function (capsOnly) {
    var moves = [], b = this.board, us = this.turn, them = us ^ 1;
    var usFlag = us ? BLACK_FLAG : 0, themFlag = them ? BLACK_FLAG : 0;
    var fwd = us === WHITE ? 16 : -16;
    var startRank = us === WHITE ? 1 : 6;
    var promoRank = us === WHITE ? 7 : 0;

    function addPawn(from, to, captured, flags) {
      if (rankOf(to) === promoRank) {
        moves.push(buildMove(from, to, PAWN, captured, QUEEN, flags | F_PROMO));
        moves.push(buildMove(from, to, PAWN, captured, ROOK, flags | F_PROMO));
        moves.push(buildMove(from, to, PAWN, captured, BISHOP, flags | F_PROMO));
        moves.push(buildMove(from, to, PAWN, captured, KNIGHT, flags | F_PROMO));
      } else {
        moves.push(buildMove(from, to, PAWN, captured, 0, flags));
      }
    }

    for (var sq = 0; sq < 128; sq++) {
      if (sq & 0x88) continue;
      var p = b[sq];
      if (!p || (p & BLACK_FLAG) !== usFlag) continue;
      var type = p & 7, i, t, q;

      if (type === PAWN) {
        // pushes
        t = sq + fwd;
        if (!(t & 0x88) && !b[t]) {
          if (!capsOnly || rankOf(t) === promoRank) addPawn(sq, t, 0, 0);
          if (!capsOnly && rankOf(sq) === startRank) {
            q = t + fwd;
            if (!b[q]) moves.push(buildMove(sq, q, PAWN, 0, 0, F_DOUBLE));
          }
        }
        // captures
        for (i = -1; i <= 1; i += 2) {
          t = sq + fwd + i;
          if (t & 0x88) continue;
          q = b[t];
          if (q && (q & BLACK_FLAG) === themFlag && (q & 7) !== KING) {
            addPawn(sq, t, q & 7, F_CAP);
          } else if (t === this.ep && this.ep >= 0) {
            moves.push(buildMove(sq, t, PAWN, PAWN, 0, F_CAP | F_EP));
          }
        }
        continue;
      }

      if (type === KNIGHT || type === KING) {
        var offs = type === KNIGHT ? KNIGHT_OFFS : KING_OFFS;
        for (i = 0; i < 8; i++) {
          t = sq + offs[i];
          if (t & 0x88) continue;
          q = b[t];
          if (!q) { if (!capsOnly) moves.push(buildMove(sq, t, type, 0, 0, 0)); }
          else if ((q & BLACK_FLAG) === themFlag && (q & 7) !== KING) {
            moves.push(buildMove(sq, t, type, q & 7, 0, F_CAP));
          }
        }
        if (type === KING && !capsOnly) {
          // castling
          if (us === WHITE) {
            if ((this.castling & 1) && !b[0x05] && !b[0x06] &&
              !this.isAttacked(0x04, BLACK) && !this.isAttacked(0x05, BLACK) && !this.isAttacked(0x06, BLACK)) {
              moves.push(buildMove(0x04, 0x06, KING, 0, 0, F_CASTLE));
            }
            if ((this.castling & 2) && !b[0x03] && !b[0x02] && !b[0x01] &&
              !this.isAttacked(0x04, BLACK) && !this.isAttacked(0x03, BLACK) && !this.isAttacked(0x02, BLACK)) {
              moves.push(buildMove(0x04, 0x02, KING, 0, 0, F_CASTLE));
            }
          } else {
            if ((this.castling & 4) && !b[0x75] && !b[0x76] &&
              !this.isAttacked(0x74, WHITE) && !this.isAttacked(0x75, WHITE) && !this.isAttacked(0x76, WHITE)) {
              moves.push(buildMove(0x74, 0x76, KING, 0, 0, F_CASTLE));
            }
            if ((this.castling & 8) && !b[0x73] && !b[0x72] && !b[0x71] &&
              !this.isAttacked(0x74, WHITE) && !this.isAttacked(0x73, WHITE) && !this.isAttacked(0x72, WHITE)) {
              moves.push(buildMove(0x74, 0x72, KING, 0, 0, F_CASTLE));
            }
          }
        }
        continue;
      }

      // sliders
      var dirs = type === BISHOP ? BISHOP_DIRS : type === ROOK ? ROOK_DIRS : null;
      var dirList = dirs || KING_OFFS; // queen = all 8
      var nDirs = dirs ? 4 : 8;
      for (i = 0; i < nDirs; i++) {
        var d = dirList[i];
        t = sq + d;
        while (!(t & 0x88)) {
          q = b[t];
          if (!q) {
            if (!capsOnly) moves.push(buildMove(sq, t, type, 0, 0, 0));
          } else {
            if ((q & BLACK_FLAG) === themFlag && (q & 7) !== KING) {
              moves.push(buildMove(sq, t, type, q & 7, 0, F_CAP));
            }
            break;
          }
          t += d;
        }
      }
    }
    return moves;
  };

  // ---- make / unmake ------------------------------------------------
  Game.prototype.make = function (m) {
    var b = this.board, us = this.turn, them = us ^ 1;
    var usFlag = us ? BLACK_FLAG : 0, themFlag = them ? BLACK_FLAG : 0;
    var from = m & 0x7f, to = (m >> 7) & 0x7f;
    var pt = (m >> 14) & 7, capt = (m >> 17) & 7, promo = (m >> 20) & 7;
    var p = this.ply;

    this.histM[p] = m;
    this.histCastle[p] = this.castling;
    this.histEp[p] = this.ep;
    this.histHalf[p] = this.halfmove;
    this.histKeyLo[p] = this.keyLo;
    this.histKeyHi[p] = this.keyHi;
    this.ply = p + 1;

    var lo = this.keyLo, hi = this.keyHi, idx;

    // clear old ep from key
    if (this.ep >= 0) { lo ^= Z_EP_LO[this.ep & 7]; hi ^= Z_EP_HI[this.ep & 7]; }

    // remove captured
    if (m & F_CAP) {
      var capSq = to;
      if (m & F_EP) capSq = us === WHITE ? to - 16 : to + 16;
      var capCode = capt | themFlag;
      idx = capCode * 128 + capSq;
      lo ^= Z_PIECE_LO[idx]; hi ^= Z_PIECE_HI[idx];
      b[capSq] = 0;
    }

    // move piece
    var code = pt | usFlag;
    idx = code * 128 + from; lo ^= Z_PIECE_LO[idx]; hi ^= Z_PIECE_HI[idx];
    b[from] = 0;
    var placed = (m & F_PROMO) ? (promo | usFlag) : code;
    idx = placed * 128 + to; lo ^= Z_PIECE_LO[idx]; hi ^= Z_PIECE_HI[idx];
    b[to] = placed;

    if (pt === KING) {
      this.kingSq[us] = to;
      if (m & F_CASTLE) {
        var rFrom, rTo;
        if (to > from) { rFrom = from + 3; rTo = from + 1; } // O-O
        else { rFrom = from - 4; rTo = from - 1; }           // O-O-O
        var rook = ROOK | usFlag;
        idx = rook * 128 + rFrom; lo ^= Z_PIECE_LO[idx]; hi ^= Z_PIECE_HI[idx];
        idx = rook * 128 + rTo; lo ^= Z_PIECE_LO[idx]; hi ^= Z_PIECE_HI[idx];
        b[rFrom] = 0; b[rTo] = rook;
      }
    }

    // castling rights
    lo ^= Z_CASTLE_LO[this.castling]; hi ^= Z_CASTLE_HI[this.castling];
    this.castling &= CASTLE_MASK[from] & CASTLE_MASK[to];
    lo ^= Z_CASTLE_LO[this.castling]; hi ^= Z_CASTLE_HI[this.castling];

    // new ep
    this.ep = -1;
    if (m & F_DOUBLE) {
      var enemyPawn = PAWN | themFlag;
      var l = to - 1, r = to + 1;
      if ((!(l & 0x88) && b[l] === enemyPawn) || (!(r & 0x88) && b[r] === enemyPawn)) {
        this.ep = us === WHITE ? from + 16 : from - 16;
        lo ^= Z_EP_LO[this.ep & 7]; hi ^= Z_EP_HI[this.ep & 7];
      }
    }

    this.halfmove = (pt === PAWN || (m & F_CAP)) ? 0 : this.halfmove + 1;
    if (us === BLACK) this.fullmove++;
    this.turn = them;
    lo ^= Z_SIDE_LO; hi ^= Z_SIDE_HI;
    this.keyLo = lo | 0; this.keyHi = hi | 0;
  };

  Game.prototype.unmake = function () {
    var p = this.ply - 1;
    if (p < 0) return;
    this.ply = p;
    var m = this.histM[p];
    var b = this.board;
    this.turn ^= 1;
    var us = this.turn, them = us ^ 1;
    var usFlag = us ? BLACK_FLAG : 0, themFlag = them ? BLACK_FLAG : 0;
    var from = m & 0x7f, to = (m >> 7) & 0x7f;
    var pt = (m >> 14) & 7, capt = (m >> 17) & 7;

    b[from] = pt | usFlag;
    b[to] = 0;
    if (m & F_CAP) {
      if (m & F_EP) {
        var capSq = us === WHITE ? to - 16 : to + 16;
        b[capSq] = PAWN | themFlag;
      } else {
        b[to] = capt | themFlag;
      }
    }
    if (pt === KING) {
      this.kingSq[us] = from;
      if (m & F_CASTLE) {
        var rook = ROOK | usFlag;
        if (to > from) { b[from + 3] = rook; b[from + 1] = 0; }
        else { b[from - 4] = rook; b[from - 1] = 0; }
      }
    }
    if (us === BLACK) this.fullmove--;
    this.castling = this.histCastle[p];
    this.ep = this.histEp[p];
    this.halfmove = this.histHalf[p];
    this.keyLo = this.histKeyLo[p];
    this.keyHi = this.histKeyHi[p];
  };

  // null move (for search)
  Game.prototype.makeNull = function () {
    var p = this.ply;
    this.histM[p] = 0;
    this.histCastle[p] = this.castling;
    this.histEp[p] = this.ep;
    this.histHalf[p] = this.halfmove;
    this.histKeyLo[p] = this.keyLo;
    this.histKeyHi[p] = this.keyHi;
    this.ply = p + 1;
    var lo = this.keyLo, hi = this.keyHi;
    if (this.ep >= 0) { lo ^= Z_EP_LO[this.ep & 7]; hi ^= Z_EP_HI[this.ep & 7]; }
    this.ep = -1;
    this.halfmove++;
    this.turn ^= 1;
    lo ^= Z_SIDE_LO; hi ^= Z_SIDE_HI;
    this.keyLo = lo | 0; this.keyHi = hi | 0;
  };
  Game.prototype.unmakeNull = function () {
    var p = this.ply - 1;
    this.ply = p;
    this.turn ^= 1;
    this.castling = this.histCastle[p];
    this.ep = this.histEp[p];
    this.halfmove = this.histHalf[p];
    this.keyLo = this.histKeyLo[p];
    this.keyHi = this.histKeyHi[p];
  };

  // ---- legality ------------------------------------------------------
  Game.prototype.legalMoves = function () {
    var pseudo = this.genMoves(false), legal = [], us = this.turn;
    if (!this.hasKing(us)) return pseudo; // drill boards: no king, no check rules
    for (var i = 0; i < pseudo.length; i++) {
      this.make(pseudo[i]);
      if (!this.isAttacked(this.kingSq[us], this.turn)) legal.push(pseudo[i]);
      this.unmake();
    }
    return legal;
  };

  Game.prototype.perft = function (depth) {
    if (depth === 0) return 1;
    var moves = this.genMoves(false), n = 0, us = this.turn;
    for (var i = 0; i < moves.length; i++) {
      this.make(moves[i]);
      if (!this.isAttacked(this.kingSq[us], this.turn)) {
        n += depth === 1 ? 1 : this.perft(depth - 1);
      }
      this.unmake();
    }
    return n;
  };

  Game.prototype.divide = function (depth) {
    var moves = this.legalMoves(), out = {};
    for (var i = 0; i < moves.length; i++) {
      this.make(moves[i]);
      out[uci(moves[i])] = depth <= 1 ? 1 : this.perft(depth - 1);
      this.unmake();
    }
    return out;
  };

  // ---- repetition / status --------------------------------------------
  // count previous occurrences of the current position
  Game.prototype.repetitionCount = function () {
    var count = 0, lo = this.keyLo, hi = this.keyHi;
    var stop = this.ply - this.halfmove;
    if (stop < 0) stop = 0;
    for (var i = this.ply - 2; i >= stop; i -= 2) {
      if (this.histKeyLo[i] === lo && this.histKeyHi[i] === hi) count++;
    }
    return count;
  };

  Game.prototype.insufficientMaterial = function () {
    var b = this.board;
    var minors = 0, bishopColors = [0, 0], knights = 0;
    for (var sq = 0; sq < 128; sq++) {
      if (sq & 0x88) continue;
      var p = b[sq];
      if (!p) continue;
      var t = p & 7;
      if (t === PAWN || t === ROOK || t === QUEEN) return false;
      if (t === KNIGHT) { knights++; minors++; }
      else if (t === BISHOP) { minors++; bishopColors[squareColor(sq)]++; }
    }
    if (minors <= 1) return true; // K vs K, K+minor vs K
    // only bishops, all on the same color complex
    if (knights === 0 && (bishopColors[0] === 0 || bishopColors[1] === 0)) return true;
    return false;
  };

  // returns {over, result, reason, winner}
  Game.prototype.status = function (legal) {
    if (!legal) legal = this.legalMoves();
    if (legal.length === 0) {
      if (this.inCheck()) {
        var winner = this.turn === WHITE ? BLACK : WHITE;
        return { over: true, result: winner === WHITE ? '1-0' : '0-1', reason: 'checkmate', winner: winner };
      }
      return { over: true, result: '1/2-1/2', reason: 'stalemate', winner: -1 };
    }
    if (this.halfmove >= 100) return { over: true, result: '1/2-1/2', reason: 'fifty-move rule', winner: -1 };
    if (this.repetitionCount() >= 2) return { over: true, result: '1/2-1/2', reason: 'threefold repetition', winner: -1 };
    if (this.insufficientMaterial()) return { over: true, result: '1/2-1/2', reason: 'insufficient material', winner: -1 };
    return { over: false, result: '*', reason: '', winner: -1 };
  };

  // ---- SAN / UCI --------------------------------------------------------
  function uci(m) {
    var s = algebraic(mvFrom(m)) + algebraic(mvTo(m));
    if (m & F_PROMO) s += PIECE_LETTERS[mvPromo(m)].toLowerCase();
    return s;
  }

  Game.prototype.moveFromUci = function (str) {
    var legal = this.legalMoves();
    for (var i = 0; i < legal.length; i++) if (uci(legal[i]) === str) return legal[i];
    return 0;
  };

  Game.prototype.san = function (m, legal) {
    if (!legal) legal = this.legalMoves();
    var s;
    if (m & F_CASTLE) {
      s = mvTo(m) > mvFrom(m) ? 'O-O' : 'O-O-O';
    } else {
      var pt = mvPiece(m), from = mvFrom(m), to = mvTo(m);
      if (pt === PAWN) {
        s = (m & F_CAP) ? String.fromCharCode(97 + fileOf(from)) + 'x' + algebraic(to) : algebraic(to);
        if (m & F_PROMO) s += '=' + PIECE_LETTERS[mvPromo(m)];
      } else {
        s = PIECE_LETTERS[pt];
        // disambiguation
        var sameFile = false, sameRank = false, others = false;
        for (var i = 0; i < legal.length; i++) {
          var o = legal[i];
          if (o === m) continue;
          if (mvPiece(o) === pt && mvTo(o) === to) {
            others = true;
            if (fileOf(mvFrom(o)) === fileOf(from)) sameFile = true;
            if (rankOf(mvFrom(o)) === rankOf(from)) sameRank = true;
          }
        }
        if (others) {
          if (!sameFile) s += String.fromCharCode(97 + fileOf(from));
          else if (!sameRank) s += (rankOf(from) + 1);
          else s += algebraic(from);
        }
        if (m & F_CAP) s += 'x';
        s += algebraic(to);
      }
    }
    // check / mate suffix
    this.make(m);
    if (this.inCheck()) s += this.legalMoves().length === 0 ? '#' : '+';
    this.unmake();
    return s;
  };

  // find a legal move matching from/to (+promo type), returns 0 if none
  Game.prototype.findMove = function (from, to, promo) {
    var legal = this.legalMoves();
    for (var i = 0; i < legal.length; i++) {
      var m = legal[i];
      if (mvFrom(m) === from && mvTo(m) === to) {
        if (m & F_PROMO) {
          if (promo && mvPromo(m) === promo) return m;
          if (!promo && mvPromo(m) === QUEEN) return m; // default
        } else return m;
      }
    }
    return 0;
  };

  // apply a list of uci moves (returns false on first illegal)
  Game.prototype.applyUciLine = function (list) {
    for (var i = 0; i < list.length; i++) {
      var m = this.moveFromUci(list[i]);
      if (!m) return false;
      this.make(m);
    }
    return true;
  };

  // ---- exports -----------------------------------------------------------
  var api = {
    WHITE: WHITE, BLACK: BLACK,
    EMPTY: EMPTY, PAWN: PAWN, KNIGHT: KNIGHT, BISHOP: BISHOP, ROOK: ROOK, QUEEN: QUEEN, KING: KING,
    BLACK_FLAG: BLACK_FLAG, MATE: MATE,
    F_CAP: F_CAP, F_DOUBLE: F_DOUBLE, F_EP: F_EP, F_CASTLE: F_CASTLE, F_PROMO: F_PROMO,
    Game: Game, START_FEN: START_FEN,
    mvFrom: mvFrom, mvTo: mvTo, mvPiece: mvPiece, mvCaptured: mvCaptured, mvPromo: mvPromo,
    uci: uci, algebraic: algebraic, parseSquare: parseSquare,
    fileOf: fileOf, rankOf: rankOf, pieceColor: pieceColor, pieceType: pieceType,
    squareColor: squareColor
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (typeof window !== 'undefined' ? window : this).RTG = api;
}());
