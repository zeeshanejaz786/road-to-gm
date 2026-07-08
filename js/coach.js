/* ============================================================
   Road to GM — coach: move grading, accuracy, Elo bookkeeping
   ============================================================ */
(function () {
  'use strict';
  var AI = window.RTGAI;

  // verdicts by centipawn loss
  var VERDICTS = [
    { id: 'best', label: 'Best move', glyph: '★', max: 9 },
    { id: 'excellent', label: 'Excellent', glyph: '!', max: 29 },
    { id: 'good', label: 'Good', glyph: '✓', max: 79 },
    { id: 'inaccuracy', label: 'Inaccuracy', glyph: '?!', max: 149 },
    { id: 'mistake', label: 'Mistake', glyph: '?', max: 299 },
    { id: 'blunder', label: 'Blunder', glyph: '??', max: Infinity }
  ];

  var PHRASES = {
    best: [
      'Exactly what the engine wanted to play.',
      'Top move. Keep this up.',
      'Precise. Nothing better existed.'
    ],
    excellent: [
      'Nearly perfect, the position stays healthy.',
      'Strong choice.',
      'Very accurate.'
    ],
    good: [
      'Reasonable. A sharper option was available.',
      'Solid, though not the most testing.',
      'Playable, keeps the balance.'
    ],
    inaccuracy: [
      'Slightly soft. You gave back part of your edge.',
      'Not terrible, but the position slipped a little.',
      'A better square was waiting.'
    ],
    mistake: [
      'That hurts. Your opponent has a clear path now.',
      'You missed something important here.',
      'The evaluation swung against you.'
    ],
    blunder: [
      'Ouch. Stop, breathe, and look at every check and capture.',
      'That loses material or worse. What did the last move attack?',
      'Big one. Ask yourself: is my move safe? Count the attackers.'
    ]
  };

  function classify(cpLoss, wasBestMove) {
    if (wasBestMove) return VERDICTS[0];
    for (var i = 0; i < VERDICTS.length; i++) {
      if (cpLoss <= VERDICTS[i].max) return VERDICTS[i];
    }
    return VERDICTS[VERDICTS.length - 1];
  }

  function phrase(verdictId) {
    var list = PHRASES[verdictId] || [''];
    return list[(Math.random() * list.length) | 0];
  }

  // per-move accuracy from win% swing (lichess-style curve)
  function moveAccuracy(winBefore, winAfter) {
    var drop = winBefore - winAfter;
    if (drop <= 0) return 100;
    var acc = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669;
    return Math.max(0, Math.min(100, acc));
  }

  function gameAccuracy(moveAccs) {
    if (!moveAccs.length) return null;
    var sum = 0;
    for (var i = 0; i < moveAccs.length; i++) sum += moveAccs[i];
    return Math.round(sum / moveAccs.length * 10) / 10;
  }

  // ---- Elo -------------------------------------------------------------
  function eloDelta(myRating, oppRating, score, gamesPlayed) {
    var k = gamesPlayed < 15 ? 40 : 24;
    var expected = 1 / (1 + Math.pow(10, (oppRating - myRating) / 400));
    return Math.round(k * (score - expected));
  }

  var TIERS = [
    [0, 'Novice'], [500, 'Learner'], [800, 'Club Player'], [1100, 'Competitor'],
    [1400, 'Tournament Player'], [1700, 'Expert'], [2000, 'Candidate Master'],
    [2200, 'Master'], [2400, 'Grandmaster Road']
  ];
  function tierFor(rating) {
    var name = TIERS[0][1];
    for (var i = 0; i < TIERS.length; i++) {
      if (rating >= TIERS[i][0]) name = TIERS[i][1];
    }
    return name;
  }
  function nextMilestone(rating) {
    for (var i = 0; i < TIERS.length; i++) {
      if (TIERS[i][0] > rating) return TIERS[i];
    }
    return null;
  }

  window.RTGCoach = {
    classify: classify,
    phrase: phrase,
    moveAccuracy: moveAccuracy,
    gameAccuracy: gameAccuracy,
    eloDelta: eloDelta,
    tierFor: tierFor,
    nextMilestone: nextMilestone,
    VERDICTS: VERDICTS
  };
}());
