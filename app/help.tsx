/**
 * In-app help — short offline guide for everyday home owners.
 */

import { type Href, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { HELP_INTRO, HELP_SECTIONS } from '@/src/content/helpGuide';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing, typography } from '@/src/theme/tokens';

export default function HelpScreen() {
  const colors = useThemeColors();
  const router = useRouter();

  return (
    <Screen scroll>
      <Text style={[styles.title, { color: colors.text }]}>Как пользоваться</Text>
      <Text style={[styles.intro, { color: colors.textSecondary }]}>
        {HELP_INTRO}
      </Text>

      {HELP_SECTIONS.map((section) => (
        <Card key={section.id} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {section.title}
          </Text>
          {section.paragraphs.map((paragraph) => (
            <Text
              key={paragraph}
              style={[styles.paragraph, { color: colors.textSecondary }]}
            >
              {paragraph}
            </Text>
          ))}
        </Card>
      ))}

      {/* Safe: onboarding only writes the completed flag; does not reset user data. */}
      <View style={styles.replay}>
        <Button
          title="Посмотреть краткое знакомство"
          variant="secondary"
          onPress={() => router.push('/onboarding' as Href)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    marginBottom: spacing.sm,
  },
  intro: {
    ...typography.body,
    marginBottom: spacing.md,
  },
  section: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.subtitle,
    marginBottom: spacing.sm,
  },
  paragraph: {
    ...typography.body,
    marginBottom: spacing.sm,
  },
  replay: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
});
