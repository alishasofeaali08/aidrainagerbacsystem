import React, { useEffect, useState } from 'react';
import './style.css';
import { req } from './components/shared.jsx';

import FloodWeatherPage from './pages/FloodWeatherPage.jsx';
import CameraAnalysisPage from './pages/CameraAnalysisPage.jsx';
import AIDetectionPage from './pages/AIDetectionPage.jsx';
import AdminPage from './pages/AdminPage.jsx';

import {
  Overview, RewardPopup, ReportsTab, EngineerCases, TechnicianCases, TechLeaderboard, RewardsCard,
  FloodMap, WeatherRisk, AICameraSystem, AnalysisTab, CameraNode, IcScanner
} from './components/index.jsx';
import { Users } from './components/adminComponents.jsx';

function Logo({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="14" fill="#0D2535" />
      <ellipse cx="32" cy="36" rx="18" ry="13" fill="#1B8CA8" />
      <circle cx="32" cy="36" r="8" fill="#0D2535" />
      <circle cx="32" cy="36" r="5" fill="#1B8CA8" />
      <circle cx="32" cy="36" r="2.5" fill="#E8A020" />
      <path d="M22 36 Q32 20 42 36" stroke="#EBF4F7" strokeWidth="1.5" fill="none" />
      <path d="M26 19 Q28 14 30 19" stroke="#1B8CA8" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M32 16 Q34 10 36 16" stroke="#1B8CA8" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function App() {
  const [cameras, setCameras] = useState([]);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [email, E] = useState('admin@example.com');
  const [password, P] = useState('Admin123!');
  const [showReg, SR] = useState(false);

  const [rName, RN] = useState('');
  const [rEmail, RE] = useState('');
  const [rPw, RP] = useState('');
  const [rIc, RI] = useState('');

  const [tab, T] = useState('dashboard');
  const [exploreSection, SE] = useState('flood');
  const [reports, R] = useState([]);
  const [flood, F] = useState([]);
  const [users, U] = useState([]);

  const [error, X] = useState('');
  const [msg, M] = useState('');
  const [reward, setReward] = useState(null);

  function checkRewards(me, reps) {
    if (me.role !== 'citizen') return;

    const key = `seenRewards_${me.id}`;
    const raw = localStorage.getItem(key);
    const now = {};

    reps.forEach(r => {
      if (r.reward_points > 0) now[r.id] = r.reward_points;
    });

    localStorage.setItem(key, JSON.stringify(now));

    if (raw === null) return;

    const seen = JSON.parse(raw);
    const items = reps
      .filter(r => (now[r.id] || 0) > (seen[r.id] || 0))
      .map(r => ({
        id: r.id,
        pts: now[r.id] - (seen[r.id] || 0),
        status: r.status
      }));

    if (!items.length) return;

    const gained = items.reduce((s, i) => s + i.pts, 0);
    const prevLevel = 1 + Math.floor(((me.points || 0) - gained) / 100);

    setReward({
      items,
      gained,
      total: me.points || 0,
      level: me.level || 1,
      levelUp: (me.level || 1) > prevLevel
    });
  }

  async function refresh() {
    try {
      const reportRoles = ['admin', 'engineer', 'technician', 'citizen'];
      const mapRoles = ['admin', 'engineer', 'technician', 'citizen'];

      const reps = reportRoles.includes(user.role) ? await req('/reports') : [];
      R(reps);

      F(mapRoles.includes(user.role) ? await req('/map/flood') : []);

      if (['admin', 'engineer', 'technician'].includes(user.role)) {
        setCameras(await req('/ai-cameras'));
      } else {
        setCameras([]);
      }

      if (user.role === 'admin') {
        U(await req('/admin/users'));
      }

      const me = await req('/auth/me');
      localStorage.setItem('user', JSON.stringify(me));
      setUser(me);

      checkRewards(me, reps);
      X('');
    } catch (e) {
      X(e.message);
    }
  }

  useEffect(() => {
    if (user) refresh();
  }, [user?.id]);

  useEffect(() => {
    if (user?.role !== 'citizen') return;

    const t = setInterval(async () => {
      try {
        const reps = await req('/reports');
        const me = await req('/auth/me');

        R(reps);
        localStorage.setItem('user', JSON.stringify(me));
        setUser(me);
        checkRewards(me, reps);
      } catch {
        // Ignore background refresh errors.
      }
    }, 30000);

    return () => clearInterval(t);
  }, [user?.id, user?.role]);

  async function act(fn, ok = 'Updated') {
    try {
      await fn();
      M(ok);
      await refresh();
    } catch (e) {
      X(e.message);
    }
  }

  if (!user) {
    return (
      <div className="login">
        <div className="login-card" style={showReg ? { maxWidth: 460 } : {}}>
          <div className="login-brand">
            <Logo size={44} />
            <div className="login-brand-text">
              <span>Air-Eyes</span>
              <span>Mata untuk setiap longkang</span>
            </div>
          </div>

          {showReg ? (
            <>
              <p style={{ fontWeight: 600, color: 'var(--navy)', fontSize: 15, margin: 0 }}>
                Create Citizen Account
              </p>

              <p style={{ fontSize: 13, color: 'var(--gray3)', margin: 0 }}>
                Fill in your details to register. All fields are required.
              </p>

              <IcScanner onResult={({ name, ic }) => {
                if (name) RN(name);
                if (ic) RI(ic);
              }} />

              <div className="form-field">
                <label>Full Name (as per IC)</label>
                <input
                  value={rName}
                  onChange={e => RN(e.target.value)}
                  placeholder="e.g. Ahmad bin Abdullah"
                />
              </div>

              <div className="form-field">
                <label>
                  MyKad IC Number <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  value={rIc}
                  onChange={e => RI(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  placeholder="12 digits e.g. 990101011234"
                  maxLength={12}
                  inputMode="numeric"
                />
                <small>
                  {rIc.length}/12 digits
                  {rIc.length === 12 && <span style={{ color: 'var(--ok)', fontWeight: 700 }}> ✓</span>}
                </small>
              </div>

              <div className="form-field">
                <label>Email Address</label>
                <input
                  value={rEmail}
                  onChange={e => RE(e.target.value)}
                  placeholder="you@example.com"
                  type="email"
                />
              </div>

              <div className="form-field">
                <label>Password</label>
                <input
                  type="password"
                  value={rPw}
                  onChange={e => RP(e.target.value)}
                  placeholder="Minimum 8 characters"
                />
                {rPw.length > 0 && (
                  <small style={{
                    color: rPw.length >= 8 ? 'var(--ok)' : 'var(--danger)',
                    fontWeight: 700
                  }}>
                    {rPw.length >= 8 ? '✓ Strong enough' : 'Too short — min 8 characters'}
                  </small>
                )}
              </div>

              <button
                disabled={rIc.length !== 12 || rPw.length < 8 || !rName || !rEmail}
                onClick={async () => {
                  try {
                    const f = new FormData();
                    f.append('name', rName);
                    f.append('email', rEmail);
                    f.append('password', rPw);
                    f.append('ic_number', rIc);

                    await req('/auth/register', { method: 'POST', body: f });

                    M('Registration successful! Please sign in.');
                    SR(false);
                    RN('');
                    RE('');
                    RP('');
                    RI('');
                  } catch (e) {
                    X(e.message);
                  }
                }}
              >
                Register as Citizen
              </button>

              {error && <p className="error">{error}</p>}
              {msg && <p className="success">{msg}</p>}

              <button className="link" onClick={() => {
                SR(false);
                X('');
                M('');
              }}>
                Already have an account? Sign in
              </button>
            </>
          ) : (
            <>
              <p style={{ color: 'var(--gray3)', fontSize: 14, margin: 0 }}>
                Sign in to your account
              </p>

              <input
                value={email}
                onChange={e => E(e.target.value)}
                placeholder="Email"
              />

              <input
                type="password"
                value={password}
                onChange={e => P(e.target.value)}
                placeholder="Password"
              />

              <button onClick={async () => {
                try {
                  const f = new FormData();
                  f.append('email', email.trim());
                  f.append('password', password);

                  const d = await req('/auth/login', { method: 'POST', body: f });

                  localStorage.setItem('token', d.access_token);
                  localStorage.setItem('user', JSON.stringify(d.user));
                  setUser(d.user);
                } catch (e) {
                  X(e.message);
                }
              }}>
                Sign in
              </button>

              {error && <p className="error">{error}</p>}
              {msg && <p className="success">{msg}</p>}

              <button className="link" onClick={() => {
                SR(true);
                X('');
                M('');
              }}>
                No account? Register
              </button>

              <p className="login-hint">Demo admin: admin@example.com / Admin123!</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const canSeeOperations = ['admin', 'engineer', 'technician'].includes(user.role);

  const nav = [
    { id: 'dashboard', label: 'Home', icon: '⌂' },
    { id: 'explore', label: 'Explore', icon: '🗺' },
    { id: 'reports', label: 'Reports', icon: '▤' },
    {
      id: 'insights',
      label: canSeeOperations ? 'Operations' : 'Rewards',
      icon: canSeeOperations ? '📡' : '⭐'
    },
    {
      id: 'workspace',
      label: user.role === 'admin' ? 'Admin' : 'Profile',
      icon: user.role === 'admin' ? '⚙' : '◎'
    }
  ];

  const activeTab = nav.some(item => item.id === tab) ? tab : 'dashboard';

  return (
    <div className="layout">
      <aside>
        <div className="brand">
          <Logo size={36} />
          <div className="brand-text">
            <span>Air-Eyes</span>
            <span>Mata untuk setiap longkang</span>
          </div>
        </div>

        <div className="user-chip">
          <strong>{user.name}</strong>
          <small>{user.role}{user.state ? ` · ${user.state}` : ''}</small>

          {user.iem_number && (
            <small style={{ color: 'var(--amber)', fontSize: 11, marginTop: 2 }}>
              IEM: {user.iem_number}
            </small>
          )}

          {user.ic_number && (
            <small style={{
              color: 'var(--gray3)',
              fontSize: 11,
              marginTop: 2,
              fontFamily: 'monospace'
            }}>
              {user.ic_number.replace(/(\d{6})(\d{2})(\d{4})/, '$1-$2-$3')}
            </small>
          )}

          {user.role === 'citizen' && (
            <small
              style={{ color: 'var(--amber)', fontSize: 12, marginTop: 4, fontWeight: 700 }}
              aria-label={`${user.points || 0} reward points, level ${user.level || 1}`}
            >
              ⭐ {user.points || 0} pts · Lv {user.level || 1}
            </small>
          )}
        </div>

        <nav aria-label="Main navigation">
          {nav.map(n => (
            <button
              key={n.id}
              type="button"
              aria-current={activeTab === n.id ? 'page' : undefined}
              className={activeTab === n.id ? 'active' : ''}
              onClick={() => T(n.id)}
            >
              <span className="nav-icon" aria-hidden="true">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>

        <button
          className="signout"
          type="button"
          onClick={() => {
            localStorage.clear();
            setUser(null);
          }}
        >
          Sign out
        </button>
      </aside>

      <main id="main-content">
        <header>
          <div>
            <small>Air-Eyes · Municipal Operations</small>
            <h1>{nav.find(item => item.id === activeTab)?.label || 'Home'}</h1>
          </div>

          <button type="button" onClick={refresh} aria-label="Refresh dashboard data">
            ↻ Refresh
          </button>
        </header>

        {error && <p className="error" role="alert">{error}</p>}
        {msg && <p className="success" role="status">{msg}</p>}

        {reward && (
          <RewardPopup reward={reward} onClose={() => setReward(null)} />
        )}

        {activeTab === 'dashboard' && (
          <div className="page-stack">
            <Overview reports={reports} flood={flood} user={user} />
            {canSeeOperations && <TechLeaderboard user={user} />}
          </div>
        )}

        {activeTab === 'explore' && (
          <div className="page-stack">
            <div className="section-switcher" role="group" aria-label="Explore sections">
              <button
                type="button"
                className={exploreSection === 'flood' ? 'selected' : ''}
                aria-pressed={exploreSection === 'flood'}
                onClick={() => SE('flood')}
              >
                Flood &amp; Weather
              </button>

              {canSeeOperations && (
                <button
                  type="button"
                  className={exploreSection === 'analysis' ? 'selected' : ''}
                  aria-pressed={exploreSection === 'analysis'}
                  onClick={() => SE('analysis')}
                >
                  Camera Analysis
                </button>
              )}

              {canSeeOperations && (
                <button
                  type="button"
                  className={exploreSection === 'ai' ? 'selected' : ''}
                  aria-pressed={exploreSection === 'ai'}
                  onClick={() => SE('ai')}
                >
                  AI Detection
                </button>
              )}
            </div>

            {exploreSection === 'flood' && (
              <FloodWeatherPage
                FloodMap={FloodMap}
                WeatherRisk={WeatherRisk}
                flood={flood}
                reports={reports}
                user={user}
              />
            )}

            {exploreSection === 'analysis' && canSeeOperations && (
              <CameraAnalysisPage AnalysisTab={AnalysisTab} CameraNode={CameraNode} />
            )}

            {exploreSection === 'ai' && canSeeOperations && (
              <AIDetectionPage
                AICameraSystem={AICameraSystem}
                cameras={cameras}
                user={user}
                act={act}
              />
            )}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="page-stack">
            <ReportsTab user={user} reports={reports} act={act} />

            {user.role === 'engineer' && (
              <EngineerCases reports={reports} user={user} act={act} />
            )}

            {user.role === 'technician' && (
              <TechnicianCases reports={reports} act={act} user={user} />
            )}
          </div>
        )}

        {activeTab === 'insights' && user.role === 'citizen' && (
          <RewardsCard user={user} reports={reports} />
        )}

        {activeTab === 'insights' && canSeeOperations && (
          <div className="page-stack">
            <div className="section-switcher" role="group" aria-label="Operations sections">
              <button
                type="button"
                className={exploreSection === 'analysis' ? 'selected' : ''}
                aria-pressed={exploreSection === 'analysis'}
                onClick={() => SE('analysis')}
              >
                Camera Analysis
              </button>

              <button
                type="button"
                className={exploreSection === 'ai' ? 'selected' : ''}
                aria-pressed={exploreSection === 'ai'}
                onClick={() => SE('ai')}
              >
                AI Detection
              </button>
            </div>

            {exploreSection === 'ai' ? (
              <AIDetectionPage
                AICameraSystem={AICameraSystem}
                cameras={cameras}
                user={user}
                act={act}
              />
            ) : (
              <CameraAnalysisPage AnalysisTab={AnalysisTab} CameraNode={CameraNode} />
            )}
          </div>
        )}

        {activeTab === 'workspace' && user.role === 'admin' && (
          <AdminPage
            Users={Users}
            users={users}
            act={act}
            user={user}
            reports={reports}
          />
        )}

        {activeTab === 'workspace' && user.role !== 'admin' && (
          <div className="page-stack">
            <section className="panel profile-panel">
              <h2>My Profile</h2>

              <div className="profile-details">
                <div>
                  <small>Name</small>
                  <strong>{user.name}</strong>
                </div>

                <div>
                  <small>Email</small>
                  <strong>{user.email || '—'}</strong>
                </div>

                <div>
                  <small>Role</small>
                  <strong>{user.role}</strong>
                </div>

                <div>
                  <small>State</small>
                  <strong>{user.state || '—'}</strong>
                </div>

                {user.role === 'citizen' && (
                  <>
                    <div>
                      <small>Reward points</small>
                      <strong>⭐ {user.points || 0}</strong>
                    </div>
                    <div>
                      <small>Level</small>
                      <strong>{user.level || 1}</strong>
                    </div>
                  </>
                )}

                {user.iem_number && (
                  <div>
                    <small>IEM number</small>
                    <strong>{user.iem_number}</strong>
                  </div>
                )}
              </div>

              {user.role === 'citizen' && (
                <div className="profile-rewards">
                  <h3>My Rewards</h3>
                  <p>
                    Earn points when your reports are verified and drainage fixes are confirmed.
                  </p>

                  <div
                    className="progress-track"
                    role="progressbar"
                    aria-label="Progress to next level"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow={(user.points || 0) % 100}
                  >
                    <span style={{ width: `${(user.points || 0) % 100}%` }} />
                  </div>

                  <small>{(user.points || 0) % 100}/100 points to the next level</small>
                </div>
              )}

              <button
                className="signout-inline"
                type="button"
                onClick={() => {
                  localStorage.clear();
                  setUser(null);
                }}
              >
                Sign out
              </button>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;