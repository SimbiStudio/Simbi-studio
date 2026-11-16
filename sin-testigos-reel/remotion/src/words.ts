// Spoken words of the HeyGen avatar, timed to the speech segments measured with
// silence detection (whisper's token times drift ~1 s, so they only set word order).
// Times inside a segment are spread by word length. All output times are REEL seconds.

export type Word = {text: string; start: number; end: number};
export type Page = {words: Word[]; start: number; end: number};

type Segment = {
  srcStart: number; // seconds in avatar.mp4
  srcEnd: number;
  offset: number; // reel time = src time + offset
  pages: string[]; // each string is one on-screen page
};

const FPS = 30;
// Avatar clip placements in the reel (frames) and their trim in the source (seconds).
const PROOF = {from: 110, srcIn: 5.03};
const CLOSE_A = {from: 476, srcIn: 9.3};
const CLOSE_B = {from: 572, srcIn: 13.4};
const off = (p: {from: number; srcIn: number}) => p.from / FPS - p.srcIn;

const SEGMENTS: Segment[] = [
  {srcStart: 0.0, srcEnd: 1.31, offset: 0, pages: ['Esta escena', 'no se filmó.']},
  {srcStart: 1.64, srcEnd: 2.5, offset: 0, pages: ['Y hay tres más.']},
  {srcStart: 2.85, srcEnd: 3.65, offset: 0, pages: ['¿Las encontrás?']},
  {
    srcStart: 5.03,
    srcEnd: 8.23,
    offset: off(PROOF),
    pages: ['Una IA analizó', 'el corto entero', 'y no encontró', 'ninguna.'],
  },
  {srcStart: 9.4, srcEnd: 10.59, offset: off(CLOSE_A), pages: ['Comentá', 'los tres números']},
  {srcStart: 10.74, srcEnd: 12.44, offset: off(CLOSE_A), pages: ['y mañana te mostramos', 'cuáles eran.']},
  {srcStart: 13.48, srcEnd: 13.67, offset: off(CLOSE_B), pages: ['Ah,']},
  {srcStart: 14.27, srcEnd: 15.41, offset: off(CLOSE_B), pages: ['y yo tampoco', 'soy real.']},
];

const weight = (w: string) => Math.max(2, w.replace(/[^\p{L}\p{N}]/gu, '').length);

const build = (seg: Segment): Page[] => {
  const all = seg.pages.map((p) => p.split(' '));
  const total = all.flat().reduce((s, w) => s + weight(w), 0);
  const span = seg.srcEnd - seg.srcStart;
  let t = seg.srcStart;
  return all.map((words) => {
    const ws: Word[] = words.map((text) => {
      const d = (weight(text) / total) * span;
      const w = {text, start: t + seg.offset, end: t + d + seg.offset};
      t += d;
      return w;
    });
    return {words: ws, start: ws[0].start, end: ws[ws.length - 1].end};
  });
};

export const PAGES: Page[] = SEGMENTS.flatMap(build);
export const HOOK_PAGES = PAGES.filter((p) => p.start < 110 / FPS);
export const AVATAR_PAGES = PAGES.filter((p) => p.start >= 110 / FPS);
