import { useEffect, useState } from 'react';
import { DEFAULT_REGION } from '@cmf/shared';

export function App() {
  const [health, setHealth] = useState<string>('checking…');

  useEffect(() => {
    fetch('/v1/health')
      .then((r) => r.json())
      .then((b) => setHealth(b.status))
      .catch(() => setHealth('API not reachable'));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>Cricket Match Finder — Admin</h1>
      <p>API status: {health}</p>
      <p>Default region: {DEFAULT_REGION}</p>
      <p>Broadcaster and rights management arrives in Step 5.</p>
    </main>
  );
}
