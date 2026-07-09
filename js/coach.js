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

  // baby-simple voice for players who are brand new to the game
  var PHRASES_GENTLE = {
    best: [
      'Perfect move! That is exactly the right idea.',
      'Wonderful. You found the very best move on the board.',
      'Yes! Give yourself a high five.'
    ],
    excellent: [
      'Really good move. You are getting the hang of this.',
      'Nice one. Your pieces are happy.',
      'Great choice. Keep playing like this.'
    ],
    good: [
      'Good move. There was an even stronger one, but this works fine.',
      'That is okay! Nothing bad happened.',
      'Solid. You are doing well.'
    ],
    inaccuracy: [
      'Hmm, not the best spot. Nothing terrible, but look around a little longer next time.',
      'That move is a little soft. Before moving, peek at what your opponent might do back.',
      'Almost! A better square was waiting. Keep going.'
    ],
    mistake: [
      'Oops, that move gives your opponent a chance. Next time, check: can anything of mine be captured?',
      'Careful! Before each move, look at every one of your pieces and ask: is it safe?',
      'That one hurts a little. It happens to everyone. Look at what your opponent attacks now.'
    ],
    blunder: [
      'Oh no, that move gives something away for free! Look at the board: which of your pieces can be captured right now?',
      'Big oops! Do not worry, every champion has done this a thousand times. Ask: what did their last move attack?',
      'That loses a piece. Take a breath. Before you move, always check if your piece will be safe on its new square.'
    ]
  };

  // plain-words piece guide, shown when a brand-new player picks up a piece
  var PIECE_GUIDE = {
    1: ['Pawn', 'Your little soldier. It walks one square forward (two on its first move) and captures diagonally. Reach the far end and it becomes a Queen!'],
    2: ['Knight', 'The horse! It jumps in an L shape: two squares one way, then one square sideways. It is the only piece that can hop over others.'],
    3: ['Bishop', 'The pointy-hat one. It slides diagonally as far as it wants, but always stays on its own color.'],
    4: ['Rook', 'The castle tower. It slides in straight lines: up, down, left, right. As far as it wants.'],
    5: ['Queen', 'Your strongest piece! She moves like a Rook and a Bishop combined: any straight or diagonal line.'],
    6: ['King', 'The most important piece. He only steps one square at a time. If he is trapped, the game is over, so keep him safe!']
  };

  // gentle, in Urdu — for brand-new players learning in their own language
  var PHRASES_GENTLE_UR = {
    best: ['بہترین چال! بالکل صحیح سوچ۔', 'زبردست۔ اس سے اچھی کوئی چال نہ تھی۔', 'شاباش! خود کو داد دیں۔'],
    excellent: ['بہت اچھی چال۔ آپ سیکھ رہے ہیں۔', 'عمدہ انتخاب۔', 'بہت درست۔'],
    good: ['ٹھیک چال۔ ایک اور مضبوط چال بھی موجود تھی۔', 'چلے گا! کوئی نقصان نہیں ہوا۔', 'مضبوط، توازن قائم ہے۔'],
    inaccuracy: ['ذرا کمزور جگہ۔ اگلی بار تھوڑا اور دیکھ لیں کہ مخالف کیا کرے گا۔', 'برا نہیں، مگر پوزیشن ذرا پھسلی۔', 'قریب تھے! ایک بہتر خانہ موجود تھا۔'],
    mistake: ['اوہو، اس سے مخالف کو موقع مل گیا۔ اگلی بار دیکھیں: میرا کوئی مہرہ تو نہیں مارا جا سکتا؟', 'خیال رکھیں! چال سے پہلے ہر مہرے کو دیکھیں کہ محفوظ ہے یا نہیں۔', 'تھوڑا نقصان۔ سب سے ہوتا ہے۔ دیکھیں مخالف اب کس پر حملہ کر رہا ہے۔'],
    blunder: ['اوہو، اس چال سے مفت میں کچھ چلا گیا! دیکھیں: ابھی آپ کا کون سا مہرہ مارا جا سکتا ہے؟', 'بڑی غلطی! فکر نہ کریں، ہر چیمپئن نے ہزار بار کی ہے۔ سوچیں: مخالف کی پچھلی چال نے کس پر حملہ کیا؟', 'اس سے مہرہ چلا جاتا ہے۔ سانس لیں۔ چال سے پہلے ہمیشہ دیکھیں کہ نئی جگہ مہرہ محفوظ رہے گا یا نہیں۔']
  };

  function classify(cpLoss, wasBestMove) {
    if (wasBestMove) return VERDICTS[0];
    for (var i = 0; i < VERDICTS.length; i++) {
      if (cpLoss <= VERDICTS[i].max) return VERDICTS[i];
    }
    return VERDICTS[VERDICTS.length - 1];
  }

  function phrase(verdictId, gentle, isUr) {
    var table = (isUr && gentle) ? PHRASES_GENTLE_UR : (gentle ? PHRASES_GENTLE : PHRASES);
    var list = table[verdictId] || [''];
    return list[(Math.random() * list.length) | 0];
  }

  function pieceGuide(type) {
    return PIECE_GUIDE[type] || null;
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
    pieceGuide: pieceGuide,
    moveAccuracy: moveAccuracy,
    gameAccuracy: gameAccuracy,
    eloDelta: eloDelta,
    tierFor: tierFor,
    nextMilestone: nextMilestone,
    VERDICTS: VERDICTS
  };
}());
