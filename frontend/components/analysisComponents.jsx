import React, { useEffect, useMemo, useRef, useState } from 'react';
import Peer from 'peerjs';
import { API, MY_STATES, getPhotoUrl, req, SC, PC, SL, Badge } from './shared.jsx';

export function detectWaterLevel(ctx, cols, rows) {
  const data = ctx.getImageData(0, 0, cols, rows).data;
  let best = 0;
  for (let x = 0; x < cols; x += 5) {
    let h = 0;
    for (let y = rows - 1; y >= rows / 2; y--) {
      const i = (y * cols + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const blue = b > r * 1.1 && b > g * 0.9;
      const dark = r < 60 && g < 60 && b < 60;
      const turbid = g > r * 0.9 && b > r * 0.9 && g + b > r * 1.8;
      if (blue || dark || turbid) h++; else break;
    }
    best = Math.max(best, h);
  }
  return Math.min(100, Math.round((best / (rows / 2)) * 100));
}

const HUB_PREFIX = 'aireyes-';
const MAX_LAPTOPS = 4;
const FLOOD_THRESHOLD = 70;

/* ═══════════════ ANALYSIS TAB (hub that receives up to 4 laptops) ═══════════════ */
export function AnalysisTab() {
  const [code, setCode] = useState('');
  const [hubStatus, setHubStatus] = useState('Starting hub…');
  const [slots, setSlots] = useState([]); // {id,label,stream}
  const [levels, setLevels] = useState({});
  const slotsRef = useRef([]);
  const peerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    function start() {
      const c = Math.random().toString(36).slice(2, 8).toUpperCase();
      const peer = new Peer(HUB_PREFIX + c);
      peerRef.current = peer;

      peer.on('open', () => { if (!cancelled) { setCode(c); setHubStatus('Hub online — waiting for laptops'); } });
      peer.on('error', err => {
        if (err.type === 'unavailable-id') { peer.destroy(); start(); return; }
        setHubStatus('Hub error: ' + err.type);
      });
      peer.on('call', call => {
        if (slotsRef.current.length >= MAX_LAPTOPS) { call.close(); return; }
        call.answer(); // receive only
        call.on('stream', stream => {
          if (slotsRef.current.find(s => s.id === call.peer)) return;
          const slot = { id: call.peer, label: call.metadata?.label || 'Laptop', stream };
          slotsRef.current = [...slotsRef.current, slot];
          setSlots(slotsRef.current);
        });
        const drop = () => {
          slotsRef.current = slotsRef.current.filter(s => s.id !== call.peer);
          setSlots(slotsRef.current);
          setLevels(l => { const n = { ...l }; delete n[call.peer]; return n; });
        };
        call.on('close', drop);
        call.on('error', drop);
      });
    }
    start();
    return () => { cancelled = true; peerRef.current?.destroy(); };
  }, []);

  const vals = Object.values(levels);
  const peak = vals.length ? Math.max(...vals) : 0;
  const alerts = vals.filter(v => v > FLOOD_THRESHOLD).length;

  return <>
    <div className="panel panel-teal">
      <h2>📈 Multi-Camera Analysis</h2>
      <p style={{ fontSize: 13, color: 'var(--gray3)' }}>
        On each other laptop, open <strong>📡 Camera Node</strong> and enter the hub code below. Up to {MAX_LAPTOPS} laptops can stream live video here. Analysis runs in this browser.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ background: 'var(--navy)', color: '#fff', padding: '10px 18px', borderRadius: 10, fontFamily: 'monospace', fontSize: 26, letterSpacing: 4 }}>
          {code || '······'}
        </div>
        <small style={{ color: 'var(--teal)', fontWeight: 600 }}>{hubStatus}</small>
      </div>
    </div>

    <div className="stats">
      <div className="stat-card"><small>📡 Connected</small><h2>{slots.length}/{MAX_LAPTOPS}</h2></div>
      <div className="stat-card amber"><small>🌊 Highest Level</small><h2>{peak}%</h2></div>
      <div className="stat-card red"><small>🚨 Flood Alerts</small><h2>{alerts}</h2></div>
    </div>

    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
      {slots.map(s => (
        <FeedAnalyzer key={s.id} slot={s} onLevel={lv => setLevels(l => ({ ...l, [s.id]: lv }))} />
      ))}
      {Array.from({ length: MAX_LAPTOPS - slots.length }).map((_, i) => (
        <div key={'e' + i} className="stat-card" style={{ textAlign: 'center', color: 'var(--gray3)', padding: 40, border: '1px dashed var(--gray2)' }}>
          💻 Waiting for laptop {slots.length + i + 1}…
        </div>
      ))}
    </div>
  </>;
}

