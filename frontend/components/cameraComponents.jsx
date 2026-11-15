import React, { useEffect, useMemo, useRef, useState } from 'react';
import { API, MY_STATES, getPhotoUrl, req, SC, PC, SL, Badge } from './shared.jsx';

export function AICameraSystem({cameras,user,act}){
  let[name,N]=useState(''),[loc,L]=useState('');

  const isAdmin = user.role === 'admin';

  return <div className="panel panel-teal">
    <h2>🌊 AI Smart Water Level Monitoring</h2>
    <p style={{fontSize:14,color:'var(--gray3)',marginBottom:20}}>
      This system simulates a network of IoT-connected cameras across the drainage network.
      AI models process live video feeds to detect water levels and potential overflow in real-time.
    </p>

    {isAdmin && <div className="stat-card" style={{marginBottom:20,background:'#f0f6f9',border:'1px dashed var(--teal)'}}>
      <strong style={{fontSize:13,display:'block',marginBottom:10}}>➕ Register New Monitoring Camera (Admin Only)</strong>
      <div className="grid" style={{gap:10}}>
        <input value={name} onChange={e=>N(e.target.value)} placeholder="Camera Name (e.g. Smart Drain A)"/>
        <input value={loc} onChange={e=>L(e.target.value)} placeholder="Geographical Location (e.g. KLCC, Kuala Lumpur)"/>
        <button onClick={()=>{
          let f=new FormData();f.append('name',name);f.append('location',loc);
          act(()=>req('/ai-cameras',{method:'POST',body:f}),'Camera registered');
          N('');L('');
        }}>Add Camera</button>
      </div>
    </div>}

    <div className="grid" style={{gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))',gap:20}}>
      {cameras.map(c => <CameraCard key={c.id} camera={c} isAdmin={isAdmin} act={act} />)}
    </div>

    {!cameras.length && <p style={{textAlign:'center',padding:40,color:'var(--gray3)'}}>No smart monitoring cameras registered.</p>}
  </div>
}

