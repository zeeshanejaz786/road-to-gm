/* ============================================================
   Road to GM — First Steps: chess from absolute zero
   Interactive lessons for someone who has never played.
   Every drill runs on the real rules engine.
   ============================================================ */
(function () {
  'use strict';
  var R = window.RTG, Sound = window.RTGSound;

  var CHAPTERS = ['', 'The Board', 'Your Army', 'Taking Pieces', 'The King', 'Special Powers', 'Graduation'];

  var LESSONS = [
    // ---------- chapter 1: the board ----------
    {
      id: 'welcome', ch: 1, icon: '♟', title: 'Welcome to chess',
      type: 'text', fen: R.START_FEN,
      intro: 'Chess is a battle between two little armies: one light, one dark. ' +
        'You command one army, your opponent commands the other. You take turns, one move each. ' +
        '<br><br>The goal is simple: <b>trap the enemy King</b> so he cannot escape. Do that and you win. ' +
        'Lose your own King and the game is over. That is really all chess is!',
      task: 'Take a look at the two armies below, then press Continue.',
      success: 'Off we go. Next: the battlefield itself.'
    },
    {
      id: 'squares', ch: 1, icon: '🗺️', title: 'Every square has a name',
      type: 'clicksquares', fen: '8/8/8/8/8/8/8/8 w - - 0 1',
      targets: ['e4', 'a1', 'h8', 'd5', 'g2'],
      intro: 'The board is a grid of 64 squares, light and dark. Each square has a name, like on a treasure map. ' +
        'The letters <b>a to h</b> run along the bottom. The numbers <b>1 to 8</b> climb up the side. ' +
        '<br><br>So <b>e4</b> means: column e, row 4. Find where the letter and the number cross.',
      task: 'Click square {target}.',
      success: 'You can read the map now. Time to meet your army!'
    },

    // ---------- chapter 2: the pieces ----------
    {
      id: 'rook', ch: 2, icon: '♜', title: 'The Rook',
      type: 'collect', fen: '8/8/8/8/8/8/8/R7 w - - 0 1', stars: ['a5', 'e5'],
      intro: 'This is the <b>Rook</b>. It looks like a little castle tower. ' +
        'The Rook slides in straight lines: up, down, left, or right. As far as it wants! ' +
        'But it cannot jump over anyone.',
      task: 'Click your Rook, then slide it to grab both stars.',
      success: 'Straight lines, big power. You have two Rooks in a real game.'
    },
    {
      id: 'bishop', ch: 2, icon: '♝', title: 'The Bishop',
      type: 'collect', fen: '8/8/8/8/8/8/8/2B5 w - - 0 1', stars: ['g5', 'd8'],
      intro: 'This is the <b>Bishop</b>, the one with the pointy hat. ' +
        'The Bishop slides <b>diagonally</b>, as far as it wants. ' +
        '<br><br>Fun secret: a Bishop stays on its starting color forever. This one lives on the dark squares.',
      task: 'Slide your Bishop diagonally and collect both stars.',
      success: 'Diagonals only, always the same color. You get one Bishop for each color.'
    },
    {
      id: 'queen', ch: 2, icon: '♛', title: 'The Queen',
      type: 'collect', fen: '8/8/8/8/8/8/8/3Q4 w - - 0 1', stars: ['d5', 'g8', 'a8'],
      intro: 'Meet the <b>Queen</b>, the strongest piece on the board! ' +
        'She moves like a Rook and a Bishop combined: any straight line, any diagonal, as far as she wants. ' +
        'Guard her well. Losing the Queen for nothing usually loses the game.',
      task: 'Use her full power to collect all three stars.',
      success: 'That is why everyone loves the Queen. One per army, make her count.'
    },
    {
      id: 'king', ch: 2, icon: '♚', title: 'The King',
      type: 'collect', fen: '8/8/8/8/8/8/8/4K3 w - - 0 1', stars: ['e2', 'd3'],
      intro: 'This is your <b>King</b>, the most important piece of all. The whole game is about him. ' +
        'He is not fast: just <b>one little step</b> in any direction. ' +
        'If your King gets trapped, you lose. So treat him like treasure.',
      task: 'Walk the King one step at a time to both stars.',
      success: 'Slow but precious. Later you will learn how to keep him safe.'
    },
    {
      id: 'knight', ch: 2, icon: '♞', title: 'The Knight',
      type: 'collect', fen: '8/8/8/8/8/8/8/1N6 w - - 0 1', stars: ['c3', 'e4'],
      intro: 'The <b>Knight</b> is the horse, and it is the trickiest piece. ' +
        'It jumps in an <b>L shape</b>: two squares one way, then one square sideways. ' +
        '<br><br>And here is its superpower: the Knight is the <b>only</b> piece that can jump over others!',
      task: 'Make two L-shaped jumps to collect the stars.',
      success: 'Weird little jumps, right? Knights love crowded boards.'
    },
    {
      id: 'pawnwalk', ch: 2, icon: '♟', title: 'The Pawn walks',
      type: 'collect', fen: '8/8/8/8/8/8/4P3/8 w - - 0 1', stars: ['e4', 'e5'],
      intro: 'This little one is a <b>Pawn</b>, your foot soldier. You have eight of them. ' +
        'A Pawn walks <b>one square forward</b>. Never backward, never sideways. ' +
        '<br><br>Special treat: on its very first move, a Pawn may take <b>two</b> steps.',
      task: 'March the Pawn forward. Try the double step first!',
      success: 'Small steps, brave heart. Now learn how Pawns fight.'
    },
    {
      id: 'pawncapture', ch: 2, icon: '⚔️', title: 'The Pawn fights',
      type: 'capture', fen: '8/8/8/4p3/3p4/4P3/8/8 w - - 0 1',
      intro: 'Pawns are odd: they walk straight, but they <b>capture diagonally</b>, one square forward-left or forward-right. ' +
        'A Pawn can never capture the piece right in front of it. ' +
        '<br><br>Capture means: move onto an enemy square and take that piece off the board. It is yours now!',
      task: 'Capture both enemy pawns with diagonal bites.',
      success: 'Walk straight, bite sideways. You know every piece now!'
    },

    // ---------- chapter 3: capturing ----------
    {
      id: 'freestuff', ch: 3, icon: '💰', title: 'Take what is free',
      type: 'capture', fen: '1b6/8/8/1n6/8/8/8/1R6 w - - 0 1',
      intro: 'Capturing enemy pieces makes your army stronger than theirs. ' +
        'Each piece is worth points: Pawn 1, Knight 3, Bishop 3, Rook 5, Queen 9. ' +
        '<br><br>The number one rule of chess for beginners: <b>take free stuff, and do not give your stuff away for free.</b> ' +
        'Most beginner games are decided by exactly this.',
      task: 'Your Rook is hungry. Capture both enemy pieces.',
      success: 'That is 3 + 3 = 6 points of material. This habit alone wins games.'
    },

    // ---------- chapter 4: the king's rules ----------
    {
      id: 'check', ch: 4, icon: '⚠️', title: 'Check: the King is attacked',
      type: 'escape', fen: '4r3/8/8/8/8/8/8/4K3 w - - 0 1',
      intro: 'When an enemy piece attacks your King, that is called <b>check</b>. The King glows red. ' +
        'You are not allowed to ignore it! You must fix it right now, in one of three ways: ' +
        '<b>move</b> the King to safety, <b>block</b> the attack, or <b>capture</b> the attacker.',
      task: 'That enemy Rook is checking your King. Step him out of the firing line!',
      success: 'Safe! Notice he could not stay anywhere on that column. Rooks see far.'
    },
    {
      id: 'mate1rook', ch: 4, icon: '🏆', title: 'Checkmate: how you win',
      type: 'mate1', fen: '6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1',
      intro: '<b>Checkmate</b> is check with no fix: the King is attacked, cannot run, nothing can block, nothing can capture the attacker. ' +
        'Checkmate ends the game instantly. That is the win! ' +
        '<br><br>Look: the dark King hides behind his three pawns. They protect him, but they also box him in. His back row is his weak spot.',
      task: 'Slide your Rook to the top row and deliver checkmate!',
      success: 'CHECKMATE! The King is trapped by his own pawns. This is called a back rank mate, and it wins real games all the time.'
    },
    {
      id: 'mate1queen', ch: 4, icon: '👑', title: 'The Queen finishes it',
      type: 'mate1', fen: '7k/8/6K1/8/8/8/1Q6/8 w - - 0 1',
      intro: 'The Queen is the best finisher in chess. ' +
        'A favorite trick: bring her right next to the enemy King while your own King guards her. ' +
        'The enemy King cannot capture her (your King protects her) and cannot run (she covers everything).',
      task: 'Find the checkmate. Hint: get the Queen close and personal.',
      success: 'Beautiful. Your two pieces worked as a team. That is chess in one picture.'
    },
    {
      id: 'draws', ch: 4, icon: '🤝', title: 'Not every game has a winner',
      type: 'text', fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1',
      intro: 'Sometimes nobody wins. That is a <b>draw</b>, and it is worth half a point. ' +
        'The sneakiest draw is <b>stalemate</b>: the player to move is NOT in check, but has no legal move at all. Game drawn, instantly. ' +
        '<br><br>Look at the board: the dark King is not attacked, but every square he could step to is covered. Stalemate! ' +
        'When you are winning big, always leave the enemy King one safe square until you are ready to checkmate. ' +
        '<br><br>Games are also drawn if the same position repeats three times, or if nobody has enough pieces left to ever checkmate.',
      task: 'Study the trap, then press Continue.',
      success: 'Now you know every way a game can end: win, lose, or draw.'
    },

    // ---------- chapter 5: special powers ----------
    {
      id: 'castle', ch: 5, icon: '🏰', title: 'Castling: the King hides',
      type: 'castle', fen: '4k3/8/8/8/8/8/8/4K2R w K - 0 1',
      intro: 'Once per game your King and a Rook can do a team move called <b>castling</b>: ' +
        'the King slides <b>two squares</b> toward the Rook, and the Rook hops to the other side of him. ' +
        'It tucks your King into a safe corner. Do it early in every game! ' +
        '<br><br>Rules: no pieces between them, neither has moved yet, and the King may not castle out of, through, or into an attack.',
      task: 'Click your King, then click two squares to the right.',
      success: 'Your King is snug in the corner and the Rook joined the fight. Win-win.'
    },
    {
      id: 'promote', ch: 5, icon: '🎁', title: 'Promotion: the Pawn levels up',
      type: 'promote', fen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 1',
      intro: 'If a brave little Pawn marches all the way to the far end of the board, it gets a reward: ' +
        'it transforms into any piece you want. Almost everyone picks a <b>Queen</b>. ' +
        '<br><br>Yes, you can have two Queens. Endgames are often won by racing a Pawn to the last row.',
      task: 'March your Pawn to the last row and crown a new Queen!',
      success: 'A brand new Queen! Never forget your Pawns; each one is a sleeping Queen.'
    },
    {
      id: 'enpassant', ch: 5, icon: '👻', title: 'En passant: the weird one',
      type: 'ep', fen: 'k7/8/8/3pP3/8/8/8/K7 w - d6 0 1',
      intro: 'One last rule, and it is strange. It is French: <b>en passant</b> means "in passing". ' +
        'If an enemy Pawn uses its double step to rush PAST your Pawn, landing right beside it, ' +
        'you may capture it as if it had only stepped one square. But only on the very next move! ' +
        '<br><br>Here the dark pawn just double-stepped past yours. Sneaky. Punish it.',
      task: 'Capture diagonally behind the enemy pawn, onto the marked file.',
      success: 'You captured a pawn that was not even on that square. Told you it was weird. It is 100% legal.'
    },

    // ---------- chapter 6: graduation ----------
    {
      id: 'firstgame', ch: 6, icon: '🎓', title: 'Your first real game',
      type: 'text', fen: R.START_FEN, action: 'gentlegame',
      intro: 'You know everything you need: the board, every piece, capturing, check, checkmate, and the special moves. ' +
        '<br><br>This is how the armies line up. Pawns in front, Rooks in the corners, Knights beside them, then Bishops, ' +
        'and the Queen starts on <b>her own color</b>. ' +
        '<br><br>Time for a real game against Pip. He is very gentle. Your coach will sit beside you the whole time: ' +
        'it explains any piece you touch, warns you about check, grades your moves in plain words, and lets you take back mistakes. ' +
        '<br><br>Do not worry about winning. Worry about looking at the whole board before each move. Good luck!',
      task: 'Press the button when you are ready.',
      button: 'Play my first game ♟',
      success: 'Go get them!'
    }
  ];

  function BasicsController() {
    this.idx = 0;
    this.solvedNow = false;
  }
  var P = BasicsController.prototype;

  P.init = function () {
    if (this.board) return;
    var self = this;
    this.board = new BoardView(document.getElementById('basics-board'), {
      interactive: true,
      theme: App.store.get().settings.boardTheme,
      showLegal: true,
      showLabels: true,
      onUserMove: function (f, t, p) { self.onUserMove(f, t, p); },
      onSquareClick: function (sq) { self.onSquareClick(sq); },
      onSelect: function (sq, code) { self.onSelect(sq, code); },
      canMove: function () { return !self.solvedNow; }
    });
    this.ui = {
      list: document.getElementById('lesson-list'),
      chip: document.getElementById('lesson-chip'),
      title: document.getElementById('lesson-title'),
      intro: document.getElementById('lesson-intro'),
      task: document.getElementById('lesson-task'),
      feedback: document.getElementById('lesson-feedback'),
      next: document.getElementById('lesson-next'),
      restart: document.getElementById('lesson-restart')
    };
    this.ui.next.addEventListener('click', function () { self.onNext(); });
    this.ui.restart.addEventListener('click', function () { self.loadLesson(self.idx); });
  };

  P.open = function () {
    this.init();
    this.board.setTheme(App.store.get().settings.boardTheme);
    var done = App.store.get().basics.done;
    // resume at first unfinished lesson
    var at = 0;
    for (var i = 0; i < LESSONS.length; i++) {
      if (!done[LESSONS[i].id]) { at = i; break; }
      at = i;
    }
    this.loadLesson(at);
  };

  P.renderList = function () {
    var self = this;
    var done = App.store.get().basics.done;
    var html = '';
    var lastCh = 0;
    LESSONS.forEach(function (l, i) {
      if (l.ch !== lastCh) {
        if (lastCh) html += '</div></div>';
        html += '<div class="lesson-group"><div class="lesson-group-name">' +
          l.ch + '. ' + CHAPTERS[l.ch] + '</div><div class="lesson-pills">';
        lastCh = l.ch;
      }
      html += '<button class="lesson-pill' + (i === self.idx ? ' at' : '') +
        (done[l.id] ? ' done' : '') + '" data-idx="' + i + '" title="' + l.title + '">' +
        '<span>' + l.icon + '</span>' + (done[l.id] ? '<i>✓</i>' : '') + '</button>';
    });
    html += '</div></div>';
    this.ui.list.innerHTML = html;
    this.ui.list.querySelectorAll('.lesson-pill').forEach(function (b) {
      b.addEventListener('click', function () { self.loadLesson(+b.dataset.idx); });
    });
  };

  P.loadLesson = function (i) {
    this.idx = Math.max(0, Math.min(i, LESSONS.length - 1));
    var l = LESSONS[this.idx];
    this.lesson = l;
    this.solvedNow = false;
    this.clickQueue = (l.targets || []).slice();
    this.misses = 0;

    this.ui.chip.textContent = CHAPTERS[l.ch] + ' · lesson ' + (this.idx + 1) + ' of ' + LESSONS.length;
    this.ui.title.textContent = l.icon + '  ' + l.title;
    this.ui.intro.innerHTML = l.intro;
    this.ui.feedback.textContent = '';
    this.ui.feedback.className = 'lesson-feedback';
    this.ui.next.hidden = true;

    // board setup
    this.g = new R.Game(l.fen);
    this.board.clickMode = l.type === 'clicksquares';
    this.board.interactive = l.type !== 'text';
    this.board.setOrientation('white');
    this.board.render(this.g, true);
    this.board.setLastMove(-1, -1);
    this.board.clearArrows();
    this.board.clearStars();
    this.board.setCheck(this.g.inCheck() ? this.g.kingSq[this.g.turn] : -1);
    if (l.stars) this.board.setStars(l.stars.map(R.parseSquare));

    if (l.type === 'clicksquares') {
      this.setTask(l.task.replace('{target}', '<b>' + this.clickQueue[0] + '</b>'));
    } else {
      this.setTask(l.task);
    }

    if (l.type === 'text') {
      this.ui.next.hidden = false;
      this.ui.next.textContent = l.button || 'Continue';
    }

    this.renderList();
  };

  P.setTask = function (html) {
    this.ui.task.innerHTML = '👉 ' + html;
  };
  P.setFeedback = function (text, cls) {
    this.ui.feedback.innerHTML = text;
    this.ui.feedback.className = 'lesson-feedback' + (cls ? ' ' + cls : '');
  };

  // narrate a piece the learner picks up during a movement drill
  P.onSelect = function (sq, code) {
    if (!code || this.solvedNow) return;
    var l = this.lesson;
    if (!l || ['collect', 'capture', 'escape', 'mate1', 'castle', 'promote', 'ep'].indexOf(l.type) < 0) return;
    if (R.pieceColor(code) !== R.WHITE) return; // learner is always White here
    var N = window.RTGNarrator;
    if (!N) return;
    var text = N.describePiece(this.g, sq, R.WHITE);
    if (text) this.setFeedback(text, '');
  };

  // ---- click-the-square drill --------------------------------------
  P.onSquareClick = function (sq) {
    if (this.solvedNow || !this.clickQueue.length) return;
    var want = this.clickQueue[0];
    if (R.algebraic(sq) === want) {
      Sound.move();
      this.board.flash(sq, 'sel');
      this.clickQueue.shift();
      this.misses = 0;
      if (!this.clickQueue.length) { this.complete(); return; }
      this.setTask(this.lesson.task.replace('{target}', '<b>' + this.clickQueue[0] + '</b>'));
      this.setFeedback('Found it! Next one.', 'good');
    } else {
      Sound.illegal();
      this.misses++;
      this.setFeedback('That one is ' + R.algebraic(sq) + '. Look for ' + want +
        ': column ' + want[0] + ', row ' + want[1] + '.', 'bad');
      if (this.misses >= 2) this.board.flash(R.parseSquare(want), 'sel');
    }
  };

  // ---- move-based drills ---------------------------------------------
  P.onUserMove = function (from, to, promo) {
    if (this.solvedNow) return;
    var l = this.lesson;
    var m = this.g.findMove(from, to, promo);
    if (!m) { Sound.illegal(); this.board.clearSelection(); return; }

    switch (l.type) {
      case 'collect': return this.doCollect(m);
      case 'capture': return this.doCapture(m);
      case 'escape': return this.doEscape(m);
      case 'mate1': return this.doMate1(m);
      case 'castle': return this.doCastle(m);
      case 'promote': return this.doPromote(m);
      case 'ep': return this.doEp(m);
    }
  };

  // after our move, hand the turn straight back (drill opponents never move)
  P.forceWhiteTurn = function () {
    var parts = this.g.fen().split(' ');
    parts[1] = 'w'; parts[3] = '-';
    this.g = new R.Game(parts.join(' '));
    this.board.game = this.g;
  };

  P.doCollect = function (m) {
    var to = R.mvTo(m);
    this.g.make(m);
    this.board.applyMove(m, this.g);
    this.forceWhiteTurn();
    if (this.board.stars.indexOf(to) >= 0) {
      this.board.removeStar(to);
      Sound.capture();
      if (!this.board.stars.length) { this.complete(); return; }
      this.setFeedback('Got one! ' + this.board.stars.length + ' star' +
        (this.board.stars.length > 1 ? 's' : '') + ' to go.', 'good');
    } else {
      Sound.move();
      this.setFeedback('Nice move. Now aim for a star.', '');
    }
  };

  P.doCapture = function (m) {
    var wasCap = !!(m & R.F_CAP);
    this.g.make(m);
    this.board.applyMove(m, this.g);
    this.forceWhiteTurn();
    var left = 0;
    for (var sq = 0; sq < 128; sq++) {
      if (!(sq & 0x88) && this.g.board[sq] && (this.g.board[sq] & 8)) left++;
    }
    if (left === 0) { this.complete(); return; }
    if (wasCap) {
      Sound.capture();
      this.setFeedback('Captured! ' + left + ' enemy piece' + (left > 1 ? 's' : '') + ' left.', 'good');
    } else {
      Sound.move();
      this.setFeedback('That was just a walk. Land ON an enemy piece to capture it.', '');
    }
  };

  P.doEscape = function (m) {
    this.g.make(m);
    this.board.applyMove(m, this.g);
    this.board.setCheck(-1);
    Sound.move();
    this.complete();
  };

  P.doMate1 = function (m) {
    this.g.make(m);
    var st = this.g.status();
    if (st.over && st.reason === 'checkmate') {
      this.board.applyMove(m, this.g);
      this.board.setCheck(this.g.kingSq[this.g.turn]);
      Sound.check();
      this.complete();
    } else {
      var gaveCheck = this.g.inCheck();
      this.g.unmake();
      this.board.render(this.g, true);
      this.board.shake();
      Sound.wrong();
      this.setFeedback(gaveCheck
        ? 'That is check, but the King can still wriggle out. Find the move that leaves him NO escape.'
        : 'Not that one. Remember: attack the King so he has nowhere to go.', 'bad');
    }
  };

  P.doCastle = function (m) {
    if (m & R.F_CASTLE) {
      this.g.make(m);
      this.board.applyMove(m, this.g);
      Sound.castle();
      this.complete();
    } else {
      Sound.illegal();
      this.setFeedback('Almost! Click the King, then click the square TWO steps toward the Rook.', 'bad');
      this.board.clearSelection();
    }
  };

  P.doPromote = function (m) {
    if (m & R.F_PROMO) {
      this.g.make(m);
      this.board.applyMove(m, this.g);
      Sound.promote();
      this.complete();
    } else {
      Sound.illegal();
      this.setFeedback('March the Pawn forward to the very last row.', 'bad');
      this.board.clearSelection();
    }
  };

  P.doEp = function (m) {
    if (m & R.F_EP) {
      this.g.make(m);
      this.board.applyMove(m, this.g);
      Sound.capture();
      this.complete();
    } else {
      Sound.illegal();
      this.setFeedback('Capture diagonally forward, onto the square just BEHIND the enemy pawn.', 'bad');
      this.board.clearSelection();
    }
  };

  // ---- completion -----------------------------------------------------
  P.complete = function () {
    if (this.solvedNow) return;
    this.solvedNow = true;
    var l = this.lesson;
    var store = App.store;
    var d = store.get();
    var firstTime = !d.basics.done[l.id];
    d.basics.done[l.id] = true;

    var reward = '';
    if (firstTime) {
      store.addCoins(10);
      reward = ' +10 🪙';
    }
    // graduation check
    var allDone = LESSONS.every(function (x) { return d.basics.done[x.id]; });
    if (allDone && !d.basics.graduated) {
      d.basics.graduated = true;
      store.addCoins(100);
      setTimeout(function () {
        App.toast('🎓 First Steps complete! +100 🪙 graduation gift. You are a chess player now.');
      }, 900);
    }
    store.save();

    Sound.right();
    this.setFeedback('🎉 ' + l.success + reward, 'good');
    this.ui.next.hidden = false;
    this.ui.next.textContent = l.action === 'gentlegame' ? (l.button || 'Continue')
      : (this.idx + 1 < LESSONS.length ? 'Next: ' + LESSONS[this.idx + 1].title : 'Finish');
    this.renderList();
    App.renderHome && App.renderHome();
  };

  P.onNext = function () {
    var l = this.lesson;
    if (l.type === 'text' && !this.solvedNow) {
      // "Continue" on a reading lesson counts as completing it
      this.complete();
      if (l.action !== 'gentlegame') return; // show the success state first, next click advances
    }
    if (l.action === 'gentlegame') {
      App.game.start({
        mode: 'bot', botId: 'pip', userColor: 'white',
        time: null, coach: true, gentle: true
      });
      return;
    }
    if (this.idx + 1 < LESSONS.length) this.loadLesson(this.idx + 1);
    else App.showScreen('home');
  };

  P.progress = function () {
    var done = App.store.get().basics.done, n = 0;
    LESSONS.forEach(function (l) { if (done[l.id]) n++; });
    return { done: n, total: LESSONS.length };
  };

  window.BasicsController = BasicsController;
  window.RTG_LESSONS = LESSONS;
}());
