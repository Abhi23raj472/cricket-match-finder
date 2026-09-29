import { useState } from 'react';
import { adminKey } from './api';
import { KeyGate } from './pages/KeyGate';
import { BroadcastersPage } from './pages/BroadcastersPage';
import { RightsPage } from './pages/RightsPage';
import { GapsPage } from './pages/GapsPage';

type Tab = 'broadcasters' | 'rights' | 'gaps';
const TABS: [Tab, string][] = [
  ['broadcasters', 'Broadcasters'],
  ['rights', 'Rights'],
  ['gaps', 'Gaps'],
];

export function App() {
  const [unlocked, setUnlocked] = useState(() => Boolean(adminKey.get()));
  const [tab, setTab] = useState<Tab>('rights');

  if (!unlocked) return <KeyGate onUnlocked={() => setUnlocked(true)} />;

  return (
    <div className="shell">
      <header className="top">
        <span className="brand">Cricket Match Finder · Admin</span>
        <nav aria-label="Sections">
          {TABS.map(([id, label]) => (
            <button key={id} className={tab === id ? 'tab active' : 'tab'} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
        <button
          className="signout"
          onClick={() => {
            adminKey.clear();
            setUnlocked(false);
          }}
        >
          Lock
        </button>
      </header>
      <main>
        {tab === 'broadcasters' && <BroadcastersPage />}
        {tab === 'rights' && <RightsPage />}
        {tab === 'gaps' && <GapsPage onFix={() => setTab('rights')} />}
      </main>
    </div>
  );
}
