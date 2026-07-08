// Verify every opening line is legal and SAN-exact. node tests/openings.test.js
const RTG = require('../js/engine.js');
const BOOK = require('../js/openings.js');

let failures = 0;
for (const op of BOOK.OPENINGS) {
  const g = new RTG.Game();
  const sans = op.moves.split(' ');
  let ok = true, at = '';
  for (const san of sans) {
    const legal = g.legalMoves();
    let found = 0;
    for (const m of legal) {
      if (g.san(m, legal) === san) { found = m; break; }
    }
    if (!found) { ok = false; at = san; break; }
    g.make(found);
  }
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${op.name}${ok ? '' : ' — illegal/unmatched SAN: ' + at}`);
}

// detection sanity
const det = BOOK.detectOpening(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']);
console.log(`${det === 'Italian Game' ? 'PASS' : 'FAIL'} detects Italian Game (got ${det})`);
if (det !== 'Italian Game') failures++;

const det2 = BOOK.detectOpening(['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Be2']);
console.log(`${det2 === 'Sicilian Najdorf' ? 'PASS' : 'FAIL'} detects Najdorf after leaving book (got ${det2})`);
if (det2 !== 'Sicilian Najdorf') failures++;

console.log(failures ? `\n${failures} FAILURES` : '\nall passed');
process.exit(failures ? 1 : 0);
