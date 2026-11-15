import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { API, MY_STATES, getPhotoUrl, req, SC, PC, SL, Badge } from './shared.jsx';

const ADDR = /\b(JALAN|JLN|LORONG|LRG|TAMAN|KAMPUNG|KG|LOT|BLOK|PERSIARAN|KM|TINGKAT|BANDAR|PANGSAPURI|APARTMENT|NO)\b/;
const SKIP = /(KAD|PENGENALAN|MALAYSIA|WARGANEGARA|ISLAM|LELAKI|PEREMPUAN|MYKAD|IDENTITY|CARD)/;

export function parseMyKad(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // --- IC number: tolerate OCR mistakes (O->0, I/l->1, S->5, B->8, Z->2) ---
  const fixDigits = l => l.replace(/[OoQD]/g, '0').replace(/[Il|!]/g, '1').replace(/S/g, '5').replace(/B/g, '8').replace(/Z/g, '2');
  const validDate = s => { const m = +s.slice(2, 4), d = +s.slice(4, 6); return m >= 1 && m <= 12 && d >= 1 && d <= 31; };
  let ic = '', icIdx = -1;
  for (let i = 0; i < lines.length && !ic; i++) {
    const m = fixDigits(lines[i]).match(/(\d{6})\D{0,3}(\d{2})\D{0,3}(\d{4})/);
    if (m && validDate(m[1])) { ic = m[1] + m[2] + m[3]; icIdx = i; }
  }
  if (!ic) { // fallback: 12 digits anywhere in the text
    const m = fixDigits(text).replace(/[\s-]/g, '').match(/\d{12}/);
    if (m && validDate(m[0])) ic = m[0];
  }

  // --- Name: a mostly-letters, mostly-uppercase line with 2+ words ---
  const isNameLine = l => {
    const up = l.toUpperCase();
    if (SKIP.test(up) || ADDR.test(up) || /\d/.test(l)) return false;
    const letters = l.replace(/[^A-Za-z]/g, '');
    const nonSpace = l.replace(/\s/g, '');
    if (letters.length < 6 || letters.length / nonSpace.length < 0.85) return false;
    if (letters.replace(/[^A-Z]/g, '').length / letters.length < 0.8) return false; // mostly uppercase
    return l.trim().split(/\s+/).filter(w => w.replace(/[^A-Za-z]/g, '').length >= 2).length >= 2;
  };
  const clean = l => l.replace(/[^A-Za-z@'/. ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();

  // Only search the lines right after the IC number (name sits just under it)
  let name = '';
  if (icIdx >= 0) {
    const after = lines.slice(icIdx + 1, icIdx + 6);
    const first = after.findIndex(isNameLine);
    if (first >= 0) {
      name = clean(after[first]);
      const next = after[first + 1];
      if (next && isNameLine(next)) name += ' ' + clean(next);
    }
  }
  return { ic, name };
}

export function makeOcrCanvas(source, sx, sy, sw, sh, mode) {
  const scale = Math.max(1, Math.min(3, 1800 / sw)); // upscale small images
  const c = document.createElement('canvas');
  c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data, n = d.length / 4;
  const gray = new Uint8ClampedArray(n);
  const hist = new Array(256).fill(0);
  for (let i = 0; i < n; i++) {
    const g = Math.round(0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2]);
    gray[i] = g; hist[g]++;
  }
  // contrast stretch (ignore 1% extremes)
  let lo = 0, hi = 255, acc = 0;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > n * 0.01) { lo = i; break; } }
  acc = 0;
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > n * 0.01) { hi = i; break; } }
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < n; i++) gray[i] = Math.max(0, Math.min(255, ((gray[i] - lo) * 255) / range));
  let thr = -1;
  if (mode === 'bw') { // Otsu threshold
    const h2 = new Array(256).fill(0);
    for (let i = 0; i < n; i++) h2[gray[i] | 0]++;
    let sum = 0; for (let i = 0; i < 256; i++) sum += i * h2[i];
    let sB = 0, wB = 0, best = 0;
    for (let i = 0; i < 256; i++) {
      wB += h2[i]; if (!wB) continue;
      const wF = n - wB; if (!wF) break;
      sB += i * h2[i];
      const mB = sB / wB, mF = (sum - sB) / wF;
      const v = wB * wF * (mB - mF) * (mB - mF);
      if (v > best) { best = v; thr = i; }
    }
  }
  for (let i = 0; i < n; i++) {
    const v = thr >= 0 ? (gray[i] > thr ? 255 : 0) : gray[i];
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function IcScanner({ onResult }) {
  const [open, setOpen] = useState(false);
  const [stream, setStream] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState('');
  const [raw, setRaw] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
  }, [stream, open]);
  useEffect(() => () => stream?.getTracks().forEach(t => t.stop()), [stream]);

  async function openCamera() {
    setMsg(''); setOpen(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 } } });
      setStream(s);
    } catch { setMsg('Camera unavailable — use "Upload photo" instead.'); }
  }
  function closeCamera() { stream?.getTracks().forEach(t => t.stop()); setStream(null); setOpen(false); }

  async function runOcr(source, w, h, fromCamera) {
    // from the live camera, crop to the dashed guide box
    const sx = fromCamera ? w * 0.08 : 0, sy = fromCamera ? h * 0.12 : 0;
    const sw = fromCamera ? w * 0.84 : w, sh = fromCamera ? h * 0.76 : h;
    const scale = Math.min(1, 1600 / sw);
    const c = document.createElement('canvas');
    c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
    c.getContext('2d').drawImage(source, sx, sy, sw, sh, 0, 0, c.width, c.height);

    setBusy(true); setMsg('Reading card…'); setRaw('');
    try {
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
      const f = new FormData();
      f.append('image', blob, 'ic.jpg');
      const res = await req('/auth/scan-ic', { method: 'POST', body: f });
      const ic = res.ic_number || '', name = res.name || '';
      if (!ic && !name) setMsg('Could not read the card. Try a clearer, closer photo — or type your details manually.');
      else {
        onResult({ ic, name });
        setMsg(`Filled${name ? ' name' : ''}${name && ic ? ' and' : ''}${ic ? ' IC number' : ''}.${!name || !ic ? ' Please type the rest.' : ''} Check them below.`);
      }
    } catch (e) {
      setMsg((e.message || 'Scan failed') + ' — please type your details manually.');
    }
    setBusy(false);
  }

  async function capture() {
    const v = videoRef.current;
    if (!v?.videoWidth) return;
    await runOcr(v, v.videoWidth, v.videoHeight, true);
    closeCamera();
  }
  async function upload(e) {
    const f = e.target.files[0];
    if (!f) return;
    const bmp = await createImageBitmap(f);
    await runOcr(bmp, bmp.width, bmp.height, false);
    e.target.value = '';
  }

  return (
    <div style={{ background: '#f0f6f9', border: '1px dashed var(--teal)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <strong style={{ fontSize: 13, color: 'var(--navy)' }}>🪪 Scan MyKad to auto-fill</strong>
      <small style={{ color: 'var(--gray3)' }}>Photo is read on your device and is not uploaded.</small>
      {open && (
        <div style={{ position: 'relative' }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', borderRadius: 8, background: '#000' }} />
          <div style={{ position: 'absolute', inset: '12% 8%', border: '2px dashed rgba(255,255,255,.8)', borderRadius: 8, pointerEvents: 'none' }} />
        </div>
      )}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!open && <button type="button" onClick={openCamera} disabled={busy} style={{ fontSize: 13 }}>📷 Take Photo</button>}
        {open && <button type="button" onClick={capture} disabled={busy || !stream} style={{ fontSize: 13, background: 'var(--ok)' }}>📸 Capture & Read</button>}
        {open && <button type="button" onClick={closeCamera} style={{ fontSize: 13, background: 'var(--gray3)' }}>Cancel</button>}
        <label style={{ fontSize: 13, background: 'var(--navy)', color: '#fff', padding: '8px 14px', borderRadius: 8, cursor: 'pointer' }}>
          🖼️ Upload Photo<input type="file" accept="image/*" capture="environment" onChange={upload} style={{ display: 'none' }} />
        </label>
      </div>
      {busy && <small style={{ color: 'var(--teal)', fontWeight: 600 }}>Reading…</small>}
      {msg && !busy && <small style={{ color: 'var(--navy)' }}>{msg}</small>}
      {raw && !busy && <details><summary style={{ fontSize: 11, cursor: 'pointer' }}>What the scanner read</summary><pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', margin: 0 }}>{raw}</pre></details>}
    </div>
  );
}

export default App;