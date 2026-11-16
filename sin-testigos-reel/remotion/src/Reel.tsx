import React from 'react';
import {AbsoluteFill, Easing, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {Audio, Video} from '@remotion/media';
import {Captions} from './Captions';
import {AVATAR_PAGES, HOOK_PAGES} from './words';
import {INK, PAPER, VIVO, WIDE} from './brand';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const SCENES = ['s1', 's2', 's3', 's4', 's5', 's6'];

// ---------- small building blocks ----------

const PushIn: React.FC<{dur: number; from?: number; to?: number; origin?: string; children: React.ReactNode}> = ({
  dur,
  from = 1,
  to = 1.12,
  origin = '50% 50%',
  children,
}) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        scale: interpolate(f, [0, dur], [from, to], {...clamp, easing: Easing.out(Easing.quad)}),
        transformOrigin: origin,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const Pill: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div
    style={{
      position: 'absolute',
      padding: '14px 26px',
      borderRadius: 999,
      background: 'rgba(20,18,23,0.78)',
      color: PAPER,
      fontFamily: WIDE,
      fontStretch: '125%',
      fontWeight: 700,
      fontSize: 30,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      ...style,
    }}
  >
    {children}
  </div>
);

const Fill: React.FC<{src: string; trim?: number; volume?: number; muted?: boolean}> = ({
  src,
  trim = 0,
  volume = 1,
  muted,
}) => (
  <Video
    src={staticFile(src)}
    trimBefore={trim}
    volume={volume}
    muted={muted}
    style={{width: '100%', height: '100%', objectFit: 'cover'}}
  />
);

// Talking-head zoom: a jump cut to a new framing on every caption page,
// alternating tight / tighter, with a slow drift in between.
const JumpZoom: React.FC<{seqFrom: number; dur: number; scales: [number, number]; origin: string; children: React.ReactNode}> = ({
  seqFrom,
  dur,
  scales,
  origin,
  children,
}) => {
  const f = useCurrentFrame();
  const cuts = [0, ...AVATAR_PAGES.map((p) => Math.round(p.start * 30) - seqFrom).filter((c) => c > 6 && c < dur - 6)];
  const i = cuts.reduce((a, c, j) => (f >= c ? j : a), 0);
  const local = f - cuts[i];
  const base = scales[i % 2];
  return (
    <AbsoluteFill
      style={{
        scale: base * interpolate(local, [0, 4, 40], [1.04, 1, 1.03], {...clamp, easing: Easing.out(Easing.cubic)}),
        transformOrigin: origin,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// ---------- 1. hook: burning report + teaser flashes ----------

const Hook: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: INK}}>
    <PushIn dur={110} to={1.18}>
      <Fill src="fire.mp4" volume={0.35} />
    </PushIn>
    {/* "Y hay tres más": four 9-frame flashes of other scenes */}
    <Sequence from={49} durationInFrames={9} name="Flash s2">
      <Fill src="s2.mp4" trim={12} muted />
    </Sequence>
    <Sequence from={58} durationInFrames={9} name="Flash s4">
      <Fill src="s4.mp4" trim={12} muted />
    </Sequence>
    <Sequence from={67} durationInFrames={9} name="Flash s6">
      <Fill src="s6.mp4" trim={12} muted />
    </Sequence>
    <Sequence from={76} durationInFrames={9} name="Flash s3">
      <Fill src="s3.mp4" trim={12} muted />
    </Sequence>
  </AbsoluteFill>
);

// ---------- 2. proof: AI scan of the film over the avatar ----------

const Scan: React.FC = () => {
  const f = useCurrentFrame();
  const REVEAL = 74; // frame (within this sequence) of "ninguna"
  const cycle = ['fire', ...SCENES];
  const scanning = f < REVEAL;
  const clip = cycle[Math.floor(f / 5) % cycle.length];
  const mm = Math.min(13 * 60 + 57, Math.floor((f / REVEAL) * (13 * 60 + 57)));
  const ts = `${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`;
  return (
    <AbsoluteFill style={{height: 960, overflow: 'hidden', backgroundColor: INK}}>
      <div style={{position: 'absolute', top: -480, left: 0, width: 1080, height: 1920}}>
        <Video
          key={clip}
          src={staticFile(`${clip}.mp4`)}
          muted
          trimBefore={10}
          style={{width: 1080, height: 1920, filter: scanning ? 'none' : 'brightness(0.35)'}}
        />
      </div>
      {scanning && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 6,
            top: interpolate(f % 24, [0, 23], [40, 920]),
            background: PAPER,
            boxShadow: `0 0 40px 10px ${VIVO}`,
            opacity: 0.85,
          }}
        />
      )}
      <Pill style={{top: 250, left: 80}}>{scanning ? `Analizando · ${ts}` : 'Análisis terminado'}</Pill>
      {!scanning && (
        <div
          style={{
            position: 'absolute',
            top: 330,
            left: 0,
            right: 0,
            textAlign: 'center',
            color: PAPER,
            scale: interpolate(f - REVEAL, [0, 6], [1.6, 1], {...clamp, easing: Easing.out(Easing.back(2))}),
          }}
        >
          <div style={{fontFamily: WIDE, fontStretch: '125%', fontWeight: 900, fontSize: 300, lineHeight: 1}}>0</div>
          <div
            style={{
              fontFamily: WIDE,
              fontStretch: '125%',
              fontWeight: 700,
              fontSize: 34,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginTop: 10,
            }}
          >
            Escenas con IA detectadas
          </div>
        </div>
      )}
      <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: PAPER, opacity: 0.9}} />
    </AbsoluteFill>
  );
};

