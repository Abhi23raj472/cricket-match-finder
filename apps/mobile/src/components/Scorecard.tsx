import { StyleSheet, Text, View } from 'react-native';
import type { InningsDto, TeamDto } from '@cmf/shared';
import { economy, scoreText, strikeRate } from '../format';
import { useTheme } from '../theme';
import { Card } from './ui';

export function Scorecard({ innings, teams }: { innings: InningsDto; teams: TeamDto[] }) {
  const t = useTheme();
  const team = teams.find((x) => x.id === innings.battingTeamId);
  const cell = (text: string | number, style?: object) => <Text style={[s.cell, { color: t.text }, style]}>{text}</Text>;
  const head = (text: string, style?: object | object[]) => <Text style={[s.cell, s.head, { color: t.muted }, style]}>{text}</Text>;

  return (
    <Card style={s.card}>
      <View style={s.title}>
        <Text style={[s.titleText, { color: t.text }]}>{team?.name ?? 'Innings'}</Text>
        <Text style={[s.titleText, { color: t.text }]}>{scoreText(innings)}</Text>
      </View>

      <View style={[s.row, { borderBottomColor: t.border }]}>
        {head('Batter', [s.name, s.left])}
        {head('R')}
        {head('B')}
        {head('4s')}
        {head('6s')}
        {head('SR', s.wide)}
      </View>
      {innings.batting.map((b, i) => (
        <View key={`${b.name}-${i}`} style={[s.row, { borderBottomColor: t.border }]}>
          <View style={s.name}>
            <Text style={[s.cell, s.left, { color: t.text, fontWeight: b.dismissal ? '400' : '600' }]} numberOfLines={1}>
              {b.name}
              {b.dismissal ? '' : '*'}
            </Text>
            <Text style={[s.small, { color: t.muted }]} numberOfLines={1}>
              {b.dismissal ?? 'not out'}
            </Text>
          </View>
          {cell(b.runs, s.bold)}
          {cell(b.balls)}
          {cell(b.fours)}
          {cell(b.sixes)}
          {cell(strikeRate(b.runs, b.balls), s.wide)}
        </View>
      ))}

      {innings.bowling.length > 0 && (
        <>
          <View style={[s.row, s.gap, { borderBottomColor: t.border }]}>
            {head('Bowler', [s.name, s.left])}
            {head('O')}
            {head('M')}
            {head('R')}
            {head('W')}
            {head('Econ', s.wide)}
          </View>
          {innings.bowling.map((b, i) => (
            <View key={`${b.name}-${i}`} style={[s.row, { borderBottomColor: t.border }]}>
              <Text style={[s.cell, s.left, s.name, { color: t.text }]} numberOfLines={1}>
                {b.name}
              </Text>
              {cell(b.overs)}
              {cell(b.maidens)}
              {cell(b.runs)}
              {cell(b.wickets, s.bold)}
              {cell(economy(b.runs, b.overs), s.wide)}
            </View>
          ))}
        </>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  card: { paddingVertical: 10 },
  title: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  titleText: { fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth },
  gap: { marginTop: 12 },
  name: { flex: 1, minWidth: 0 },
  cell: { width: 32, fontSize: 13, textAlign: 'right', fontVariant: ['tabular-nums'] },
  wide: { width: 48 },
  left: { width: 'auto', textAlign: 'left' },
  head: { fontSize: 11, fontWeight: '700' },
  bold: { fontWeight: '700' },
  small: { fontSize: 11, marginTop: 1 },
});
