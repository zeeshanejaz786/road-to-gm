/* ============================================================
   Road to GM — synthesized sounds (WebAudio, no assets)
   ============================================================ */
(function () {
  'use strict';
  var ctx = null;
  var enabled = true;

  function ac() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, gain, delay, sweep) {
    var c = ac();
    if (!c || !enabled) return;
    var t0 = c.currentTime + (delay || 0);
    var osc = c.createOscillator();
    var g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (sweep) osc.frequency.exponentialRampToValueAtTime(sweep, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.12, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(c.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  var Sound = {
    setEnabled: function (v) { enabled = v; },
    isEnabled: function () { return enabled; },
    unlock: function () { ac(); },
    move: function () { tone(260, 0.055, 'triangle', 0.16, 0, 190); },
    capture: function () { tone(190, 0.05, 'square', 0.09); tone(300, 0.07, 'triangle', 0.14, 0.03, 210); },
    castle: function () { tone(230, 0.05, 'triangle', 0.13); tone(230, 0.05, 'triangle', 0.13, 0.09); },
    check: function () { tone(680, 0.14, 'sine', 0.1, 0, 620); },
    promote: function () { tone(520, 0.09, 'triangle', 0.11); tone(780, 0.12, 'triangle', 0.11, 0.08); },
    illegal: function () { tone(140, 0.12, 'sawtooth', 0.06); },
    lowTime: function () { tone(940, 0.06, 'sine', 0.09); },
    win: function () {
      tone(392, 0.12, 'triangle', 0.12);
      tone(494, 0.12, 'triangle', 0.12, 0.11);
      tone(587, 0.12, 'triangle', 0.12, 0.22);
      tone(784, 0.24, 'triangle', 0.13, 0.33);
    },
    loss: function () {
      tone(330, 0.16, 'triangle', 0.11);
      tone(262, 0.16, 'triangle', 0.11, 0.14);
      tone(196, 0.3, 'triangle', 0.11, 0.28);
    },
    draw: function () { tone(330, 0.14, 'triangle', 0.1); tone(330, 0.18, 'triangle', 0.09, 0.16); },
    right: function () { tone(660, 0.08, 'sine', 0.11); tone(880, 0.14, 'sine', 0.12, 0.07); },
    wrong: function () { tone(180, 0.14, 'sawtooth', 0.06); tone(140, 0.18, 'sawtooth', 0.05, 0.1); }
  };

  window.RTGSound = Sound;
}());
