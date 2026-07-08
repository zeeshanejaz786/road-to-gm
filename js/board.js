/* ============================================================
   Road to GM — interactive board widget
   ============================================================ */
(function () {
  'use strict';
  var R = window.RTG;

  var GLYPHS = { 1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' };

  function BoardView(el, opts) {
    this.el = el;
    this.opts = opts || {};
    this.orientation = this.opts.orientation || 'white'; // which color at bottom
    this.interactive = !!this.opts.interactive;
    this.showLegal = this.opts.showLegal !== false;
    this.showCoords = this.opts.showCoords !== false;
    this.theme = this.opts.theme || 'green';
    this.game = null;
    this.selected = -1;
    this.legalTargets = [];
    this.pieceEls = {};      // sq -> element
    this.lastFrom = -1; this.lastTo = -1;
    this.checkSq = -1;
    this.clickMode = false; // when true, taps report squares instead of moving pieces
    this.stars = [];
    this._drag = null;
    this._build();
  }

  BoardView.prototype._build = function () {
    var el = this.el;
    el.classList.add('board');
    el.dataset.btheme = this.theme;
    el.innerHTML = '';
    this.sqLayer = document.createElement('div');
    this.sqLayer.className = 'sq-layer';
    this.squares = {};
    for (var i = 0; i < 64; i++) {
      var d = document.createElement('div');
      d.className = 'sq';
      this.sqLayer.appendChild(d);
    }
    el.appendChild(this.sqLayer);

    this.pieceLayer = document.createElement('div');
    this.pieceLayer.className = 'piece-layer';
    el.appendChild(this.pieceLayer);

    this.arrowLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.arrowLayer.setAttribute('class', 'arrow-layer');
    this.arrowLayer.setAttribute('viewBox', '0 0 800 800');
    el.appendChild(this.arrowLayer);

    this._paintSquares();
    this._bindEvents();
  };

  BoardView.prototype.setTheme = function (t) {
    this.theme = t;
    this.el.dataset.btheme = t;
  };

  // map board square (0x88) <-> screen cell (col,row from top-left)
  BoardView.prototype._screenOf = function (sq) {
    var f = sq & 7, r = sq >> 4;
    if (this.orientation === 'white') return { x: f, y: 7 - r };
    return { x: 7 - f, y: r };
  };
  BoardView.prototype._sqAt = function (x, y) {
    if (x < 0 || x > 7 || y < 0 || y > 7) return -1;
    if (this.orientation === 'white') return (7 - y) * 16 + x;
    return y * 16 + (7 - x);
  };

  BoardView.prototype._paintSquares = function () {
    var kids = this.sqLayer.children;
    for (var i = 0; i < 64; i++) {
      var x = i % 8, y = (i / 8) | 0;
      var sq = this._sqAt(x, y);
      var d = kids[i];
      d.dataset.square = R.algebraic(sq);
      d.dataset.sq = sq;
      d.className = 'sq ' + (R.squareColor(sq) ? 'light' : 'dark');
      d.innerHTML = '';
      this.squares[sq] = d;
      if (this.showCoords) {
        if (x === 0) {
          var rk = document.createElement('span');
          rk.className = 'coord rank';
          rk.textContent = (sq >> 4) + 1;
          d.appendChild(rk);
        }
        if (y === 7) {
          var fl = document.createElement('span');
          fl.className = 'coord file';
          fl.textContent = String.fromCharCode(97 + (sq & 7));
          d.appendChild(fl);
        }
      }
    }
    this._restoreMarks();
  };

  BoardView.prototype.setOrientation = function (o) {
    if (o === this.orientation) return;
    this.orientation = o;
    this._paintSquares();
    if (this.game) this.render(this.game, true);
  };

  // full re-render (no per-piece animation)
  BoardView.prototype.render = function (game, instant) {
    this.game = game;
    var b = game.board;
    var want = {};
    for (var sq = 0; sq < 128; sq++) {
      if (sq & 0x88) continue;
      if (b[sq]) want[sq] = b[sq];
    }
    // remove stale
    for (var k in this.pieceEls) {
      if (!(k in want) || this._codeOf(this.pieceEls[k]) !== want[k]) {
        this.pieceLayer.removeChild(this.pieceEls[k]);
        delete this.pieceEls[k];
      }
    }
    for (var s in want) {
      s = +s;
      if (!this.pieceEls[s]) {
        this.pieceEls[s] = this._makePiece(want[s], s, instant);
      } else {
        this._place(this.pieceEls[s], s, instant);
      }
    }
    this.clearSelection();
  };

  BoardView.prototype._codeOf = function (el) { return +el.dataset.code; };

  BoardView.prototype._makePiece = function (code, sq, instant) {
    var p = document.createElement('div');
    var color = (code & 8) ? 'b' : 'w';
    p.className = 'piece ' + color + (instant ? ' no-anim' : '');
    p.textContent = GLYPHS[code & 7];
    p.dataset.code = code;
    this._place(p, sq, true);
    this.pieceLayer.appendChild(p);
    if (instant) {
      // force reflow then re-enable animation
      void p.offsetWidth;
      p.classList.remove('no-anim');
    }
    return p;
  };

  BoardView.prototype._place = function (el, sq, instant) {
    var pos = this._screenOf(sq);
    if (instant) el.classList.add('no-anim');
    el.style.transform = 'translate(' + pos.x * 100 + '%,' + pos.y * 100 + '%)';
    if (instant) { void el.offsetWidth; el.classList.remove('no-anim'); }
  };

  // animate a move that was just MADE on game (board array already updated)
  BoardView.prototype.applyMove = function (move, game) {
    this.game = game;
    var from = R.mvFrom(move), to = R.mvTo(move);
    var el = this.pieceEls[from];
    if (!el) { this.render(game, true); return; }

    // captured piece (incl. en passant target)
    var capSq = to;
    if (move & R.F_EP) capSq = (game.turn === R.WHITE) ? to + 16 : to - 16; // turn already flipped
    if ((move & R.F_CAP) && this.pieceEls[capSq]) {
      var dead = this.pieceEls[capSq];
      delete this.pieceEls[capSq];
      dead.style.opacity = '0';
      setTimeout(function () { dead.parentNode && dead.parentNode.removeChild(dead); }, 130);
    }
    delete this.pieceEls[from];
    // if something already sits on target (shouldn't), clear it
    if (this.pieceEls[to]) {
      var st = this.pieceEls[to];
      st.parentNode && st.parentNode.removeChild(st);
    }
    this.pieceEls[to] = el;
    this._place(el, to, false);
    if (move & R.F_PROMO) {
      var code = game.board[to];
      el.textContent = GLYPHS[code & 7];
      el.dataset.code = code;
    }
    // castle: move rook too
    if (move & R.F_CASTLE) {
      var rFrom, rTo;
      if (to > from) { rFrom = from + 3; rTo = from + 1; }
      else { rFrom = from - 4; rTo = from - 1; }
      var rk = this.pieceEls[rFrom];
      if (rk) {
        delete this.pieceEls[rFrom];
        this.pieceEls[rTo] = rk;
        this._place(rk, rTo, false);
      }
    }
    this.setLastMove(from, to);
    this.clearSelection();
    this.clearArrows();
  };

  // ---- marks ------------------------------------------------------
  BoardView.prototype._restoreMarks = function () {
    if (this.lastFrom >= 0) {
      this.squares[this.lastFrom] && this.squares[this.lastFrom].classList.add('last');
      this.squares[this.lastTo] && this.squares[this.lastTo].classList.add('last');
    }
    if (this.checkSq >= 0 && this.squares[this.checkSq]) this.squares[this.checkSq].classList.add('check');
    for (var i = 0; i < this.stars.length; i++) {
      var d = this.squares[this.stars[i]];
      if (d) d.classList.add('star');
    }
  };
  BoardView.prototype.setLastMove = function (from, to) {
    if (this.lastFrom >= 0) {
      this.squares[this.lastFrom] && this.squares[this.lastFrom].classList.remove('last');
      this.squares[this.lastTo] && this.squares[this.lastTo].classList.remove('last');
    }
    this.lastFrom = from; this.lastTo = to;
    if (from >= 0) {
      this.squares[from].classList.add('last');
      this.squares[to].classList.add('last');
    }
  };
  BoardView.prototype.setCheck = function (sq) {
    if (this.checkSq >= 0 && this.squares[this.checkSq]) this.squares[this.checkSq].classList.remove('check');
    this.checkSq = sq;
    if (sq >= 0 && this.squares[sq]) this.squares[sq].classList.add('check');
  };
  BoardView.prototype.clearSelection = function () {
    if (this.selected >= 0 && this.squares[this.selected]) this.squares[this.selected].classList.remove('sel');
    for (var i = 0; i < this.legalTargets.length; i++) {
      var d = this.squares[this.legalTargets[i]];
      if (d) { d.classList.remove('dot'); d.classList.remove('cap'); d.classList.remove('hovertgt'); }
    }
    this.selected = -1;
    this.legalTargets = [];
  };
  BoardView.prototype.flash = function (sq, cls) {
    var d = this.squares[sq];
    if (!d) return;
    d.classList.add(cls);
    setTimeout(function () { d.classList.remove(cls); }, 500);
  };
  BoardView.prototype.setStars = function (list) {
    this.clearStars();
    this.stars = list.slice();
    for (var i = 0; i < list.length; i++) {
      var d = this.squares[list[i]];
      if (d) d.classList.add('star');
    }
  };
  BoardView.prototype.removeStar = function (sq) {
    var i = this.stars.indexOf(sq);
    if (i >= 0) this.stars.splice(i, 1);
    var d = this.squares[sq];
    if (d) d.classList.remove('star');
  };
  BoardView.prototype.clearStars = function () {
    for (var i = 0; i < this.stars.length; i++) {
      var d = this.squares[this.stars[i]];
      if (d) d.classList.remove('star');
    }
    this.stars = [];
  };
  BoardView.prototype.shake = function () {
    this.el.classList.remove('shake');
    void this.el.offsetWidth;
    this.el.classList.add('shake');
  };

  // ---- arrows -------------------------------------------------------
  BoardView.prototype.showArrow = function (from, to, cls) {
    var a = this._screenOf(from), b = this._screenOf(to);
    var x1 = a.x * 100 + 50, y1 = a.y * 100 + 50;
    var x2 = b.x * 100 + 50, y2 = b.y * 100 + 50;
    var dx = x2 - x1, dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;
    var ux = dx / len, uy = dy / len;
    var headLen = 34, headW = 26, shaftEnd = len - headLen + 6;
    var ns = 'http://www.w3.org/2000/svg';
    var g = document.createElementNS(ns, 'g');
    g.setAttribute('class', cls || 'arrow-gold');
    var line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', x1 + ux * 22); line.setAttribute('y1', y1 + uy * 22);
    line.setAttribute('x2', x1 + ux * shaftEnd); line.setAttribute('y2', y1 + uy * shaftEnd);
    line.setAttribute('stroke-width', 15);
    line.setAttribute('stroke-linecap', 'round');
    var tipX = x2 - ux * 6, tipY = y2 - uy * 6;
    var bx = x1 + ux * (len - headLen), by = y1 + uy * (len - headLen);
    var px = -uy, py = ux;
    var poly = document.createElementNS(ns, 'polygon');
    poly.setAttribute('points',
      tipX + ',' + tipY + ' ' +
      (bx + px * headW / 2) + ',' + (by + py * headW / 2) + ' ' +
      (bx - px * headW / 2) + ',' + (by - py * headW / 2));
    g.appendChild(line); g.appendChild(poly);
    this.arrowLayer.appendChild(g);
  };
  BoardView.prototype.clearArrows = function () {
    while (this.arrowLayer.firstChild) this.arrowLayer.removeChild(this.arrowLayer.firstChild);
  };

  // ---- interaction ----------------------------------------------------
  BoardView.prototype._bindEvents = function () {
    var self = this;
    this.el.addEventListener('pointerdown', function (e) { self._onDown(e); });
    this.el.addEventListener('pointermove', function (e) { self._onMove(e); });
    this.el.addEventListener('pointerup', function (e) { self._onUp(e); });
    this.el.addEventListener('pointercancel', function () { self._cancelDrag(); });
    this.el.addEventListener('contextmenu', function (e) { e.preventDefault(); self.clearSelection(); });
  };

  BoardView.prototype._eventSquare = function (e) {
    var rect = this.el.getBoundingClientRect();
    var x = Math.floor((e.clientX - rect.left) / rect.width * 8);
    var y = Math.floor((e.clientY - rect.top) / rect.height * 8);
    return this._sqAt(x, y);
  };

  BoardView.prototype._canPick = function (sq) {
    if (!this.interactive || !this.game) return false;
    var p = this.game.board[sq];
    if (!p) return false;
    var color = (p & 8) ? R.BLACK : R.WHITE;
    if (color !== this.game.turn) return false;
    if (this.opts.canMove && !this.opts.canMove(color)) return false;
    return true;
  };

  BoardView.prototype._select = function (sq) {
    this.clearSelection();
    this.selected = sq;
    this.squares[sq].classList.add('sel');
    if (this.opts.onSelect) this.opts.onSelect(sq, this.game ? this.game.board[sq] : 0);
    if (!this.showLegal) return;
    var legal = this.game.legalMoves();
    for (var i = 0; i < legal.length; i++) {
      if (R.mvFrom(legal[i]) === sq) {
        var to = R.mvTo(legal[i]);
        if (this.legalTargets.indexOf(to) < 0) {
          this.legalTargets.push(to);
          this.squares[to].classList.add((legal[i] & R.F_CAP) ? 'cap' : 'dot');
        }
      }
    }
  };

  BoardView.prototype._onDown = function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (this._promoActive) return;
    var sq = this._eventSquare(e);
    if (sq < 0) return;

    if (this.clickMode) {
      if (this.opts.onSquareClick) this.opts.onSquareClick(sq);
      return;
    }

    if (this.selected >= 0 && this.legalTargets.indexOf(sq) >= 0) {
      this._tryMove(this.selected, sq);
      return;
    }
    if (this._canPick(sq)) {
      this._select(sq);
      // begin drag
      var el = this.pieceEls[sq];
      if (el) {
        this._drag = { from: sq, el: el, startX: e.clientX, startY: e.clientY, moved: false };
        try { this.el.setPointerCapture(e.pointerId); } catch (err) { }
      }
    } else if (this.selected >= 0) {
      this.clearSelection();
    }
  };

  BoardView.prototype._onMove = function (e) {
    if (!this._drag) return;
    var d = this._drag;
    var dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    if (!d.moved && Math.sqrt(dx * dx + dy * dy) < 5) return;
    d.moved = true;
    var rect = this.el.getBoundingClientRect();
    var cell = rect.width / 8;
    var pos = this._screenOf(d.from);
    d.el.classList.add('dragging');
    d.el.style.transform = 'translate(' +
      (pos.x * 100 + dx / cell * 100) + '%,' +
      (pos.y * 100 + dy / cell * 100) + '%) scale(1.15)';
    // hover target
    var over = this._eventSquare(e);
    if (over !== d.hover) {
      if (d.hover >= 0 && this.squares[d.hover]) this.squares[d.hover].classList.remove('hovertgt');
      d.hover = over;
      if (over >= 0 && this.legalTargets.indexOf(over) >= 0) this.squares[over].classList.add('hovertgt');
    }
  };

  BoardView.prototype._onUp = function (e) {
    if (!this._drag) return;
    var d = this._drag;
    this._drag = null;
    if (d.hover >= 0 && this.squares[d.hover]) this.squares[d.hover].classList.remove('hovertgt');
    d.el.classList.remove('dragging');
    if (!d.moved) {
      // treat as click-select (already selected on down)
      this._place(d.el, d.from, true);
      return;
    }
    var target = this._eventSquare(e);
    if (target >= 0 && this.legalTargets.indexOf(target) >= 0) {
      this._place(d.el, d.from, true); // snap home; controller animates the real move
      this._tryMove(d.from, target);
    } else {
      this._place(d.el, d.from, false);
      this.clearSelection();
    }
  };

  BoardView.prototype._cancelDrag = function () {
    if (!this._drag) return;
    var d = this._drag;
    this._drag = null;
    d.el.classList.remove('dragging');
    this._place(d.el, d.from, false);
    this.clearSelection();
  };

  BoardView.prototype._tryMove = function (from, to) {
    var self = this;
    var g = this.game;
    // promotion?
    var piece = g.board[from] & 7;
    var promoRank = g.turn === R.WHITE ? 7 : 0;
    if (piece === R.PAWN && (to >> 4) === promoRank) {
      this._promptPromotion(g.turn, function (promoType) {
        if (promoType) self.opts.onUserMove && self.opts.onUserMove(from, to, promoType);
        else self.clearSelection();
      });
      return;
    }
    this.opts.onUserMove && this.opts.onUserMove(from, to, 0);
  };

  BoardView.prototype._promptPromotion = function (color, cb) {
    var self = this;
    this._promoActive = true;
    var overlay = document.createElement('div');
    overlay.className = 'promo-overlay';
    var box = document.createElement('div');
    box.className = 'promo-box';
    var types = [R.QUEEN, R.ROOK, R.BISHOP, R.KNIGHT];
    var cls = color === R.WHITE ? 'w' : 'b';
    types.forEach(function (t) {
      var b = document.createElement('button');
      b.className = cls;
      b.textContent = GLYPHS[t];
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        self.el.removeChild(overlay);
        self._promoActive = false;
        cb(t);
      });
      box.appendChild(b);
    });
    overlay.addEventListener('click', function () {
      self.el.removeChild(overlay);
      self._promoActive = false;
      cb(0);
    });
    overlay.appendChild(box);
    this.el.appendChild(overlay);
  };

  window.BoardView = BoardView;
  window.PIECE_GLYPHS = GLYPHS;
}());
