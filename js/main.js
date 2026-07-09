/* ============================================================
   Road to GM — app shell: store, routing, screens, modals
   ============================================================ */
(function () {
  'use strict';
  var R = window.RTG, AI = window.RTGAI, Coach = window.RTGCoach,
    Book = window.RTGBOOK, Sound = window.RTGSound;

  var LS_KEY = 'roadtogm_v1';

  // ---------------- store ----------------
  function defaults() {
    return {
      v: 1,
      rating: 800,
      peak: 800,
      gamesPlayed: 0,
      history: [],   // {ts, rating, delta, botId, score, acc, reason}
      records: {},   // botId -> {w,l,d}
      puzzles: { solved: {}, streak: 0, best: 0 },
      coins: 0,
      lastWinDay: null,
      avatar: 'classic',
      unlocks: { themes: ['green'], avatars: ['classic'] },
      basics: { done: {}, graduated: false },
      firstRunDone: false,
      settings: {
        boardTheme: 'green',
        showLegal: true,
        sounds: true,
        coachDefault: true,
        takebackOffers: true,
        autoRotate: false,
        beginnerCoach: false, // extra plain-words explanations in coach games
        pieceLabels: false    // print piece names on the board
      },
      savedGame: null
    };
  }

  var Store = {
    data: null,
    load: function () {
      try {
        var raw = localStorage.getItem(LS_KEY);
        this.data = raw ? Object.assign(defaults(), JSON.parse(raw)) : defaults();
        this.data.settings = Object.assign(defaults().settings, this.data.settings || {});
        this.data.puzzles = Object.assign(defaults().puzzles, this.data.puzzles || {});
        this.data.unlocks = Object.assign(defaults().unlocks, this.data.unlocks || {});
        this.data.basics = Object.assign(defaults().basics, this.data.basics || {});
        // grandfather: a theme selected before the shop existed stays yours
        var th = this.data.settings.boardTheme;
        if (th && this.data.unlocks.themes.indexOf(th) < 0) this.data.unlocks.themes.push(th);
      } catch (e) { this.data = defaults(); }
    },
    addCoins: function (n) {
      this.data.coins = Math.max(0, this.data.coins + n);
      this.save();
      return this.data.coins;
    },
    save: function () {
      try { localStorage.setItem(LS_KEY, JSON.stringify(this.data)); } catch (e) { }
    },
    get: function () { return this.data; },
    applyGameResult: function (info) {
      var d = this.data;
      var oldRating = d.rating;
      var delta = Coach.eloDelta(d.rating, info.botElo, info.score, d.gamesPlayed);
      d.rating = Math.max(100, d.rating + delta);
      d.peak = Math.max(d.peak, d.rating);
      d.gamesPlayed++;
      // coin rewards: wins pay by opponent strength, first win of the day pays extra
      var coins = 0;
      if (info.score === 1) {
        coins = Math.round(info.botElo / 25);
        var today = new Date().toDateString();
        if (d.lastWinDay !== today) { coins += 20; d.lastWinDay = today; }
      } else if (info.score === 0.5) {
        coins = Math.round(info.botElo / 50);
      } else {
        coins = 2; // showing up counts for something
      }
      d.coins += coins;
      var rec = d.records[info.botId] || { w: 0, l: 0, d: 0 };
      if (info.score === 1) rec.w++;
      else if (info.score === 0) rec.l++;
      else rec.d++;
      d.records[info.botId] = rec;
      d.history.push({
        ts: Date.now(), rating: d.rating, delta: delta, botId: info.botId,
        score: info.score, acc: info.accuracy, blunders: info.blunders,
        mistakes: info.mistakes, reason: info.reason, moves: info.moves
      });
      if (d.history.length > 400) d.history = d.history.slice(-400);
      this.save();
      return { delta: delta, rating: d.rating, oldRating: oldRating, coins: coins };
    },
    markPuzzleSolved: function (id, assisted, mateIn) {
      var p = this.data.puzzles;
      var first = !p.solved[id];
      p.solved[id] = true;
      var earned = 0;
      if (first) earned += mateIn === 1 ? 5 : mateIn === 2 ? 10 : 20;
      if (!assisted) {
        p.streak++;
        if (p.streak > p.best) p.best = p.streak;
        if (p.streak % 5 === 0) earned += 15; // streak milestone
      }
      this.data.coins += earned;
      this.save();
      return { first: first, earned: earned };
    },
    puzzleStreakReset: function () {
      this.data.puzzles.streak = 0;
      this.save();
    },
    saveGame: function (sg) { this.data.savedGame = sg; this.save(); },
    clearSavedGame: function () { this.data.savedGame = null; this.save(); },
    resetAll: function () { this.data = defaults(); this.save(); }
  };

  // ---------------- tips ----------------
  var TIPS = [
    'Before every move, ask three questions: what did their move threaten, what can I check or capture, and is my move safe?',
    'One slow game with full attention beats ten blitz games on autopilot.',
    'After every loss, find the exact move where it went wrong. That is where the lesson lives.',
    'Tactics win games below 2000. Ten minutes of puzzles a day compounds fast.',
    'Develop, castle, connect rooks. Only then start a fight.',
    'When you spot a good move, sit on your hands and look for a better one.',
    'Endgames feel boring until they win you fifty rating points. Learn king and pawn basics early.',
    'The best players are not the ones who see further. They are the ones who blunder less.',
    'Play the board, not the opponent. The bot does not get tired, but it also cannot scare you.',
    'A knight on the rim is dim. Centralize everything, including your courage.'
  ];

  // ---------------- learn content ----------------
  var BANDS = [
    { from: 0, to: 600, focus: '<b>Board vision.</b> Know how every piece moves without thinking. Play Pip and Ruk with the coach on, and simply try to stop giving pieces away. Ten warmup puzzles a day.' },
    { from: 600, to: 1000, focus: '<b>Free stuff.</b> Take everything your opponent hangs, protect everything you hang. Learn the checks-captures-threats scan and run it every single move. Openings: just develop, castle, do not blunder.' },
    { from: 1000, to: 1400, focus: '<b>Tactics, tactics, tactics.</b> Forks, pins, skewers, discovered attacks. Learn one opening as White (Italian or London) and one reply to e4 and d4 as Black. Beat Nia consistently before moving on.' },
    { from: 1400, to: 1800, focus: '<b>Plans and endgames.</b> Pawn structure, good vs bad bishops, when to trade. King and pawn endgames, basic rook endgames. Analyze every loss without an engine first, then check with the coach.' },
    { from: 1800, to: 2200, focus: '<b>Calculation discipline.</b> Candidate moves, forcing lines first, count the material at the end of each line. Slow time controls. Vera and Kron will punish anything lazy.' },
    { from: 2200, to: 9999, focus: '<b>The grind.</b> Study annotated master games, build a real repertoire, review every game like it matters. Magnus Mode is waiting. So is 2500.' }
  ];

  var OPENING_RULES = [
    '<b>Fight for the center</b> with pawns and pieces from move one.',
    '<b>Develop knights and bishops</b> before moving the same piece twice.',
    '<b>Castle before move ten</b> in almost every game.',
    '<b>Do not bring the queen out early.</b> She becomes a target.',
    '<b>Connect your rooks</b> and put them on open files.',
    '<b>Every pawn move creates a weakness.</b> Make them count.'
  ];

  var CHECKLIST = [
    '<b>What changed?</b> What does their last move attack, threaten, or unblock?',
    '<b>Checks, captures, threats.</b> Look at every forcing move, yours and theirs, in that order.',
    '<b>Is my move safe?</b> Count attackers and defenders on the square before you commit.',
    '<b>Improve the worst piece.</b> If nothing is urgent, find your laziest piece a better job.'
  ];

  var GLOSSARY = [
    ['Fork', 'One piece attacks two targets at once. Knights are the classic culprits.'],
    ['Pin', 'A piece cannot move because something more valuable hides behind it.'],
    ['Skewer', 'A pin in reverse: the valuable piece is in front and must move, exposing the one behind.'],
    ['Discovered attack', 'Moving one piece unleashes an attack from another behind it.'],
    ['Double check', 'Two pieces give check at once. The king must move. Devastating.'],
    ['Back rank mate', 'A rook or queen mates a castled king trapped behind its own pawns.'],
    ['Smothered mate', 'A knight mates a king completely boxed in by its own pieces.'],
    ['Deflection', 'Forcing a defender to abandon its post, then striking what it defended.'],
    ['Zwischenzug', 'An in-between move: instead of the expected recapture, an even stronger threat first.'],
    ['Zugzwang', 'Any move worsens the position, but a move must be made. Endgame poison.']
  ];

  var ENDGAME_RULES = [
    '<b>Opposition:</b> in king endgames, facing the enemy king with one square between often wins the fight for key squares.',
    '<b>Square of the pawn:</b> if the defending king can step into the pawn’s "square", it catches the runner.',
    '<b>Rooks belong behind passed pawns</b>, yours and theirs.',
    '<b>King and queen vs king:</b> box the king to the edge, walk your king up, deliver mate. Drill it until it is automatic.',
    '<b>Philidor and Lucena</b> are the two rook endgame positions that decide thousands of games. Learn their names, then their ideas.'
  ];

  var HOWTO = [
    '<b>Play rated ladder games</b> with the coach on. It grades every move like chess.com does, and offers takebacks on blunders so you learn in the moment.',
    '<b>Review every game.</b> Click through the move list afterward. Find your worst move, understand the better one.',
    '<b>Ten puzzles a day.</b> They are mined and proof-checked by the engine: exactly one winning first move, forced mate.',
    '<b>One opening a week</b> from the Openings room. Step through it, then drill it against the bot.',
    '<b>Move up when ready:</b> beat a bot three games in a row, then challenge the next one. Rating follows effort.'
  ];

  // ---------------- app ----------------
  var App = {
    store: Store,
    game: null,
    puzzles: null,
    currentScreen: 'home',

    toast: function (msg, ms) {
      var root = document.getElementById('toast-root');
      root.innerHTML = '';
      var t = document.createElement('div');
      t.className = 'toast';
      t.innerHTML = msg;
      root.appendChild(t);
      requestAnimationFrame(function () { t.classList.add('show'); });
      clearTimeout(App._toastTimer);
      App._toastTimer = setTimeout(function () {
        t.classList.remove('show');
        setTimeout(function () { t.remove(); }, 300);
      }, ms || 3400);
    },

    explainRating: function () {
      App.modal(
        '<h3>What is a rating?</h3>' +
        '<p class="modal-sub">Your <b>rating</b> is one number that measures how strong you are at chess. Every player has one. ' +
        'People who are just learning start near the very bottom and climb from there.</p>' +
        '<p class="modal-sub">Win a game and your number goes <b>up</b>. Lose and it dips a little — but it never falls below <b>100</b>, ' +
        'so you can play fearlessly while you learn. Beating a tougher opponent is worth more points.</p>' +
        '<p class="modal-sub">The ladder climbs all the way to <b>2500 (Magnus Mode)</b>. For reference, brand-new players online sit around ' +
        '400–800, and solid club players reach 1200–1600. Just keep playing and learning; the number follows.</p>' +
        '<div class="modal-actions"><button class="btn btn-gold" data-done>Got it</button></div>'
      ).querySelector('[data-done]').addEventListener('click', App.closeModal);
    },

    modal: function (html, opts) {
      opts = opts || {};
      App.closeModal();
      var ov = document.createElement('div');
      ov.className = 'modal-overlay';
      var m = document.createElement('div');
      m.className = 'modal' + (opts.wide ? ' wide' : '');
      m.innerHTML = html;
      ov.appendChild(m);
      if (!opts.sticky) {
        ov.addEventListener('click', function (e) { if (e.target === ov) App.closeModal(); });
      }
      document.getElementById('modal-root').appendChild(ov);
      return m;
    },
    closeModal: function () {
      document.getElementById('modal-root').innerHTML = '';
    },

    confirmModal: function (o) {
      var m = App.modal(
        '<h3>' + o.title + '</h3>' +
        '<p class="modal-sub">' + (o.sub || '') + '</p>' +
        '<div class="modal-actions">' +
        '<button class="btn ' + (o.danger ? 'btn-danger' : 'btn-gold') + '" data-yes>' + (o.yes || 'Yes') + '</button>' +
        '<button class="btn btn-ghost" data-no>' + (o.no || 'Cancel') + '</button>' +
        '</div>', { sticky: true });
      m.querySelector('[data-yes]').addEventListener('click', function () {
        App.closeModal(); o.onYes && o.onYes();
      });
      m.querySelector('[data-no]').addEventListener('click', function () {
        App.closeModal(); o.onNo && o.onNo();
      });
    },

    isScreen: function (id) { return App.currentScreen === id; },

    showScreen: function (id) {
      App.currentScreen = id;
      document.querySelectorAll('.screen').forEach(function (s) {
        s.classList.toggle('active', s.id === 'screen-' + id);
      });
      document.querySelectorAll('.rail-btn[data-nav]').forEach(function (b) {
        b.classList.toggle('active', b.dataset.nav === id ||
          (id === 'game' && b.dataset.nav === 'bots') ||
          (id === 'bots' && b.dataset.nav === 'bots'));
      });
      if (id === 'home') App.renderHome();
      if (id === 'bots') App.renderBots();
      if (id === 'basics') App.basics.open();
      if (id === 'puzzles') { App.puzzles.open(); }
      if (id === 'openings') App.renderOpenings();
      if (id === 'learn') App.renderLearn();
      if (id === 'stats') App.renderStats();
      window.scrollTo(0, 0);
    },

    // ---------------- home ----------------
    renderHome: function () {
      var d = Store.get();
      document.getElementById('medal-rating').textContent = d.rating;
      document.getElementById('medal-tier').textContent = Coach.tierFor(d.rating);
      var next = Coach.nextMilestone(d.rating);
      var prog = document.getElementById('medal-progress');
      var circ = 2 * Math.PI * 88;
      if (next) {
        var prevTier = 0;
        // find prior milestone threshold
        var tiers = [0, 500, 800, 1100, 1400, 1700, 2000, 2200, 2400];
        for (var i = 0; i < tiers.length; i++) if (tiers[i] <= d.rating) prevTier = tiers[i];
        var frac = (d.rating - prevTier) / (next[0] - prevTier);
        prog.style.strokeDashoffset = circ * (1 - Math.max(0.02, Math.min(1, frac)));
        document.getElementById('medal-next').textContent =
          (next[0] - d.rating) + ' to ' + next[1] + ' (' + next[0] + ')';
      } else {
        prog.style.strokeDashoffset = 0;
        document.getElementById('medal-next').textContent = 'The summit. Stay sharp.';
      }
      document.getElementById('home-tip').textContent =
        '“' + TIPS[(Math.random() * TIPS.length) | 0] + '”';
      var coinEl = document.getElementById('coin-balance');
      if (coinEl) coinEl.textContent = '🪙 ' + d.coins;

      // first steps progress on the home card
      var bp = document.getElementById('basics-progress');
      if (bp && App.basics) {
        var pr = App.basics.progress();
        if (d.basics.graduated) {
          bp.textContent = 'Graduated 🎓 Revisit any lesson whenever you like';
        } else if (pr.done > 0) {
          bp.textContent = pr.done + ' of ' + pr.total + ' lessons done. Keep going!';
        } else {
          bp.textContent = 'Never played chess? Start from absolute zero';
        }
      }

      var cont = document.getElementById('btn-continue');
      var sg = d.savedGame;
      cont.hidden = !(sg && sg.uciLine && sg.uciLine.length > 0);
      if (!cont.hidden && sg.cfg && sg.cfg.botId) {
        var bot = AI.botById(sg.cfg.botId);
        cont.textContent = 'Resume vs ' + bot.name + ' (' + Math.ceil(sg.uciLine.length / 2) + ' moves in)';
      }
    },

    // ---------------- bots ----------------
    setup: { color: 'white', time: '0' },

    renderBots: function () {
      var d = Store.get();
      var lane = document.getElementById('bot-lane');
      lane.innerHTML = '';
      var tierColors = ['#85a94f', '#7fa3c4', '#6f9bc4', '#d4bf5a', '#d9964e', '#cf5b4c', '#e9cb70'];
      // recommended: closest elo above (rating - 100)
      var recId = null, bestDist = 1e9;
      AI.BOTS.forEach(function (b) {
        var dist = Math.abs(b.elo - d.rating);
        if (dist < bestDist) { bestDist = dist; recId = b.id; }
      });
      AI.BOTS.forEach(function (b, idx) {
        var rec = d.records[b.id] || { w: 0, l: 0, d: 0 };
        var card = document.createElement('div');
        card.className = 'bot-card' + (b.id === recId ? ' recommended' : '');
        card.style.setProperty('--tier', tierColors[idx]);
        card.innerHTML =
          (b.id === recId ? '<span class="bot-flag">your level</span>' : '') +
          '<div class="bot-top">' +
          '<div class="bot-avatar">' + b.emoji + '</div>' +
          '<div><div class="bot-name">' + b.name + '</div>' +
          '<div class="bot-elo"><b>' + b.elo + '</b> elo<span class="bot-tiername">' + b.tier + '</span></div></div>' +
          '</div>' +
          '<div class="bot-blurb">' + b.blurb + '</div>' +
          '<div class="bot-teach">' + b.teach + '</div>' +
          '<div class="bot-record">score vs ' + b.name + ': <b>' + rec.w + 'W · ' + rec.l + 'L · ' + rec.d + 'D</b></div>' +
          '<button class="btn btn-ghost bot-play">Challenge</button>';
        card.querySelector('.bot-play').addEventListener('click', function () {
          App.startBotGame(b.id);
        });
        lane.appendChild(card);
      });
    },

    startBotGame: function (botId) {
      var color = App.setup.color;
      if (color === 'random') color = Math.random() < 0.5 ? 'white' : 'black';
      var time = null;
      if (App.setup.time === '5') time = { base: 5, inc: 0 };
      else if (App.setup.time === '10') time = { base: 10, inc: 0 };
      else if (App.setup.time === '15+10') time = { base: 15, inc: 10 };
      var coach = document.getElementById('coach-toggle').checked;
      App.game.start({
        mode: 'bot', botId: botId, userColor: color, time: time, coach: coach
      });
    },

    startLocalGame: function () {
      App.game.start({ mode: 'local', userColor: 'white', time: null, coach: false });
    },

    // ---------------- end modal ----------------
    showEndModal: function (info) {
      var title, cls;
      var st = info.st;
      if (info.mode === 'bot') {
        if (info.userScore === 1) { title = 'You won.'; cls = 'win'; }
        else if (info.userScore === 0) { title = info.bot.name + ' wins.'; cls = 'loss'; }
        else { title = 'A draw.'; cls = 'draw'; }
      } else {
        title = st.winner === -1 ? 'A draw.' : (st.winner === R.WHITE ? 'White wins.' : 'Black wins.');
        cls = 'draw';
      }
      var deltaHtml = '';
      if (info.delta) {
        var s = info.delta.delta;
        deltaHtml = '<div class="elo-delta ' + (s >= 0 ? 'up' : 'down') + '">' +
          (s >= 0 ? '+' : '') + s +
          '<small>' + info.delta.oldRating + ' → ' + info.delta.rating + '</small></div>';
        if (info.delta.coins) {
          deltaHtml += '<div class="coin-earn">+' + info.delta.coins + ' 🪙 earned</div>';
        }
      }
      var h = Store.get().history;
      var last = h.length ? h[h.length - 1] : null;
      var statsHtml = '';
      if (info.mode === 'bot' && last) {
        statsHtml = '<div class="end-stats">' +
          (last.acc != null ? '<div class="end-stat"><span>' + last.acc + '%</span><label>accuracy</label></div>' : '') +
          '<div class="end-stat"><span>' + (last.blunders || 0) + '</span><label>blunders</label></div>' +
          '<div class="end-stat"><span>' + (last.mistakes || 0) + '</span><label>mistakes</label></div>' +
          (info.takebacks ? '<div class="end-stat"><span>' + info.takebacks + '</span><label>takebacks</label></div>' : '') +
          '</div>';
      }
      // plain-words explanation for brand-new players
      var gentleLine = '';
      if (info.cfg && info.cfg.gentle) {
        var EXPLAIN = {
          'checkmate': 'A King was attacked with no escape, no block, and no rescue. That is checkmate, and it ends the game on the spot.',
          'stalemate': 'The player to move was NOT in check but had no legal move at all. That is stalemate, and it is a draw.',
          'resignation': 'One player gave up. That counts as a loss for them.',
          'time out': 'One player ran out of clock time, which loses the game.',
          'threefold repetition': 'The exact same position appeared three times, so the game is a draw.',
          'fifty-move rule': 'Fifty moves passed with no capture and no pawn move, so the game is a draw.',
          'insufficient material': 'Neither side has enough pieces left to ever trap a King, so it is a draw.'
        };
        if (EXPLAIN[st.reason]) {
          gentleLine = '<p class="modal-sub" style="text-align:center;margin-top:10px">' + EXPLAIN[st.reason] + '</p>';
        }
      }
      var m = App.modal(
        '<div class="endgame-head">' +
        '<div class="endgame-title ' + cls + '">' + title + '</div>' +
        '<div class="endgame-reason">by ' + st.reason + '</div>' +
        '</div>' + gentleLine + deltaHtml + statsHtml +
        '<div class="modal-actions">' +
        '<button class="btn btn-gold" data-rematch>Rematch</button>' +
        '<button class="btn btn-ghost" data-newbot>' + (info.mode === 'bot' ? 'Choose bot' : 'New game') + '</button>' +
        '<button class="btn btn-ghost" data-review>Review board</button>' +
        '</div>', { sticky: true });
      m.querySelector('[data-rematch]').addEventListener('click', function () {
        App.closeModal();
        App.game.start(info.cfg);
      });
      m.querySelector('[data-newbot]').addEventListener('click', function () {
        App.closeModal();
        App.showScreen(info.mode === 'bot' ? 'bots' : 'home');
      });
      m.querySelector('[data-review]').addEventListener('click', function () {
        App.closeModal();
        App.toast('Click any move to revisit it. Arrow keys work too.');
      });
    },

    onGameEnd: function (info) { App.showEndModal(info); },

    // ---------------- openings ----------------
    renderOpenings: function () {
      var grid = document.getElementById('openings-grid');
      if (grid.dataset.built) return;
      grid.dataset.built = '1';
      var styleClass = {
        Attacking: 'red', Gambit: 'red', Counterattack: 'red',
        Solid: 'green', System: 'green', Classical: 'gold',
        Positional: 'blue', Open: 'gold', Provocative: 'blue', Flexible: 'green'
      };
      Book.OPENINGS.forEach(function (op) {
        if (op.moves.split(' ').length < 4) return; // skip 1-move generics in the study room
        var card = document.createElement('button');
        card.className = 'opening-card';
        card.innerHTML =
          '<h3>' + op.name + '</h3>' +
          '<div class="opening-moves">' + formatLine(op.moves) + '</div>' +
          '<div class="opening-idea">' + op.idea + '</div>' +
          '<div class="chip-row">' +
          '<span class="chip ' + (styleClass[op.style] || '') + '">' + op.style + '</span>' +
          '<span class="chip">' + op.level + '</span>' +
          '<span class="chip">' + (op.side === 'white' ? 'for White' : 'for Black') + '</span>' +
          '</div>';
        card.addEventListener('click', function () { App.openStudy(op); });
        grid.appendChild(card);
      });
    },

    openStudy: function (op) {
      var sans = op.moves.split(' ');
      var m = App.modal(
        '<h3>' + op.name + '</h3>' +
        '<p class="modal-sub">' + op.idea + '</p>' +
        '<div class="study-grid">' +
        '<div>' +
        '<div class="study-board-wrap"><div id="study-board"></div></div>' +
        '</div>' +
        '<div>' +
        '<div class="study-controls">' +
        '<button class="icon-btn" data-s="start"><svg><use href="#i-start"/></svg></button>' +
        '<button class="icon-btn" data-s="back"><svg><use href="#i-back"/></svg></button>' +
        '<button class="icon-btn" data-s="fwd"><svg><use href="#i-next"/></svg></button>' +
        '<button class="icon-btn" data-s="end"><svg><use href="#i-end"/></svg></button>' +
        '</div>' +
        '<div class="study-line" id="study-line"></div>' +
        '<div class="modal-actions">' +
        '<button class="btn btn-gold" data-drill="white">Drill as White</button>' +
        '<button class="btn btn-ghost" data-drill="black">Drill as Black</button>' +
        '</div>' +
        '<p class="modal-sub" style="margin-top:14px">Drilling starts a coached game vs Nia (1100). The bot follows this exact line while you stay in book.</p>' +
        '</div></div>', { wide: true });

      var board = new BoardView(m.querySelector('#study-board'), {
        interactive: false, theme: Store.get().settings.boardTheme,
        orientation: op.side === 'black' ? 'black' : 'white'
      });
      var g0 = new R.Game();
      var lineEl = m.querySelector('#study-line');
      var at = 0; // plies shown

      sans.forEach(function (san, i) {
        var legal = g0.legalMoves(), mv = 0;
        for (var k = 0; k < legal.length; k++) if (g0.san(legal[k], legal) === san) { mv = legal[k]; break; }
        if (mv) g0.make(mv);
        var b = document.createElement('button');
        b.textContent = (i % 2 === 0 ? (i / 2 + 1) + '. ' : '') + san;
        b.addEventListener('click', function () { show(i + 1); });
        lineEl.appendChild(b);
      });

      function show(n) {
        at = Math.max(0, Math.min(n, sans.length));
        var g = new R.Game();
        var lastM = 0;
        for (var i = 0; i < at; i++) {
          var legal = g.legalMoves(), mv = 0;
          for (var k = 0; k < legal.length; k++) if (g.san(legal[k], legal) === sans[i]) { mv = legal[k]; break; }
          if (!mv) break;
          g.make(mv); lastM = mv;
        }
        board.render(g, true);
        if (lastM) board.setLastMove(R.mvFrom(lastM), R.mvTo(lastM));
        else board.setLastMove(-1, -1);
        lineEl.querySelectorAll('button').forEach(function (b, i) {
          b.classList.toggle('at', i === at - 1);
        });
      }
      m.querySelector('[data-s="start"]').addEventListener('click', function () { show(0); });
      m.querySelector('[data-s="back"]').addEventListener('click', function () { show(at - 1); });
      m.querySelector('[data-s="fwd"]').addEventListener('click', function () { show(at + 1); });
      m.querySelector('[data-s="end"]').addEventListener('click', function () { show(sans.length); });
      m.querySelectorAll('[data-drill]').forEach(function (b) {
        b.addEventListener('click', function () {
          App.closeModal();
          App.game.start({
            mode: 'bot', botId: 'nia', userColor: b.dataset.drill,
            time: null, coach: true,
            practice: { name: op.name, moves: sans }
          });
        });
      });
      show(Math.min(2, sans.length));
    },

    // ---------------- learn ----------------
    renderLearn: function () {
      var el = document.getElementById('learn-body');
      var d = Store.get();
      var html = '';

      html += '<div class="learn-section"><h3>The ladder</h3>' +
        '<div class="sect-sub">Every band has one job. Do that job, ignore the rest.</div>';
      BANDS.forEach(function (b) {
        var you = d.rating >= b.from && d.rating < b.to;
        html += '<div class="band' + (you ? ' you' : '') + '">' +
          '<div class="band-range">' + b.from + '–' + (b.to === 9999 ? '∞' : b.to) +
          '<small>rating</small></div>' +
          '<div class="band-focus">' + b.focus + '</div></div>';
      });
      html += '</div>';

      html += '<div class="learn-section"><h3>Before every single move</h3>' +
        '<div class="sect-sub">The four-question scan. Slow at first, automatic within a month.</div>' +
        '<ul class="rule-list">' + CHECKLIST.map(function (r) { return '<li><span>' + r + '</span></li>'; }).join('') + '</ul></div>';

      html += '<div class="learn-section"><h3>Golden rules of the opening</h3>' +
        '<ul class="rule-list">' + OPENING_RULES.map(function (r) { return '<li><span>' + r + '</span></li>'; }).join('') + '</ul></div>';

      html += '<div class="learn-section"><h3>Tactics glossary</h3>' +
        '<div class="sect-sub">If you can name it, you can spot it.</div>' +
        '<div class="gloss-grid">' + GLOSSARY.map(function (g) {
          return '<div class="gloss"><b>' + g[0] + '</b>' + g[1] + '</div>';
        }).join('') + '</div></div>';

      html += '<div class="learn-section"><h3>Endgame survival kit</h3>' +
        '<ul class="rule-list">' + ENDGAME_RULES.map(function (r) { return '<li><span>' + r + '</span></li>'; }).join('') + '</ul></div>';

      html += '<div class="learn-section"><h3>How to use this academy</h3>' +
        '<ul class="rule-list">' + HOWTO.map(function (r) { return '<li><span>' + r + '</span></li>'; }).join('') + '</ul></div>';

      el.innerHTML = html;
    },

    // ---------------- stats ----------------
    renderStats: function () {
      var d = Store.get();
      var el = document.getElementById('stats-body');
      var accs = d.history.filter(function (h) { return h.acc != null; }).slice(-10);
      var avgAcc = accs.length
        ? Math.round(accs.reduce(function (a, h) { return a + h.acc; }, 0) / accs.length * 10) / 10
        : null;
      var solvedCount = Object.keys(d.puzzles.solved).length;
      var wins = 0, losses = 0, draws = 0;
      d.history.forEach(function (h) {
        if (h.score === 1) wins++; else if (h.score === 0) losses++; else draws++;
      });

      var html = '<div class="stats-top">' +
        tile(d.rating, 'current rating') +
        tile(d.peak, 'peak rating') +
        tile(wins + '–' + losses + '–' + draws, 'w · l · d', true) +
        tile(avgAcc != null ? avgAcc + '%' : '—', 'accuracy (last 10)', true) +
        tile(solvedCount + '/' + (window.RTG_PUZZLES || []).length, 'puzzles solved', true) +
        tile(d.puzzles.best, 'best streak', true) +
        tile('🪙 ' + d.coins, 'coin purse', true) +
        '</div>';

      html += '<div class="chart-card"><h3>Rating over time</h3><canvas id="rating-chart"></canvas>' +
        (d.history.length < 2 ? '<div class="empty-note">Play a few rated games and the line appears.</div>' : '') +
        '</div>';

      html += '<div class="chart-card"><h3>Record by opponent</h3>';
      if (Object.keys(d.records).length === 0) {
        html += '<div class="empty-note">No rated games yet. The ladder is waiting.</div>';
      } else {
        html += '<table class="records-table"><tr><th>Bot</th><th>Elo</th><th>Wins</th><th>Losses</th><th>Draws</th></tr>';
        AI.BOTS.forEach(function (b) {
          var r = d.records[b.id];
          if (!r) return;
          html += '<tr><td>' + b.emoji + '  ' + b.name + '</td><td class="mono">' + b.elo +
            '</td><td class="mono">' + r.w + '</td><td class="mono">' + r.l +
            '</td><td class="mono">' + r.d + '</td></tr>';
        });
        html += '</table>';
      }
      html += '</div>';

      html += '<div style="display:flex;justify-content:flex-end">' +
        '<button class="btn btn-danger" id="btn-reset-all">Reset all progress</button></div>';

      el.innerHTML = html;
      App.drawChart(document.getElementById('rating-chart'), d.history);
      document.getElementById('btn-reset-all').addEventListener('click', function () {
        App.confirmModal({
          title: 'Reset everything?',
          sub: 'Rating, history, puzzle progress, settings. This cannot be undone.',
          yes: 'Wipe it', no: 'Keep my story', danger: true,
          onYes: function () { Store.resetAll(); App.applySettings(); App.showScreen('home'); App.toast('Fresh start. 800 again.'); }
        });
      });

      function tile(v, label, plain) {
        return '<div class="stat-tile"><div class="big' + (plain ? ' plain' : '') + '">' + v + '</div><label>' + label + '</label></div>';
      }
    },

    drawChart: function (canvas, history) {
      if (!canvas) return;
      var pts = [{ rating: 800 }].concat(history);
      var dpr = window.devicePixelRatio || 1;
      var w = canvas.clientWidth || canvas.parentNode.clientWidth - 40;
      var h = 230;
      canvas.width = w * dpr; canvas.height = h * dpr;
      var ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);
      if (pts.length < 2) return;
      var vals = pts.map(function (p) { return p.rating; });
      var min = Math.min.apply(null, vals) - 40, max = Math.max.apply(null, vals) + 40;
      var pad = { l: 44, r: 12, t: 12, b: 22 };
      function X(i) { return pad.l + (w - pad.l - pad.r) * (i / (pts.length - 1)); }
      function Y(v) { return pad.t + (h - pad.t - pad.b) * (1 - (v - min) / (max - min)); }

      // grid lines
      ctx.strokeStyle = 'rgba(236,231,217,0.07)';
      ctx.fillStyle = 'rgba(154,163,146,0.8)';
      ctx.font = '10px IBM Plex Mono, monospace';
      ctx.lineWidth = 1;
      var steps = 4;
      for (var s = 0; s <= steps; s++) {
        var v = min + (max - min) * s / steps;
        var y = Y(v);
        ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
        ctx.fillText(Math.round(v), 6, y + 3);
      }
      // area
      var grad = ctx.createLinearGradient(0, pad.t, 0, h);
      grad.addColorStop(0, 'rgba(201,164,65,0.28)');
      grad.addColorStop(1, 'rgba(201,164,65,0)');
      ctx.beginPath();
      ctx.moveTo(X(0), Y(vals[0]));
      for (var i = 1; i < pts.length; i++) ctx.lineTo(X(i), Y(vals[i]));
      ctx.lineTo(X(pts.length - 1), h - pad.b); ctx.lineTo(X(0), h - pad.b); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
      // line
      ctx.beginPath();
      ctx.moveTo(X(0), Y(vals[0]));
      for (i = 1; i < pts.length; i++) ctx.lineTo(X(i), Y(vals[i]));
      ctx.strokeStyle = '#e9cb70';
      ctx.lineWidth = 2;
      ctx.stroke();
      // dots
      ctx.fillStyle = '#e9cb70';
      for (i = 0; i < pts.length; i++) {
        ctx.beginPath(); ctx.arc(X(i), Y(vals[i]), i === pts.length - 1 ? 3.5 : 2, 0, 7); ctx.fill();
      }
    },

    // ---------------- settings & shop ----------------
    THEMES: [
      { id: 'green', name: 'Tournament', l: '#eeeed2', d: '#769656', price: 0 },
      { id: 'walnut', name: 'Walnut', l: '#f0d9b5', d: '#b58863', price: 120 },
      { id: 'slate', name: 'Slate', l: '#dee3e6', d: '#8ca2ad', price: 180 },
      { id: 'coal', name: 'Coal', l: '#a9a49a', d: '#59544d', price: 240 }
    ],
    AVATARS: [
      { id: 'classic', emoji: '♔', name: 'Classic', price: 0 },
      { id: 'fox', emoji: '🦊', name: 'Fox', price: 120 },
      { id: 'lion', emoji: '🦁', name: 'Lion', price: 180 },
      { id: 'owl', emoji: '🦉', name: 'Owl', price: 220 },
      { id: 'wizard', emoji: '🧙', name: 'Wizard', price: 300 },
      { id: 'crown', emoji: '👑', name: 'Crown', price: 400 },
      { id: 'goat', emoji: '🐐', name: 'The Goat', price: 500, requiresMagnusWin: true }
    ],

    avatarEmoji: function () {
      var id = Store.get().avatar;
      for (var i = 0; i < App.AVATARS.length; i++) {
        if (App.AVATARS[i].id === id) return App.AVATARS[i].emoji;
      }
      return '♔';
    },

    openSettings: function () {
      var d = Store.get(), s = d.settings;
      var magnusBeaten = d.records.magnus && d.records.magnus.w > 0;

      var themeHtml = App.THEMES.map(function (t) {
        var owned = d.unlocks.themes.indexOf(t.id) >= 0;
        var active = s.boardTheme === t.id;
        return '<div class="shop-item">' +
          '<button class="swatch' + (active ? ' active' : '') + (owned ? '' : ' locked') +
          '" data-theme="' + t.id + '" style="--swl:' + t.l + ';--swd:' + t.d + '" title="' + t.name + '">' +
          '<i></i><i></i><i></i><i></i></button>' +
          '<small class="' + (owned ? 'own' : '') + '">' + (owned ? t.name : '🪙 ' + t.price) + '</small>' +
          '</div>';
      }).join('');

      var avatarHtml = App.AVATARS.map(function (a) {
        var owned = d.unlocks.avatars.indexOf(a.id) >= 0;
        var active = d.avatar === a.id;
        var label = owned ? a.name : (a.requiresMagnusWin && !magnusBeaten ? 'beat 🐐' : '🪙 ' + a.price);
        return '<button class="avatar-btn' + (active ? ' active' : '') + (owned ? '' : ' locked') +
          '" data-avatar="' + a.id + '" title="' + a.name + '">' +
          '<span>' + a.emoji + '</span><small>' + label + '</small></button>';
      }).join('');

      var m = App.modal(
        '<h3>Setup</h3>' +
        '<p class="modal-sub">Board, sounds, training wheels, and the coin shop. ' +
        'Balance: <b class="shop-balance">🪙 ' + d.coins + '</b></p>' +
        '<div class="set-row"><div class="lbl">Board theme<small>Win games and puzzles to unlock the rest.</small></div>' +
        '<div class="swatches">' + themeHtml + '</div></div>' +
        '<div class="set-row" style="flex-direction:column;align-items:stretch"><div class="lbl">Your avatar' +
        '<small>Shown on your side of the board.</small></div>' +
        '<div class="avatar-grid">' + avatarHtml + '</div></div>' +
        row('beginnerCoach', 'Beginner coach mode', 'Full plain-words help in coached games: explains each piece you touch, warns about danger, and reads the board. Turn this off once you can play on your own.') +
        row('pieceLabels', 'Piece name labels', 'Print the name (Pawn, Knight…) on every piece so you never forget which is which.') +
        row('showLegal', 'Show legal moves', 'Dots on every square a selected piece can reach.') +
        row('sounds', 'Sounds', 'Clicks, captures, and the little victory tune.') +
        row('takebackOffers', 'Blunder takebacks', 'Coach offers to undo mistakes and blunders in bot games.') +
        row('autoRotate', 'Auto-rotate in Pass & Play', 'Board turns to face whoever moves.') +
        '<div class="modal-actions"><button class="btn btn-gold" data-done>Done</button></div>'
      );
      function row(key, label, sub) {
        return '<div class="set-row"><div class="lbl">' + label + '<small>' + sub + '</small></div>' +
          '<label class="switch"><input type="checkbox" data-set="' + key + '"' + (s[key] ? ' checked' : '') + '>' +
          '<span class="slider"></span></label></div>';
      }

      function buy(price, list, id, onOwned) {
        if (list.indexOf(id) >= 0) { onOwned(); Store.save(); App.openSettings(); return; }
        if (d.coins < price) {
          App.toast('Not enough coins. You need 🪙 ' + (price - d.coins) + ' more. Win games, solve puzzles.');
          return;
        }
        d.coins -= price;
        list.push(id);
        onOwned();
        Store.save();
        Sound.right();
        App.toast('Unlocked! 🪙 ' + d.coins + ' left.');
        App.openSettings();
      }

      m.querySelectorAll('.swatch').forEach(function (b) {
        b.addEventListener('click', function () {
          var t = App.THEMES.filter(function (x) { return x.id === b.dataset.theme; })[0];
          buy(t.price, d.unlocks.themes, t.id, function () {
            s.boardTheme = t.id;
            App.applySettings();
          });
        });
      });
      m.querySelectorAll('.avatar-btn').forEach(function (b) {
        b.addEventListener('click', function () {
          var a = App.AVATARS.filter(function (x) { return x.id === b.dataset.avatar; })[0];
          if (a.requiresMagnusWin && !magnusBeaten && d.unlocks.avatars.indexOf(a.id) < 0) {
            App.toast('The Goat must be earned. Beat Magnus Mode once, then it costs 🪙 ' + a.price + '.');
            return;
          }
          buy(a.price, d.unlocks.avatars, a.id, function () {
            d.avatar = a.id;
          });
        });
      });
      m.querySelectorAll('[data-set]').forEach(function (inp) {
        inp.addEventListener('change', function () {
          s[inp.dataset.set] = inp.checked;
          Store.save();
          App.applySettings();
        });
      });
      m.querySelector('[data-done]').addEventListener('click', App.closeModal);
    },

    applySettings: function () {
      var s = Store.get().settings;
      Sound.setEnabled(s.sounds);
      if (App.game && App.game.board) {
        App.game.board.setTheme(s.boardTheme);
        App.game.board.showLegal = s.showLegal;
        // don't strip labels mid-game if the current game forced them on
        App.game.board.setLabels(s.pieceLabels || (App.game.active && App.game.gentle));
      }
      if (App.puzzles && App.puzzles.board) {
        App.puzzles.board.setTheme(s.boardTheme);
        App.puzzles.board.showLegal = s.showLegal;
      }
      if (App.basics && App.basics.board) {
        App.basics.board.setTheme(s.boardTheme);
      }
      var si = document.getElementById('sound-icon');
      if (si) si.innerHTML = '<use href="#i-sound' + (s.sounds ? '' : '-off') + '"/>';
    },

    // ---------------- boot ----------------
    init: function () {
      Store.load();
      App.game = new GameController();
      App.puzzles = new PuzzleController();
      App.basics = new BasicsController();

      // nav
      document.querySelectorAll('[data-nav]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (b.dataset.nav === 'game') return;
          App.showScreen(b.dataset.nav);
        });
      });
      document.querySelectorAll('[data-action="settings"]').forEach(function (b) {
        b.addEventListener('click', App.openSettings);
      });
      document.querySelectorAll('[data-action="local-game"]').forEach(function (b) {
        b.addEventListener('click', App.startLocalGame);
      });

      var med = document.getElementById('medallion');
      if (med) { med.style.cursor = 'pointer'; med.title = 'What is my rating?'; med.addEventListener('click', App.explainRating); }

      // setup segments
      document.getElementById('seg-color').addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        this.querySelectorAll('button').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        App.setup.color = b.dataset.color;
      });
      document.getElementById('seg-time').addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        this.querySelectorAll('button').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        App.setup.time = b.dataset.time;
      });
      document.getElementById('coach-toggle').checked = Store.get().settings.coachDefault;

      // sound in game controls
      document.getElementById('btn-sound').addEventListener('click', function () {
        var s = Store.get().settings;
        s.sounds = !s.sounds;
        Store.save();
        App.applySettings();
        App.toast(s.sounds ? 'Sound on' : 'Sound off');
      });

      // resume
      document.getElementById('btn-continue').addEventListener('click', function () {
        var sg = Store.get().savedGame;
        if (sg) App.game.resume(sg);
      });

      // audio unlock + escape key
      document.addEventListener('pointerdown', function once() {
        Sound.unlock();
        document.removeEventListener('pointerdown', once);
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') App.closeModal();
      });

      App.applySettings();
      App.showScreen('home');

      // first visit: route brand-new players straight to First Steps
      if (!Store.get().firstRunDone) {
        Store.get().firstRunDone = true;
        Store.save();
        var wm = App.modal(
          '<h3>Welcome to Road to GM ♞</h3>' +
          '<p class="modal-sub">One quick question so we start you in the right place. ' +
          'Have you played chess before?</p>' +
          '<div class="modal-actions">' +
          '<button class="btn btn-gold" data-zero>Never, teach me from zero</button>' +
          '<button class="btn btn-ghost" data-know>I know the moves</button>' +
          '</div>', { sticky: true });
        wm.querySelector('[data-zero]').addEventListener('click', function () {
          var d = Store.get();
          // brand-new player: start at the very bottom and turn on the gentle coach
          d.rating = 100; d.peak = 100;
          d.settings.beginnerCoach = true;
          d.settings.pieceLabels = true;
          Store.save();
          App.applySettings();
          App.closeModal();
          App.showScreen('basics');
        });
        wm.querySelector('[data-know]').addEventListener('click', function () {
          App.closeModal();
          App.toast('Great. The Ladder awaits. First Steps is always there under Basics if you want a refresher.');
        });
      }
    }
  };

  function formatLine(moves) {
    var out = [], sans = moves.split(' ');
    for (var i = 0; i < sans.length; i++) {
      if (i % 2 === 0) out.push((i / 2 + 1) + '.' + sans[i]);
      else out.push(sans[i]);
    }
    return out.join(' ');
  }

  window.App = App;
  document.addEventListener('DOMContentLoaded', App.init);
}());
