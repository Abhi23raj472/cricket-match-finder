import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { WatchOptionDto } from '@cmf/shared';
import { api } from '../../src/api';
import { useAsync } from '../../src/hooks';
import { REGIONS, usePrefs } from '../../src/prefs';
import { useTheme } from '../../src/theme';
import { languageName, openWatchOption, withLocalSubscriptions } from '../../src/watch';
import { StateView } from '../../src/components/ui';

const TYPE: Record<WatchOptionDto['type'], string> = { OTT: 'Streaming app', TV: 'TV channel', FREE: 'Free-to-air' };

export default function WatchSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const { prefs } = usePrefs();
  const match = useAsync((sig) => api.match(id, sig), [id, prefs.region]);
  const [message, setMessage] = useState<string | null>(null);
  const options = useMemo(() => withLocalSubscriptions(match.data?.watchOptions ?? [], prefs.subscriptions), [match.data, prefs.subscriptions]);
  const country = REGIONS.find((r) => r.code === prefs.region)?.name ?? prefs.region;

  if (!match.data) return <StateView loading={match.loading} error={match.error} onRetry={match.reload} />;

  const open = async (o: WatchOptionDto) => {
    setMessage(null);
    try {
      const how = await openWatchOption(o);
      if (how === 'none') setMessage(`${o.name} is on TV. Check your TV guide for the channel.`);
    } catch {
      setMessage(`Couldn't open ${o.name}. Try opening the app yourself.`);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={s.body}>
      <Text style={[s.title, { color: t.text }]}>
        {match.data.homeTeam.name} v {match.data.awayTeam.name}
      </Text>
      <Text style={[s.sub, { color: t.muted }]}>Official broadcasters in {country}. You'll sign in on their app or site as usual.</Text>

      {options.length === 0 ? (
        <StateView empty={`We don't know of an official broadcaster for this match in ${country} yet.`} />
      ) : (
        options.map((o) => {
          const hasLink = Boolean(o.deepLink || o.webUrl || o.affiliateUrl);
          return (
            <Pressable
              key={`${o.broadcasterId}-${o.language}`}
              onPress={() => open(o)}
              accessibilityRole="button"
              accessibilityLabel={`${hasLink ? 'Open' : 'About'} ${o.name}, ${languageName(o.language)}`}
              style={({ pressed }) => [s.option, { backgroundColor: t.card, borderColor: o.isSubscribed ? t.accent : t.border, opacity: pressed ? 0.85 : 1 }]}
            >
              <View style={s.optionMain}>
                <Text style={[s.name, { color: t.text }]}>{o.name}</Text>
                <Text style={[s.meta, { color: t.muted }]}>
                  {TYPE[o.type]} · {languageName(o.language)}
                </Text>
                <View style={s.badges}>
                  {o.isSubscribed && <Text style={[s.badge, { backgroundColor: t.okBg, color: t.ok }]}>You have this</Text>}
                  {o.isFree && <Text style={[s.badge, { backgroundColor: t.okBg, color: t.ok }]}>Free</Text>}
                </View>
              </View>
              <Text style={[s.action, { color: hasLink ? t.accent : t.muted }]}>{hasLink ? 'Open' : 'On TV'}</Text>
            </Pressable>
          );
        })
      )}

      {message && <Text style={[s.message, { color: t.text }]}>{message}</Text>}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  body: { padding: 16, gap: 10, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '700' },
  sub: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
  option: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, padding: 14, gap: 12 },
  optionMain: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 4 },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  action: { fontSize: 15, fontWeight: '700' },
  message: { fontSize: 14, marginTop: 6 },
});
