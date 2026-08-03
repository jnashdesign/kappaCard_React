import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import AdminPage from './pages/AdminPage';
import CollectedPage from './pages/CollectedPage';
import CompleteProfilePage from './pages/CompleteProfilePage';
import InvitesPage from './pages/InvitesPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import MyCardPage from './pages/MyCardPage';
import PricingPage from './pages/PricingPage';
import ProfilePage from './pages/ProfilePage';
import PublicCardPage from './pages/PublicCardPage';
import RequestInvitePage from './pages/RequestInvitePage';
import SignupPage from './pages/SignupPage';
import UpgradePage from './pages/UpgradePage';
import UpgradeSuccessPage from './pages/UpgradeSuccessPage';

function LegacyKardRedirect() {
  const { username } = useParams();
  return <Navigate to={`/card/${username ?? ''}`} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<LandingPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="signup" element={<SignupPage />} />
            <Route path="request-invite" element={<RequestInvitePage />} />
            <Route path="pricing" element={<PricingPage />} />
            <Route path="card/:username" element={<PublicCardPage />} />
            {/* Keep old /kard links working */}
            <Route path="kard/:username" element={<LegacyKardRedirect />} />

            <Route
              path="complete-profile"
              element={
                <ProtectedRoute>
                  <CompleteProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="dashboard"
              element={<Navigate to="/my-card" replace />}
            />
            <Route
              path="profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="my-card"
              element={
                <ProtectedRoute>
                  <MyCardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="collected"
              element={
                <ProtectedRoute>
                  <CollectedPage />
                </ProtectedRoute>
              }
            />
            <Route path="my-kard" element={<Navigate to="/my-card" replace />} />
            <Route
              path="invites"
              element={
                <ProtectedRoute>
                  <InvitesPage />
                </ProtectedRoute>
              }
            />
            <Route path="requests" element={<Navigate to="/my-card" replace />} />
            <Route
              path="upgrade"
              element={
                <ProtectedRoute>
                  <UpgradePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="upgrade/success"
              element={
                <ProtectedRoute>
                  <UpgradeSuccessPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin"
              element={
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
