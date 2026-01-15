import { Routes, Route, Navigate } from 'react-router-dom';
import { useSession } from './hooks/useSession';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';

export default function App() {
  const { session, isAdmin, ready } = useSession();

  if (!ready) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Arial, sans-serif' }}>
      جاري التحميل...
    </div>
  );

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
      
      {/* Protected Routes */}
      <Route path="/" element={session ? <Home /> : <Navigate to="/login" />} />

      {/* Protected Admin Routes */}
      <Route
        path="/admin/*"
        element={isAdmin ? <Admin /> : <Navigate to="/login" />}
      />

      {/* 404 Handling */}
      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
