import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { MatchStatus } from '@cmf/shared';
import { useTheme } from '../theme';

export function StatusPill({ status }: { status: MatchStatus }) {
  const t = useTheme();
  if (status === 'live') {
    return (
      <View style={[s.pill, { backgroundColor: t.liveBg }]} accessibilityLabel="Live">
        <View style={[s.dot, { backgroundColor: t.live }]} />
        <Text style={[s.pillText, { color: t.live }]}>LIVE</Text>
      </View>
    );
  }
  const label = status === 'completed' ? 'Result' : status === 'abandoned' ? 'Abandoned' : 'Upcoming';
  return (
    <View style={[s.pill, { backgroundColor: t.chip }]}>
      <Text style={[s.pillText, { color: t.muted }]}>{label}</Text>
    </View>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View style={[s.segmented, { backgroundColor: t.chip }]} accessibilityRole="tablist">
      {options.map(([v, label]) => {
        const active = v === value;
        return (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[s.segment, active && { backgroundColor: t.card }]}
          >
            <Text style={[s.segmentText, { color: active ? t.text : t.muted }, active && s.bold]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[s.chip, { backgroundColor: selected ? t.accent : t.chip }]}
    >
      <Text style={[s.chipText, { color: selected ? t.accentText : t.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Button({ label, onPress, kind = 'primary', disabled, style }: { label: string; onPress: () => void; kind?: 'primary' | 'plain'; disabled?: boolean; style?: ViewStyle }) {
  const t = useTheme();
  const primary = kind === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.button,
        { backgroundColor: primary ? t.accent : 'transparent', opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Text style={[s.buttonText, { color: primary ? t.accentText : t.accent }]}>{label}</Text>
    </Pressable>
  );
}

/** Loading spinner, error with retry, or empty message. */
export function StateView({ loading, error, empty, onRetry }: { loading?: boolean; error?: string | null; empty?: string; onRetry?: () => void }) {
  const t = useTheme();
  if (loading) {
    return (
      <View style={s.state}>
        <ActivityIndicator color={t.accent} accessibilityLabel="Loading" />
      </View>
    );
  }
  if (error) {
    return (
      <View style={s.state}>
        <Text style={[s.stateText, { color: t.text }]}>{error}</Text>
        {onRetry && <Button label="Try again" kind="plain" onPress={onRetry} />}
      </View>
    );
  }
  return (
    <View style={s.state}>
      <Text style={[s.stateText, { color: t.muted }]}>{empty}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[s.card, { backgroundColor: t.card, borderColor: t.border }, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={[s.section, { color: t.muted }]}>{children}</Text>;
}

const s = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, alignSelf: 'flex-start' },
  pillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  segmented: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentText: { fontSize: 14 },
  bold: { fontWeight: '600' },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  chipText: { fontSize: 13, fontWeight: '500' },
  button: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center' },
  buttonText: { fontSize: 15, fontWeight: '600' },
  state: { padding: 32, alignItems: 'center', gap: 12 },
  stateText: { fontSize: 15, textAlign: 'center' },
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  section: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 20, marginBottom: 8 },
});
