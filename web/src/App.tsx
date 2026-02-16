import { Routes, Route } from 'react-router-dom';
import { LandingPage } from '@/pages/LandingPage';
import { GamesListPage } from '@/pages/GamesListPage';
import { SpectatorPage } from '@/pages/SpectatorPage';

/**
 * App - Main application with routing
 *
 * Routes:
 * - /           Landing page (dark theatrical intro)
 * - /games      Active games list with watchlist
 * - /games/:id  Spectator view (game canvas + logs)
 */
function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/games" element={<GamesListPage />} />
      <Route path="/games/:gameId" element={<SpectatorPage />} />
    </Routes>
  );
}

export default App;
