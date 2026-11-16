import React from 'react';
import {Composition} from 'remotion';
import {Reel} from './Reel';
import './brand';

export const RemotionRoot: React.FC = () => (
  <Composition id="SinTestigosReel" component={Reel} width={1080} height={1920} fps={30} durationInFrames={634} />
);
