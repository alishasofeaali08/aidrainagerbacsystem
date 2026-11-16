
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { API, MY_STATES, getPhotoUrl, req, SC, PC, SL, Badge } from './shared.jsx';

export function Overview({ reports, flood, user }) {
  return (
    <>
      <div className="stats">
        <div className="stat-card">
          <small>📊 Total Reports</small>
          <h2>{reports.length}</h2>
        </div>

        <div className="stat-card red">
          <small>⚠️ High Risk</small>
          <h2>{flood.filter(x => x.risk_score >= 0.6).length}</h2>
        </div>

        <div className="stat-card amber">
          <small>🔍 Awaiting Engineer</small>
          <h2>{reports.filter(r => !r.risk_approved).length}</h2>
        </div>

        <div className="stat-card">
          <small>🛠️ Awaiting Fix</small>
          <h2>{reports.filter(r => r.status === 'engineer_approved').length}</h2>
        </div>

        <div className="stat-card purple">
          <small>⏳ Pending Closure</small>
          <h2>{reports.filter(r => r.status === 'pending_closure').length}</h2>
        </div>

        <div className="stat-card green">
          <small>✅ Resolved</small>
          <h2>{reports.filter(r => r.status === 'resolved').length}</h2>
        </div>
      </div>

      <ReportTable reports={reports} />
    </>
  );
}

/* ── Reward pop-up (accessible modal) ── */
export function RewardPopup({ reward, onClose }) {
  let btn = useRef(null);

  useEffect(() => {
    btn.current?.focus();

    let k = e => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,34,48,.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: 16
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reward-title"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--white)',
          borderRadius: 16,
          padding: '28px 28px 22px',
          maxWidth: 380,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0,0,0,.25)'
        }}
      >
        <div aria-hidden="true" style={{ fontSize: 52, lineHeight: 1 }}>
          {reward.levelUp ? '🏅' : '⭐'}
        </div>

        <h2
          id="reward-title"
          style={{ margin: '10px 0 4px', color: 'var(--navy)' }}
        >
          +{reward.gained} points!
        </h2>

        {reward.levelUp && (
          <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--amber)' }}>
            Level up! You're now Level {reward.level}
          </p>
        )}

        <p style={{ margin: '0 0 12px', color: 'var(--gray3)', fontSize: 14 }}>
          Thanks for keeping the drains clear.
        </p>

        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '0 0 14px',
            fontSize: 14,
            textAlign: 'left'
          }}
        >
          {reward.items.map(i => (
            <li
              key={i.id}
              style={{
                padding: '6px 0',
                borderBottom: '1px solid var(--gray2)'
              }}
            >
              DR-{i.id}: <strong>+{i.pts}</strong>{' '}
              {i.status === 'resolved'
                ? '— fix confirmed'
                : '— report verified'}
            </li>
          ))}
        </ul>

        <p style={{ margin: '0 0 16px', fontSize: 13 }}>
          Total: <strong>{reward.total} pts</strong> · Level {reward.level}
        </p>

        <button ref={btn} onClick={onClose} style={{ width: '100%' }}>
          Awesome
        </button>
      </div>
    </div>
  );
}

