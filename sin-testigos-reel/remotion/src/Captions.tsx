import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Page} from './words';
import {INK, PAPER, VIVO, SANS} from './brand';

// Word-by-word captions: one short page at a time, the spoken word in vivo,
// each word pops in as it is said. Pages hold until the next one starts.
export const Captions: React.FC<{pages: Page[]; top: number; size: number; until?: number}> = ({
  pages,
  top,
  size,
  until,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const idx = pages.findIndex((p, i) => {
    const next = pages[i + 1];
    const end = Math.min(next ? next.start : Infinity, p.end + 0.5, until ?? Infinity);
    return t >= p.start && t < end;
  });
  if (idx < 0) return null;
  const page = pages[idx];
  const pageIn = (t - page.start) * fps;

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          top,
          left: 80,
          right: 80,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          columnGap: size * 0.28,
          rowGap: size * 0.05,
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: size,
          lineHeight: 1.08,
          letterSpacing: '-0.01em',
          scale: interpolate(pageIn, [0, 5], [0.86, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.bezier(0.2, 1.4, 0.4, 1),
          }),
        }}
      >
        {page.words.map((w, i) => {
          const local = (t - w.start) * fps;
          const spoken = t >= w.start;
          const lastSpoken = page.words.reduce((a, x, j) => (t >= x.start ? j : a), -1);
          const active = i === lastSpoken;
          return (
            <span
              key={i}
              style={{
                color: active ? VIVO : PAPER,
                opacity: spoken ? 1 : 0.35,
                translate: interpolate(local, [0, 4], ['0px 14px', '0px 0px'], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing: Easing.out(Easing.cubic),
                }),
                textShadow: `0 0 2px ${INK}, 0 4px 18px rgba(20,18,23,0.85), 0 2px 0 ${INK}`,
                WebkitTextStroke: `${Math.round(size / 28)}px ${INK}`,
                paintOrder: 'stroke fill',
              }}
            >
              {w.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
