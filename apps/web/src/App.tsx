import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './lib/auth-context';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DataRoomsPage } from './pages/DataRoomsPage';
import { DataRoomDetailPage } from './pages/DataRoomDetailPage';
import { PublicSharePage } from './pages/PublicSharePage';
import { ProtectedRoute } from './components/ProtectedRoute';

const App = () => {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/share/:token" element={<PublicSharePage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DataRoomsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/data-rooms/:id"
              element={
                <ProtectedRoute>
                  <DataRoomDetailPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
};

export default App;
