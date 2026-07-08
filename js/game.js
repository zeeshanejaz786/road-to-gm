/* ============================================================
   Road to GM — game controller (vs bot / pass & play)
   ============================================================ */
(function () {
  'use strict';
  var R = window.RTG, AI = window.RTGAI, Coach = window.RTGCoach,
    Book = window.RTGBOOK, Sound = window.RTGSound;

  var GLYPHS = { 1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' };

  function fmtClock(ms) {
    if (ms < 0) ms = 0;
    var s = Math.ceil(ms / 1000);
    var m = Math.floor(s / 60); s -= m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function GameController() {
    this.active = false;
    this.over = false;
  }

  var P = GameController.prototype;

  P.init = function () {
    var self = this;
    if (this.board) return;
    this.board = new BoardView(document.getElementById('board'), {
      interactive: true,
      theme: App.store.get().settings.boardTheme,
      showLegal: App.store.get().settings.showLegal,
      onUserMove: function (from, to, promo) { self.onUserMove(from, to, promo); },
      canMove: function (color) { return self.canUserMove(color); }
    });
    this.ui = {
      top: document.getElementById('pbar-top'),
      bottom: document.getElementById('pbar-bottom'),
      movelist: document.getElementById('movelist'),
      openingName: document.getElementById('opening-name'),
      coachCard: document.getElementById('coach-card'),
      evalbar: document.getElementById('evalbar'),
      evalFill: document.getElementById('evalbar-fill'),
      evalNum: document.getElementById('evalbar-num')
    };
    this._bindControls();
  };

  P._bindControls = function () {
    var self = this;
    document.getElementById('btn-hint').addEventListener('click', function () { self.hint(); });
    document.getElementById('btn-undo').addEventListener('click', function () { self.undo(); });
    document.getElementById('btn-flip').addEventListener('click', function () { self.flip(); });
    document.getElementById('btn-resign').addEventListener('click', function () { self.confirmResign(); });
    document.getElementById('btn-exit-game').addEventListener('click', function () { self.exit(); });
    document.getElementById('nav-start').addEventListener('click', function () { self.setView(-2); });
    document.getElementById('nav-back').addEventListener('click', function () { self.stepView(-1); });
    document.getElementById('nav-fwd').addEventListener('click', function () { self.stepView(1); });
    document.getElementById('nav-end').addEventListener('click', function () { self.setView(-1); });
    document.getElementById('nav-live').addEventListener('click', function () { self.setView(-1); });
    document.addEventListener('keydown', function (e) {
      if (!self.active || !App.isScreen('game')) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); self.stepView(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); self.stepView(1); }
      if (e.key === 'f') self.flip();
    });
  };

  // config: {mode:'bot'|'local', botId, userColor, time:{base,inc}|null, coach, practice}
  P.start = function (config, restored) {
    this.init();
    this.cfg = config;
    this.mode = config.mode;
    this.bot = config.mode === 'bot' ? AI.botById(config.botId) : null;
    this.userColor = config.userColor === 'black' ? R.BLACK : R.WHITE;
    this.coachOn = !!config.coach && config.mode === 'bot';
    this.practice = config.practice || null;

    this.g = new R.Game();
    this.sanLine = [];
    this.meta = [];       // per ply: {san, uci, verdictId, cpLoss, bestSan, bestUci, acc}
    this.takebacks = 0;
    this.hintsUsed = 0;
    this.over = false;
    this.active = true;
    this.viewPly = -1;
    this.lastAnalysis = null;
    this.pendingBot = false;
    this._graded = 0;

    // clocks
    this.clock = null;
    if (config.time && config.time.base > 0) {
      this.clock = {
        w: config.time.base * 60000, b: config.time.base * 60000,
        inc: (config.time.inc || 0) * 1000,
        running: null, stamp: 0
      };
    }
    if (restored && restored.clock) this.clock = restored.clock;

    AI.resetSearchState();

    // restore moves
    if (restored && restored.uciLine) {
      for (var i = 0; i < restored.uciLine.length; i++) {
        var m = this.g.moveFromUci(restored.uciLine[i]);
        if (!m) break;
        var legal = this.g.legalMoves();
        var san = this.g.san(m, legal);
        this.sanLine.push(san);
        var mm = { san: san, uci: restored.uciLine[i] };
        if (restored.meta && restored.meta[i]) {
          mm.verdictId = restored.meta[i].v; mm.cpLoss = restored.meta[i].c;
          mm.bestSan = restored.meta[i].bs; mm.bestUci = restored.meta[i].bu;
          mm.acc = restored.meta[i].a;
        }
        this.meta.push(mm);
        this.g.make(m);
      }
      this.takebacks = restored.takebacks || 0;
      this.hintsUsed = restored.hintsUsed || 0;
    }

    // board orientation: user at bottom (local: white at bottom)
    var orient = (this.mode === 'bot' && this.userColor === R.BLACK) ? 'black' : 'white';
    this.board.setTheme(App.store.get().settings.boardTheme);
    this.board.showLegal = App.store.get().settings.showLegal;
    this.board.setOrientation(orient);
    this.board.interactive = true;
    this.board.render(this.g, true);
    this.board.setLastMove(-1, -1);
    if (this.g.ply > 0) {
      var lastM = this.g.histM[this.g.ply - 1];
      this.board.setLastMove(R.mvFrom(lastM), R.mvTo(lastM));
    }

    this.ui.evalbar.hidden = !this.coachOn;
    this.setEval(0);
    this.ui.coachCard.hidden = true;
    this.renderMovelist();
    this.renderBars();
    this.updateOpening();
    this.updateCheckMark();
    this.startClockLoop();

    App.showScreen('game');

    // if it's the bot's turn, think
    if (!this.over && this.mode === 'bot' && this.g.turn !== this.userColor) {
      this.scheduleBotMove(420);
    } else {
      this.refreshAnalysis();
    }
    if (this.clock && !this.clock.running) this.switchClock();
    this.save();
  };

  P.canUserMove = function (color) {
    if (!this.active || this.over || this.viewPly !== -1) return false;
    if (this.pendingBot) return false;
    if (this.mode === 'bot') return color === this.userColor;
    return true; // local: side to move
  };

  // ---- clocks -----------------------------------------------------------
  P.startClockLoop = function () {
    var self = this;
    if (this._clockTimer) clearInterval(this._clockTimer);
    this._clockTimer = setInterval(function () { self.tickClock(); }, 200);
    this.renderClocks();
  };
  P.switchClock = function () {
    if (!this.clock || this.over) return;
    this.tickClock();
    var side = this.g.turn === R.WHITE ? 'w' : 'b';
    this.clock.running = side;
    this.clock.stamp = Date.now();
    this.renderClocks();
  };
  P.tickClock = function () {
    var c = this.clock;
    if (!c || !c.running || this.over) return;
    var now = Date.now();
    c[c.running] -= now - c.stamp;
    c.stamp = now;
    if (c[c.running] <= 0) {
      c[c.running] = 0;
      var loser = c.running === 'w' ? R.WHITE : R.BLACK;
      this.endGame({ over: true, reason: 'time out', winner: loser ^ 1, result: loser === R.WHITE ? '0-1' : '1-0' });
    }
    this.renderClocks();
  };
  P.renderClocks = function () {
    if (!this._clockEls) return;
    var c = this.clock;
    for (var side in this._clockEls) {
      var el = this._clockEls[side];
      if (!el) continue;
      if (!c) { el.textContent = '--:--'; continue; }
      el.textContent = fmtClock(c[side]);
      el.classList.toggle('low', c[side] < 30000 && c[side] > 0);
    }
  };

  // ---- rendering ---------------------------------------------------------
  P.playersFor = function () {
    // returns {top:{...}, bottom:{...}} by current board orientation
    var white, black;
    if (this.mode === 'bot') {
      var myEmoji = App.store.get().avatar === 'classic'
        ? (this.userColor === R.WHITE ? '♔' : '♚')
        : App.avatarEmoji();
      var you = { name: 'You', elo: App.store.get().rating, emoji: myEmoji, color: this.userColor, you: true };
      var bot = { name: this.bot.name, elo: this.bot.elo, emoji: this.bot.emoji, color: this.userColor ^ 1 };
      white = you.color === R.WHITE ? you : bot;
      black = you.color === R.BLACK ? you : bot;
    } else {
      white = { name: 'White', elo: null, emoji: '♔', color: R.WHITE };
      black = { name: 'Black', elo: null, emoji: '♚', color: R.BLACK };
    }
    return this.board.orientation === 'white'
      ? { top: black, bottom: white }
      : { top: white, bottom: black };
  };

  P.renderBars = function () {
    var ps = this.playersFor();
    this._clockEls = {};
    this._barByColor = {};
    this._renderBar(this.ui.top, ps.top);
    this._renderBar(this.ui.bottom, ps.bottom);
    this.updateActiveBar();
  };

  P._renderBar = function (el, p) {
    var caps = this.capturedFor(p.color);
    el.innerHTML = '';
    el.className = 'player-bar';
    var av = document.createElement('div');
    av.className = 'pb-avatar';
    av.textContent = p.emoji;
    var info = document.createElement('div');
    info.className = 'pb-info';
    var nm = document.createElement('div');
    nm.className = 'pb-name';
    nm.innerHTML = '<span>' + p.name + '</span>' +
      (p.elo ? '<span class="pb-elo">' + p.elo + '</span>' : '') +
      '<span class="pb-think"><i></i><i></i><i></i></span>';
    var cp = document.createElement('div');
    cp.className = 'pb-caps';
    cp.innerHTML = caps.html;
    info.appendChild(nm); info.appendChild(cp);
    el.appendChild(av); el.appendChild(info);
    if (this.clock) {
      var ck = document.createElement('div');
      ck.className = 'pb-clock';
      el.appendChild(ck);
      this._clockEls[p.color === R.WHITE ? 'w' : 'b'] = ck;
    }
    this._barByColor[p.color] = el;
    this.renderClocks();
  };

  // pieces captured BY color (i.e., enemy pieces removed), plus material lead
  P.capturedFor = function (color) {
    var counts = {}, i;
    var mover = R.WHITE; // games always start with white to move in our flows
    for (i = 0; i < this.g.ply; i++) {
      var m = this.g.histM[i];
      if (m && (m & R.F_CAP) && mover === color) {
        var t = R.mvCaptured(m);
        counts[t] = (counts[t] || 0) + 1;
      }
      mover ^= 1;
    }
    var order = [1, 2, 3, 4, 5];
    var html = '';
    for (i = 0; i < order.length; i++) {
      var n = counts[order[i]] || 0;
      for (var k = 0; k < n; k++) html += GLYPHS[order[i]];
    }
    // material diff
    var my = 0, their = 0;
    for (var sq = 0; sq < 128; sq++) {
      if (sq & 0x88) continue;
      var pc = this.g.board[sq];
      if (!pc) continue;
      var v = AI.VAL[pc & 7];
      if ((pc & 7) === R.KING) continue;
      if (((pc & 8) ? R.BLACK : R.WHITE) === color) my += v; else their += v;
    }
    var diff = my - their;
    if (diff > 0) html += '<b>+' + Math.round(diff / 100) + '</b>';
    return { html: html || '&nbsp;' };
  };

  P.updateActiveBar = function () {
    if (!this._barByColor) return;
    for (var c = 0; c <= 1; c++) {
      var bar = this._barByColor[c];
      if (bar) bar.classList.toggle('active', !this.over && this.g.turn === c);
    }
  };
  P.setThinking = function (color, on) {
    var bar = this._barByColor && this._barByColor[color];
    if (bar) bar.classList.toggle('thinking', on);
  };

  P.renderMovelist = function () {
    var ol = this.ui.movelist;
    ol.innerHTML = '';
    for (var i = 0; i < this.meta.length; i += 2) {
      var num = document.createElement('li');
      num.className = 'mv-num';
      num.textContent = (i / 2 + 1) + '.';
      ol.appendChild(num);
      ol.appendChild(this._mvCell(i));
      if (i + 1 < this.meta.length) ol.appendChild(this._mvCell(i + 1));
      else { var pad = document.createElement('li'); ol.appendChild(pad); }
    }
    ol.parentNode.scrollTop = ol.parentNode.scrollHeight;
    this.updateViewHighlight();
  };

  P._mvCell = function (ply) {
    var self = this;
    var li = document.createElement('li');
    li.className = 'mv';
    li.dataset.ply = ply;
    var mm = this.meta[ply];
    var g = '';
    if (mm.verdictId && this.coachOn) {
      var v = null;
      for (var i = 0; i < Coach.VERDICTS.length; i++) if (Coach.VERDICTS[i].id === mm.verdictId) v = Coach.VERDICTS[i];
      if (v && v.id !== 'good' && v.id !== 'excellent') {
        g = '<span class="glyph ' + v.id + '">' + v.glyph + '</span>';
      }
    }
    li.innerHTML = '<span>' + mm.san + '</span>' + g;
    li.addEventListener('click', function () { self.setView(ply); });
    return li;
  };

  P.updateOpening = function () {
    var name = Book.detectOpening(this.sanLine);
    if (this.practice) {
      this.ui.openingName.textContent = '📖 ' + this.practice.name;
    } else if (name) {
      this.ui.openingName.textContent = name;
    } else if (this.sanLine.length === 0) {
      this.ui.openingName.textContent = this.mode === 'bot' ? 'vs ' + this.bot.name : 'Pass & Play';
    }
  };

  P.updateCheckMark = function () {
    if (this.g.inCheck()) this.board.setCheck(this.g.kingSq[this.g.turn]);
    else this.board.setCheck(-1);
  };

  P.setEval = function (whitePov) {
    if (!this.coachOn) return;
    var pct = AI.winPercent(whitePov);
    this.ui.evalFill.style.height = pct + '%';
    this.ui.evalNum.textContent = AI.formatScore(whitePov);
  };

  // ---- moves ---------------------------------------------------------------
  P.onUserMove = function (from, to, promo) {
    if (!this.active || this.over || this.viewPly !== -1) return;
    var m = this.g.findMove(from, to, promo);
    if (!m) { Sound.illegal(); this.board.clearSelection(); return; }
    var prevAnalysis = this.lastAnalysis; // analysis of the position BEFORE this move
    this.applyMove(m);
    if (this.over) return;

    if (this.mode === 'bot') {
      if (this.coachOn) {
        this.gradeUserMove(m, prevAnalysis);
      } else {
        this.scheduleBotMove(300);
      }
    } else {
      // pass & play: optional auto-rotate
      if (App.store.get().settings.autoRotate) {
        this.board.setOrientation(this.g.turn === R.WHITE ? 'white' : 'black');
        this.renderBars();
      }
    }
  };

  P.applyMove = function (m) {
    var legal = this.g.legalMoves();
    var san = this.g.san(m, legal);
    var isCap = !!(m & R.F_CAP), isCastle = !!(m & R.F_CASTLE), isPromo = !!(m & R.F_PROMO);
    this.g.make(m);
    this.sanLine.push(san);
    this.meta.push({ san: san, uci: R.uci(m) });

    this.board.applyMove(m, this.g);
    this.updateCheckMark();

    if (this.g.inCheck()) Sound.check();
    else if (isPromo) Sound.promote();
    else if (isCastle) Sound.castle();
    else if (isCap) Sound.capture();
    else Sound.move();

    if (this.clock) {
      // increment for the side that just moved
      var moved = this.g.turn ^ 1;
      this.clock[moved === R.WHITE ? 'w' : 'b'] += this.clock.inc;
      this.switchClock();
    }

    this.renderMovelist();
    this.renderBars();
    this.updateOpening();
    this.save();

    var st = this.g.status();
    if (st.over) { this.endGame(st); return; }
  };

  // ---- coach pipeline --------------------------------------------------------
  P.refreshAnalysis = function () {
    var self = this;
    if (!this.coachOn || this.over || !this.active) return;
    if (this.mode === 'bot' && this.g.turn !== this.userColor) return;
    var forPly = this.g.ply;
    setTimeout(function () {
      if (!self.active || self.over || self.g.ply !== forPly) return;
      var r = null;
      try { r = AI.analyze(self.g, 550); } catch (e) { }
      if (!r || self.g.ply !== forPly) return;
      var legal = self.g.legalMoves();
      self.lastAnalysis = {
        ply: forPly,
        move: r.move,
        san: self.g.san(r.move, legal),
        score: r.score, // side-to-move POV = user POV here
        scoreWhite: AI.toWhitePov(r.score, self.g.turn)
      };
      self.setEval(self.lastAnalysis.scoreWhite);
    }, 60);
  };

  P.gradeUserMove = function (m, prevAnalysis) {
    var self = this;
    var gradedPly = this.g.ply - 1; // index of the move just played
    this.setThinking(this.userColor ^ 1, true);
    setTimeout(function () {
      if (!self.active) return;
      // ensure we have a "before" analysis
      var before = prevAnalysis && prevAnalysis.ply === gradedPly ? prevAnalysis : null;
      var ra = null;
      try {
        if (!before) {
          // reconstruct: unmake, analyze, remake
          self.g.unmake();
          var rb = AI.analyze(self.g, 420);
          var legalB = self.g.legalMoves();
          before = rb ? { move: rb.move, san: self.g.san(rb.move, legalB), score: rb.score } : null;
          self.g.make(m);
        }
        // eval after user's move (opponent to move)
        ra = AI.analyze(self.g, 420);
      } catch (e) { /* grading is optional, the game must go on */ }
      if (!before || !ra || self.over || !self.active) {
        self.setThinking(self.userColor ^ 1, false);
        self.scheduleBotMove(120);
        return;
      }
      var played = -ra.score; // back to user POV
      var cpLoss = Math.max(0, before.score - played);
      var wasBest = before.move === m;
      var verdict = Coach.classify(cpLoss, wasBest);
      var wb = AI.winPercent(AI.toWhitePov(before.score, self.userColor));
      var wa = AI.winPercent(AI.toWhitePov(played, self.userColor));
      if (self.userColor === R.BLACK) { wb = 100 - wb; wa = 100 - wa; }
      var acc = Coach.moveAccuracy(wb, wa);

      var mm = self.meta[gradedPly];
      if (mm) {
        mm.verdictId = verdict.id;
        mm.cpLoss = Math.round(cpLoss);
        mm.bestSan = before.san;
        mm.bestUci = R.uci(before.move);
        mm.acc = acc;
      }
      self._graded++;
      self.renderCoachCard(mm, verdict);
      self.renderMovelist();
      self.setEval(AI.toWhitePov(played, self.userColor));
      self.save();
      self.setThinking(self.userColor ^ 1, false);

      // takeback offer on big errors
      var offerOk = App.store.get().settings.takebackOffers &&
        (verdict.id === 'blunder' || verdict.id === 'mistake') && !self.over;
      if (offerOk) {
        App.confirmModal({
          title: verdict.id === 'blunder' ? 'That one stings' : 'Hold on',
          sub: 'Coach: "' + Coach.phrase(verdict.id) + '" Best was <b>' + before.san +
            '</b>. Take the move back and find it?',
          yes: 'Take it back', no: 'Play on',
          onYes: function () { self.takeback(1); },
          onNo: function () { self.scheduleBotMove(160); }
        });
      } else {
        self.scheduleBotMove(160);
      }
    }, 50);
  };

  P.renderCoachCard = function (mm, verdict) {
    var el = this.ui.coachCard;
    if (!this.coachOn || !mm) { el.hidden = true; return; }
    el.hidden = false;
    var bestLine = '';
    if (verdict.id !== 'best' && mm.bestSan) {
      bestLine = '<div class="coach-best">best was ' + mm.bestSan +
        ' <button data-showbest="1">show</button></div>';
    }
    el.innerHTML =
      '<div class="coach-head">' +
      '<span class="verdict-pill ' + verdict.id + '">' + verdict.label + '</span>' +
      '<span class="coach-move">' + mm.san +
      (mm.cpLoss > 9 ? ' · −' + (mm.cpLoss / 100).toFixed(1) : '') + '</span>' +
      '</div>' +
      '<div class="coach-text">' + Coach.phrase(verdict.id) + '</div>' +
      bestLine;
    var self = this;
    var btn = el.querySelector('[data-showbest]');
    if (btn) {
      btn.addEventListener('click', function () {
        var ply = self.meta.indexOf(mm);
        self.setView(ply - 1 >= 0 ? ply - 1 : -2, true);
        var from = R.parseSquare(mm.bestUci.slice(0, 2));
        var to = R.parseSquare(mm.bestUci.slice(2, 4));
        self.board.clearArrows();
        self.board.showArrow(from, to, 'arrow-green');
      });
    }
  };

  // ---- bot -------------------------------------------------------------------
  P.scheduleBotMove = function (delay) {
    var self = this;
    if (this.over || this.mode !== 'bot' || this.g.turn === this.userColor) {
      this.refreshAnalysis();
      return;
    }
    this.pendingBot = true;
    this.setThinking(this.userColor ^ 1, true);
    setTimeout(function () {
      if (!self.active || self.over) { self.pendingBot = false; return; }
      var mv = 0;
      // opening practice: bot follows the chosen line while it matches
      if (self.practice) {
        var line = self.practice.moves;
        var idx = self.sanLine.length;
        var inLine = idx < line.length;
        if (inLine) {
          for (var i = 0; i < idx; i++) if (self.sanLine[i] !== line[i]) { inLine = false; break; }
        }
        if (inLine) {
          var legal = self.g.legalMoves();
          for (var k = 0; k < legal.length; k++) {
            if (self.g.san(legal[k], legal) === line[idx]) { mv = legal[k]; break; }
          }
        }
      }
      if (!mv) {
        try { mv = AI.pickBotMove(self.g, self.bot, self.sanLine, Book.probeBook); }
        catch (e) { mv = 0; }
      }
      if (!mv) {
        // never brick a live game: any legal move beats a frozen bot
        var fallback = self.g.legalMoves();
        if (fallback.length) mv = fallback[(Math.random() * fallback.length) | 0];
      }
      self.pendingBot = false;
      self.setThinking(self.userColor ^ 1, false);
      if (!mv) return;
      self.applyMove(mv);
      if (!self.over) {
        self.checkPracticeStatus();
        self.refreshAnalysis();
      }
    }, delay || 200);
  };

  P.checkPracticeStatus = function () {
    if (!this.practice) return;
    var line = this.practice.moves, n = this.sanLine.length;
    for (var i = 0; i < Math.min(n, line.length); i++) {
      if (this.sanLine[i] !== line[i]) {
        App.toast('Off book: the line move was ' + line[i] + '. Playing on.');
        this.practice = null;
        this.updateOpening();
        return;
      }
    }
    if (n >= line.length) {
      App.toast('Line complete. You know this one now, play it out!');
      this.practice = null;
    }
  };

  // when the USER goes off book in practice, nudge (called after user move via applyMove? kept simple: check after bot replies)

  // ---- actions ----------------------------------------------------------------
  var HINT_COST = 5;

  P.hint = function () {
    var self = this;
    if (!this.active || this.over || this.viewPly !== -1) return;
    if (this.mode === 'bot' && this.g.turn !== this.userColor) return;
    if (this.mode === 'bot') {
      if (App.store.get().coins < HINT_COST) {
        App.toast('Hints cost 🪙 ' + HINT_COST + '. Win games or solve puzzles to earn coins.');
        return;
      }
    }
    App.toast('Thinking…');
    setTimeout(function () {
      var r = null;
      try { r = AI.analyze(self.g, 700); } catch (e) { }
      if (!r) return;
      var legal = self.g.legalMoves();
      var san = self.g.san(r.move, legal);
      self.hintsUsed++;
      if (self.mode === 'bot') App.store.addCoins(-HINT_COST);
      self.board.clearArrows();
      self.board.showArrow(R.mvFrom(r.move), R.mvTo(r.move), 'arrow-gold');
      App.toast('Consider ' + san + (self.mode === 'bot' ? ' (−' + HINT_COST + ' 🪙)' : ''));
    }, 40);
  };

  P.undo = function () {
    if (!this.active || this.over || this.viewPly !== -1 || this.pendingBot) return;
    if (this.mode === 'bot') {
      if (this.g.turn !== this.userColor || this.g.ply < 1) return;
      var n = Math.min(2, this.g.ply);
      // ensure we land back on user's turn
      if (this.g.ply >= 2) n = 2; else n = 1;
      this.takeback(n);
    } else {
      if (this.g.ply < 1) return;
      this.takeback(1);
    }
  };

  P.takeback = function (plies) {
    for (var i = 0; i < plies && this.g.ply > 0; i++) {
      this.g.unmake();
      this.sanLine.pop();
      this.meta.pop();
    }
    this.takebacks++;
    this.lastAnalysis = null;
    this.board.render(this.g, true);
    if (this.g.ply > 0) {
      var lm = this.g.histM[this.g.ply - 1];
      this.board.setLastMove(R.mvFrom(lm), R.mvTo(lm));
    } else this.board.setLastMove(-1, -1);
    this.updateCheckMark();
    this.renderMovelist();
    this.renderBars();
    this.updateOpening();
    this.ui.coachCard.hidden = true;
    if (this.clock) this.switchClock();
    this.save();
    this.refreshAnalysis();
    // if after takeback it's still the bot's turn (local weirdness), let it move
    if (this.mode === 'bot' && this.g.turn !== this.userColor) this.scheduleBotMove(300);
  };

  P.flip = function () {
    this.board.setOrientation(this.board.orientation === 'white' ? 'black' : 'white');
    this.renderBars();
  };

  P.confirmResign = function () {
    var self = this;
    if (!this.active || this.over) return;
    App.confirmModal({
      title: 'Resign this game?',
      sub: this.mode === 'bot' ? 'It counts as a loss and your rating takes the hit.' : 'White resigns if it is White to move, and vice versa.',
      yes: 'Resign', no: 'Keep playing', danger: true,
      onYes: function () {
        var loser = self.mode === 'bot' ? self.userColor : self.g.turn;
        self.endGame({
          over: true, reason: 'resignation', winner: loser ^ 1,
          result: loser === R.WHITE ? '0-1' : '1-0'
        });
      }
    });
  };

  P.exit = function () {
    var self = this;
    if (this.active && !this.over && this.g.ply > 1 && this.mode === 'bot') {
      App.confirmModal({
        title: 'Leave the board?',
        sub: 'Your game is saved. You can resume it from Home.',
        yes: 'Leave', no: 'Stay',
        onYes: function () { App.showScreen('home'); App.renderHome(); }
      });
    } else {
      if (!this.over) this.save();
      App.showScreen('home'); App.renderHome();
    }
  };

  // ---- history viewing -----------------------------------------------------------
  P.setView = function (ply, keepArrows) {
    // ply: -1 live, -2 start, 0..n-1 after that move
    if (ply === -1) {
      this.viewPly = -1;
      this.board.interactive = true;
      this.board.render(this.g, true);
      if (this.g.ply > 0) {
        var lm = this.g.histM[this.g.ply - 1];
        this.board.setLastMove(R.mvFrom(lm), R.mvTo(lm));
      } else this.board.setLastMove(-1, -1);
      this.updateCheckMark();
    } else {
      var upto = ply === -2 ? 0 : ply + 1;
      if (upto > this.meta.length) upto = this.meta.length;
      this.viewPly = ply === -2 ? -2 : Math.min(ply, this.meta.length - 1);
      var tmp = new R.Game();
      var lastMove = 0;
      for (var i = 0; i < upto; i++) {
        var m = tmp.moveFromUci(this.meta[i].uci);
        if (!m) break;
        tmp.make(m);
        lastMove = m;
      }
      this.board.interactive = false;
      this.board.render(tmp, true);
      if (lastMove) this.board.setLastMove(R.mvFrom(lastMove), R.mvTo(lastMove));
      else this.board.setLastMove(-1, -1);
      if (tmp.inCheck()) this.board.setCheck(tmp.kingSq[tmp.turn]);
      else this.board.setCheck(-1);
    }
    if (!keepArrows) this.board.clearArrows();
    document.getElementById('nav-live').hidden = this.viewPly === -1;
    this.updateViewHighlight();
  };

  P.stepView = function (dir) {
    var n = this.meta.length;
    if (!n) return;
    if (dir > 0) {
      if (this.viewPly === -1) return; // already live
      var nxt = this.viewPly === -2 ? 0 : this.viewPly + 1;
      if (nxt >= n - 1) this.setView(-1); // last move = live position
      else this.setView(nxt);
    } else {
      if (this.viewPly === -2) return; // already at start
      var prev = this.viewPly === -1 ? n - 2 : this.viewPly - 1;
      if (prev < 0) this.setView(-2);
      else this.setView(prev);
    }
  };

  P.updateViewHighlight = function () {
    var cells = this.ui.movelist.querySelectorAll('.mv');
    var target = this.viewPly === -1 ? this.meta.length - 1 : this.viewPly;
    cells.forEach(function (c) {
      c.classList.toggle('viewing', +c.dataset.ply === target);
    });
  };

  // ---- end of game ------------------------------------------------------------------
  P.endGame = function (st) {
    if (this.over) return;
    this.over = true;
    this.pendingBot = false;
    if (this.clock) this.clock.running = null;
    this.updateActiveBar();
    this.setThinking(0, false); this.setThinking(1, false);
    App.store.clearSavedGame();

    var userScore = null, deltaInfo = null;
    if (this.mode === 'bot') {
      userScore = st.winner === -1 ? 0.5 : (st.winner === this.userColor ? 1 : 0);
      // accuracy over user's graded moves
      var accs = [], blunders = 0, mistakes = 0;
      var startColor = R.WHITE;
      for (var i = 0; i < this.meta.length; i++) {
        var moverColor = (i % 2 === 0) ? startColor : startColor ^ 1;
        if (moverColor === this.userColor && this.meta[i].acc != null) {
          accs.push(this.meta[i].acc);
          if (this.meta[i].verdictId === 'blunder') blunders++;
          if (this.meta[i].verdictId === 'mistake') mistakes++;
        }
      }
      var acc = Coach.gameAccuracy(accs);
      deltaInfo = App.store.applyGameResult({
        botId: this.bot.id, botElo: this.bot.elo,
        score: userScore, accuracy: acc,
        blunders: blunders, mistakes: mistakes,
        takebacks: this.takebacks, hints: this.hintsUsed,
        moves: Math.ceil(this.meta.length / 2),
        reason: st.reason
      });
      if (userScore === 1) Sound.win();
      else if (userScore === 0) Sound.loss();
      else Sound.draw();
    } else {
      Sound.draw();
    }

    var self = this;
    setTimeout(function () {
      App.showEndModal({
        mode: self.mode,
        st: st,
        userColor: self.userColor,
        userScore: userScore,
        bot: self.bot,
        delta: deltaInfo,
        takebacks: self.takebacks,
        hints: self.hintsUsed,
        cfg: self.cfg
      });
    }, 650);
  };

  // ---- persistence ---------------------------------------------------------------------
  P.save = function () {
    if (!this.active || this.over) return;
    var metaSlim = this.meta.map(function (m) {
      return { v: m.verdictId, c: m.cpLoss, bs: m.bestSan, bu: m.bestUci, a: m.acc };
    });
    App.store.saveGame({
      cfg: {
        mode: this.mode,
        botId: this.bot ? this.bot.id : null,
        userColor: this.userColor === R.BLACK ? 'black' : 'white',
        time: this.cfg.time || null,
        coach: this.coachOn,
        practice: this.practice
      },
      uciLine: this.meta.map(function (m) { return m.uci; }),
      meta: metaSlim,
      clock: this.clock,
      takebacks: this.takebacks,
      hintsUsed: this.hintsUsed,
      ts: Date.now()
    });
  };

  P.resume = function (saved) {
    this.start(saved.cfg, saved);
  };

  window.GameController = GameController;
}());
