// Component: App
// @env:prod
// Description: Componente principal da aplicação que gerencia a autenticação e navegação

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginForm } from './components/LoginForm';
import { ChannelList } from './components/ChannelList';
import { MovieList } from './components/MovieList';
import { SeriesList } from './components/SeriesList';
import { Settings } from './components/Settings';
import { Layout } from './components/Layout';
import { useAuth } from './lib/hooks/useAuth';
import './lib/i18n';

// #region Types
interface ProtectedRouteProps {
  children: React.ReactNode;
}
// #endregion

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/" /> : <LoginForm />} 
        />
        
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/live" replace />} />
          <Route path="live" element={<ChannelList />} />
          <Route path="movies" element={<MovieList />} />
          <Route path="series" element={<SeriesList />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;