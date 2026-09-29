import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useAsync } from '../../src/hooks';
import { useTheme } from '../../src/theme';
import { StateView } from '../../src/components/ui';

const DATE = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export default function Tournaments() {
  const t = useTheme();
  const router = useRouter();
  const list = useAsync((sig) => api.tournaments(sig), []);

  return (
    <FlatList
      style={{ backgroundColor: t.bg }}
      data={list.data ?? []}
      keyExtractor={(x) => x.id}
      contentContainerStyle={s.list}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={t.accent} />}
      ListEmptyComponent={<StateView loading={list.loading} error={list.error} empty="No current or upcoming tournaments." onRetry={list.reload} />}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/tournament/${item.id}`)}
          accessibilityRole="button"
          style={({ pressed }) => [s.card, { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[s.name, { color: t.text }]}>{item.name}</Text>
          <Text style={[s.meta, { color: t.muted }]}>
            {item.format} · {DATE.format(new Date(item.startDate))} – {DATE.format(new Date(item.endDate))} · {item.matchCount} matches
          </Text>
          {item.liveCount > 0 && <Text style={[s.live, { color: t.live }]}>{item.liveCount} live now</Text>}
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  list: { padding: 16 },
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 4 },
  name: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 13 },
  live: { fontSize: 13, fontWeight: '600' },
});
