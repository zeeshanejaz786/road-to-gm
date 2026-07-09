/* ============================================================
   Road to GM — the Narrator: explains a position in plain words
   (English or Urdu) for players who are brand new to chess.
   Pure functions on a Game. Language comes from I18N.
   ============================================================ */
(function () {
  'use strict';
  var isNode = (typeof module !== 'undefined' && module.exports);
  var R = isNode ? require('./engine.js') : window.RTG;
  var I18N = isNode ? require('./i18n.js') : window.I18N;

  var WHITE = R.WHITE, BLACK = R.BLACK, BLACK_FLAG = R.BLACK_FLAG;
  var PAWN = R.PAWN, KNIGHT = R.KNIGHT, BISHOP = R.BISHOP, ROOK = R.ROOK, QUEEN = R.QUEEN, KING = R.KING;

  var VAL = [0, 1, 3, 3, 5, 9, 0]; // material points (king not counted)

  var KN = [14, 18, 31, 33, -14, -18, -31, -33];
  var KG = [1, -1, 16, -16, 15, 17, -15, -17];
  var BD = [15, 17, -15, -17];
  var RD = [1, -1, 16, -16];

  function ur() { return I18N.isUr(); }
  function name(code) { return I18N.pieceName(code); }
  function sq(s) { return R.algebraic(s); }
  function colorOf(code) { return (code & BLACK_FLAG) ? BLACK : WHITE; }

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

  // ---- describe a single piece the player clicked --------------------
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

    if (ur()) {
      parts.push('<b>' + I18N.owner(mine) + ' ' + name(code) + ' ' + sq(s) + ' پر ہے۔</b> ' +
        name(code) + ' ' + I18N.moveRule(code) + '۔');
      if (mine) {
        if (quiet.length) parts.push('ابھی یہ ان خانوں پر جا سکتا ہے: <b>' + I18N.joinList(quiet.map(sq)) + '</b> (نمایاں خانے)۔');
        else if (!caps.length) parts.push('اس وقت اس کے پاس جانے کو کوئی خانہ نہیں۔');
        if (caps.length) parts.push('💥 یہ <b>' + I18N.joinList(caps.map(function (c) { return name(c.victim) + ' (' + sq(c.to) + ')'; })) + '</b> کو مار سکتا ہے!');
        if (attackers.length) {
          var a = g.board[attackers[0]];
          var w = '⚠️ خیال رکھیں: اس ' + name(code) + ' پر ' + I18N.owner(false) + ' ' + name(a) + ' (' + sq(attackers[0]) + ') حملہ کر رہا ہے۔';
          w += defenders.length ? ' اسے محافظ حاصل ہے، سو سودا ہو سکتا ہے مگر مفت نقصان نہیں۔' : ' اسے کوئی نہیں بچا رہا — مفت میں مارا جا سکتا ہے، اسے ہٹائیں یا محافظ دیں۔';
          parts.push(w);
        }
      } else {
        parts.push('یہ مخالف کا مہرہ ہے۔ دیکھیں یہ کن خانوں پر قابو رکھتا ہے۔');
        if (attackers.length) parts.push('اچھی بات: آپ اس پر ' + attackers.length + ' مہروں سے حملہ کر رہے ہیں۔');
      }
      return parts.join('<br>');
    }

    parts.push('<b>' + I18N.Owner(mine) + ' ' + name(code) + ' on ' + sq(s) + '.</b> ' +
      'A ' + name(code) + ' moves ' + I18N.moveRule(code) + '.');
    if (mine) {
      if (quiet.length) parts.push('Right now it can move to <b>' + I18N.joinList(quiet.map(sq)) + '</b> — those are the highlighted squares.');
      else if (!caps.length) parts.push('It has nowhere to go this turn.');
      if (caps.length) parts.push('💥 It can capture the <b>' + I18N.joinList(caps.map(function (c) { return name(c.victim) + ' on ' + sq(c.to); })) + '</b>!');
      if (attackers.length) {
        var atk = g.board[attackers[0]];
        var warn = '⚠️ Careful: this ' + name(code) + ' is being attacked by ' + I18N.owner(false) + ' ' + name(atk) + ' on ' + sq(attackers[0]) + '.';
        warn += defenders.length ? ' It is defended, so a trade is possible but not a free loss.' : ' Nothing is guarding it, so it could be taken for free — move it or defend it.';
        parts.push(warn);
      }
    } else {
      parts.push('This is an enemy piece. Watch what squares it controls.');
      if (attackers.length) parts.push('Good news: you are attacking it with ' + attackers.length + ' of your pieces.');
    }
    return parts.join('<br>');
  }

  // ---- read the whole board -------------------------------------------
  function explainBoard(g, userColor) {
    var enemy = userColor ^ 1, parts = [];
    var mine = materialCount(g, userColor), theirs = materialCount(g, enemy), diff = mine - theirs;
    var myHang = hangingSquares(g, userColor);
    var theirHang = hangingSquares(g, enemy).filter(function (s) { return findAttackers(g, s, userColor).length > 0; });
    var U = ur();

    if (U) {
      parts.push('<b>مقصد ہمیشہ ایک ہی ہے:</b> مخالف کے بادشاہ کو پھنسانا (شہ مات) اور اپنے بادشاہ کو محفوظ رکھنا۔ ' +
        'ہر چال ان میں سے کوئی ایک کام کرے: بادشاہ پر حملہ، مہرہ جیتنا، اپنے مہرے مضبوط کرنا، یا اپنی چیزیں بچانا۔');
      if (g.inCheck(userColor)) parts.push('🚨 <b>آپ کے بادشاہ کو شہ ہے!</b> اسی چال میں حل کریں: بادشاہ ہٹائیں، بیچ میں مہرہ رکھیں، یا حملہ آور کو ماریں۔');
      else if (g.inCheck(enemy)) parts.push('آپ شہ دے رہے ہیں — مخالف کو جواب دینا پڑے گا۔');
      if (diff === 0) parts.push('مواد برابر ہے (' + mine + ' پوائنٹ ہر طرف)۔ پیادہ=1، گھوڑا=اونٹ=3، ہاتھی=5، وزیر=9۔');
      else if (diff > 0) parts.push('آپ مواد میں <b>' + diff + ' پوائنٹ آگے</b> ہیں۔ برابر مہرے بدلتے رہیں تو یہ برتری قائم رہے گی۔');
      else parts.push('آپ مواد میں <b>' + (-diff) + ' پوائنٹ پیچھے</b> ہیں۔ مہرہ واپس جیتنے کا موقع ڈھونڈیں اور فی الحال بلاوجہ مہرے نہ بدلیں۔');
      if (myHang.length) parts.push('⚠️ <b>خطرے میں:</b> آپ کا ' + I18N.joinList(myHang.map(function (s) { return name(g.board[s]) + ' (' + sq(s) + ')'; })) + ' حملے میں ہے اور بغیر محافظ کے ہے۔ مخالف کے مفت مارنے سے پہلے اسے بچائیں۔');
      if (theirHang.length) parts.push('💰 <b>مفت مال:</b> مخالف کا ' + I18N.joinList(theirHang.map(function (s) { return name(g.board[s]) + ' (' + sq(s) + ')'; })) + ' بغیر محافظ ہے۔ اپنی چال محفوظ ہو تو اسے مار لیں!');
      if (g.fullmove <= 8) parts.push('ابھی شروعات ہے۔ اپنے گھوڑے اور اونٹ پچھلی قطار سے نکال کر بیچ میں لائیں، پھر بادشاہ کو کیسلنگ سے محفوظ کریں۔');
      else if (!myHang.length && !theirHang.length) parts.push('کچھ خطرے میں نہیں۔ اپنے سب سے کمزور مہرے کو بہتر جگہ دیں، یا مخالف کی کسی اہم چیز پر حملہ ترتیب دیں۔');
      return parts.join('<br><br>');
    }

    parts.push('<b>The goal never changes:</b> trap the enemy King (checkmate) while keeping yours safe. ' +
      'Every move should do one of these: attack the King, win material, make your pieces stronger, or protect your own stuff.');
    if (g.inCheck(userColor)) parts.push('🚨 <b>Your King is in check!</b> You must fix it this move: move the King, block the line, or capture the checker.');
    else if (g.inCheck(enemy)) parts.push('You are giving check — the opponent has to respond to it.');
    if (diff === 0) parts.push('Material is even (' + mine + ' points each). Pawn=1, Knight=Bishop=3, Rook=5, Queen=9.');
    else if (diff > 0) parts.push('You are <b>ahead by ' + diff + ' point' + (diff > 1 ? 's' : '') + '</b> of material. Trading pieces evenly keeps that lead.');
    else parts.push('You are <b>behind by ' + (-diff) + ' point' + (-diff > 1 ? 's' : '') + '</b>. Look for a chance to win material back, and avoid trades for now.');
    if (myHang.length) parts.push('⚠️ <b>In danger:</b> your ' + I18N.joinList(myHang.map(function (s) { return name(g.board[s]) + ' on ' + sq(s); })) + ' ' + (myHang.length > 1 ? 'are' : 'is') + ' attacked and undefended. Rescue ' + (myHang.length > 1 ? 'them' : 'it') + ' before the opponent grabs ' + (myHang.length > 1 ? 'them' : 'it') + ' for free.');
    if (theirHang.length) parts.push('💰 <b>Free to take:</b> their ' + I18N.joinList(theirHang.map(function (s) { return name(g.board[s]) + ' on ' + sq(s); })) + ' ' + (theirHang.length > 1 ? 'are' : 'is') + ' hanging. Check that your capture is safe, then grab it!');
    if (g.fullmove <= 8) parts.push('It is still the opening. Get your Knights and Bishops off the back row toward the center, then castle your King to safety.');
    else if (!myHang.length && !theirHang.length) parts.push('Nothing is hanging. Improve your worst-placed piece, or line up an attack on something the opponent cares about.');
    return parts.join('<br><br>');
  }

  // ---- explain WHY a suggested move is good ---------------------------
  function explainMove(g, move, userColor, mateIn, san) {
    var from = R.mvFrom(move), to = R.mvTo(move), pt = R.mvPiece(move);
    var pieceCode = pt | (userColor ? 8 : 0);
    var wasHanging = findAttackers(g, from, userColor ^ 1).length > 0 && findAttackers(g, from, userColor).length === 0 && pt !== KING;
    var captured = R.mvCaptured(move);
    g.make(move);
    var givesCheck = g.inCheck(userColor ^ 1);
    var nowSafe = findAttackers(g, to, userColor ^ 1).length === 0 || findAttackers(g, to, userColor).length > 0;
    g.unmake();

    var backRank = userColor === WHITE ? 0 : 7;
    var develops = !captured && !(move & R.F_CASTLE) && (pt === KNIGHT || pt === BISHOP) && (from >> 4) === backRank && g.fullmove <= 10;
    var U = ur(), reasons = [];

    if (U) {
      var lead = 'یہ چال چلیں (<b>' + (san || '') + '</b>): اپنا ' + name(pieceCode) + ' ' + sq(from) + ' سے ' + sq(to) + ' پر لے جائیں۔';
      if (mateIn > 0) reasons.push(mateIn === 1 ? 'یہ شہ مات ہے — آپ ابھی جیت گئے!' : 'یہ ' + mateIn + ' چالوں میں شہ مات کر دیتی ہے۔');
      if (move & R.F_PROMO) reasons.push('آپ کا پیادہ آخری قطار پر پہنچ کر نیا وزیر بن جاتا ہے۔');
      if (move & R.F_CASTLE) reasons.push('یہ کیسلنگ ہے، بادشاہ کونے میں محفوظ ہو جاتا ہے اور ہاتھی حرکت میں آتا ہے۔');
      if (captured) reasons.push(VAL[captured] >= VAL[pt] ? ('یہ مخالف کا ' + I18N.pieceName(captured) + ' مار کر مواد جیتتی ہے۔') : ('یہ مخالف کا ' + I18N.pieceName(captured) + ' مار لیتی ہے۔'));
      if (givesCheck && !(mateIn > 0)) reasons.push('یہ بادشاہ پر حملہ (شہ) کرتی ہے، مخالف کو جواب دینا پڑے گا۔');
      if (wasHanging) reasons.push('یہ خطرے میں پھنسے مہرے کو بچا لیتی ہے۔');
      if (develops) reasons.push('یہ مہرے کو بیچ کی طرف لاتی ہے اور کیسلنگ کے لیے تیار کرتی ہے۔');
      if (!nowSafe) reasons.push('(خیال رہے: وہاں اس مہرے پر حملہ ہو سکتا ہے — سودا سوچ کر کریں۔)');
      if (!reasons.length) reasons.push('یہ یہاں سب سے مضبوط چال ہے: پوزیشن بہتر کرتی ہے اور سب کچھ محفوظ رکھتی ہے۔');
      return lead + '<br><b>کیوں:</b> ' + reasons.join(' ');
    }

    var leadEn = 'Play <b>' + (san || '') + '</b>: move your ' + name(pieceCode) + ' from ' + sq(from) + ' to ' + sq(to) + '.';
    if (mateIn > 0) reasons.push(mateIn === 1 ? 'It is checkmate — you win right now!' : 'It forces checkmate in ' + mateIn + ' moves.');
    if (move & R.F_PROMO) reasons.push('Your pawn reaches the end and becomes a brand-new Queen.');
    if (move & R.F_CASTLE) reasons.push('It castles, tucking your King safely into the corner and waking up a Rook.');
    if (captured) reasons.push(VAL[captured] >= VAL[pt] ? ('It wins material by capturing their ' + I18N.pieceNameEn(captured) + '.') : ('It captures their ' + I18N.pieceNameEn(captured) + '.'));
    if (givesCheck && !(mateIn > 0)) reasons.push('It attacks the enemy King (check), forcing a reply.');
    if (wasHanging) reasons.push('It rescues a piece that was under attack.');
    if (develops) reasons.push('It develops a piece toward the center, getting you ready to castle.');
    if (!nowSafe) reasons.push('(Heads up: the piece can be attacked there — make sure you are happy with the trade.)');
    if (!reasons.length) reasons.push('It is the strongest move here: it quietly improves your position and keeps everything safe.');
    return leadEn + '<br><b>Why:</b> ' + reasons.join(' ');
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
  if (isNode) module.exports = api;
  else window.RTGNarrator = api;
}());
