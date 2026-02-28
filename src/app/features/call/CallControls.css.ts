import { style } from '@vanilla-extract/css';
import { color, config, DefaultReset, toRem } from 'folds';

export const ControlsBar = style([
  DefaultReset,
  {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: config.space.S300,
    padding: config.space.S300,
  },
]);

export const ControlButton = style([
  DefaultReset,
  {
    width: toRem(48),
    height: toRem(48),
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: 'none',
    backgroundColor: color.SurfaceVariant.Container,
    color: color.SurfaceVariant.OnContainer,
    transition: 'background-color 200ms, color 200ms',

    selectors: {
      '&:hover': {
        opacity: config.opacity.P300,
      },
    },
  },
]);

export const ControlButtonMuted = style({
  backgroundColor: color.Critical.Container,
  color: color.Critical.OnContainer,
});

export const HangupButton = style([
  DefaultReset,
  {
    width: toRem(48),
    height: toRem(48),
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: 'none',
    backgroundColor: color.Critical.Main,
    color: color.Critical.OnMain,

    selectors: {
      '&:hover': {
        opacity: config.opacity.P300,
      },
    },
  },
]);