const Proof: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: INK}}>
    <div style={{position: 'absolute', top: 960, left: 0, width: 1080, height: 960, overflow: 'hidden'}}>
      <div style={{position: 'absolute', top: -260, left: 0, width: 1080, height: 1920}}>
        <JumpZoom seqFrom={110} dur={96} scales={[1.4, 1.62]} origin="50% 27%">
          <Fill src="avatar.mp4" trim={151} />
        </JumpZoom>
      </div>
    </div>
    <Scan />
  </AbsoluteFill>
);

// ---------- 3. the six scenes ----------

const SceneCard: React.FC<{n: number; src: string}> = ({n, src}) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: INK}}>
      <PushIn dur={45} to={1.14}>
        <Fill src={src} trim={3} volume={0.5} />
      </PushIn>
      <div
        style={{
          position: 'absolute',
          top: 230,
          left: 80,
          color: PAPER,
          fontFamily: WIDE,
          fontStretch: '125%',
          fontWeight: 900,
          fontSize: 300,
          lineHeight: 1,
          textShadow: '0 8px 40px rgba(20,18,23,0.7)',
          scale: interpolate(f, [0, 7], [1.5, 1], {...clamp, easing: Easing.out(Easing.back(2.2))}),
          transformOrigin: '0% 0%',
        }}
      >
        {n}
      </div>
      <Pill style={{top: 270, right: 80}}>¿IA o real?</Pill>
    </AbsoluteFill>
  );
};

// ---------- 4. close: grid of the six + "yo tampoco soy real" ----------

