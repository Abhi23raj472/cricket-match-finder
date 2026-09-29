import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, useColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { PrefsProvider, usePrefs } from '../src/prefs';
import { useTheme } from '../src/theme';

/** Sends first-time users to onboarding; everyone else to the app. */
function Gate() {
  const { prefs, loaded } = usePrefs();
  const segments = useSegments();
  const router = useRouter();
  const t = useTheme();
  const scheme = useColorScheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = { ...base, colors: { ...base.colors, background: t.bg, card: t.card, text: t.text, border: t.border, primary: t.accent } };

  useEffect(() => {
    if (!loaded) return;
    const inOnboarding = segments[0] === 'onboarding';
    if (!prefs.onboarded && !inOnboarding) router.replace('/onboarding');
  }, [loaded, prefs.onboarded, segments, router]);

  if (!loaded) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.card },
          headerTintColor: t.text,
          contentStyle: { backgroundColor: t.bg },
          headerBackTitle: 'Back',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="match/[id]" options={{ title: 'Match' }} />
        <Stack.Screen name="tournament/[id]" options={{ title: 'Tournament' }} />
        <Stack.Screen name="watch/[id]" options={{ title: 'Watch on', presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <PrefsProvider>
      <Gate />
    </PrefsProvider>
  );
}
