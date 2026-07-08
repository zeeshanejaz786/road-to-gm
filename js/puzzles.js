/* ============================================================
   Road to GM — tactics trainer
   Puzzles are engine-mined and engine-verified (unique first move,
   forced mate). Correctness at every step is re-checked live, so
   alternate mates that are equally fast are accepted.
   ============================================================ */
(function () {
  'use strict';
  var R = window.RTG, AI = window.RTGAI, Sound = window.RTGSound;

  function PuzzleController() {
    this.diff = 1;
    this.current = null;
    this.remaining = 0;
    this.busy = false;
    this.assisted = false;
    this.hintStage = 0;
  }
  var P = PuzzleController.prototype;

  P.init = function () {
    if (this.board) return;
    var self = this;
    this.board = new BoardView(document.getElementById('puzzle-board'), {
      interactive: true,
      theme: App.store.get().settings.boardTheme,
      showLegal: App.store.get().settings.showLegal,
      onUserMove: function (f, t, p) { self.onUserMove(f, t, p); },
      canMove: function () { return !self.busy && !!self.current && !self.solvedNow; }
    });
    this.ui = {
      prompt: document.getElementById('puzzle-prompt'),
      feedback: document.getElementById('puzzle-feedback'),
      streak: document.getElementById('pz-streak'),
      best: document.getElementById('pz-best'),
      solved: document.getElementById('pz-solved'),
      next: document.getElementById('pz-next'),
      tabs: document.getElementById('puzzle-tabs')
    };
    this.ui.tabs.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      self.ui.tabs.querySelectorAll('button').forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      self.diff = +b.dataset.diff;
      self.loadNext();
    });
    document.getElementById('pz-hint').addEventListener('click', function () { self.hint(); });
    document.getElementById('pz-skip').addEventListener('click', function () { self.loadNext(); });
    this.ui.next.addEventListener('click', function () { self.loadNext(); });
  };

  P.open = function () {
    this.init();
    this.board.setTheme(App.store.get().settings.boardTheme);
    if (!this.current) this.loadNext();
    this.renderStats();
  };

  P.loadNext = function () {
    var pool = (window.RTG_PUZZLES || []).filter(function (p) { return p.mateIn === this.diff; }.bind(this));
    if (!pool.length) {
      this.ui.prompt.textContent = 'No puzzles at this level yet.';
      return;
    }
    var solved = App.store.get().puzzles.solved;
    var fresh = pool.filter(function (p) { return !solved[p.id]; });
    var pick = (fresh.length ? fresh : pool)[(Math.random() * (fresh.length ? fresh.length : pool.length)) | 0];
    this.setPuzzle(pick, fresh.length === 0);
  };

  P.setPuzzle = function (p, isRepeat) {
    this.current = p;
    this.g = new R.Game(p.fen);
    this.remaining = p.mateIn;
    this.solvedNow = false;
    this.assisted = false;
    this.hintStage = 0;
    this.busy = false;
    var toMove = this.g.turn === R.WHITE ? 'White' : 'Black';
    this.board.setOrientation(this.g.turn === R.WHITE ? 'white' : 'black');
    this.board.render(this.g, true);
    this.board.setLastMove(-1, -1);
    this.board.clearArrows();
    if (this.g.inCheck()) this.board.setCheck(this.g.kingSq[this.g.turn]);
    else this.board.setCheck(-1);
    this.ui.prompt.innerHTML = toMove + ' to move · <b>Mate in ' + p.mateIn + '</b>' +
      '<small>' + (isRepeat ? 'All solved at this level — replaying the set.' :
        'Forcing moves first: every check, every capture.') + '</small>';
    this.setFeedback('', '');
    this.ui.next.hidden = true;
    this.renderStats();
  };

  P.setFeedback = function (text, cls) {
    this.ui.feedback.textContent = text;
    this.ui.feedback.className = 'puzzle-feedback' + (cls ? ' ' + cls : '');
  };

  P.renderStats = function () {
    var st = App.store.get().puzzles;
    var all = window.RTG_PUZZLES || [];
    var mine = all.filter(function (p) { return p.mateIn === this.diff; }.bind(this));
    var solvedCount = mine.filter(function (p) { return st.solved[p.id]; }).length;
    this.ui.streak.textContent = st.streak;
    this.ui.best.textContent = st.best;
    this.ui.solved.textContent = solvedCount + '/' + mine.length;
  };

  P.onUserMove = function (from, to, promo) {
    if (!this.current || this.busy || this.solvedNow) return;
    var m = this.g.findMove(from, to, promo);
    if (!m) { Sound.illegal(); this.board.clearSelection(); return; }

    var self = this;
    this.busy = true;
    this.g.make(m);

    // immediate mate?
    var st = this.g.status();
    if (st.over && st.reason === 'checkmate') {
      this.board.applyMove(m, this.g);
      this.board.setCheck(this.g.kingSq[this.g.turn]);
      Sound.check();
      this.solve();
      return;
    }

    // does this move keep the forced mate on schedule?
    var need = this.remaining - 1; // opponent must now be mated in <= need
    if (need <= 0) { this.fail(m, 'Mate slipped away there. Try again.'); return; }

    setTimeout(function () {
      var r = AI.think(self.g, { timeMs: 600, maxDepth: 2 * need + 3 });
      var keeps = r && r.mate < 0 && Math.abs(r.mate) <= need;
      var slower = r && r.mate < 0 && Math.abs(r.mate) > need;
      if (!keeps) {
        self.fail(m, slower
          ? 'That still wins eventually, but the puzzle asks for the fastest mate.'
          : 'Not that one. Look for the most forcing move.');
        return;
      }
      // accepted: animate, opponent defends with the engine's best
      self.board.applyMove(m, self.g);
      if (self.g.inCheck()) { self.board.setCheck(self.g.kingSq[self.g.turn]); Sound.check(); }
      else { self.board.setCheck(-1); Sound.move(); }
      self.setFeedback('Yes. Keep going.', 'good');
      self.remaining = need;

      setTimeout(function () {
        if (!r.move) { self.busy = false; return; }
        self.g.make(r.move);
        self.board.applyMove(r.move, self.g);
        var st2 = self.g.status();
        if (self.g.inCheck()) self.board.setCheck(self.g.kingSq[self.g.turn]);
        else self.board.setCheck(-1);
        Sound.move();
        self.busy = false;
        if (st2.over) {
          // defender got mated or stalemated unexpectedly — treat mate as solve
          if (st2.reason === 'checkmate') self.solve();
        }
      }, 420);
    }, 30);
  };

  P.fail = function (m, msg) {
    var self = this;
    var from = R.mvFrom(m), to = R.mvTo(m);
    this.g.unmake();
    setTimeout(function () {
      self.board.render(self.g, true);
      if (self.g.inCheck()) self.board.setCheck(self.g.kingSq[self.g.turn]);
      self.board.flash(to, 'sel');
      self.board.shake();
      Sound.wrong();
      self.setFeedback(msg, 'bad');
      App.store.puzzleStreakReset();
      self.renderStats();
      self.busy = false;
    }, 120);
  };

  P.solve = function () {
    this.solvedNow = true;
    this.busy = false;
    Sound.right();
    var res = App.store.markPuzzleSolved(this.current.id, this.assisted, this.current.mateIn);
    var msg = this.assisted
      ? 'Solved with a nudge. It counts, but streak stays put.'
      : 'Checkmate. Clean.';
    if (res.earned > 0) msg += ' +' + res.earned + ' 🪙';
    this.setFeedback(msg, 'good');
    this.ui.next.hidden = false;
    this.renderStats();
  };

  P.hint = function () {
    if (!this.current || this.solvedNow || this.busy) return;
    var self = this;
    this.assisted = true;
    if (this.hintStage === 0) {
      // highlight the piece to move
      setTimeout(function () {
        var r = AI.think(self.g, { timeMs: 500, maxDepth: 2 * self.remaining + 3 });
        if (!r) return;
        self.board.flash(R.mvFrom(r.move), 'sel');
        self.setFeedback('This piece wants to move.', '');
        self.hintStage = 1;
      }, 20);
    } else {
      setTimeout(function () {
        var r = AI.think(self.g, { timeMs: 500, maxDepth: 2 * self.remaining + 3 });
        if (!r) return;
        self.board.clearArrows();
        self.board.showArrow(R.mvFrom(r.move), R.mvTo(r.move), 'arrow-gold');
        self.setFeedback('There it is. See why it forces mate.', '');
      }, 20);
    }
  };

  window.PuzzleController = PuzzleController;
}());