export function CameraCard({camera, isAdmin, act}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [camError, setCamError] = useState('');
  const [aiLevel, setAiLevel] = useState(0);
  const [sam2Result, setSam2Result] = useState(null);
  const [useSam2, setUseSam2] = useState(false);

  const startCamera = async () => {
    try {
      setCamError('');
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
      setStream(s);
      // Use a timeout or next tick to ensure video element is rendered
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(console.error);
        }
      }, 100);
    } catch (e) {
      setCamError('Camera access denied or unavailable');
      console.error(e);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setAiLevel(0);
    }
  };

  useEffect(() => {
    let interval;
    if (stream && videoRef.current) {
      interval = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const video = videoRef.current;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        if (useSam2 && isAdmin) {
          // SAM 2 Enhanced AI: Send frame to backend for high-precision segmentation
          canvas.toBlob(async (blob) => {
            if (!blob) return;
            const f = new FormData();
            f.append('image', blob, 'frame.jpg');
            try {
              const res = await req(`/ai-cameras/${camera.id}/analyze-sam2`, {
                method: 'POST',
                body: f
              });
              if (res && res.sam2_analysis) {
                setSam2Result(res.sam2_analysis);
                const sam2Level = Math.round(res.sam2_analysis.water_area_ratio * 100);
                setAiLevel(prev => Math.round(prev * 0.5 + sam2Level * 0.5));
              }
            } catch (err) {
              console.error('SAM 2 Analysis failed:', err);
            }
          }, 'image/jpeg', 0.7);
        } else {
          // Basic AI: Local Vertical Height Detection
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

          let detectedHeight = 0;
          const rows = canvas.height;
          const cols = canvas.width;

          for (let x = 0; x < cols; x += 5) {
            let columnWaterHeight = 0;
            for (let y = rows - 1; y >= rows / 2; y--) {
              const idx = (y * cols + x) * 4;
              const r = data[idx], g = data[idx+1], b = data[idx+2];
              const isBlueish = b > r * 1.1 && b > g * 0.9;
              const isDark = r < 60 && g < 60 && b < 60;
              const isTurbid = g > r * 0.9 && b > r * 0.9 && (g+b) > (r*1.8);

              if (isBlueish || isDark || isTurbid) {
                columnWaterHeight++;
              } else break;
            }
            detectedHeight = Math.max(detectedHeight, columnWaterHeight);
          }

          const newLevel = Math.min(100, Math.round((detectedHeight / (rows / 2)) * 100));
          setAiLevel(prev => Math.round(prev * 0.8 + newLevel * 0.2));

          // Basic AI auto-update status
          const currentLevel = Math.round(aiLevel * 0.8 + newLevel * 0.2);
          const newStatus = currentLevel > 70 ? 'red' : 'green';
          if (newStatus !== camera.status && isAdmin) {
            let f = new FormData();
            f.append('status', newStatus);
           req(`/ai-cameras/${camera.id}`, {
             method: 'PATCH',
             body: f
           }).catch(console.error);
          }
        }
      }, 2000); // Increased interval to 2s to accommodate SAM 2 inference
    }
    return () => {
      if (interval) clearInterval(interval);
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [stream, camera.status, isAdmin, useSam2]);

  const c = camera;
  const isFlood = aiLevel > 70;
  const waterLevelRecognition = aiLevel > 70 ? 'HIGH' : (aiLevel > 30 ? 'MEDIUM' : 'LOW');

  // Simulation: Drain max height is 100cm
  const maxDrainHeight = 100;
  const currentWaterHeight = Math.round((aiLevel / 100) * maxDrainHeight);

  return (
    <div className="stat-card" style={{position:'relative',borderTopColor:isFlood?'#dc2626':'#059669'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <strong style={{fontSize:16}}>{c.name}</strong>
          <div style={{fontSize:12,color:'var(--gray3)',marginTop:4}}>
             {c.location || (c.latitude != null && c.longitude != null
              ? `${Number(c.latitude).toFixed(4)}, ${Number(c.longitude).toFixed(4)}`
             : 'Location unavailable')}
          </div>
        </div>
        <Badge label={isFlood?'FLOOD DETECTED':'NO FLOOD'} color={isFlood?'#dc2626':'#059669'}/>
      </div>

      <div style={{marginTop:15,background:'#000',height:160,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:10,color:'#fff',overflow:'hidden',position:'relative'}}>
        <canvas ref={canvasRef} width="80" height="60" style={{display:'none'}} />
        {stream ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{width:'100%', height:'100%', objectFit:'cover', position:'absolute', top:0, left:0}}
            />
            {/* AI Scan Overlay */}
            <div style={{
              position:'absolute',
              top: '50%',
              left: 0,
              right: 0,
              bottom: 0,
              borderTop: '2px solid rgba(255,255,255,0.3)',
              background: isFlood ? 'rgba(220,38,38,0.1)' : 'rgba(5,150,105,0.05)',
              pointerEvents: 'none',
              zIndex: 1
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '2px',
                background: isFlood ? '#ef4444' : '#10b981',
                boxShadow: `0 0 10px ${isFlood ? '#ef4444' : '#10b981'}`,
                animation: 'scan 2s infinite ease-in-out'
              }}/>
              <style>{`
                @keyframes scan {
                  0% { top: 0%; opacity: 0.5; }
                  50% { top: 100%; opacity: 1; }
                  100% { top: 0%; opacity: 0.5; }
                }
              `}</style>
            </div>
          </>
        ) : (
          <>
            <div style={{fontSize:40,opacity:0.3}}>📷</div>
            {camError ? (
              <div style={{fontSize:11, color:'#f87171', textAlign:'center', padding:'0 10px'}}>{camError}</div>
            ) : (
              <button onClick={startCamera} style={{fontSize:12, padding:'5px 10px', background:'var(--teal)'}}>Activate AI Monitoring</button>
            )}
          </>
        )}

        <div style={{position:'absolute',top:10,left:10,background:isFlood?'rgba(220,38,38,0.8)':'rgba(5,150,105,0.8)',padding:'2px 6px',borderRadius:4,fontSize:10,fontWeight:700,zIndex:2}}>
         {stream
           ? (useSam2
               ? `SAM 2 ENHANCED: ${waterLevelRecognition} LEVEL`
               : `AI RECOGNIZING: ${waterLevelRecognition} LEVEL`)
           : 'CAMERA OFFLINE'}
        </div>

        {useSam2 && sam2Result && (
          <div style={{position:'absolute',top:10,right:10,background:'rgba(30,58,138,0.8)',padding:'2px 6px',borderRadius:4,fontSize:9,color:'#fff',zIndex:2,textAlign:'right'}}>
            <div>SAM 2 Conf: {(sam2Result.confidence*100).toFixed(1)}%</div>
            <div>Inference: {sam2Result.inference_time_ms}ms</div>
          </div>
        )}

        {stream && <div style={{position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,0.7)', padding:8, zIndex:2}}>
           <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
             <div style={{fontSize:10,fontWeight:600,color:isFlood?'#ff8a8a':'#a7f3d0'}}>
               Water: {currentWaterHeight}cm / {maxDrainHeight}cm ({aiLevel}%)
             </div>
             <div style={{fontSize:9, color:'#fff', opacity:0.8}}>{isFlood?'FLOOD RISK':'NORMAL FLOW'}</div>
           </div>
           <div style={{width:'100%',height:6,background:'#333',borderRadius:3,marginTop:4,overflow:'hidden'}}>
             <div style={{width:`${aiLevel}%`,height:'100%',background:isFlood?'#dc2626':'#059669',transition:'width 0.5s'}}/>
           </div>
           <div style={{fontSize:8, color:'rgba(255,255,255,0.5)', marginTop:2, fontStyle:'italic'}}>
             Calculated: ({currentWaterHeight}cm / {maxDrainHeight}cm) × 100 = {aiLevel}%
           </div>
           <button onClick={stopCamera} style={{marginTop:8, fontSize:9, padding:'2px 5px', background:'rgba(255,255,255,0.2)', border:'none', color:'#fff', borderRadius:3, cursor:'pointer'}}>Deactivate</button>
        </div>}
      </div>

      {isAdmin && <div style={{marginTop:15,display:'flex',gap:8,alignItems:'center'}}>
        <button
          onClick={() => setUseSam2(!useSam2)}
          className="btn-small"
          style={{
            background: useSam2 ? 'var(--navy)' : '#e2e8f0',
            color: useSam2 ? '#fff' : '#475569',
            fontSize: 10,
            padding: '4px 8px',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          {useSam2 ? '✨ SAM 2 Active' : 'Enable SAM 2'}
        </button>
        <div style={{flex:1, fontSize:10, color:'var(--gray3)', fontStyle:'italic'}}>
          {useSam2 ? 'High-precision SAM 2 segmenting...' : 'Standard AI detection active.'}
        </div>
        <button
          onClick={()=>act(()=>req(`/ai-cameras/${c.id}`,{method:'DELETE'}),'Camera deleted')}
          style={{background:'transparent',color:'var(--danger)',fontSize:10,boxShadow:'none',padding:0}}
        >
          Remove
        </button>
      </div>}

      <div style={{fontSize:10,color:'var(--gray3)',marginTop:10,textAlign:'right'}}>Last sync: {new Date(c.last_update).toLocaleTimeString()}</div>
    </div>
  );
}

/* ═══════════════ shared water-level detection (same logic as CameraCard) ═══════════════ */
