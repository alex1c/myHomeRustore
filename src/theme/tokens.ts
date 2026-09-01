/**
 * Design tokens — calm home palette with light/dark support.
 */

export const lightColors = {
  primary: '#8B5E3C',
  primaryMuted: '#A67C52',
  primarySoft: '#F3E8DC',
  text: '#2C2418',
  textSecondary: '#5C5348',
  textMuted: '#9A9188',
  background: '#F5F0E8',
  surface: '#FFFFFF',
  surfaceMuted: '#EDE6DC',
  border: '#DDD4C8',
  danger: '#B91C1C',
  warning: '#B45309',
  success: '#047857',
} as const;

export const darkColors = {
  primary: '#C4A882',
  primaryMuted: '#A68B6A',
  primarySoft: '#3D3428',
  text: '#F5F0E8',
  textSecondary: '#C9C0B6',
  textMuted: '#8A8278',
  background: '#1A1612',
  surface: '#2A241E',
  surfaceMuted: '#352E27',
  border: '#4A4238',
  danger: '#F87171',
  warning: '#FBBF24',
  success: '#34D399',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const typography = {
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
} as const;

export const tokens = {
  lightColors,
  darkColors,
  spacing,
  typography,
  radii,
} as const;

export default tokens;
