import { View, Text, StyleSheet } from 'react-native';
import { DEFAULT_TIMEZONE } from '@cmf/shared';

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Match feed</Text>
      <Text>Live, Upcoming and Results tabs arrive in Step 6.</Text>
      <Text>Times shown in {DEFAULT_TIMEZONE}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  title: { fontSize: 22, fontWeight: '600' },
});
