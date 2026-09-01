/**
 * Hook returning semantic colors for the active color scheme.
 */

import { useColorScheme } from '@/components/useColorScheme';
import { darkColors, lightColors } from '@/src/theme/tokens';

export function useThemeColors() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkColors : lightColors;
}
