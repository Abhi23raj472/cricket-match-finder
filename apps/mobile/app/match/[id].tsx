import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { TeamDto } from '@cmf/shared';
import { api } from '../../src/api';
import { chaseText, formatWhen, scoreText } from '../../src/format';
import { useAsync, useLiveScore } from '../../src/hooks';
import { usePrefs } from '../../src/prefs';
import { useTheme } from '../../src/theme';
import { withLocalSubscriptions } from '../../src/watch';
import { Scorecard } from '../../src/components/Scorecard';
import { Button, Card, Segmented, SectionTitle, StateView, StatusPill } from '../../src/components/ui';

export default function MatchDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const router = useRouter();
  const { prefs } = usePrefs();
  const match = useAsync((sig) => api.match(id, sig), [id, prefs.region]);
  const m = match.data;
  const { score, connection } = useLiveScore(id, m?.live, m?.status);
  const [inningsIdx, setInningsIdx] = useState<number | null>(null);

  const status = score?.status ?? m?.status;
  const innings = score?.innings ?? [];
  const teams: TeamDto[] = m ? [m.homeTeam, m.awayTeam] : [];
  const teamName = (tid: string) => teams.find((x) => x.id === tid)?.name ?? '';
  const scoreFor = (team: TeamDto) => innings.filter((i) => i.battingTeamId === team.id).at(-1);
  const options = useMemo(() => withLocalSubscriptions(m?.watchOptions ?? [], prefs.subscriptions), [m?.watchOptions, prefs.subscriptions]);

  if (!m) {
    return (
      <View style={[s.screen, { backgroundColor: t.bg }]}>
        <StateView loading={match.loading} error={match.error} onRetry={match.reload} />
      </View>
    );
  }

  const shownInnings = inningsIdx ?? innings.length - 1;
  const chase = status === 'live' ? chaseText(innings, teamName) : null;
  const best = options[0];
  const watchLabel = options.length === 0 ? 'Where to watch' : best.isSubscribed ? `Watch on ${best.name}` : `Watch on ${best.name}${options.length > 1 ? ` +${options.length - 1}` : ''}`;

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={s.body}
      refreshControl={<RefreshControl refreshing={match.refreshing} onRefresh={match.refresh} tintColor={t.accent} />}
    >
      <Stack.Screen options={{ title: `${m.homeTeam.shortCode} v ${m.awayTeam.shortCode}` }} />

      <Card>
        <View style={s.headRow}>
          <Text style={[s.meta, { color: t.muted }]} numberOfLines={1}>
            {[m.matchNo, m.tournament.name].filter(Boolean).join(' · ')}
          </Text>
          {status && <StatusPill status={status} />}
        </View>
        {teams.map((team) => {
          const sc = scoreFor(team);
          return (
            <View key={team.id} style={s.teamRow}>
              <Text style={[s.team, { color: t.text }]}>{team.name}</Text>
              <Text style={[s.bigScore, { color: sc ? t.text : t.muted }]}>{sc ? scoreText(sc) : status === 'upcoming' ? '' : 'Yet to bat'}</Text>
            </View>
          );
        })}
        <Text style={[s.note, { color: status === 'completed' ? t.ok : t.muted }]}>
          {status === 'completed' || status === 'abandoned'
            ? (m.resultText ?? 'No result')
            : chase ?? (status === 'upcoming' ? formatWhen(m.startTimeUtc) : score?.tossText ?? m.venue.name)}
        </Text>
        <Text style={[s.venue, { color: t.muted }]}>
          {m.venue.name}, {m.venue.city}
        </Text>
        {status === 'live' && connection === 'reconnecting' && <Text style={[s.venue, { color: t.muted }]}>Reconnecting to live updates…</Text>}
      </Card>

      <Button label={watchLabel} onPress={() => router.push(`/watch/${m.id}`)} style={s.watch} />

      {status === 'live' && score && (
        <>
          <SectionTitle>At the crease</SectionTitle>
          <Card>
            {score.currentBatters.map((b, i) => (
              <View key={`${b.name}-${i}`} style={s.lineRow}>
                <Text style={[s.line, { color: t.text }]}>
                  {b.name}
                  {i === 0 ? ' *' : ''}
                </Text>
                <Text style={[s.line, { color: t.text }]}>
                  {b.runs} ({b.balls})
                </Text>
              </View>
            ))}
            {score.currentBowler && (
              <View style={s.lineRow}>
                <Text style={[s.line, { color: t.muted }]}>{score.currentBowler.name}</Text>
                <Text style={[s.line, { color: t.muted }]}>
                  {score.currentBowler.wickets}-{score.currentBowler.runs} ({score.currentBowler.overs})
                </Text>
              </View>
            )}
            {score.lastSixBalls.length > 0 && (
              <View style={s.balls} accessibilityLabel={`Last balls: ${score.lastSixBalls.join(', ')}`}>
                {score.lastSixBalls.map((b, i) => (
                  <View key={i} style={[s.ball, { backgroundColor: b === 'W' ? t.wicket : b === '4' || b === '6' ? t.boundary : t.chip }]}>
                    <Text style={[s.ballText, { color: b === 'W' || b === '4' || b === '6' ? '#fff' : t.text }]}>{b === '0' ? '•' : b}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </>
      )}

      {innings.length > 0 && (
        <>
          <SectionTitle>Scorecard</SectionTitle>
          {innings.length > 1 && (
            <View style={{ marginBottom: 10 }}>
              <Segmented
                value={String(shownInnings)}
                options={innings.map((inn, i) => [String(i), m.homeTeam.id === inn.battingTeamId ? m.homeTeam.shortCode : m.awayTeam.shortCode])}
                onChange={(v) => setInningsIdx(Number(v))}
              />
            </View>
          )}
          <Scorecard innings={innings[shownInnings]} teams={teams} />
        </>
      )}

      {score && score.commentary.length > 0 && (
        <>
          <SectionTitle>Commentary</SectionTitle>
          <Card>
            {score.commentary.slice(0, 20).map((c, i) => (
              <View key={`${c.over}-${i}`} style={[s.comm, i > 0 && { borderTopColor: t.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <Text style={[s.over, { color: t.muted }]}>{c.over}</Text>
                <Text style={[s.commText, { color: t.text }]}>{c.text}</Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: 16, paddingBottom: 40 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 },
  meta: { fontSize: 12, flex: 1 },
  teamRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  team: { fontSize: 18, fontWeight: '700', flex: 1 },
  bigScore: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  note: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  venue: { fontSize: 12, marginTop: 4 },
  watch: { marginTop: 14 },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  line: { fontSize: 15, fontVariant: ['tabular-nums'] },
  balls: { flexDirection: 'row', gap: 6, marginTop: 10 },
  ball: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  ballText: { fontSize: 13, fontWeight: '700' },
  comm: { flexDirection: 'row', gap: 12, paddingVertical: 8 },
  over: { width: 36, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  commText: { flex: 1, fontSize: 14, lineHeight: 20 },
});
