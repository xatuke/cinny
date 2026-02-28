import { style } from '@vanilla-extract/css';
import { DefaultReset } from 'folds';

export const HiddenHost = style([
  DefaultReset,
  {
    position: 'fixed',
    top: '-200vh',
    left: '-200vw',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    pointerEvents: 'none',
  },
]);

export const IframeContainer = style([
  DefaultReset,
  {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
]);