export function FeedAnalyzer({ slot, onLevel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [level, setLevel] = useState(0);
  const [history, setHistory] = useState([]);
  const [secAbove, setSecAbove] = useState(0);
  const levelRef = useRef(0);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = slot.stream;
      videoRef.current.play().catch(() => {});
    }
  }, [slot.stream]);

  useEffect(() => {
    const t = setInterval(() => {
      const v = videoRef.current, c = canvasRef.current;
      if (!v || !c || v.readyState < 2) return;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const raw = detectWaterLevel(ctx, c.width, c.height);
      levelRef.current = Math.round(levelRef.current * 0.7 + raw * 0.3);
      const lv = levelRef.current;
      setLevel(lv);
      onLevel(lv);
      setHistory(h => [...h.slice(-59), lv]);
      if (lv > FLOOD_THRESHOLD) setSecAbove(s => s + 2);
    }, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, []);

  const flood = level > FLOOD_THRESHOLD;
  const label = flood ? 'HIGH' : level > 30 ? 'MEDIUM' : 'LOW';
  const avg = history.length ? Math.round(history.reduce((a, b) => a + b, 0) / history.length) : 0;
  const peak = history.length ? Math.max(...history) : 0;
  const pts = history.map((v, i) => `${(i / Math.max(history.length - 1, 1)) * 100},${40 - (v / 100) * 38}`).join(' ');

  return (
    <div className="stat-card" style={{ borderTopColor: flood ? '#dc2626' : '#059669' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong>💻 {slot.label}</strong>
        <span className="badge" style={{ background: flood ? '#dc2626' : '#059669' }}>{flood ? 'FLOOD DETECTED' : 'NO FLOOD'}</span>
      </div>
      <div style={{ position: 'relative', background: '#000', borderRadius: 8, overflow: 'hidden', height: 170 }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <canvas ref={canvasRef} width="80" height="60" style={{ display: 'none' }} />
        <div style={{ position: 'absolute', top: 8, left: 8, background: flood ? 'rgba(220,38,38,.85)' : 'rgba(5,150,105,.85)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>
          LIVE · {label} LEVEL
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600 }}>
          <span>Water level</span><span style={{ color: flood ? '#dc2626' : '#059669' }}>{level}%</span>
        </div>
        <div style={{ height: 7, background: 'var(--gray2)', borderRadius: 4, overflow: 'hidden', marginTop: 3 }}>
          <div style={{ width: `${level}%`, height: '100%', background: flood ? '#dc2626' : '#059669', transition: 'width .5s' }} />
        </div>
      </div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height: 50, marginTop: 10, background: 'var(--gray1)', borderRadius: 6 }}>
        <line x1="0" x2="100" y1={40 - 0.7 * 38} y2={40 - 0.7 * 38} stroke="#dc2626" strokeWidth="0.4" strokeDasharray="2 2" />
        {history.length > 1 && <polyline points={pts} fill="none" stroke="#1B8CA8" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--gray3)', marginTop: 6 }}>
        <span>Avg {avg}%</span><span>Peak {peak}%</span><span>Above 70%: {secAbove}s</span>
      </div>
    </div>
  );
}

/* ═══════════════ CAMERA NODE (run on each extra laptop) ═══════════════ */
export function CameraNode() {
  const [hub, setHub] = useState('');
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState('');
  const [stream, setStream] = useState(null);
  const [connected, setConnected] = useState(false);
  const videoRef = useRef(null);
  const peerRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
  }, [stream]);

  function stop() {
    peerRef.current?.destroy(); peerRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    setStream(null); setConnected(false);
  }
  useEffect(() => stop, []);

  async function connect() {
    if (!hub.trim()) { setStatus('Enter the hub code first.'); return; }
    try {
      setStatus('Opening camera…');
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      streamRef.current = s; setStream(s);
      const peer = new Peer();
      peerRef.current = peer;
      peer.on('open', () => {
        setStatus('Connecting to hub…');
        const call = peer.call(HUB_PREFIX + hub.trim().toUpperCase(), s, { metadata: { label: label.trim() || 'Laptop' } });
        call.on('close', () => { setConnected(false); setStatus('Disconnected from hub.'); });
        setTimeout(() => setConnected(c => { if (!c) setStatus('Streaming (if the hub is full or the code is wrong, nothing will appear there).'); return true; }), 1500);
      });
      peer.on('error', e => setStatus(e.type === 'peer-unavailable' ? 'Hub code not found.' : 'Error: ' + e.type));
    } catch (e) {
      setStatus('Camera access denied or unavailable (HTTPS required).');
    }
  }

  return (
    <div className="panel panel-teal">
      <h2>📡 Camera Node</h2>
      <p style={{ fontSize: 13, color: 'var(--gray3)' }}>Use this laptop as a live camera. Enter the hub code shown on the 📈 Analysis tab of the main laptop.</p>
      <div className="grid">
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Laptop name (e.g. Drain A – Block 3)" />
        <input value={hub} onChange={e => setHub(e.target.value.toUpperCase())} placeholder="Hub code (6 characters)" maxLength={6} style={{ fontFamily: 'monospace', letterSpacing: 3 }} />
        {!connected && !stream
          ? <button style={{ gridColumn: '1/-1' }} onClick={connect}>Start Camera & Connect</button>
          : <button style={{ gridColumn: '1/-1', background: 'var(--danger)' }} onClick={() => { stop(); setStatus('Stopped.'); }}>Stop Streaming</button>}
      </div>
      {status && <p style={{ fontSize: 13, color: 'var(--teal)', fontWeight: 600 }}>{status}</p>}
      {stream && <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', maxWidth: 480, borderRadius: 10, background: '#000', marginTop: 10 }} />}
    </div>
  );
}

/* ═══════════════ IC SCANNER (OCR → fills name + IC number) ═══════════════ */
