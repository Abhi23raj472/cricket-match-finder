import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { MatchStatus } from '@cmf/shared';
import { api } from '../../src/api';
import { useAsync } from '../../src/hooks';
import { usePrefs } from '../../src/prefs';
import { useTheme } from '../../src/theme';
import { MatchCard } from '../../src/components/MatchCard';
import { Chip, Segmented, StateView } from '../../src/components/ui';

type Tab = 'live' | 'upcoming' | 'completed';
const TABS: [Tab, string][] = [
  ['live', 'Live'],
  ['upcoming', 'Upcoming'],
  ['completed', 'Results'],
];
const EMPTY: Record<Tab, string> = {
  live: 'No matches are live right now.',
  upcoming: 'No upcoming matches.',
  completed: 'No results yet.',
};

export default function Home() {
  const t = useTheme();
  const router = useRouter();
  const { prefs } = usePrefs();
  const [tab, setTab] = useState<Tab>('live');
  const [team, setTeam] = useState<string | undefined>();
  const [tournament, setTournament] = useState<string | undefined>();

  const teams = useAsync((sig) => api.teams(sig), []);
  const tournaments = useAsync((sig) => api.tournaments(sig), []);
  const matches = useAsync(
    (sig) => api.matches({ status: tab as MatchStatus, team, tournament, pageSize: 50 }, sig),
    [tab, team, tournament],
  );

  const favTeams = useMemo(
    () => (teams.data ?? []).filter((x) => prefs.favouriteTeams.includes(x.id)),
    [teams.data, prefs.favouriteTeams],
  );

  const items = matches.data?.items ?? [];

  return (
    <View style={[s.screen, { backgroundColor: t.bg }]}>
      <View style={s.controls}>
        <Segmented value={tab} options={TABS} onChange={setTab} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          <Chip label="All" selected={!team && !tournament} onPress={() => { setTeam(undefined); setTournament(undefined); }} />
          {favTeams.map((ft) => (
            <Chip key={ft.id} label={ft.name} selected={team === ft.id} onPress={() => { setTournament(undefined); setTeam(team === ft.id ? undefined : ft.id); }} />
          ))}
          {(tournaments.data ?? []).map((tr) => (
            <Chip key={tr.id} label={tr.name} selected={tournament === tr.id} onPress={() => { setTeam(undefined); setTournament(tournament === tr.id ? undefined : tr.id); }} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={items}
        keyExtractor={(m) => m.id}
        contentContainerStyle={s.list}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => <MatchCard match={item} onPress={() => router.push(`/match/${item.id}`)} />}
        refreshControl={<RefreshControl refreshing={matches.refreshing} onRefresh={matches.refresh} tintColor={t.accent} />}
        ListEmptyComponent={<StateView loading={matches.loading} error={matches.error} empty={EMPTY[tab]} onRetry={matches.reload} />}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  controls: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  chips: { gap: 8, paddingVertical: 2 },
  list: { padding: 16, paddingTop: 12 },
});
