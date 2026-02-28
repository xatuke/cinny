import { keyframes, style } from '@vanilla-extract/css';
import { color, config, DefaultReset, toRem } from 'folds';

const slideIn = keyframes({
  '0%': {
    transform: 'translateX(100%)',
    opacity: 0,
  },
  '100%': {
    transform: 'translateX(0)',
    opacity: 1,
  },
});

export const ToastContainer = style([
  DefaultReset,
  {
    position: 'fixed',
    top: config.space.S400,
    right: config.space.S400,
    zIndex: config.zIndex.Max,
    animation: `${slideIn} 200ms ease-out`,
  },
]);

export const ToastCard = style([
  DefaultReset,
  {
    backgroundColor: color.Surface.Container,
    color: color.Surface.OnContainer,
    borderRadius: config.radii.R400,
    boxShadow: config.shadow.E400,
    border: `${config.borderWidth.B300} solid ${color.Surface.ContainerLine}`,
    padding: config.space.S400,
    minWidth: toRem(280),
    maxWidth: toRem(360),
  },
]);

export const AcceptButton = style({
  backgroundColor: color.Success.Main,
  color: color.Success.OnMain,
});

export const DeclineButton = style({
  backgroundColor: color.Critical.Main,
  color: color.Critical.OnMain,
});
