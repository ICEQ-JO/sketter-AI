// Hand-authored figlet-style block banner (wider "Standard" letterforms
// than the old bitmap-generated font). Kept as a literal string rather than
// a generator since it's a one-off wordmark, not a reusable font.
//
// Rows are padded to a common width before joining: with `white-space: pre`
// and `text-align: center`, trailing whitespace is part of each line's
// measured width, so uneven rows get centered independently and the glyphs
// visibly drift out of alignment row to row.
const ROWS = [
  "███████ ██   ██ ███████ ████████ ████████ ███████ ██████",
  "██      ██  ██  ██         ██       ██    ██      ██   ██",
  "███████ █████   █████      ██       ██    █████   ██████",
  "     ██ ██  ██  ██         ██       ██    ██      ██   ██",
  "███████ ██   ██ ███████    ██       ██    ███████ ██   ██",
];

const WIDTH = Math.max(...ROWS.map((row) => row.length));

export const SKETTER_BANNER = ROWS.map((row) => row.padEnd(WIDTH)).join("\n");
