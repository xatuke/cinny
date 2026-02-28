import { style } from '@vanilla-extract/css';
import { color, config, toRem } from 'folds';

export const MemberList = style({
  display: 'flex',
  flexDirection: 'column',
  paddingLeft: config.space.S500,
  paddingBottom: config.space.S100,
});

export const MemberItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: config.space.S200,
  padding: `${config.space.S100} ${config.space.S200}`,
  borderRadius: config.radii.R300,
  minHeight: toRem(28),
  cursor: 'default',
  ':hover': {
    backgroundColor: color.Background.ContainerHover,
  },
});
