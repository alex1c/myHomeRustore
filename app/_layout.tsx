/**
 * Root layout — theme, splash, and database bootstrap.
 */

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { DatabaseProvider, useDatabase } from '@/src/providers/DatabaseProvider';
import { useNotificationNavigation } from '@/src/hooks/useNotificationNavigation';
import { darkColors, lightColors } from '@/src/theme/tokens';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const LightNavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: lightColors.primary,
    background: lightColors.background,
    card: lightColors.surface,
    text: lightColors.text,
    border: lightColors.border,
  },
};

const DarkNavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: darkColors.primary,
    background: darkColors.background,
    card: darkColors.surface,
    text: darkColors.text,
    border: darkColors.border,
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <DatabaseProvider>
      <NotificationNavigationObserver />
      <ThemeProvider value={colorScheme === 'dark' ? DarkNavTheme : LightNavTheme}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="item/add" options={{ title: 'Новая вещь' }} />
          <Stack.Screen name="item/[id]" options={{ title: 'Вещь' }} />
          <Stack.Screen name="item/edit/[id]" options={{ title: 'Редактировать' }} />
          <Stack.Screen name="warranty/add" options={{ title: 'Добавить гарантию' }} />
          <Stack.Screen name="warranty/[id]" options={{ title: 'Гарантия' }} />
          <Stack.Screen name="warranty/edit/[id]" options={{ title: 'Редактировать гарантию' }} />
          <Stack.Screen name="document/add" options={{ title: 'Добавить документ' }} />
          <Stack.Screen name="document/[id]" options={{ title: 'Документ' }} />
          <Stack.Screen name="maintenance/add" options={{ title: 'Добавить обслуживание' }} />
          <Stack.Screen name="maintenance/[id]" options={{ title: 'Обслуживание' }} />
          <Stack.Screen name="maintenance/edit/[id]" options={{ title: 'Редактировать' }} />
          <Stack.Screen name="consumable/add" options={{ title: 'Добавить расходник' }} />
          <Stack.Screen name="consumable/[id]" options={{ title: 'Расходник' }} />
          <Stack.Screen name="consumable/edit/[id]" options={{ title: 'Редактировать' }} />
        </Stack>
      </ThemeProvider>
    </DatabaseProvider>
  );
}

function NotificationNavigationObserver() {
  const { db } = useDatabase();
  useNotificationNavigation(db);
  return null;
}
