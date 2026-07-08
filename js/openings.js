/* ============================================================
   Road to GM — opening book + study data
   Every line is engine-verified by tests/openings.test.js.
   ============================================================ */
(function () {
  'use strict';

  // moves are SAN, space separated
  var OPENINGS = [
    {
      id: 'kp', name: "King's Pawn Game", moves: 'e4 e5',
      style: 'Classical', level: 'Starter', side: 'white',
      idea: 'The oldest fight: both sides stake a claim in the center and develop fast.'
    },
    {
      id: 'italian', name: 'Italian Game', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O',
      style: 'Classical', level: 'Starter', side: 'white',
      idea: 'Develop quickly, castle early, point the bishop at f7. The best first opening to learn as White.'
    },
    {
      id: 'ruy', name: 'Ruy Lopez', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O',
      style: 'Positional', level: 'Advanced', side: 'white',
      idea: 'Pressure the knight that defends e5 and grind a long-term edge. A lifetime opening.'
    },
    {
      id: 'scotch', name: 'Scotch Game', moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7 Qe2 Nd5',
      style: 'Open', level: 'Intermediate', side: 'white',
      idea: 'Blast the center open on move three and play with active pieces.'
    },
    {
      id: 'vienna', name: 'Vienna Game', moves: 'e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4',
      style: 'Attacking', level: 'Intermediate', side: 'white',
      idea: 'A sneaky move order that often lands a big pawn center or a quick kingside attack.'
    },
    {
      id: 'kg', name: "King's Gambit", moves: 'e4 e5 f4 exf4 Nf3 g5',
      style: 'Gambit', level: 'Advanced', side: 'white',
      idea: 'Sacrifice a pawn on move two for open lines and a raging initiative. Romantic era chess.'
    },
    {
      id: 'sicilian', name: 'Sicilian Defense', moves: 'e4 c5',
      style: 'Counterattack', level: 'Intermediate', side: 'black',
      idea: 'The most popular reply to e4 at every level: fight for the center from the side and play for a win.'
    },
    {
      id: 'najdorf', name: 'Sicilian Najdorf', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6',
      style: 'Counterattack', level: 'Advanced', side: 'black',
      idea: 'The sharpest mainstream opening in chess. Flexible, venomous, endlessly deep.'
    },
    {
      id: 'accdragon', name: 'Accelerated Dragon', moves: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6',
      style: 'Counterattack', level: 'Intermediate', side: 'black',
      idea: 'Fianchetto the bishop onto the long diagonal fast and hit the center later.'
    },
    {
      id: 'french', name: 'French Defense', moves: 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3',
      style: 'Solid', level: 'Starter', side: 'black',
      idea: 'Build a solid pawn chain, then chip at the base with c5 and f6. Structure over speed.'
    },
    {
      id: 'carokann', name: 'Caro-Kann Defense', moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5',
      style: 'Solid', level: 'Starter', side: 'black',
      idea: 'Like the French but the light-squared bishop gets out first. Rock solid at every level.'
    },
    {
      id: 'scandi', name: 'Scandinavian Defense', moves: 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5',
      style: 'Solid', level: 'Starter', side: 'black',
      idea: 'One setup against e4 you can learn in an evening. Clear plans, few surprises.'
    },
    {
      id: 'pirc', name: 'Pirc Defense', moves: 'e4 d6 d4 Nf6 Nc3 g6 f4 Bg7 Nf3',
      style: 'Counterattack', level: 'Advanced', side: 'black',
      idea: 'Let White build a big center, then attack it with pieces. Requires nerve.'
    },
    {
      id: 'alekhine', name: "Alekhine's Defense", moves: 'e4 Nf6 e5 Nd5 d4 d6 Nf3',
      style: 'Provocative', level: 'Advanced', side: 'black',
      idea: 'Provoke White’s pawns forward until they become targets.'
    },
    {
      id: 'qp', name: "Queen's Pawn Game", moves: 'd4 d5',
      style: 'Classical', level: 'Starter', side: 'white',
      idea: 'The closed-game counterpart to e4 e5: slower plans, deeper strategy.'
    },
    {
      id: 'qgd', name: "Queen's Gambit Declined", moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3',
      style: 'Solid', level: 'Intermediate', side: 'black',
      idea: 'Refuse the pawn, keep the center, untangle slowly. World championship material for 150 years.'
    },
    {
      id: 'qga', name: "Queen's Gambit Accepted", moves: 'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6',
      style: 'Open', level: 'Intermediate', side: 'black',
      idea: 'Take the pawn, give it back for fast development and a clean position.'
    },
    {
      id: 'slav', name: 'Slav Defense', moves: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5',
      style: 'Solid', level: 'Intermediate', side: 'black',
      idea: 'Defend d5 with c6 so the light-squared bishop stays free. Sturdy and respected.'
    },
    {
      id: 'london', name: 'London System', moves: 'd4 d5 Bf4 Nf6 e3 c5 c3 Nc6 Nd2 e6 Ngf3 Bd6 Bg3',
      style: 'System', level: 'Starter', side: 'white',
      idea: 'Same healthy setup against almost anything Black plays. Low theory, high annoyance.'
    },
    {
      id: 'kid', name: "King's Indian Defense", moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6',
      style: 'Attacking', level: 'Advanced', side: 'black',
      idea: 'Concede the center, castle, then launch every pawn at White’s king. All or nothing.'
    },
    {
      id: 'nimzo', name: 'Nimzo-Indian Defense', moves: 'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O',
      style: 'Positional', level: 'Advanced', side: 'black',
      idea: 'Pin the knight, fight for e4, trade bishop for structure. Pure chess understanding.'
    },
    {
      id: 'qid', name: "Queen's Indian Defense", moves: 'd4 Nf6 c4 e6 Nf3 b6 g3 Bb7 Bg2 Be7 O-O O-O',
      style: 'Solid', level: 'Advanced', side: 'black',
      idea: 'Control e4 from distance with the b7 bishop. Quiet moves, deep ideas.'
    },
    {
      id: 'grunfeld', name: 'Grünfeld Defense', moves: 'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7',
      style: 'Counterattack', level: 'Advanced', side: 'black',
      idea: 'Give White the dream center, then prove it is a target. Engine-approved.'
    },
    {
      id: 'catalan', name: 'Catalan Opening', moves: 'd4 Nf6 c4 e6 g3 d5 Bg2 Be7 Nf3 O-O O-O dxc4',
      style: 'Positional', level: 'Advanced', side: 'white',
      idea: 'Queen’s Gambit plus a monster fianchetto bishop. Squeeze for 40 moves.'
    },
    {
      id: 'english', name: 'English Opening', moves: 'c4 e5 Nc3 Nf6 g3 d5 cxd5 Nxd5 Bg2 Nb6',
      style: 'Positional', level: 'Intermediate', side: 'white',
      idea: 'A reversed Sicilian with an extra move. Flexible and fashionable.'
    },
    {
      id: 'reti', name: 'Réti Opening', moves: 'Nf3 d5 c4 e6 g3 Nf6 Bg2 Be7 O-O O-O',
      style: 'System', level: 'Intermediate', side: 'white',
      idea: 'Control the center with pieces first, pawns later. Hypermodern style.'
    },
    {
      id: 'dutch', name: 'Dutch Defense', moves: 'd4 f5 g3 Nf6 Bg2 e6 Nf3 Be7 O-O O-O c4 d6',
      style: 'Attacking', level: 'Advanced', side: 'black',
      idea: 'Grab kingside space on move one and aim everything at the white king.'
    },
    {
      id: 'indian', name: 'Indian Game', moves: 'd4 Nf6',
      style: 'Flexible', level: 'Starter', side: 'black',
      idea: 'Develop the knight first and keep every pawn structure available.'
    }
  ];

  // ---- book trie: joined-SAN prefix -> array of next SANs -----------
  var BOOK = {};
  (function build() {
    for (var i = 0; i < OPENINGS.length; i++) {
      var line = OPENINGS[i].moves.split(' ');
      for (var k = 0; k < line.length; k++) {
        var key = line.slice(0, k).join(' ');
        if (!BOOK[key]) BOOK[key] = [];
        if (BOOK[key].indexOf(line[k]) < 0) BOOK[key].push(line[k]);
      }
    }
  }());

  // probe: sanLine (array) -> a SAN continuation or null
  function probeBook(sanLine) {
    var opts = BOOK[sanLine.join(' ')];
    if (!opts || !opts.length) return null;
    return opts[(Math.random() * opts.length) | 0];
  }

  // detect the current opening name from a SAN line (longest matched prefix)
  function detectOpening(sanLine) {
    var bestName = null, bestLen = 0;
    for (var i = 0; i < OPENINGS.length; i++) {
      var line = OPENINGS[i].moves.split(' ');
      var n = 0;
      while (n < line.length && n < sanLine.length && line[n] === sanLine[n]) n++;
      // matched the whole line, or the game is still inside the line
      var matched = (n === line.length) || (n === sanLine.length && n > 0);
      if (matched && n > bestLen) { bestLen = n; bestName = OPENINGS[i].name; }
    }
    return bestName;
  }

  var api = { OPENINGS: OPENINGS, BOOK: BOOK, probeBook: probeBook, detectOpening: detectOpening };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (typeof window !== 'undefined' ? window : this).RTGBOOK = api;
}());