/* ── Citizen reward points ── */
export function RewardsCard({ user, reports }) {
  let pts = user.points || 0;
  let lvl = user.level || 1;
  let into = pts % 100;

  let earned = reports.filter(r => r.reward_points > 0);

  return (
    <div className="panel">
      <h2>⭐ My Rewards</h2>

      <p style={{ margin: '4px 0 10px' }}>
        Earn <strong>+10 pts</strong> when an engineer verifies your report and{' '}
        <strong>+20 pts</strong> when the fix is confirmed. Every 100 pts is a
        new level.
      </p>

      <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <small>Total points</small>
          <h2 style={{ margin: 0 }}>{pts}</h2>
        </div>

        <div>
          <small>Level</small>
          <h2 style={{ margin: 0 }}>{lvl}</h2>
        </div>

        <div style={{ flex: 1, minWidth: 180 }}>
          <small>{into}/100 to Level {lvl + 1}</small>

          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={into}
            aria-label="Progress to next level"
            style={{
              height: 10,
              background: 'var(--gray2)',
              borderRadius: 6,
              overflow: 'hidden',
              marginTop: 4
            }}
          >
            <div
              style={{
                width: `${into}%`,
                height: '100%',
                background: 'var(--amber)'
              }}
            />
          </div>
        </div>
      </div>

      {earned.length > 0 && (
        <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 13 }}>
          {earned.map(r => (
            <li key={r.id}>
              DR-{r.id}: +{r.reward_points} pts{' '}
              {r.status === 'resolved'
                ? '(verified + fixed)'
                : '(verified)'}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════ REPORTS TAB ═══════════════════════════════════════ */
export function ReportsTab({ user, reports, act }) {
  return (
    <>
      <ReportForm user={user} act={act} />
      <ReportTable reports={reports} />

      {/* Admin: approve AI risk → assigns to engineer's state queue */}
      {user.role === 'admin' && (
        <div className="panel panel-amber">
          <h2>
            <span className="step-tag amber">Step 1</span>
            Approve AI Risk — Assign to Engineer
          </h2>

          <p>
            Review the AI-generated flood risk score for each new report.
            Approving it marks the case as <strong>Engineer Approved</strong>{' '}
            and routes it to the responsible state engineer.
          </p>

          {reports.filter(r => !r.risk_approved).length === 0 ? (
            <p style={{ color: 'var(--ok)', fontWeight: 600 }}>
              ✅ All reports have been reviewed.
            </p>
          ) : (
            reports
              .filter(r => !r.risk_approved)
              .map(r => <RiskApproval key={r.id} r={r} act={act} />)
          )}
        </div>
      )}

      {/* Admin: approve technician fix submissions */}
      {user.role === 'admin' && (
        <div className="panel panel-purple">
          <h2>
            <span className="step-tag purple">Step 3</span>
            Approve Technician Fix — Close Case
          </h2>

          <p>
            Technicians have submitted fix photos and comments below. Assign to
            the responsible engineer, or approve directly to close the case.
          </p>

          {reports.filter(r => r.status === 'pending_closure').length === 0 ? (
            <p style={{ color: 'var(--gray3)' }}>
              No cases pending closure.
            </p>
          ) : (
            reports
              .filter(r => r.status === 'pending_closure')
              .map(r => <ClosureReview key={r.id} r={r} act={act} isAdmin />)
          )}
        </div>
      )}

      {/* Engineer: approve closure for their state */}
      {user.role === 'engineer' && (
        <div className="panel panel-purple">
          <h2>
            <span className="step-tag purple">Step 3</span>
            Approve Technician Fix — Close Case
          </h2>

          <p>
            Review the fix submissions for your state ({user.state || '—'}) and
            approve to resolve the case.
          </p>

          {reports.filter(r => r.status === 'pending_closure').length === 0 ? (
            <p style={{ color: 'var(--gray3)' }}>
              No cases pending closure in your state.
            </p>
          ) : (
            reports
              .filter(r => r.status === 'pending_closure')
              .map(r => (
                <ClosureReview
                  key={r.id}
                  r={r}
                  act={act}
                  isAdmin={false}
                />
              ))
          )}
        </div>
      )}
    </>
  );
}

/* ── AI risk approval card ── */
export function RiskApproval({ r, act }) {
  let [risk, setRisk] = useState(Math.round(r.flood_risk * 100));
  let rV = risk / 100;

  let col =
    r.flood_risk >= 0.7
      ? '#dc2626'
      : r.flood_risk >= 0.5
        ? '#d97706'
        : '#059669';

  return (
    <div className="case-card">
      <div className="case-card-head">
        <strong>DR-{r.id}</strong>

        <Badge label={SL(r.status)} color={SC(r.status)} />

        {r.state ? (
          <Badge label={r.state} color="var(--navy)" />
        ) : (
          <Badge label="No state set" color="#94a3b8" />
        )}

        <span style={{ color: col, fontWeight: 700, fontSize: 13 }}>
          AI Risk {Math.round(r.flood_risk * 100)}%
        </span>
      </div>

      <p style={{ fontSize: 13, color: '#4a6278', marginBottom: 10 }}>
        {r.description || '(no description)'}
      </p>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 80,
              height: 8,
              background: 'var(--gray2)',
              borderRadius: 4,
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${r.flood_risk * 100}%`,
                height: '100%',
                background: col
              }}
            />
          </div>
        </div>

        <label
          style={{
            fontSize: 13,
            color: '#4a6278',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          Override %:
          <input
            type="number"
            min="0"
            max="100"
            value={risk}
            onChange={e => setRisk(+e.target.value)}
            style={{ width: 64, padding: '5px 8px' }}
          />
        </label>

        <button
          onClick={() =>
            act(
              () =>
                req(`/reports/${r.id}/approve-risk?flood_risk=${rV}`, {
                  method: 'PATCH'
                }),
              `DR-${r.id} approved — assigned to state engineer`
            )
          }
          style={{ background: 'var(--teal)', fontSize: 13 }}
        >
          ✅ Approve &amp; Assign
        </button>
      </div>
    </div>
  );
}

/* ── Closure review card ── */
export function ClosureReview({ r, act, isAdmin }) {
  return (
    <div className="case-card" style={{ borderLeftColor: '#8b5cf6' }}>
      <div className="case-card-head">
        <strong>DR-{r.id}</strong>

        <Badge label="Pending Closure" color="#8b5cf6" />

        {r.state && <Badge label={r.state} color="var(--navy)" />}
      </div>

      <p style={{ fontSize: 13, color: '#4a6278', marginBottom: 10 }}>
        {r.description || '(no description)'}
      </p>

      {r.technician_comment && (
        <div
          style={{
            background: 'var(--gray1)',
            borderRadius: 8,
            padding: 10,
            marginBottom: 10
          }}
        >
          <strong style={{ fontSize: 12, color: 'var(--navy)' }}>
            💬 Technician note:
          </strong>

          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text)' }}>
            {r.technician_comment}
          </p>
        </div>
      )}

      {r.fix_photo_path && (
        <div style={{ marginBottom: 10 }}>
          <strong style={{ fontSize: 12, color: 'var(--navy)' }}>
            📷 Fix photo:
          </strong>
          <br />

          <a href={r.fix_photo_path} target="_blank" rel="noreferrer">
            <img
              src={r.fix_photo_path}
              alt="fix"
              style={{
                marginTop: 6,
                maxWidth: 220,
                maxHeight: 150,
                borderRadius: 8,
                border: '1px solid var(--gray2)',
                objectFit: 'cover'
              }}
            />
          </a>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() =>
            act(
              () => req(`/reports/${r.id}/approve-closure`, { method: 'PATCH' }),
              'Case closed — drainage confirmed resolved'
            )
          }
          style={{ background: 'var(--ok)', fontSize: 13 }}
        >
          ✅ Approve &amp; Close
        </button>

        <button
          onClick={() =>
            act(
              () => req(`/reports/${r.id}/review?status=engineer_approved`, {
                method: 'PATCH'
              }),
              'Sent back to technician'
            )
          }
          style={{ background: 'var(--warn)', fontSize: 13 }}
        >
          ↩ Send Back
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════ ENGINEER CASES ═══════════════════════════════════════ */
export function EngineerCases({ reports, user, act }) {
  let state = user.state || '—';

  let myPending = reports.filter(r => r.status === 'pending_closure');
  let myApproved = reports.filter(r => r.status === 'engineer_approved');
  let myDone = reports.filter(r => r.status === 'resolved');

  return (
    <>
      <div className="panel panel-teal">
        <h2>
          <span className="step-tag">Step 1</span>
          Approve AI Risk for {state}
        </h2>

        <p>
          Review and approve the AI flood risk for reports in your state. This
          routes the case to technicians for repair.
        </p>

        {reports.filter(r => !r.risk_approved).length === 0 ? (
          <p style={{ color: 'var(--ok)', fontWeight: 600 }}>
            ✅ All reports reviewed.
          </p>
        ) : (
          reports
            .filter(r => !r.risk_approved)
            .map(r => <RiskApproval key={r.id} r={r} act={act} />)
        )}
      </div>

      <div className="panel">
        <h2>
          <span className="step-tag amber">Step 2</span>
          Awaiting Technician Fix
        </h2>

        {myApproved.length === 0 ? (
          <p style={{ color: 'var(--gray3)' }}>
            No cases awaiting fix in {state}.
          </p>
        ) : (
          myApproved.map(r => (
            <div
              key={r.id}
              className="case-card"
              style={{ borderLeftColor: 'var(--teal)' }}
            >
              <div className="case-card-head">
                <strong>DR-{r.id}</strong>
                <Badge label="Engineer Approved" color="var(--teal)" />
                <Badge label={`P${r.priority}`} color={PC(r.priority)} />
              </div>

              <p style={{ fontSize: 13, color: '#4a6278', margin: 0 }}>
                {r.description || '(no description)'}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="panel panel-purple">
        <h2>
          <span className="step-tag purple">Step 3</span>
          Pending Closure — Review Technician Submissions
        </h2>

        {myPending.length === 0 ? (
          <p style={{ color: 'var(--gray3)' }}>
            No cases pending closure.
          </p>
        ) : (
          myPending.map(r => (
            <ClosureReview
              key={r.id}
              r={r}
              act={act}
              isAdmin={false}
            />
          ))
        )}
      </div>

      {myDone.length > 0 && (
        <div className="panel panel-green">
          <h2>✅ Resolved Cases in {state}</h2>

          {myDone.map(r => (
            <div
              key={r.id}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                padding: '10px 0',
                borderBottom: '1px solid var(--gray2)',
                flexWrap: 'wrap'
              }}
            >
              <strong style={{ fontSize: 14 }}>DR-{r.id}</strong>
              <Badge label="Resolved" color="var(--ok)" />

              <span style={{ fontSize: 13, color: '#4a6278', flex: 1 }}>
                {r.description || '(no description)'}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════ TECHNICIAN CASES ═══════════════════════════════════════ */
/* ── "You're #N this month" strip shown at top of My Cases ── */
export function MyRankStrip({ user }) {
  let [rows, setRows] = useState(null);

  useEffect(() => {
    req('/leaderboard/technicians?period=month')
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  if (!rows) return null;

  let i = rows.findIndex(t => t.id === user.id);

  if (i < 0) {
    return (
      <div
        className="panel"
        style={{ padding: '10px 16px', fontSize: 13, color: 'var(--gray3)' }}
      >
        🏆 Get your first fix approved this month to join the leaderboard.
      </div>
    );
  }

  let need = i > 0 ? rows[i - 1].fixes - rows[i].fixes + 1 : 0;

  return (
    <div
      className="panel"
      style={{
        padding: '10px 16px',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
        borderLeft: '4px solid var(--amber)'
      }}
    >
      <strong>🏆 You're #{i + 1} this month</strong>

      <span style={{ fontSize: 13, color: 'var(--gray3)', flex: 1 }}>
        {rows[i].fixes} fixes · Lv {rows[i].level}
        {i > 0
          ? ` · ${need} more to reach #${i}`
          : ' · Top spot, keep it up!'}
      </span>
    </div>
  );
}

export function TechnicianCases({ reports, act, user }) {
  let assigned = reports.filter(r => r.status === 'engineer_approved');
  let submitted = reports.filter(r => r.status === 'pending_closure');
  let done = reports.filter(r => r.status === 'resolved' && r.proof_approved);

  return (
    <>
      <MyRankStrip user={user} />

      <div className="panel panel-teal">
        <h2>
          <span className="step-tag">Step 2</span>
          Cases Assigned to You
        </h2>

        <p>
          These cases have been approved by the engineer. Carry out the repair,
          upload a photo, add a comment, then submit for engineer approval.
        </p>

        {assigned.length === 0 ? (
          <p
            style={{
              color: 'var(--gray3)',
              textAlign: 'center',
              padding: '20px 0'
            }}
          >
            No cases assigned yet.
          </p>
        ) : (
          assigned.map(r => (
            <TechnicianFixForm key={r.id} r={r} act={act} />
          ))
        )}
      </div>

      {submitted.length > 0 && (
        <div className="panel" style={{ borderTop: '3px solid #8b5cf6' }}>
          <h2>
            <span className="step-tag purple">⏳</span>
            Awaiting Engineer Approval
          </h2>

          {submitted.map(r => (
            <div
              key={r.id}
              className="case-card"
              style={{ borderLeftColor: '#8b5cf6' }}
            >
              <div className="case-card-head">
                <strong>DR-{r.id}</strong>
                <Badge label="Pending Closure" color="#8b5cf6" />
                {r.state && <Badge label={r.state} color="var(--navy)" />}
              </div>

              {r.technician_comment && (
                <p
                  style={{
                    fontSize: 13,
                    color: '#4a6278',
                    background: 'var(--gray1)',
                    padding: '8px 10px',
                    borderRadius: 6,
                    margin: '6px 0 0'
                  }}
                >
                  {r.technician_comment}
                </p>
              )}

              {r.fix_photo_path && (
                <a
                  href={r.fix_photo_path}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'block',
                    marginTop: 6,
                    fontSize: 13,
                    color: 'var(--teal)'
                  }}
                >
                  👁️ View submitted photo
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <div className="panel panel-green">
          <h2>✅ Completed Cases</h2>

          {done.map(r => (
            <div
              key={r.id}
              style={{
                display: 'flex',
                gap: 10,
                padding: '10px 0',
                borderBottom: '1px solid var(--gray2)',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}
            >
              <strong>DR-{r.id}</strong>
              <Badge label="Resolved" color="var(--ok)" />

              <span style={{ fontSize: 13, color: '#4a6278', flex: 1 }}>
                {r.description || '(no description)'}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ── Technician fix form ── */
export function TechnicianFixForm({ r, act }) {
  let [comment, C] = useState('');
  let [file, F] = useState(null);
  let [preview, V] = useState(null);

  function pick(e) {
    let f = e.target.files[0];
    F(f);
    V(f ? URL.createObjectURL(f) : null);
  }

  function submit(e) {
    e.preventDefault();

    if (!file) {
      alert('Please upload a fix photo');
      return;
    }

    let fd = new FormData();
    fd.append('comment', comment);
    fd.append('file', file);

    act(
      () =>
        req(`/reports/${r.id}/technician-submit`, {
          method: 'PATCH',
          body: fd
        }),
      'Fix submitted — awaiting engineer approval'
    );

    C('');
    F(null);
    V(null);
  }

  return (
    <div className="case-card" style={{ borderLeftColor: 'var(--teal)' }}>
      <div className="case-card-head">
        <strong>DR-{r.id}</strong>
        <Badge label="Engineer Approved" color="var(--teal)" />
        <Badge label={`P${r.priority}`} color={PC(r.priority)} />

        <span
          style={{
            fontSize: 12,
            color:
              r.flood_risk >= 0.7
                ? '#dc2626'
                : r.flood_risk >= 0.5
                  ? '#d97706'
                  : 'var(--ok)',
            fontWeight: 700
          }}
        >
          Risk {Math.round(r.flood_risk * 100)}%
        </span>

        {r.state && <Badge label={r.state} color="var(--navy)" />}
      </div>

      <p style={{ fontSize: 13, color: '#4a6278', marginBottom: 12 }}>
        {r.description || '(no description)'}
      </p>

      <form
        onSubmit={submit}
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <div>
          <label
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--navy)',
              display: 'block',
              marginBottom: 4
            }}
          >
            📷 Upload photo of repaired drainage{' '}
            <span style={{ color: 'var(--danger)' }}>*</span>
          </label>

          <input
            type="file"
            accept="image/*"
            onChange={pick}
            style={{ fontSize: 13 }}
          />

          {preview && (
            <img
              src={preview}
              alt="preview"
              style={{
                marginTop: 8,
                maxWidth: 200,
                maxHeight: 140,
                borderRadius: 8,
                objectFit: 'cover',
                border: '1px solid var(--gray2)'
              }}
            />
          )}
        </div>

        <div>
          <label
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--navy)',
              display: 'block',
              marginBottom: 4
            }}
          >
            💬 Description of work done
          </label>

          <textarea
            value={comment}
            onChange={e => C(e.target.value)}
            placeholder="Describe the repair carried out…"
          />
        </div>

        <button
          type="submit"
          style={{
            background: 'var(--teal)',
            alignSelf: 'flex-start',
            fontSize: 13
          }}
        >
          📤 Submit Fix for Engineer Approval
        </button>
      </form>
    </div>
  );
}

/* ═══════════════════════════════════════ TECHNICIAN LEADERBOARD ═══════════════════════════════════════ */
export function TechLeaderboard({ user }) {
  let [rows, setRows] = useState([]);
  let [period, setPeriod] = useState('month');
  let [loading, setLoading] = useState(true);
  let [err, setErr] = useState('');

  useEffect(() => {
    setLoading(true);
    setErr('');

    req(`/leaderboard/technicians?period=${period}`)
      .then(setRows)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [period]);

  let me = rows.findIndex(t => t.id === user.id);

  return (
    <div className="panel panel-teal">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 6
        }}
      >
        <h2 style={{ margin: 0, flex: 1 }}>🏆 Technician Leaderboard</h2>

        <select
          value={period}
          onChange={e => setPeriod(e.target.value)}
          style={{ width: 'auto' }}
        >
          <option value="week">This week</option>
          <option value="month">This month</option>
          <option value="all">All time</option>
        </select>
      </div>

      <p style={{ fontSize: 13, color: 'var(--gray3)' }}>
        Ranked by fixes approved by an engineer. Ties are broken by first-time-right rate.
        {user.role === 'engineer' && user.state && (
          <>
            {' '}Showing cases in <strong>{user.state}</strong>.
          </>
        )}
      </p>

      {user.role === 'technician' && me >= 0 && (
        <div
          style={{
            background: '#fff7e6',
            border: '1px solid var(--amber)',
            borderRadius: 8,
            padding: '8px 12px',
            marginBottom: 10,
            fontSize: 13,
            fontWeight: 600
          }}
        >
          You are #{me + 1} · {rows[me].fixes} fixes · Lv {rows[me].level}
        </div>
      )}

      {loading && (
        <p style={{ textAlign: 'center', color: 'var(--gray3)', padding: 20 }}>
          Loading…
        </p>
      )}

      {err && <p className="error">{err}</p>}

      {!loading && !err && rows.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--gray3)', padding: 20 }}>
          No approved fixes in this period yet.
        </p>
      )}

      {rows.map((t, i) => (
        <div
          key={t.id}
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            padding: '10px 8px',
            borderBottom: '1px solid var(--gray2)',
            flexWrap: 'wrap',
            background: t.id === user.id ? '#fff7e6' : 'transparent',
            borderRadius: 6
          }}
        >
          <strong style={{ minWidth: 34, fontSize: 16 }}>
            {['🥇', '🥈', '🥉'][i] || `#${i + 1}`}
          </strong>

          <span style={{ flex: 1, minWidth: 120 }}>
            {t.name}
            {t.id === user.id && (
              <small style={{ color: 'var(--amber)', fontWeight: 700 }}>
                {' '}(you)
              </small>
            )}
          </span>

          <Badge label={`Lv ${t.level}`} color="var(--amber)" />
          <Badge label={`${t.fixes} fixes`} color="var(--teal)" />
          <small style={{ color: 'var(--gray3)' }}>
            {t.first_time_rate}% first-time
          </small>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════ REPORT TABLE ═══════════════════════════════════════ */
export function ReportTable({ reports }) {
  return (
    <div className="panel">
      <h2>📋 Drain Reports</h2>

      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>AI Label</th>
              <th>Risk</th>
              <th>State</th>
              <th>Priority</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {reports.map(r => (
              <tr key={r.id}>
                <td><strong>DR-{r.id}</strong></td>
                <td style={{ fontSize: 13 }}>{r.ai_label}</td>

                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div
                      style={{
                        width: 52,
                        height: 7,
                        background: 'var(--gray2)',
                        borderRadius: 4,
                        overflow: 'hidden'
                      }}
                    >
                      <div
                        style={{
                          width: `${r.flood_risk * 100}%`,
                          height: '100%',
                          background:
                            r.flood_risk >= 0.7
                              ? '#dc2626'
                              : r.flood_risk >= 0.5
                                ? '#d97706'
                                : '#059669'
                        }}
                      />
                    </div>

                    <small>{Math.round(r.flood_risk * 100)}%</small>
                  </div>
                </td>

                <td>
                  <small style={{ color: 'var(--teal)', fontWeight: 600 }}>
                    {r.state || '—'}
                  </small>
                </td>

                <td>
                  <Badge label={`P${r.priority}`} color={PC(r.priority)} />
                </td>

                <td>
                  <Badge label={SL(r.status)} color={SC(r.status)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!reports.length && (
          <p style={{ textAlign: 'center', color: 'var(--gray3)', padding: 20 }}>
            No reports yet.
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Report submit form ── */
export function ReportForm({ user, act }) {
  let [d, D] = useState('');
  let [lat, L] = useState('');
  let [lng, G] = useState('');
  let [photo, S] = useState(null);
  let [locSt, LS] = useState('');

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      p => {
        L(p.coords.latitude);
        G(p.coords.longitude);
        LS('📍 Location captured');
      },
      () => LS('Location unavailable')
    );
  }, []);

  if (!['citizen', 'admin'].includes(user.role)) return null;

  return (
    <div className="panel panel-teal">
      <h2>📝 Submit Drain Report</h2>

      <div className="grid">
        <textarea
          style={{ gridColumn: '1/-1' }}
          placeholder="Describe the blockage, overflow or rubbish…"
          value={d}
          onChange={e => D(e.target.value)}
        />

        <div
          style={{
            gridColumn: '1/-1',
            display: 'flex',
            gap: 10,
            flexWrap: 'wrap',
            alignItems: 'center'
          }}
        >
          <button
            type="button"
            onClick={() =>
              navigator.geolocation?.getCurrentPosition(
                p => {
                  L(p.coords.latitude);
                  G(p.coords.longitude);
                  LS('📍 Location captured');
                },
                () => LS('Location unavailable')
              )
            }
            style={{ background: 'var(--navy)', flex: '0 0 auto' }}
          >
            📍 Get Location
          </button>

          <small style={{ color: 'var(--teal)', fontWeight: 600 }}>
            {locSt}
          </small>
        </div>

        <input
          type="file"
          accept="image/*"
          onChange={e => S(e.target.files[0])}
          style={{ gridColumn: '1/-1' }}
        />

        <button
          style={{ gridColumn: '1/-1' }}
          onClick={() => {
            if (!lat || !lng) return;

            let f = new FormData();
            f.append('description', d);
            f.append('latitude', lat);
            f.append('longitude', lng);

            if (photo) f.append('photo', photo);

            act(() => req('/reports', { method: 'POST', body: f }), 'Report submitted');
          }}
        >
          Submit Report
        </button>
      </div>
    </div>
  );
}
