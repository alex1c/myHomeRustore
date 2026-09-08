/**
 * In-app help — offline user guide for everyday home owners.
 */

import { Ionicons } from '@expo/vector-icons';
import { type Href, useRouter } from 'expo-router';
import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { appEnvironment } from '@/src/config/environment';
import {
  HELP_SECTIONS,
  HELP_SUBTITLE,
} from '@/src/content/helpGuide';
import { useThemeColors } from '@/src/theme/useThemeColors';
import { spacing, typography } from '@/src/theme/tokens';

export default function HelpScreen() {
  const colors = useThemeColors();
  const router = useRouter();

  return (
    <Screen scroll>
      {/* Stack header already shows «Как пользоваться»; keep an in-body title
          for clarity when scrolling long content. */}
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: colors.text }]}
      >
        Как пользоваться
      </Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {HELP_SUBTITLE}
      </Text>

      {HELP_SECTIONS.map((section) => (
        <Card key={section.id} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons
              name={section.icon as keyof typeof Ionicons.glyphMap}
              size={22}
              color={colors.primary}
              style={styles.sectionIcon}
            />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {section.title}
            </Text>
          </View>

          {section.paragraphs.map((paragraph) => (
            <Text
              key={paragraph}
              style={[styles.paragraph, { color: colors.textSecondary }]}
            >
              {paragraph}
            </Text>
          ))}

          {section.bullets && section.bullets.length > 0 ? (
            <View style={styles.bulletList}>
              {section.bullets.map((bullet) => (
                <View key={bullet} style={styles.bulletRow}>
                  <Text
                    style={[styles.bulletMark, { color: colors.primary }]}
                  >
                    •
                  </Text>
                  <Text
                    style={[styles.bulletText, { color: colors.textSecondary }]}
                  >
                    {bullet}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ))}

      <Pressable
        accessibilityRole="link"
        onPress={() => {
          void Linking.openURL(appEnvironment.privacyPolicyUrl);
        }}
        style={({ pressed }) => [
          styles.privacyLink,
          { opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[styles.privacyLabel, { color: colors.primary }]}>
          Политика конфиденциальности
        </Text>
      </Pressable>

      {/* Safe: onboarding only writes the completed flag; does not reset data. */}
      <View style={styles.replay}>
        <Button
          title="Посмотреть знакомство ещё раз"
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
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    marginBottom: spacing.md,
  },
  section: {
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  sectionIcon: {
    marginTop: 1,
  },
  sectionTitle: {
    ...typography.subtitle,
    flex: 1,
    flexShrink: 1,
  },
  paragraph: {
    ...typography.body,
    marginBottom: spacing.sm,
  },
  bulletList: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingRight: spacing.xs,
  },
  bulletMark: {
    ...typography.body,
    width: 18,
    fontWeight: '700',
  },
  bulletText: {
    ...typography.body,
    flex: 1,
    flexShrink: 1,
  },
  privacyLink: {
    minHeight: 44,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  privacyLabel: {
    ...typography.body,
    fontWeight: '600',
  },
  replay: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
});
