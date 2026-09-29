import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MatchSummaryDto, TeamDto } from '@cmf/shared';
import { formatWhen, scoreText, teamScore } from '../format';
import { useTheme } from '../theme';
import { StatusPill } from './ui';

export function MatchCard({ match, onPress, showTournament = true }: { match: MatchSummaryDto; onPress: () => void; showTournament?: boolean }) {
  const t = useTheme();
  const row = (team: TeamDto) => {
    const sc = teamScore(match, team);
    return (
      <View style={s.teamRow}>
        <Text style={[s.team, { color: t.text }]} numberOfLines={1}>
          {team.name}
        </Text>
        <Text style={[s.score, { color: sc ? t.text : t.muted }]}>{sc ? scoreText(sc) : match.status === 'upcoming' ? '' : 'Yet to bat'}</Text>
      </View>
    );
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${match.homeTeam.name} versus ${match.awayTeam.name}, ${match.status}`}
      style={({ pressed }) => [s.card, { backgroundColor: t.card, borderColor: t.border, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={s.head}>
        <Text style={[s.meta, { color: t.muted }]} numberOfLines={1}>
          {[match.matchNo, showTournament ? match.tournament.name : null].filter(Boolean).join(' · ')}
        </Text>
        <StatusPill status={match.status} />
      </View>
      {row(match.homeTeam)}
      {row(match.awayTeam)}
      <Text style={[s.foot, { color: match.status === 'completed' ? t.ok : t.muted }]} numberOfLines={2}>
        {match.status === 'completed' || match.status === 'abandoned'
          ? match.resultText ?? 'No result'
          : match.status === 'live'
            ? `${match.venue.city}`
            : `${formatWhen(match.startTimeUtc)} · ${match.venue.city}`}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 2 },
  meta: { fontSize: 12, flex: 1 },
  teamRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  team: { fontSize: 16, fontWeight: '600', flex: 1 },
  score: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  foot: { fontSize: 13, marginTop: 4 },
});
