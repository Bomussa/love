import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import Admin from './pages/Admin';
import { useSession } from './hooks/useSession';

export default function App() {
  const { session, isAdmin, ready } = useSession();

  if (!ready) return null;

  return (
    <Routes>
      <Route path="/" element={session ? <Home /> : <Navigate to="/login" />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/admin"
        element={isAdmin ? <Admin /> : <Navigate to="/404" />}
      />
      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
