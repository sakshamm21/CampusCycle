import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Headline } from '../src/components/Headline.tsx';
import { Text } from '../src/components/Text.tsx';
import { useTheme } from '../src/theme/ThemeProvider.tsx';

export default function HomeScreen() {
  const { mode, themePreference, setTheme, c } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <View style={styles.content}>
        <Text variant="label" tone="muted" style={styles.kicker}>
          CAMPUSCYCLE · FOUNDATION
        </Text>

        <Headline text="hey *aanya*" size="xl" style={styles.headline} />

        <Headline text="ride *anywhere*" size="l" style={styles.subheadline} />

        <Text variant="body" tone="muted" style={styles.body}>
          Current theme: {mode} ({themePreference})
        </Text>

        <View style={styles.themeToggleRow}>
          {(['dark', 'day', 'system'] as const).map((pref) => {
            const isSelected = themePreference === pref;
            return (
              <TouchableOpacity
                key={pref}
                onPress={() => setTheme(pref)}
                style={[
                  styles.toggleButton,
                  {
                    backgroundColor: isSelected ? c.primary : c.surface2,
                    borderColor: c.border,
                  },
                ]}
              >
                <Text
                  variant="button"
                  style={{
                    color: isSelected ? c.onPrimary : c.fg,
                  }}
                >
                  {pref.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: 16,
  },
  kicker: {
    marginBottom: 8,
  },
  headline: {
    textAlign: 'center',
  },
  subheadline: {
    textAlign: 'center',
  },
  body: {
    marginTop: 8,
    textAlign: 'center',
  },
  themeToggleRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  toggleButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
  },
});
