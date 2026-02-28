import { style } from '@vanilla-extract/css';
import { color, config, DefaultReset, toRem } from 'folds';

export const PanelContainer = style([
  DefaultReset,
  {
    backgroundColor: color.Background.Container,
    borderTop: `${config.borderWidth.B300} solid ${color.Background.ContainerLine}`,
    padding: `${config.space.S200} ${config.space.S300}`,
    display: 'flex',
    flexDirection: 'column',
    gap: config.space.S100,
  },
]);

export const StatusRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: config.space.S200,
});

export const SignalIcon = style({
  color: color.Success.Main,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
});

export const SignalIconConnecting = style({
  color: color.Warning.Main,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
});

export const StatusInfo = style({
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  flex: 1,
});

export const ConnectedLabel = style({
  color: color.Success.Main,
  fontWeight: config.fontWeight.W600,
  fontSize: toRem(13),
  lineHeight: toRem(18),
});

export const ConnectingLabel = style({
  color: color.Warning.Main,
  fontWeight: config.fontWeight.W600,
  fontSize: toRem(13),
  lineHeight: toRem(18),
});

export const RoomNameButton = style({
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  textAlign: 'left',
  color: color.Background.OnContainer,
  fontSize: toRem(12),
  lineHeight: toRem(16),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',

  selectors: {
    '&:hover': {
      textDecoration: 'underline',
    },
  },
});

export const PanelControls = style({
  display: 'flex',
  alignItems: 'center',
  gap: config.space.S100,
  paddingTop: config.space.S100,
});

export const SmallControlButton = style([
  DefaultReset,
  {
    flex: 1,
    height: toRem(32),
    borderRadius: config.radii.R400,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: 'none',
    backgroundColor: color.SurfaceVariant.Container,
    color: color.SurfaceVariant.OnContainer,

    selectors: {
      '&:hover': {
        backgroundColor: color.SurfaceVariant.ContainerHover,
      },
    },
  },
]);

export const SmallControlButtonActive = style({
  backgroundColor: color.Critical.Container,
  color: color.Critical.OnContainer,

  selectors: {
    '&:hover': {
      backgroundColor: color.Critical.ContainerHover,
    },
  },
});

export const HangupButton = style([
  DefaultReset,
  {
    flexShrink: 0,
    width: toRem(28),
    height: toRem(28),
    borderRadius: config.radii.R400,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: 'none',
    backgroundColor: color.Critical.Container,
    color: color.Critical.OnContainer,

    selectors: {
      '&:hover': {
        backgroundColor: color.Critical.ContainerHover,
      },
    },
  },
]);

