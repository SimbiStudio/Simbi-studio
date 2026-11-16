import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

// Simbi brand tokens (dark theme values for video).
export const PAPER = '#F6F2EC';
export const INK = '#141217';
export const VIVO = '#F04A97';
export const SISTEMA = '#7C93FF';
export const SANS = 'Instrument Sans';
export const WIDE = 'Archivo';

loadFont({family: SANS, url: staticFile('InstrumentSans-VF.ttf'), weight: '400 700'});
loadFont({family: WIDE, url: staticFile('Archivo-VF.ttf'), weight: '100 900', stretch: '62% 125%'});