const Grid: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute',
        top: 905,
        left: 110,
        right: 110,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 14,
      }}
    >
      {SCENES.map((s, i) => (
        <div
          key={s}
          style={{
            position: 'relative',
            height: 290,
            borderRadius: 18,
            overflow: 'hidden',
            border: `3px solid ${PAPER}`,
            opacity: interpolate(f - i * 2, [0, 5], [0, 1], clamp),
            scale: interpolate(f - i * 2, [0, 6], [0.7, 1], {...clamp, easing: Easing.out(Easing.back(1.8))}),
          }}
        >
          <div style={{position: 'absolute', top: -110, left: -1, width: 284, height: 505}}>
            <Video src={staticFile(`${s}.mp4`)} muted trimBefore={6} style={{width: 284, height: 505}} />
          </div>
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 16,
              color: PAPER,
              fontFamily: WIDE,
              fontStretch: '125%',
              fontWeight: 900,
              fontSize: 84,
              textShadow: '0 4px 20px rgba(20,18,23,0.8)',
            }}
          >
            {i + 1}
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------- timeline ----------

export const Reel: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{backgroundColor: INK}}>
      <Sequence name="Hook" durationInFrames={110}>
        <Hook />
      </Sequence>
      <Audio src={staticFile('avatar.mp4')} trimBefore={0} durationInFrames={110} name="Hook voice" />

      <Sequence name="Proof" from={110} durationInFrames={96}>
        <Proof />
      </Sequence>

      <Sequence name="Scene 1" from={206} durationInFrames={45}>
        <SceneCard n={1} src="s1.mp4" />
      </Sequence>
      <Sequence name="Scene 2" from={251} durationInFrames={45}>
        <SceneCard n={2} src="s2.mp4" />
      </Sequence>
      <Sequence name="Scene 3" from={296} durationInFrames={45}>
        <SceneCard n={3} src="s3.mp4" />
      </Sequence>
      <Sequence name="Scene 4" from={341} durationInFrames={45}>
        <SceneCard n={4} src="s4.mp4" />
      </Sequence>
      <Sequence name="Scene 5" from={386} durationInFrames={45}>
        <SceneCard n={5} src="s5.mp4" />
      </Sequence>
      <Sequence name="Scene 6" from={431} durationInFrames={45}>
        <SceneCard n={6} src="s6.mp4" />
      </Sequence>

      <Sequence name="Close A" from={476} durationInFrames={96}>
        <JumpZoom seqFrom={476} dur={96} scales={[1.22, 1.36]} origin="50% 22%">
          <Fill src="avatar.mp4" trim={279} />
        </JumpZoom>
        <Sequence from={3} name="Grid">
          <Grid />
        </Sequence>
      </Sequence>
      <Sequence name="Close B" from={572} durationInFrames={62}>
        <JumpZoom seqFrom={572} dur={62} scales={[1.45, 1.72]} origin="50% 27%">
          <Fill src="avatar.mp4" trim={402} />
        </JumpZoom>
      </Sequence>

      {/* captions */}
      <Captions pages={HOOK_PAGES} top={360} size={104} until={110 / 30} />
      {f >= 110 && f < 206 && <Captions pages={AVATAR_PAGES} top={830} size={70} until={206 / 30} />}
      {f >= 476 && f < 572 && <Captions pages={AVATAR_PAGES} top={808} size={60} until={572 / 30} />}
      {f >= 572 && <Captions pages={AVATAR_PAGES} top={1250} size={96} />}

      {/* sound: music bed ducked under the voice, whooshes on cuts */}
      <Audio
        src={staticFile('music.mp3')}
        durationInFrames={634}
        volume={(fr) =>
          interpolate(fr, [0, 200, 210, 470, 480, 634], [0.22, 0.22, 0.55, 0.55, 0.22, 0.22], clamp)
        }
      />
      <Sequence from={49} name="Flash clicks">
        <Audio src={staticFile('sfx-mouse-click.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={67}>
        <Audio src={staticFile('sfx-mouse-click.wav')} volume={0.5} />
      </Sequence>
      <Sequence from={184} name="Reveal 0">
        <Audio src={staticFile('sfx-switch.wav')} volume={0.8} />
      </Sequence>
      <Sequence from={203} name="Whoosh 1">
        <Audio src={staticFile('sfx-whoosh.wav')} volume={0.45} />
      </Sequence>
      <Sequence from={248}>
        <Audio src={staticFile('sfx-whoosh.wav')} volume={0.45} />
      </Sequence>
      <Sequence from={293}>
        <Audio src={staticFile('sfx-whoosh.wav')} volume={0.45} />
      </Sequence>
      <Sequence from={338}>
        <Audio src={staticFile('sfx-whoosh.wav')} volume={0.45} />
      </Sequence>
      <Sequence from={383}>
        <Audio src={staticFile('sfx-whoosh.wav')} volume={0.45} />
      </Sequence>
      <Sequence from={428}>
        <Audio src={staticFile('sfx-whoosh.wav')} volume={0.45} />
      </Sequence>
      <Sequence from={473}>
        <Audio src={staticFile('sfx-whoosh.wav')} volume={0.45} />
      </Sequence>
    </AbsoluteFill>
  );
};
