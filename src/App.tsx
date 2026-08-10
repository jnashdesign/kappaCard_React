import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { publicCardPathWithSearch } from './lib/cardUrl';
import AdminPage from './pages/AdminPage';
import BrotherDetailPage from './pages/BrotherDetailPage';
import BrothersPage from './pages/BrothersPage';
import CompleteProfilePage from './pages/CompleteProfilePage';
import InvitesPage from './pages/InvitesPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import MetEncounterRedirect from './pages/MetEncounterRedirect';
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
  const { search } = useLocation();
  return <Navigate to={publicCardPathWithSearch(username ?? '', search)} replace />;
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
              path="brothers"
              element={
                <ProtectedRoute>
                  <BrothersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="brothers/:subjectUserId"
              element={
                <ProtectedRoute>
                  <BrotherDetailPage />
                </ProtectedRoute>
              }
            />
            <Route path="collected" element={<Navigate to="/brothers" replace />} />
            <Route path="met" element={<Navigate to="/brothers" replace />} />
            <Route
              path="met/:encounterId"
              element={
                <ProtectedRoute>
                  <MetEncounterRedirect />
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
