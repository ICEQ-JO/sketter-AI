// Tiny 5x7 dot-matrix font, rendered to block characters. Generating the
// banner from bitmaps (rather than hand-typing rows of block characters)
// avoids silent transcription errors and makes it trivial to change the word.
const FONT: Record<string, string[]> = {
  S: ["01110", "10001", "10000", "01110", "00001", "10001", "01110"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

const FILLED = "█";
const EMPTY = " ";

export function renderAsciiBanner(word: string, glyphGap = " "): string {
  const letters = word
    .toUpperCase()
    .split("")
    .map((ch) => FONT[ch] ?? FONT[" "]);
  const rows: string[] = [];
  for (let row = 0; row < 7; row++) {
    rows.push(
      letters
        .map((bitmap) =>
          bitmap[row]
            .split("")
            .map((bit) => (bit === "1" ? FILLED : EMPTY))
            .join(""),
        )
        .join(glyphGap),
    );
  }
  return rows.join("\n");
}

export const SKETTER_BANNER = renderAsciiBanner("SKETTER");
