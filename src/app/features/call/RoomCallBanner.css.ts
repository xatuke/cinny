import { style } from '@vanilla-extract/css';
import { color, config, DefaultReset, toRem } from 'folds';

export const BannerContainer = style([
  DefaultReset,
  {
    backgroundColor: color.Success.Container,
    color: color.Success.OnContainer,
    padding: `${config.space.S200} ${config.space.S400}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'SpaceBetween' as any,
    gap: config.space.S300,
    cursor: 'pointer',
    borderBottom: `${config.borderWidth.B300} solid ${color.Success.ContainerLine}`,

    selectors: {
      '&:hover': {
        opacity: config.opacity.P300,
      },
    },
  },
]);

export const BannerText = style({
  fontWeight: config.fontWeight.W600,
  fontSize: toRem(13),
});
