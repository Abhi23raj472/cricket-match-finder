import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '../src/api';
import { useAsync } from '../src/hooks';
import { REGIONS, usePrefs } from '../src/prefs';
import { useTheme } from '../src/theme';
import { Button, Chip, StateView } from '../src/components/ui';

type Step = 'region' | 'subscriptions' | 'teams';
const STEPS: Step[] = ['region', 'subscriptions', 'teams'];

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export default function Onboarding() {
  const t = useTheme();
  const router = useRouter();
  const { prefs, update } = usePrefs();
  const [step, setStep] = useState<Step>('region');
  const [region, setRegion] = useState(prefs.region);
  const [subs, setSubs] = useState<string[]>(prefs.subscriptions);
  const [teams, setTeams] = useState<string[]>(prefs.favouriteTeams);

  const broadcasters = useAsync((sig) => api.broadcasters(sig), []);
  const teamList = useAsync((sig) => api.teams(sig), []);

  const finish = async (save: boolean) => {
    await update(save ? { onboarded: true, region, subscriptions: subs, favouriteTeams: teams } : { onboarded: true });
    router.replace('/');
  };

  const index = STEPS.indexOf(step);
  const next = () => (index < STEPS.length - 1 ? setStep(STEPS[index + 1]) : finish(true));

  return (
    <SafeAreaView style={[s.screen, { backgroundColor: t.bg }]}>
      <View style={s.top}>
        <Text style={[s.progress, { color: t.muted }]}>
          Step {index + 1} of {STEPS.length}
        </Text>
        <Button label="Skip" kind="plain" onPress={() => finish(false)} />
      </View>

      <ScrollView contentContainerStyle={s.body}>
        {step === 'region' && (
          <>
            <Text style={[s.title, { color: t.text }]}>Where are you watching from?</Text>
            <Text style={[s.sub, { color: t.muted }]}>Broadcasters differ by country, so we show the ones available where you are.</Text>
            <View style={s.chips}>
              {REGIONS.map((r) => (
                <Chip key={r.code} label={r.name} selected={region === r.code} onPress={() => setRegion(r.code)} />
              ))}
            </View>
          </>
        )}

        {step === 'subscriptions' && (
          <>
            <Text style={[s.title, { color: t.text }]}>Which apps do you already pay for?</Text>
            <Text style={[s.sub, { color: t.muted }]}>We'll put matches you can watch first. You can change this later.</Text>
            {broadcasters.loading || broadcasters.error ? (
              <StateView loading={broadcasters.loading} error={broadcasters.error} onRetry={broadcasters.reload} />
            ) : (
              <View style={s.chips}>
                {(broadcasters.data ?? []).map((b) => (
                  <Chip key={b.id} label={b.name} selected={subs.includes(b.id)} onPress={() => setSubs((x) => toggle(x, b.id))} />
                ))}
              </View>
            )}
          </>
        )}

        {step === 'teams' && (
          <>
            <Text style={[s.title, { color: t.text }]}>Pick your favourite teams</Text>
            <Text style={[s.sub, { color: t.muted }]}>Quickly filter the match feed to the teams you follow.</Text>
            {teamList.loading || teamList.error ? (
              <StateView loading={teamList.loading} error={teamList.error} onRetry={teamList.reload} />
            ) : (
              <View style={s.chips}>
                {(teamList.data ?? []).map((tm) => (
                  <Chip key={tm.id} label={tm.name} selected={teams.includes(tm.id)} onPress={() => setTeams((x) => toggle(x, tm.id))} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={s.bottom}>
        {index > 0 && <Button label="Back" kind="plain" onPress={() => setStep(STEPS[index - 1])} />}
        <Button label={index === STEPS.length - 1 ? 'Done' : 'Next'} onPress={next} style={s.grow} />
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  progress: { fontSize: 13 },
  body: { padding: 20, gap: 10 },
  title: { fontSize: 24, fontWeight: '700' },
  sub: { fontSize: 15, lineHeight: 21, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bottom: { flexDirection: 'row', gap: 8, padding: 16 },
  grow: { flex: 1 },
});
