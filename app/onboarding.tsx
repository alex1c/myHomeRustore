/**
 * First-run onboarding — max 3 screens, shown once via app_settings.
 */

import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { ONBOARDING_SETTING_KEY } from '@/src/monetization/config';
import { useDatabase } from '@/src/providers/DatabaseProvider';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing, typography } from '@/src/theme/tokens';

const SLIDES = [
  {
    title: 'Всё о доме в одном месте',
    body: 'Имущество, чеки, документы и гарантии — под рукой.',
  },
  {
    title: 'Не пропускайте важное',
    body: 'Обслуживание, расходники и напоминания вовремя.',
  },
  {
    title: 'Ваши данные остаются у вас',
    body: 'Локальное хранение на устройстве и ручная резервная копия.',
  },
] as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { settings } = useDatabase();
  const [index, setIndex] = useState(0);
  const slide = useMemo(() => SLIDES[index]!, [index]);

  const finish = () => {
    try {
      settings?.set(ONBOARDING_SETTING_KEY, '1');
    } catch {
      // ignore — still enter the app
    }
    router.replace('/(tabs)');
  };

  const handleNext = () => {
    if (index >= SLIDES.length - 1) {
      finish();
      return;
    }
    setIndex((value) => value + 1);
  };

  return (
    <Screen>
      <View style={styles.body}>
        <Text style={[styles.kicker, { color: colors.textMuted }]}>
          Мой дом
        </Text>
        <Text style={[styles.title, { color: colors.text }]}>{slide.title}</Text>
        <Text style={[styles.copy, { color: colors.textSecondary }]}>
          {slide.body}
        </Text>
      </View>

      <View style={styles.dots}>
        {SLIDES.map((item, i) => (
          <View
            key={item.title}
            style={[
              styles.dot,
              {
                backgroundColor:
                  i === index ? colors.primary : colors.border,
              },
            ]}
          />
        ))}
      </View>

      <Button
        title={index >= SLIDES.length - 1 ? 'Начать' : 'Далее'}
        onPress={handleNext}
      />
      <Button title="Пропустить" variant="ghost" onPress={finish} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  kicker: {
    ...typography.caption,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.title,
    marginBottom: spacing.sm,
  },
  copy: {
    ...typography.body,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
