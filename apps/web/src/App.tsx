import { Link, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { MatchPage } from './pages/MatchPage';
import { TournamentsPage } from './pages/TournamentsPage';
import { TournamentPage } from './pages/TournamentPage';
import { PreferencesPage } from './pages/PreferencesPage';

function NotFound() {
  return (
    <div className="state">
      <h1>Page not found</h1>
      <p className="muted">
        <Link to="/" className="link">
          Back to matches
        </Link>
      </p>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="match/:id" element={<MatchPage />} />
        <Route path="tournaments" element={<TournamentsPage />} />
        <Route path="tournaments/:id" element={<TournamentPage />} />
        <Route path="preferences" element={<PreferencesPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
