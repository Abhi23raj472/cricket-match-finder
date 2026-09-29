import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { useAsync } from '../../src/hooks';
import { useTheme } from '../../src/theme';
import { MatchCard } from '../../src/components/MatchCard';
import { Card, Segmented, StateView } from '../../src/components/ui';

type Tab = 'fixtures' | 'standings' | 'results';

export default function TournamentPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('fixtures');
  const detail = useAsync((sig) => api.tournament(id, sig), [id]);
  const matches = useAsync((sig) => api.matches({ tournament: id, pageSize: 100 }, sig), [id]);

  const all = matches.data?.items ?? [];
  const fixtures = all.filter((m) => m.status === 'live' || m.status === 'upcoming');
  const results = all.filter((m) => m.status === 'completed' || m.status === 'abandoned').reverse();

  return (
    <View style={[s.screen, { backgroundColor: t.bg }]}>
      <Stack.Screen options={{ title: detail.data?.name ?? 'Tournament' }} />
      <View style={s.controls}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            ['fixtures', 'Fixtures'],
            ['standings', 'Table'],
            ['results', 'Results'],
          ]}
        />
      </View>

      {tab === 'standings' ? (
        detail.data ? (
          <ScrollView contentContainerStyle={s.body}>
            <Card>
              <View style={[s.row, { borderBottomColor: t.border }]}>
                {['Team', 'P', 'W', 'L', 'NR', 'Pts', 'NRR'].map((h, i) => (
                  <Text key={h} style={[i === 0 ? s.teamCell : s.cell, s.head, { color: t.muted }, h === 'NRR' && s.wide]}>
                    {h}
                  </Text>
                ))}
              </View>
              {detail.data.standings.map((r, i) => (
                <View key={r.team.id} style={[s.row, { borderBottomColor: t.border }]}>
                  <Text style={[s.teamCell, { color: t.text }]} numberOfLines={1}>
                    {i + 1}. {r.team.name}
                  </Text>
                  <Text style={[s.cell, { color: t.text }]}>{r.played}</Text>
                  <Text style={[s.cell, { color: t.text }]}>{r.won}</Text>
                  <Text style={[s.cell, { color: t.text }]}>{r.lost}</Text>
                  <Text style={[s.cell, { color: t.text }]}>{r.tied + r.noResult}</Text>
                  <Text style={[s.cell, s.bold, { color: t.text }]}>{r.points}</Text>
                  <Text style={[s.cell, s.wide, { color: t.text }]}>{(r.netRunRate >= 0 ? '+' : '') + r.netRunRate.toFixed(3)}</Text>
                </View>
              ))}
            </Card>
            <Text style={[s.note, { color: t.muted }]}>Win 2 points, tie or no result 1. Level teams are split by net run rate.</Text>
          </ScrollView>
        ) : (
          <StateView loading={detail.loading} error={detail.error} onRetry={detail.reload} />
        )
      ) : (
        <FlatList
          data={tab === 'fixtures' ? fixtures : results}
          keyExtractor={(m) => m.id}
          contentContainerStyle={s.body}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => <MatchCard match={item} showTournament={false} onPress={() => router.push(`/match/${item.id}`)} />}
          ListEmptyComponent={
            <StateView loading={matches.loading} error={matches.error} empty={tab === 'fixtures' ? 'No fixtures left.' : 'No results yet.'} onRetry={matches.reload} />
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  controls: { paddingHorizontal: 16, paddingTop: 12 },
  body: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  teamCell: { flex: 1, fontSize: 14, fontWeight: '600' },
  cell: { width: 30, fontSize: 14, textAlign: 'right', fontVariant: ['tabular-nums'] },
  wide: { width: 58 },
  head: { fontSize: 11, fontWeight: '700' },
  bold: { fontWeight: '700' },
  note: { fontSize: 12, marginTop: 10 },
});
