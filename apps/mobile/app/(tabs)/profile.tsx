import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useAsync } from '../../src/hooks';
import { REGIONS, usePrefs } from '../../src/prefs';
import { useTheme } from '../../src/theme';
import { Button, Card, Chip, SectionTitle, StateView } from '../../src/components/ui';

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export default function Profile() {
  const t = useTheme();
  const router = useRouter();
  const { prefs, update, reset } = usePrefs();
  const broadcasters = useAsync((sig) => api.broadcasters(sig), []);
  const teams = useAsync((sig) => api.teams(sig), []);

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={s.body}>
      <Card>
        <Text style={[s.heading, { color: t.text }]}>Guest</Text>
        <Text style={[s.muted, { color: t.muted }]}>
          Your settings are saved on this phone. Signing in to keep them across devices and get match alerts is coming soon.
        </Text>
      </Card>

      <SectionTitle>Country</SectionTitle>
      <View style={s.chips}>
        {REGIONS.map((r) => (
          <Chip key={r.code} label={r.name} selected={prefs.region === r.code} onPress={() => update({ region: r.code })} />
        ))}
      </View>

      <SectionTitle>My subscriptions</SectionTitle>
      {broadcasters.data ? (
        <View style={s.chips}>
          {broadcasters.data.map((b) => (
            <Chip key={b.id} label={b.name} selected={prefs.subscriptions.includes(b.id)} onPress={() => update({ subscriptions: toggle(prefs.subscriptions, b.id) })} />
          ))}
        </View>
      ) : (
        <StateView loading={broadcasters.loading} error={broadcasters.error} onRetry={broadcasters.reload} />
      )}

      <SectionTitle>Favourite teams</SectionTitle>
      {teams.data ? (
        <View style={s.chips}>
          {teams.data.map((tm) => (
            <Chip key={tm.id} label={tm.name} selected={prefs.favouriteTeams.includes(tm.id)} onPress={() => update({ favouriteTeams: toggle(prefs.favouriteTeams, tm.id) })} />
          ))}
        </View>
      ) : (
        <StateView loading={teams.loading} error={teams.error} onRetry={teams.reload} />
      )}

      <SectionTitle>Alerts</SectionTitle>
      <Text style={[s.muted, { color: t.muted }]}>Toss, wicket and result alerts arrive with sign-in.</Text>

      <Button
        label="Reset and run setup again"
        kind="plain"
        style={s.reset}
        onPress={async () => {
          await reset();
          router.replace('/onboarding');
        }}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  body: { padding: 16, paddingBottom: 40 },
  heading: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  muted: { fontSize: 14, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reset: { marginTop: 28 },
});
