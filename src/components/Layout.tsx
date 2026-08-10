import { useEffect, useId, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canUseCardFeatures } from '../lib/users';
import './Layout.css';

export default function Layout() {
  const { profile, logout, firebaseUser } = useAuth();
  const unlocked = canUseCardFeatures(profile);
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const navId = useId();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  async function onLogout() {
    closeMenu();
    await logout();
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-row">
          <Link to={firebaseUser && profile ? '/my-card' : '/'} className="brand" onClick={closeMenu}>
            <span className="brand-name">MyKappaCard.com</span>
          </Link>

          <button
            type="button"
            className={`menu-toggle${menuOpen ? ' is-open' : ''}`}
            aria-expanded={menuOpen}
            aria-controls={navId}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        {menuOpen && (
          <button
            type="button"
            className="nav-backdrop"
            aria-label="Close menu"
            onClick={closeMenu}
          />
        )}

        <nav id={navId} className={`nav${menuOpen ? ' is-open' : ''}`}>
          {firebaseUser && profile ? (
            <>
              <NavLink to="/" onClick={closeMenu}>
                Home
              </NavLink>

              <NavLink to="/my-card" onClick={closeMenu}>
                My Card
              </NavLink>

              <NavLink to="/brothers" onClick={closeMenu}>
                Brothers
              </NavLink>

              {profile.username ? (
                <NavLink to={`/card/${profile.username}`} onClick={closeMenu}>
                  MyProfile
                </NavLink>
              ) : (
                <NavLink to="/profile" onClick={closeMenu}>
                  My Profile
                </NavLink>
              )}
              {unlocked && (
                <NavLink to="/invites" onClick={closeMenu}>
                  My Invites
                </NavLink>
              )}
              {!unlocked && (
                <NavLink to="/pricing" onClick={closeMenu}>
                  Upgrade
                </NavLink>
              )}
              {profile.admin && (
                <NavLink to="/admin" onClick={closeMenu}>
                  Admin Dashboard
                </NavLink>
              )}
              <button type="button" className="primary" onClick={() => void onLogout()}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/" onClick={closeMenu}>
                Home
              </NavLink>

              <NavLink to="/pricing" onClick={closeMenu}>
                Pricing
              </NavLink>
              {location.pathname !== '/login' && (
                <NavLink
                  style={{
                    backgroundColor: 'white',
                    color: 'var(--crimson)',
                    borderRadius: '99px',
                    border: '1px solid var(--crimson)',
                    padding: '10px 20px',
                  }}
                  to="/login"
                  onClick={closeMenu}
                >
                  Sign in
                </NavLink>
              )}
              {location.pathname !== '/request-invite' && location.pathname !== '/signup' && (
                <NavLink
                  style={{
                    backgroundColor: 'var(--crimson)',
                    color: 'white',
                    borderRadius: '99px',
                    padding: '10px 20px',
                  }}
                  to="/request-invite"
                  className="nav-cta"
                  onClick={closeMenu}
                >
                  Get started
                </NavLink>
              )}
              {location.pathname === '/request-invite' && (
                <NavLink
                  style={{
                    backgroundColor: 'var(--crimson)',
                    color: 'white',
                    borderRadius: '99px',
                    padding: '10px 20px',
                  }}
                  to="/signup"
                  onClick={closeMenu}
                >
                  I have an invite
                </NavLink>
              )}
              {location.pathname === '/signup' && (
                <NavLink
                  style={{
                    backgroundColor: 'var(--crimson)',
                    color: 'white',
                    borderRadius: '99px',
                    padding: '10px 20px',
                  }}
                  to="/request-invite"
                  onClick={closeMenu}
                >
                  Request an invite
                </NavLink>
              )}
            </>
          )}
        </nav>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <footer className="footer">
        <p>&copy; MyKappaCard {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
