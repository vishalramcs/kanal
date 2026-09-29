// Split sections into overlapping chunks that never cross a page/slide/section boundary,
// so each chunk can cite exactly where it came from.

const SIZE = 900; // characters (~200 tokens): small enough to be specific, big enough to keep context
const OVERLAP = 150; // carried into the next chunk so an idea split across the boundary is still findable
const MIN = 15; // short slides ("Heaps: complete binary trees") still count; only near-empty fragments are dropped

function pieces(text) {
  // Paragraphs first, then sentences for long paragraphs.
  return text
    .split(/\n{2,}|\n(?=[-*•\d])/)
    .flatMap((p) => (p.length <= SIZE ? [p] : p.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [p]))
    .flatMap((s) => (s.length <= SIZE ? [s] : s.match(new RegExp(`.{1,${SIZE}}(\\s|$)`, "gs")) || [s]))
    .map((s) => s.trim())
    .filter(Boolean);
}

export function chunkSections(sections, { size = SIZE, overlap = OVERLAP } = {}) {
  const chunks = [];
  for (const sec of sections) {
    let current = "";
    const flush = () => {
      if (current.trim().length >= MIN) {
        chunks.push({ index: chunks.length, text: current.trim(), page: sec.page, slide: sec.slide, section: sec.section });
      }
    };
    for (const piece of pieces(sec.text)) {
      if (current && current.length + piece.length + 1 > size) {
        flush();
        const tail = current.slice(-overlap);
        current = `${tail.slice(tail.indexOf(" ") + 1)} ${piece}`;
      } else {
        current = current ? `${current}\n${piece}` : piece;
      }
    }
    flush();
  }
  return chunks;
}

/** Human label for a chunk's location, e.g. "Page 42", "Slide 7", "Section: Rotations". */
export function locationLabel(c) {
  if (c.page) return `Page ${c.page}`;
  if (c.slide) return `Slide ${c.slide}`;
  if (c.section) return `Section: ${c.section}`;
  return `Part ${c.index + 1}`;
}
