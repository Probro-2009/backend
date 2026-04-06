import React from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import AuthPage from '@/pages/AuthPage';
import HomePage from '@/pages/HomePage';
import MessagesPage from '@/pages/MessagesPage';
import AIPage from '@/pages/AIPage';
import SettingsPage from '@/pages/SettingsPage';
import ProfilePage from '@/pages/ProfilePage';
import MainLayout from '@/components/MainLayout';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="loading-screen">
        <div className="text-center">
          <h1 className="font-heading text-3xl font-light tracking-tight text-foreground">T.P</h1>
          <p className="text-muted-foreground text-sm mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/ai" element={<AIPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile/:username" element={<ProfilePage />} />
        <Route path="/reels" element={
          <div className="flex items-center justify-center h-[80vh]" data-testid="reels-page">
            <div className="text-center">
              <h2 className="font-heading text-2xl font-medium text-foreground">Reels</h2>
              <p className="text-muted-foreground mt-2">Coming soon in V2</p>
            </div>
          </div>
        } />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
