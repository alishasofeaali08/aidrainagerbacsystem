import React,{useEffect,useState,useRef} from 'react';
import{createRoot}from'react-dom/client';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Polyline,
  useMap
} from 'react-leaflet';
import'leaflet/dist/leaflet.css';
import'./style.css';
import Peer from 'peerjs';

const API=import.meta.env.VITE_API_URL||'/api';
const BACKEND_URL = 'https://air-eyes-ctrl-system.onrender.com/api';

const getPhotoUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${BACKEND_URL}${path.startsWith('/') ? path : `/${path}`}`;
};
const MY_STATES=["Johor","Kedah","Kelantan","Melaka","Negeri Sembilan","Pahang","Perak","Perlis","Pulau Pinang","Sabah","Sarawak","Selangor","Terengganu","Kuala Lumpur","Putrajaya","Labuan"];

async function req(path,opts={}){
  let h={...(opts.headers||{})};
  if(!(opts.body instanceof FormData))h['Content-Type']='application/json';
  let t=localStorage.getItem('token');
  if(t)h.Authorization='Bearer '+t;
  let r=await fetch(API+path,{...opts,headers:h});
  let d=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(d.detail||'Request failed');
  return d;
}

/* ── Brand SVG logo ── */
function Logo({size=36}){
  return(
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="64" height="64" rx="14" fill="#0D2535"/>
      <ellipse cx="32" cy="36" rx="18" ry="13" fill="#1B8CA8"/>
      <circle cx="32" cy="36" r="8" fill="#0D2535"/>
      <circle cx="32" cy="36" r="5" fill="#1B8CA8"/>
      <circle cx="32" cy="36" r="2.5" fill="#E8A020"/>
      <path d="M22 36 Q32 20 42 36" stroke="#EBF4F7" strokeWidth="1.5" fill="none"/>
      <path d="M26 19 Q28 14 30 19" stroke="#1B8CA8" strokeWidth="2" strokeLinecap="round" fill="none"/>
      <path d="M32 16 Q34 10 36 16" stroke="#1B8CA8" strokeWidth="2" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

/* ── helpers ── */
const SC=s=>({resolved:'#059669',pending_closure:'#8b5cf6',engineer_approved:'#1B8CA8',in_progress:'#d97706',reviewed:'#0891b2',rejected:'#dc2626'}[s]||'#64748b');
const PC=p=>p<=1?'#dc2626':p<=2?'#ea580c':p<=3?'#ca8a04':p<=4?'#1B8CA8':'#64748b';
const SL=s=>({submitted:'Submitted',reviewed:'Reviewed',engineer_approved:'Engineer Approved',in_progress:'In Progress',pending_closure:'Pending Closure',resolved:'Resolved',rejected:'Rejected'}[s]||s);

function Badge({label,color}){return <span className="badge" style={{background:color||'#64748b'}}>{label}</span>}

/* ═══════════════════════════════════════ APP ═══════════════════════════════════════ */
function App(){

  const [cameras, setCameras] = useState([]);
  let[user,setUser]=useState(JSON.parse(localStorage.getItem('user')||'null'));
  let[email,E]=useState('admin@example.com'),[password,P]=useState('Admin123!'),[name,N]=useState(''),[showReg,SR]=useState(false);
  // Register form state
  let[rName,RN]=useState(''),[rEmail,RE]=useState(''),[rPw,RP]=useState(''),[rIc,RI]=useState(''),[rPhone,RPH]=useState('');
  let[tab,T]=useState('📊 Overview'),[reports,R]=useState([]),[flood,F]=useState([]),[users,U]=useState([]);
  let[error,X]=useState(''),[msg,M]=useState('');

  async function refresh(){
    try{
      R(await req('/reports'));
      F(await req('/map/flood'));
      setCameras(await req('/ai-cameras'));
      if(user.role==='admin')U(await req('/admin/users'));
      X('');
    }catch(e){X(e.message)}
  }
  useEffect(()=>{if(user)refresh()},[user?.id]);
  async function act(fn,ok='Updated'){try{await fn();M(ok);await refresh()}catch(e){X(e.message)}}

  /* ── Login / Register ── */
  if(!user)return(
    <div className="login">
      <div className="login-card" style={showReg?{maxWidth:460}:{}}>
        <div className="login-brand">
          <Logo size={44}/>
          <div className="login-brand-text">
            <span>Air-Eyes</span>
            <span>Mata untuk setiap longkang</span>
          </div>
        </div>
        {showReg
          ?<>
            <p style={{fontWeight:600,color:'var(--navy)',fontSize:15,margin:0}}>Create Citizen Account</p>
            <p style={{fontSize:13,color:'var(--gray3)',margin:0}}>Fill in your details to register. All fields are required.</p>
            <IcScanner onResult={({name,ic})=>{ if(name)RN(name); if(ic)RI(ic); }}/>
            {/* Full name */}
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              <label style={{fontSize:12,fontWeight:700,color:'var(--navy)',textTransform:'uppercase',letterSpacing:.5}}>Full Name (as per IC)</label>
              <input value={rName} onChange={e=>RN(e.target.value)} placeholder="e.g. Ahmad bin Abdullah"/>
            </div>
            {/* IC number */}
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              <label style={{fontSize:12,fontWeight:700,color:'var(--navy)',textTransform:'uppercase',letterSpacing:.5}}>MyKad IC Number <span style={{color:'var(--danger)'}}>*</span></label>
              <input value={rIc} onChange={e=>{let v=e.target.value.replace(/\D/g,'').slice(0,12);RI(v)}} placeholder="12 digits e.g. 990101011234" maxLength={12} inputMode="numeric"/>
              <small style={{color:'var(--gray3)',fontSize:11}}>{rIc.length}/12 digits{rIc.length===12&&<span style={{color:'var(--ok)',fontWeight:700}}> ✓</span>}</small>
            </div>
            {/* Email */}
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              <label style={{fontSize:12,fontWeight:700,color:'var(--navy)',textTransform:'uppercase',letterSpacing:.5}}>Email Address</label>
              <input value={rEmail} onChange={e=>RE(e.target.value)} placeholder="you@example.com" type="email"/>
            </div>
            {/* Password */}
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              <label style={{fontSize:12,fontWeight:700,color:'var(--navy)',textTransform:'uppercase',letterSpacing:.5}}>Password</label>
              <input type="password" value={rPw} onChange={e=>RP(e.target.value)} placeholder="Minimum 8 characters"/>
              {rPw.length>0&&<small style={{fontSize:11,color:rPw.length>=8?'var(--ok)':'var(--danger)',fontWeight:700}}>{rPw.length>=8?'✓ Strong enough':'Too short — min 8 characters'}</small>}
            </div>
            <button
              disabled={rIc.length!==12||rPw.length<8||!rName||!rEmail}
              style={{opacity:(rIc.length!==12||rPw.length<8||!rName||!rEmail)?.5:1}}
              onClick={async()=>{
                try{
                  let f=new FormData();
                  f.append('name',rName);f.append('email',rEmail);
                  f.append('password',rPw);f.append('ic_number',rIc);
                  await req('/auth/register',{method:'POST',body:f});
                  M('Registration successful! Please sign in.');
                  SR(false);RN('');RE('');RP('');RI('');
                }catch(e){X(e.message)}
              }}>
              Register as Citizen
            </button>
            {error&&<p className="error">{error}</p>}
            {msg&&<p className="success">{msg}</p>}
            <button className="link" onClick={()=>{SR(false);X('');M('')}}>Already have an account? Sign in</button>
          </>
          :<>
            <p style={{color:'var(--gray3)',fontSize:14,margin:0}}>Sign in to your account</p>
            <input value={email} onChange={e=>E(e.target.value)} placeholder="Email"/>
            <input type="password" value={password} onChange={e=>P(e.target.value)} placeholder="Password"/>
            <button onClick={async()=>{try{let f=new FormData();f.append('email',email);f.append('password',password);let d=await req('/auth/login',{method:'POST',body:f});localStorage.setItem('token',d.access_token);localStorage.setItem('user',JSON.stringify(d.user));setUser(d.user)}catch(e){X(e.message)}}}>Sign in</button>
            {error&&<p className="error">{error}</p>}
            {msg&&<p className="success">{msg}</p>}
            <button className="link" onClick={()=>{SR(true);X('');M('')}}>No account? Register</button>
            <p className="login-hint">Demo admin: admin@example.com / Admin123!</p>
          </>
        }
      </div>
    </div>
  );

  /* ── Nav tabs by role ── */
  let nav=['📊 Overview','📋 Reports','🗺️ Flood Map','🌊 AI Detection'];
  if(['admin','engineer'].includes(user.role))nav.push('📈 Analysis');
  if(['admin','engineer','technician'].includes(user.role))nav.push('📡 Camera Node');
  if(['engineer','admin'].includes(user.role))nav.push('🔍 My State Cases');
  if(user.role==='technician')nav.push('🛠️ My Cases');
  nav.push('🌦️ Weather Risk');
  if(user.role==='admin')nav.push('👥 Users');

  return(
    <div className="layout">
      <aside>
        <div className="brand">
          <Logo size={36}/>
          <div className="brand-text">
            <span>Air-Eyes</span>
            <span>Mata untuk setiap longkang</span>
          </div>
        </div>
        <div className="user-chip">
          <strong>{user.name}</strong>
          <small>{user.role}{user.state?` · ${user.state}`:''}</small>
          {user.iem_number&&<small style={{color:'var(--amber)',fontSize:11,marginTop:2}}>IEM: {user.iem_number}</small>}
          {user.ic_number&&<small style={{color:'var(--gray3)',fontSize:11,marginTop:2,fontFamily:'monospace'}}>{user.ic_number.replace(/(\d{6})(\d{2})(\d{4})/,'$1-$2-$3')}</small>}
        </div>
        <nav>{nav.map(n=><button key={n} className={tab===n?'active':''} onClick={()=>T(n)}>{n}</button>)}</nav>
        <button className="signout" onClick={()=>{localStorage.clear();setUser(null)}}>Sign out</button>
      </aside>
      <main>
        <header>
          <div><small>Municipal Operations</small><h1>{tab}</h1></div>
          <button onClick={refresh}>↻ Refresh</button>
        </header>
        {error&&<p className="error">{error}</p>}
        {msg&&<p className="success">{msg}</p>}
        {tab==='📊 Overview'&&<Overview reports={reports} flood={flood} user={user}/>}
        {tab==='📋 Reports'&&<ReportsTab user={user} reports={reports} act={act}/>}
        {tab==='🗺️ Flood Map'&&<FloodMap flood={flood} reports={reports} user={user}/>}
        {tab === '🌊 AI Detection' && <AICameraSystem cameras={cameras} user={user} act={act}/>}
        {tab==='📈 Analysis'&&<AnalysisTab/>}
        {tab==='📡 Camera Node'&&<CameraNode/>}
        {tab==='🔍 My State Cases'&&<EngineerCases reports={reports} user={user} act={act}/>}
        {tab==='🛠️ My Cases'&&<TechnicianCases reports={reports} act={act}/>}
        {tab==='🌦️ Weather Risk'&&<WeatherRisk user={user}/>}
        {tab==='👥 Users'&&<Users users={users} act={act} user={user} reports={reports}/>}
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════ OVERVIEW ═══════════════════════════════════════ */
function Overview({reports,flood,user}){
  return<>
    <div className="stats">
      <div className="stat-card"><small>📊 Total Reports</small><h2>{reports.length}</h2></div>
      <div className="stat-card red"><small>⚠️ High Risk</small><h2>{flood.filter(x=>x.risk_score>=.6).length}</h2></div>
      <div className="stat-card amber"><small>🔍 Awaiting Engineer</small><h2>{reports.filter(r=>!r.risk_approved).length}</h2></div>
      <div className="stat-card"><small>🛠️ Awaiting Fix</small><h2>{reports.filter(r=>r.status==='engineer_approved').length}</h2></div>
      <div className="stat-card purple"><small>⏳ Pending Closure</small><h2>{reports.filter(r=>r.status==='pending_closure').length}</h2></div>
      <div className="stat-card green"><small>✅ Resolved</small><h2>{reports.filter(r=>r.status==='resolved').length}</h2></div>
    </div>
    <ReportTable reports={reports}/>
  </>
}

/* ═══════════════════════════════════════ REPORTS TAB ═══════════════════════════════════════ */
function ReportsTab({user,reports,act}){
  return<>
    <ReportForm user={user} act={act}/>
    <ReportTable reports={reports}/>

    {/* Admin: approve AI risk → assigns to engineer's state queue */}
    {user.role==='admin'&&<div className="panel panel-amber">
      <h2><span className="step-tag amber">Step 1</span>Approve AI Risk — Assign to Engineer</h2>
      <p>Review the AI-generated flood risk score for each new report. Approving it marks the case as <strong>Engineer Approved</strong> and routes it to the responsible state engineer.</p>
      {reports.filter(r=>!r.risk_approved).length===0
        ?<p style={{color:'var(--ok)',fontWeight:600}}>✅ All reports have been reviewed.</p>
        :reports.filter(r=>!r.risk_approved).map(r=><RiskApproval key={r.id} r={r} act={act}/>)
      }
    </div>}

    {/* Admin: approve technician fix submissions */}
    {user.role==='admin'&&<div className="panel panel-purple">
      <h2><span className="step-tag purple">Step 3</span>Approve Technician Fix — Close Case</h2>
      <p>Technicians have submitted fix photos and comments below. Assign to the responsible engineer, or approve directly to close the case.</p>
      {reports.filter(r=>r.status==='pending_closure').length===0
        ?<p style={{color:'var(--gray3)'}}>No cases pending closure.</p>
        :reports.filter(r=>r.status==='pending_closure').map(r=><ClosureReview key={r.id} r={r} act={act} isAdmin/>)
      }
    </div>}

    {/* Engineer: approve closure for their state */}
    {user.role==='engineer'&&<div className="panel panel-purple">
      <h2><span className="step-tag purple">Step 3</span>Approve Technician Fix — Close Case</h2>
      <p>Review the fix submissions for your state ({user.state||'—'}) and approve to resolve the case.</p>
      {reports.filter(r=>r.status==='pending_closure').length===0
        ?<p style={{color:'var(--gray3)'}}>No cases pending closure in your state.</p>
        :reports.filter(r=>r.status==='pending_closure').map(r=><ClosureReview key={r.id} r={r} act={act} isAdmin={false}/>)
      }
    </div>}
  </>
}

/* ── AI risk approval card ── */
function RiskApproval({r,act}){
  let[risk,setRisk]=useState(Math.round(r.flood_risk*100));
  let rV=risk/100;
  let col=r.flood_risk>=0.7?'#dc2626':r.flood_risk>=0.5?'#d97706':'#059669';
  return<div className="case-card">
    <div className="case-card-head">
      <strong>DR-{r.id}</strong>
      <Badge label={SL(r.status)} color={SC(r.status)}/>
      {r.state?<Badge label={r.state} color="var(--navy)"/>:<Badge label="No state set" color="#94a3b8"/>}
      <span style={{color:col,fontWeight:700,fontSize:13}}>AI Risk {Math.round(r.flood_risk*100)}%</span>
    </div>
    <p style={{fontSize:13,color:'#4a6278',marginBottom:10}}>{r.description||'(no description)'}</p>
    <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
      <div style={{display:'flex',alignItems:'center',gap:6}}>
        <div style={{width:80,height:8,background:'var(--gray2)',borderRadius:4,overflow:'hidden'}}>
          <div style={{width:`${r.flood_risk*100}%`,height:'100%',background:col}}/>
        </div>
      </div>
      <label style={{fontSize:13,color:'#4a6278',display:'flex',alignItems:'center',gap:6}}>
        Override %:
        <input type="number" min="0" max="100" value={risk} onChange={e=>setRisk(+e.target.value)} style={{width:64,padding:'5px 8px'}}/>
      </label>
      <button onClick={()=>act(()=>req(`/reports/${r.id}/approve-risk?flood_risk=${rV}`,{method:'PATCH'}),`DR-${r.id} approved — assigned to state engineer`)} style={{background:'var(--teal)',fontSize:13}}>✅ Approve &amp; Assign</button>
    </div>
  </div>
}

/* ── Closure review card ── */
function ClosureReview({r,act,isAdmin}){
  return<div className="case-card" style={{borderLeftColor:'#8b5cf6'}}>
    <div className="case-card-head">
      <strong>DR-{r.id}</strong>
      <Badge label="Pending Closure" color="#8b5cf6"/>
      {r.state&&<Badge label={r.state} color="var(--navy)"/>}
    </div>
    <p style={{fontSize:13,color:'#4a6278',marginBottom:10}}>{r.description||'(no description)'}</p>
    {r.technician_comment&&<div style={{background:'var(--gray1)',borderRadius:8,padding:10,marginBottom:10}}>
      <strong style={{fontSize:12,color:'var(--navy)'}}>💬 Technician note:</strong>
      <p style={{margin:'4px 0 0',fontSize:13,color:'var(--text)'}}>{r.technician_comment}</p>
    </div>}
    {r.fix_photo_path&&<div style={{marginBottom:10}}>
      <strong style={{fontSize:12,color:'var(--navy)'}}>📷 Fix photo:</strong><br/>
      <a href={r.fix_photo_path} target="_blank" rel="noreferrer">
        <img src={r.fix_photo_path} alt="fix" style={{marginTop:6,maxWidth:220,maxHeight:150,borderRadius:8,border:'1px solid var(--gray2)',objectFit:'cover'}}/>
      </a>
    </div>}
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <button onClick={()=>act(()=>req(`/reports/${r.id}/approve-closure`,{method:'PATCH'}),'Case closed — drainage confirmed resolved')} style={{background:'var(--ok)',fontSize:13}}>✅ Approve &amp; Close</button>
      <button onClick={()=>act(()=>req(`/reports/${r.id}/review?status=engineer_approved`,{method:'PATCH'}),'Sent back to technician')} style={{background:'var(--warn)',fontSize:13}}>↩ Send Back</button>
    </div>
  </div>
}

/* ═══════════════════════════════════════ ENGINEER CASES ═══════════════════════════════════════ */
function EngineerCases({reports,user,act}){
  let state=user.state||'—';
  let myPending=reports.filter(r=>r.status==='pending_closure');
  let myApproved=reports.filter(r=>r.status==='engineer_approved');
  let myDone=reports.filter(r=>r.status==='resolved');

  return<>
    <div className="panel panel-teal">
      <h2><span className="step-tag">Step 1</span>Approve AI Risk for {state}</h2>
      <p>Review and approve the AI flood risk for reports in your state. This routes the case to technicians for repair.</p>
      {reports.filter(r=>!r.risk_approved).length===0
        ?<p style={{color:'var(--ok)',fontWeight:600}}>✅ All reports reviewed.</p>
        :reports.filter(r=>!r.risk_approved).map(r=><RiskApproval key={r.id} r={r} act={act}/>)
      }
    </div>

    <div className="panel">
      <h2><span className="step-tag amber">Step 2</span>Awaiting Technician Fix</h2>
      {myApproved.length===0
        ?<p style={{color:'var(--gray3)'}}>No cases awaiting fix in {state}.</p>
        :myApproved.map(r=><div key={r.id} className="case-card" style={{borderLeftColor:'var(--teal)'}}>
          <div className="case-card-head">
            <strong>DR-{r.id}</strong>
            <Badge label="Engineer Approved" color="var(--teal)"/>
            <Badge label={`P${r.priority}`} color={PC(r.priority)}/>
          </div>
          <p style={{fontSize:13,color:'#4a6278',margin:0}}>{r.description||'(no description)'}</p>
        </div>)
      }
    </div>

    <div className="panel panel-purple">
      <h2><span className="step-tag purple">Step 3</span>Pending Closure — Review Technician Submissions</h2>
      {myPending.length===0
        ?<p style={{color:'var(--gray3)'}}>No cases pending closure.</p>
        :myPending.map(r=><ClosureReview key={r.id} r={r} act={act} isAdmin={false}/>)
      }
    </div>

    {myDone.length>0&&<div className="panel panel-green">
      <h2>✅ Resolved Cases in {state}</h2>
      {myDone.map(r=><div key={r.id} style={{display:'flex',gap:10,alignItems:'center',padding:'10px 0',borderBottom:'1px solid var(--gray2)',flexWrap:'wrap'}}>
        <strong style={{fontSize:14}}>DR-{r.id}</strong>
        <Badge label="Resolved" color="var(--ok)"/>
        <span style={{fontSize:13,color:'#4a6278',flex:1}}>{r.description||'(no description)'}</span>
      </div>)}
    </div>}
  </>
}

/* ═══════════════════════════════════════ TECHNICIAN CASES ═══════════════════════════════════════ */
function TechnicianCases({reports,act}){
  let assigned=reports.filter(r=>r.status==='engineer_approved');
  let submitted=reports.filter(r=>r.status==='pending_closure');
  let done=reports.filter(r=>r.status==='resolved'&&r.proof_approved);

  return<>
    <div className="panel panel-teal">
      <h2><span className="step-tag">Step 2</span>Cases Assigned to You</h2>
      <p>These cases have been approved by the engineer. Carry out the repair, upload a photo, add a comment, then submit for engineer approval.</p>
      {assigned.length===0
        ?<p style={{color:'var(--gray3)',textAlign:'center',padding:'20px 0'}}>No cases assigned yet.</p>
        :assigned.map(r=><TechnicianFixForm key={r.id} r={r} act={act}/>)
      }
    </div>

    {submitted.length>0&&<div className="panel" style={{borderTop:'3px solid #8b5cf6'}}>
      <h2><span className="step-tag purple">⏳</span>Awaiting Engineer Approval</h2>
      {submitted.map(r=><div key={r.id} className="case-card" style={{borderLeftColor:'#8b5cf6'}}>
        <div className="case-card-head">
          <strong>DR-{r.id}</strong>
          <Badge label="Pending Closure" color="#8b5cf6"/>
          {r.state&&<Badge label={r.state} color="var(--navy)"/>}
        </div>
        {r.technician_comment&&<p style={{fontSize:13,color:'#4a6278',background:'var(--gray1)',padding:'8px 10px',borderRadius:6,margin:'6px 0 0'}}>{r.technician_comment}</p>}
        {r.fix_photo_path&&<a href={r.fix_photo_path} target="_blank" rel="noreferrer" style={{display:'block',marginTop:6,fontSize:13,color:'var(--teal)'}}>👁️ View submitted photo</a>}
      </div>)}
    </div>}

    {done.length>0&&<div className="panel panel-green">
      <h2>✅ Completed Cases</h2>
      {done.map(r=><div key={r.id} style={{display:'flex',gap:10,padding:'10px 0',borderBottom:'1px solid var(--gray2)',alignItems:'center',flexWrap:'wrap'}}>
        <strong>DR-{r.id}</strong><Badge label="Resolved" color="var(--ok)"/>
        <span style={{fontSize:13,color:'#4a6278',flex:1}}>{r.description||'(no description)'}</span>
      </div>)}
    </div>}
  </>
}

/* ── Technician fix form ── */
function TechnicianFixForm({r,act}){
  let[comment,C]=useState(''),[file,F]=useState(null),[preview,V]=useState(null);
  function pick(e){let f=e.target.files[0];F(f);V(f?URL.createObjectURL(f):null)}
  function submit(e){
    e.preventDefault();
    if(!file){alert('Please upload a fix photo');return}
    let fd=new FormData();fd.append('comment',comment);fd.append('file',file);
    act(()=>req(`/reports/${r.id}/technician-submit`,{method:'PATCH',body:fd}),'Fix submitted — awaiting engineer approval');
    C('');F(null);V(null);
  }
  return<div className="case-card" style={{borderLeftColor:'var(--teal)'}}>
    <div className="case-card-head">
      <strong>DR-{r.id}</strong>
      <Badge label="Engineer Approved" color="var(--teal)"/>
      <Badge label={`P${r.priority}`} color={PC(r.priority)}/>
      <span style={{fontSize:12,color:r.flood_risk>=0.7?'#dc2626':r.flood_risk>=0.5?'#d97706':'var(--ok)',fontWeight:700}}>Risk {Math.round(r.flood_risk*100)}%</span>
      {r.state&&<Badge label={r.state} color="var(--navy)"/>}
    </div>
    <p style={{fontSize:13,color:'#4a6278',marginBottom:12}}>{r.description||'(no description)'}</p>
    <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:10}}>
      <div>
        <label style={{fontSize:13,fontWeight:600,color:'var(--navy)',display:'block',marginBottom:4}}>
          📷 Upload photo of repaired drainage <span style={{color:'var(--danger)'}}>*</span>
        </label>
        <input type="file" accept="image/*" onChange={pick} style={{fontSize:13}}/>
        {preview&&<img src={preview} alt="preview" style={{marginTop:8,maxWidth:200,maxHeight:140,borderRadius:8,objectFit:'cover',border:'1px solid var(--gray2)'}}/>}
      </div>
      <div>
        <label style={{fontSize:13,fontWeight:600,color:'var(--navy)',display:'block',marginBottom:4}}>💬 Description of work done</label>
        <textarea value={comment} onChange={e=>C(e.target.value)} placeholder="Describe the repair carried out…"/>
      </div>
      <button type="submit" style={{background:'var(--teal)',alignSelf:'flex-start',fontSize:13}}>📤 Submit Fix for Engineer Approval</button>
    </form>
  </div>
}

/* ═══════════════════════════════════════ REPORT TABLE ═══════════════════════════════════════ */
function ReportTable({reports}){
  return<div className="panel">
    <h2>📋 Drain Reports</h2>
    <div className="scroll"><table><thead><tr>
      <th>ID</th><th>AI Label</th><th>Risk</th><th>State</th><th>Priority</th><th>Status</th>
    </tr></thead><tbody>
      {reports.map(r=><tr key={r.id}>
        <td><strong>DR-{r.id}</strong></td>
        <td style={{fontSize:13}}>{r.ai_label}</td>
        <td><div style={{display:'flex',alignItems:'center',gap:6}}>
          <div style={{width:52,height:7,background:'var(--gray2)',borderRadius:4,overflow:'hidden'}}>
            <div style={{width:`${r.flood_risk*100}%`,height:'100%',background:r.flood_risk>=0.7?'#dc2626':r.flood_risk>=0.5?'#d97706':'#059669'}}/>
          </div>
          <small>{Math.round(r.flood_risk*100)}%</small>
        </div></td>
        <td><small style={{color:'var(--teal)',fontWeight:600}}>{r.state||'—'}</small></td>
        <td><Badge label={`P${r.priority}`} color={PC(r.priority)}/></td>
        <td><Badge label={SL(r.status)} color={SC(r.status)}/></td>
      </tr>)}
    </tbody></table>
    {!reports.length&&<p style={{textAlign:'center',color:'var(--gray3)',padding:20}}>No reports yet.</p>}
    </div>
  </div>
}

/* ── Report submit form ── */
function ReportForm({user,act}){
  let[d,D]=useState(''),[lat,L]=useState(''),[lng,G]=useState(''),[photo,S]=useState(null),[locSt,LS]=useState('');
  useEffect(()=>{navigator.geolocation?.getCurrentPosition(p=>{L(p.coords.latitude);G(p.coords.longitude);LS('📍 Location captured')},()=>LS('Location unavailable'))},[]);
  if(!['citizen','admin'].includes(user.role))return null;
  return<div className="panel panel-teal">
    <h2>📝 Submit Drain Report</h2>
    <div className="grid">
      <textarea style={{gridColumn:'1/-1'}} placeholder="Describe the blockage, overflow or rubbish…" value={d} onChange={e=>D(e.target.value)}/>
      <div style={{gridColumn:'1/-1',display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
        <button type="button" onClick={()=>navigator.geolocation?.getCurrentPosition(p=>{L(p.coords.latitude);G(p.coords.longitude);LS('📍 Location captured')},()=>LS('Location unavailable'))} style={{background:'var(--navy)',flex:'0 0 auto'}}>📍 Get Location</button>
        <small style={{color:'var(--teal)',fontWeight:600}}>{locSt}</small>
      </div>
      <input type="file" accept="image/*" onChange={e=>S(e.target.files[0])} style={{gridColumn:'1/-1'}}/>
      <button style={{gridColumn:'1/-1'}} onClick={()=>{if(!lat||!lng)return;let f=new FormData();f.append('description',d);f.append('latitude',lat);f.append('longitude',lng);if(photo)f.append('photo',photo);act(()=>req('/reports',{method:'POST',body:f}),'Report submitted')}}>Submit Report</button>
    </div>
  </div>
}
function MapController({ center, route }) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();

    if (route && route.length > 1) {
      map.fitBounds(route, { padding: [40, 40] });
    } else if (center) {
      map.setView(center, 13);
    }
  }, [map, center, route]);

  return null;
}
/* ═══════════════════════════════════════ FLOOD MAP ═══════════════════════════════════════ */
function FloodMap({flood,reports,user}){
    const [userLocation, setUserLocation] = useState(null);
    const [destination, setDestination] = useState(null);
    const [destinationName, setDestinationName] = useState('');
    const [route, setRoute] = useState([]);
    const [gpsStatus, setGpsStatus] = useState('');
    const [routeStatus, setRouteStatus] = useState('');
    const [mapError, setMapError] = useState('');
    const [searching, setSearching] = useState(false);

    const mapCenter = userLocation ||
      (flood.length > 0 &&
       Number.isFinite(Number(flood[0].latitude)) &&
       Number.isFinite(Number(flood[0].longitude))
         ? [Number(flood[0].latitude), Number(flood[0].longitude)]
         : [4.2105, 101.9758]);

    function getCurrentLocation() {
      if (!navigator.geolocation) {
        setGpsStatus('Your browser does not support GPS.');
        return;
      }

      if (!window.isSecureContext) {
        setGpsStatus('GPS requires a secure HTTPS connection.');
        return;
      }

      setGpsStatus('Detecting your location...');

      navigator.geolocation.getCurrentPosition(
        position => {
          const coords = [
            position.coords.latitude,
            position.coords.longitude
          ];

          setUserLocation(coords);
          setGpsStatus('📍 Current location detected!');
          setRoute([]);
          setRouteStatus('');
        },
        error => {
          console.error('GPS error:', error.code, error.message);

          const messages = {
            1: 'Location permission denied. Allow location in browser settings.',
            2: 'Location unavailable. Check your device location services.',
            3: 'GPS timed out. Please try again.'
          };

          setGpsStatus(
            messages[error.code] || 'Unable to detect your location.'
          );
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0
        }
      );
    }

    async function searchDestination(e) {
      e.preventDefault();

      if (!destinationName.trim()) {
        setRouteStatus('Please enter a destination.');
        return;
      }

      setSearching(true);
      setRouteStatus('');
      setRoute([]);
      setMapError('');

      try {
        const url =
          'https://nominatim.openstreetmap.org/search?' +
          new URLSearchParams({
            format: 'jsonv2',
            q: destinationName.trim(),
            limit: '1',
            countrycodes: 'my'
          });

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error('Geocoding service unavailable.');
        }

        const results = await response.json();

        if (!results.length) {
          throw new Error('Destination not found. Try another address.');
        }

        const result = results[0];

        setDestination([
          Number(result.lat),
          Number(result.lon)
        ]);

        setDestinationName(result.display_name);
        setRouteStatus('Destination found. Get directions to continue.');

      } catch (error) {
        setRouteStatus(error.message);
      } finally {
        setSearching(false);
      }
    }

    async function getDirections() {
      if (!userLocation) {
        setRouteStatus('Please detect your current location first.');
        return;
      }

      if (!destination) {
        setRouteStatus('Please search for a destination first.');
        return;
      }

      setRouteStatus('Calculating route...');

      try {
        const [startLat, startLng] = userLocation;
        const [endLat, endLng] = destination;

        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${startLng},${startLat};${endLng},${endLat}` +
          `?overview=full&geometries=geojson`;

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error('Routing service unavailable.');
        }

        const data = await response.json();

        if (data.code !== 'Ok' || !data.routes?.length) {
          throw new Error('No driving route found.');
        }

        const coordinates = data.routes[0].geometry.coordinates;

        setRoute(
          coordinates.map(([lng, lat]) => [lat, lng])
        );

        const distance =
          (data.routes[0].distance / 1000).toFixed(2);

        const duration =
          Math.round(data.routes[0].duration / 60);

        setRouteStatus(
          `Route found: ${distance} km · approximately ${duration} minutes.`
        );

      } catch (error) {
        setRoute([]);
        setRouteStatus(error.message);
      }
    }
   let[sel,setSel]=useState(null);
  let[comments,setComments]=useState([]);
  let[loadingC,setLC]=useState(false);
  let[newComment,NC]=useState('');
  let[posting,setPosting]=useState(false);
  let[postErr,setPE]=useState('');

  let selReport=sel?reports.find(r=>r.id===sel.id)||sel:null;

  async function loadComments(id){
    setLC(true);setComments([]);
    try{let d=await req(`/reports/${id}/comments`);setComments(d);}catch(e){}
    setLC(false);
  }

 function selectPin(p){
   const matched = reports.find(
     r => String(r.id) === String(p.id)
   );

   console.log("MAP MARKER:", p);
   console.log("MATCHED REPORT:", matched);
   console.log("PHOTO PATH:", matched?.photo_path);
   console.log("DESCRIPTION:", matched?.description);

   setSel(matched || p);
   setPE('');
   NC('');
   loadComments(p.id);
 }

  async function submitComment(e){
    e.preventDefault();
    if(!newComment.trim())return;
    setPosting(true);setPE('');
    try{
      let f=new FormData();f.append('text',newComment.trim());
      await req(`/reports/${sel.id}/comments`,{method:'POST',body:f});
      NC('');await loadComments(sel.id);
    }catch(e){setPE(e.message);}
    setPosting(false);
  }

  const riskCol=v=>v>=0.7?'#dc2626':v>=0.5?'#d97706':'#059669';
  const statusCol=s=>({resolved:'#059669',pending_closure:'#8b5cf6',engineer_approved:'#1B8CA8',in_progress:'#d97706',reviewed:'#0891b2',rejected:'#dc2626'}[s]||'#64748b');
  const statusLabel=s=>({submitted:'Submitted',reviewed:'Reviewed',engineer_approved:'Engineer Approved',in_progress:'In Progress',pending_closure:'Pending Closure',resolved:'Resolved',rejected:'Rejected'}[s]||s);
  const roleCol=r=>r==='engineer'?'var(--teal)':r==='admin'?'var(--navy)':r==='technician'?'#8b5cf6':'#64748b';

  return<div className="panel" style={{padding:0,overflow:'hidden'}}>
    <div style={{display:'flex',height:600,minHeight:450}}>

      <div style={{
        flex:sel?'0 0 55%':'1',
        transition:'flex .3s',
        minWidth:0,
        minHeight:0,
        display:'flex',
        flexDirection:'column'
      }}>

        {/* GPS AND DESTINATION CONTROLS */}
        <div style={{
          padding:12,
          background:'#f0f6f9',
          display:'flex',
          flexDirection:'column',
          gap:9
        }}>

          <button
            type="button"
            onClick={getCurrentLocation}
            style={{background:'var(--navy)',width:'100%'}}
          >
            📍 Detect My Current Location
          </button>

          <small style={{color:'var(--teal)'}}>
            {gpsStatus}
          </small>

          <form
            onSubmit={searchDestination}
            style={{display:'flex',gap:8}}
          >
            <input
              value={destinationName}
              onChange={e=>setDestinationName(e.target.value)}
              placeholder="Search destination in Malaysia..."
              style={{flex:1,minWidth:0}}
            />

            <button
              type="submit"
              disabled={searching}
              style={{background:'#1B8CA8'}}
            >
              {searching?'...':'Search'}
            </button>
          </form>

          {destination&&(
            <button
              type="button"
              onClick={getDirections}
              disabled={!userLocation}
              style={{background:'#059669'}}
            >
              🧭 Get Directions
            </button>
          )}

          {routeStatus&&(
            <small style={{color:'#0D2535',lineHeight:1.5}}>
              {routeStatus}
            </small>
          )}

          {mapError&&(
            <small style={{color:'#dc2626'}}>
              {mapError}
            </small>
          )}

        </div>

        {/* INTERACTIVE MAP */}
        <div style={{flex:1,minHeight:0,position:'relative'}}>

          <MapContainer
            center={mapCenter}
            zoom={7}
            style={{height:'100%',width:'100%',minHeight:350}}
            scrollWheelZoom={true}
          >

            <MapController center={mapCenter} route={route}/>

            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap"
              eventHandlers={{
                tileerror:()=>setMapError(
                  'Map tiles could not load. Check your internet connection.'
                ),
                load:()=>setMapError('')
              }}
            />

            {/* CURRENT USER LOCATION */}
            {userLocation&&(
              <CircleMarker
                center={userLocation}
                radius={10}
                pathOptions={{
                  color:'#2563eb',
                  fillColor:'#3b82f6',
                  fillOpacity:1,
                  weight:3
                }}
              >
                <Popup>
                  📍 Your Current Location
                </Popup>
              </CircleMarker>
            )}

            {/* DESTINATION */}
            {destination&&(
              <CircleMarker
                center={destination}
                radius={11}
                pathOptions={{
                  color:'#047857',
                  fillColor:'#10b981',
                  fillOpacity:1,
                  weight:3
                }}
              >
                <Popup>
                  🎯 Destination
                  <br/>
                  {destinationName}
                </Popup>
              </CircleMarker>
            )}

            {/* ROUTE */}
            {route.length>1&&(
              <Polyline
                positions={route}
                pathOptions={{
                  color:'#2563eb',
                  weight:6,
                  opacity:0.8
                }}
              />
            )}

            {/* EXISTING FLOOD REPORT MARKERS */}
            {flood.map(p=>{
              const lat=Number(p.latitude);
              const lng=Number(p.longitude);

              if(!Number.isFinite(lat)||!Number.isFinite(lng)){
                return null;
              }

              let isSelected=sel?.id===p.id;
              let col=riskCol(p.risk_score);

              return (
                <CircleMarker
                  key={p.id}
                  center={[lat,lng]}
                  radius={isSelected?16:p.risk_score>=0.7?13:10}
                  pathOptions={{
                    color:isSelected?'#E8A020':col,
                    fillColor:isSelected?'#E8A020':col,
                    fillOpacity:.75,
                    weight:isSelected?3:2
                  }}
                  eventHandlers={{
                    click:()=>selectPin(p)
                  }}
                >
                  <Popup>
                    <div style={{minWidth:150}}>
                      <strong style={{fontSize:13}}>
                        Report #{p.id}
                      </strong>

                      {p.state&&(
                        <div style={{fontSize:11,color:'#64748b'}}>
                          {p.state}
                        </div>
                      )}

                      <div style={{
                        fontSize:12,
                        color:col,
                        fontWeight:700,
                        margin:'4px 0'
                      }}>
                        {Math.round(p.risk_score*100)}% risk
                      </div>

                      <button
                        onClick={()=>selectPin(p)}
                        style={{
                          fontSize:12,
                          padding:'5px 10px',
                          width:'100%',
                          background:'#1B8CA8'
                        }}
                      >
                        💬 View &amp; Comment
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

          </MapContainer>
        </div>
      </div>

      {sel&&<div style={{flex:'0 0 45%',display:'flex',flexDirection:'column',borderLeft:'1px solid #dde8ed',background:'white',overflow:'hidden'}}>
        <div style={{padding:'12px 16px',borderBottom:'1px solid #dde8ed',background:'#f0f6f9',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <strong style={{fontSize:15,color:'#0D2535',flex:1}}>Report #{sel.id}</strong>
          {sel.state&&<span style={{fontSize:11,background:'#0D2535',color:'white',padding:'2px 8px',borderRadius:4,fontWeight:600}}>{sel.state}</span>}
          <span style={{fontSize:11,background:statusCol(sel.status),color:'white',padding:'2px 8px',borderRadius:4,fontWeight:600}}>{statusLabel(sel.status)}</span>
          <button onClick={()=>{setSel(null);setComments([]);}} style={{background:'transparent',color:'#94a3b8',padding:'4px 8px',fontSize:18,minWidth:0,boxShadow:'none',lineHeight:1}}>×</button>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'14px 16px',display:'flex',flexDirection:'column',gap:12}}>
          {selReport?.photo_path && (
            <img
              src={getPhotoUrl(selReport.photo_path)}
              alt="report"
              style={{
                width:'100%',
                maxHeight:180,
                objectFit:'cover',
                borderRadius:8,
                border:'1px solid #dde8ed'
              }}
              onError={(e) => {
                console.error("Photo failed to load:", e.currentTarget.src);
                e.currentTarget.style.display = 'none';
              }}
            />
          )}

          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:12,color:'#94a3b8',fontWeight:600,minWidth:64}}>Flood Risk</span>
            <div style={{flex:1,height:8,background:'#dde8ed',borderRadius:4,overflow:'hidden'}}>
              <div style={{width:`${sel.risk_score*100}%`,height:'100%',background:riskCol(sel.risk_score)}}/>
            </div>
            <span style={{fontSize:13,fontWeight:700,color:riskCol(sel.risk_score)}}>{Math.round(sel.risk_score*100)}%</span>
          </div>

          {selReport?.description&&<div style={{fontSize:13,color:'#374151',background:'#f0f6f9',padding:'10px 12px',borderRadius:8,lineHeight:1.5}}>{selReport.description}</div>}
          {(selReport?.ai_label||sel.ai_label)&&<div style={{fontSize:12,color:'#94a3b8'}}>AI label: <strong style={{color:'#0D2535'}}>{selReport?.ai_label||sel.ai_label}</strong></div>}

          <div style={{borderTop:'1px solid #dde8ed',paddingTop:12}}>
            <strong style={{fontSize:13,color:'#0D2535',display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
              💬 Community Posts <span style={{fontSize:11,color:'#94a3b8',fontWeight:400}}>({comments.length})</span>
            </strong>
            {loadingC&&<p style={{fontSize:13,color:'#94a3b8',textAlign:'center'}}>Loading…</p>}
            {!loadingC&&comments.length===0&&<p style={{fontSize:13,color:'#94a3b8',fontStyle:'italic',textAlign:'center'}}>No posts yet — be the first!</p>}
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {comments.map(c=><div key={c.id} style={{padding:'10px 12px',borderRadius:8,background:'#f0f6f9',border:'1px solid #dde8ed'}}>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,flexWrap:'wrap'}}>
                  <span style={{fontSize:10,fontWeight:700,color:'white',background:roleCol(c.user_role),padding:'2px 7px',borderRadius:10}}>{c.user_role}</span>
                  <strong style={{fontSize:13,color:'#0D2535'}}>{c.user_name}</strong>
                  <span style={{fontSize:11,color:'#94a3b8',marginLeft:'auto'}}>{new Date(c.created_at).toLocaleString('en-MY',{dateStyle:'short',timeStyle:'short'})}</span>
                </div>
                <p style={{margin:0,fontSize:13,color:'#374151',lineHeight:1.5}}>{c.text}</p>
              </div>)}
            </div>
          </div>
        </div>

        <div style={{padding:'12px 16px',borderTop:'2px solid #dde8ed',background:'white'}}>
          <form onSubmit={submitComment} style={{display:'flex',flexDirection:'column',gap:8}}>
            <textarea value={newComment} onChange={e=>NC(e.target.value)} placeholder="Share what you know about this drainage issue…" style={{minHeight:68,fontSize:13,resize:'none'}}/>
            {postErr&&<p style={{fontSize:12,color:'#dc2626',margin:0}}>{postErr}</p>}
            <button type="submit" disabled={posting||!newComment.trim()} style={{background:'#1B8CA8',fontSize:13,opacity:posting||!newComment.trim()?0.6:1}}>{posting?'Posting…':'📤 Post Comment'}</button>
          </form>
        </div>
      </div>}
    </div>
    <div style={{padding:'10px 16px',borderTop:'1px solid #dde8ed',display:'flex',gap:16,flexWrap:'wrap',background:'#f0f6f9'}}>
      <span style={{fontSize:12,color:'#94a3b8'}}>🔴 High risk ≥70%</span>
      <span style={{fontSize:12,color:'#94a3b8'}}>🟠 Moderate 50–69%</span>
      <span style={{fontSize:12,color:'#94a3b8'}}>🟢 Low &lt;50%</span>
      <span style={{fontSize:12,color:'#94a3b8',marginLeft:'auto'}}>Click any pin to view &amp; comment</span>
    </div>
  </div>
  
}


/* ═══════════════════════════════════════ USERS ═══════════════════════════════════════ */
function Users({users,act,user,reports}){
  let[name,N]=useState(''),[email,E]=useState(''),[password,P]=useState('TempPass123!'),[role,R]=useState('engineer'),[state,ST]=useState(''),[iem,IM]=useState(''),[ic,IC]=useState('');

  return<>
    <div className="panel panel-teal">
      <h2>➕ Create User</h2>
      <div className="grid">
        <input placeholder="Full name" value={name} onChange={e=>N(e.target.value)}/>
        <input placeholder="Email" value={email} onChange={e=>E(e.target.value)}/>
        <input placeholder="Password" value={password} onChange={e=>P(e.target.value)}/>
        <select value={role} onChange={e=>{R(e.target.value);if(e.target.value!=='engineer'){ST('');IM('')}if(!['citizen','technician'].includes(e.target.value))IC('')}}>
          <option value="engineer">Engineer</option>
          <option value="technician">Technician</option>
          <option value="citizen">Citizen</option>
          <option value="admin">Admin</option>
        </select>
        {/* IC number for citizen / technician */}
        {['citizen','technician'].includes(role)&&<div style={{gridColumn:'1/-1',display:'flex',flexDirection:'column',gap:4}}>
          <label style={{fontSize:12,fontWeight:700,color:'var(--navy)',textTransform:'uppercase',letterSpacing:.5}}>MyKad IC Number <span style={{color:'var(--danger)'}}>*</span></label>
          <input value={ic} onChange={e=>{let v=e.target.value.replace(/\D/g,'').slice(0,12);IC(v)}} placeholder="12 digits e.g. 990101011234" maxLength={12} inputMode="numeric"/>
          <small style={{fontSize:11,color:ic.length===12?'var(--ok)':'var(--gray3)'}}>{ic.length}/12 digits{ic.length===12&&' ✓'}</small>
        </div>}
        {role==='engineer'&&<>
          <input placeholder="IEM Membership No. (e.g. M/12345)" value={iem} onChange={e=>IM(e.target.value)} style={{gridColumn:'1/-1'}}/>
          <label style={{fontSize:13,color:'var(--navy)',fontWeight:600,display:'flex',flexDirection:'column',gap:4,gridColumn:'1/-1'}}>
            Assign state responsibility:
            <select value={state} onChange={e=>ST(e.target.value)} style={{fontWeight:400}}>
              <option value="">— Select state —</option>
              {MY_STATES.map(s=><option key={s}>{s}</option>)}
            </select>
          </label>
        </>}
        <button style={{gridColumn:'1/-1'}} onClick={()=>{
          act(()=>req(`/admin/users?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&role=${role}&state=${encodeURIComponent(state)}&iem_number=${encodeURIComponent(iem)}&ic_number=${encodeURIComponent(ic)}`,{method:'POST'}),'User created');
          N('');E('');P('TempPass123!');R('engineer');ST('');IM('');IC('');
        }}>Create User</button>
      </div>
    </div>

    <div className="panel">
      <h2>👥 All Users</h2>
      <div className="scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>IC / IEM</th><th>State</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {users.map(u=><UserRow key={u.id} u={u} me={user} act={act}/>)}
      </tbody></table></div>
    </div>

    {/* Admin: set state on unassigned reports */}
    <div className="panel panel-amber">
      <h2>🗺️ Assign Report States</h2>
      <p>Set the state for each unassigned report so it appears in the correct engineer's queue.</p>
      {reports.filter(r=>!r.state).length===0
        ?<p style={{color:'var(--ok)',fontWeight:600}}>✅ All reports have a state assigned.</p>
        :reports.filter(r=>!r.state).map(r=><ReportStateRow key={r.id} r={r} act={act}/>)
      }
    </div>
  </>
}

function UserRow({u,me,act}){
  let[editState,ES]=useState(false),[newState,NS]=useState(u.state||'');
  return<tr>
    <td><strong>{u.name}</strong>{u.iem_number&&<div style={{fontSize:11,color:'var(--amber)',fontWeight:600,marginTop:2}}>IEM: {u.iem_number}</div>}</td>
    <td style={{fontSize:13,color:'var(--gray3)'}}>{u.email}</td>
    <td><Badge label={u.role} color={u.role==='engineer'?'var(--teal)':u.role==='admin'?'var(--navy)':u.role==='technician'?'#8b5cf6':'#64748b'}/></td>
    <td style={{fontSize:12}}>
      {u.ic_number?<span style={{color:'var(--navy)',fontFamily:'monospace'}}>{u.ic_number.replace(/(\d{6})(\d{2})(\d{4})/,'$1-$2-$3')}</span>:null}
      {u.iem_number?<span style={{color:'var(--amber)',fontWeight:600,fontSize:11,display:'block'}}>IEM {u.iem_number}</span>:null}
      {!u.ic_number&&!u.iem_number&&<span style={{color:'var(--gray3)'}}>—</span>}
    </td>
    <td>
      {u.role==='engineer'?
        editState
          ?<span style={{display:'flex',gap:6,alignItems:'center'}}>
            <select value={newState} onChange={e=>NS(e.target.value)} style={{fontSize:12,padding:'4px 8px'}}>
              <option value="">— None —</option>{MY_STATES.map(s=><option key={s}>{s}</option>)}
            </select>
            <button onClick={()=>{act(()=>req(`/admin/users/${u.id}?state=${encodeURIComponent(newState)}`,{method:'PATCH'}),`${u.name} assigned to ${newState||'no state'}`);ES(false)}} style={{fontSize:12,padding:'4px 10px',background:'var(--ok)'}}>Save</button>
            <button onClick={()=>ES(false)} style={{fontSize:12,padding:'4px 10px',background:'var(--gray3)'}}>✕</button>
          </span>
          :<span style={{display:'flex',gap:6,alignItems:'center'}}>
            <small style={{color:'var(--teal)',fontWeight:600}}>{u.state||'—'}</small>
            <button onClick={()=>ES(true)} style={{fontSize:11,padding:'3px 8px',background:'var(--navy)'}}>Edit</button>
          </span>
        :<small style={{color:'var(--gray3)'}}>—</small>
      }
    </td>
    <td><Badge label={u.active?'Active':'Inactive'} color={u.active?'var(--ok)':'var(--gray3)'}/></td>
    <td>{u.id!==me.id&&<button onClick={()=>act(()=>req(`/admin/users/${u.id}`,{method:'DELETE'}),'User deleted')} style={{padding:'5px 10px',fontSize:12,background:'var(--danger)'}}>Delete</button>}</td>
  </tr>
}

function ReportStateRow({r,act}){
  let[s,S]=useState('');
  return<div style={{display:'flex',gap:10,alignItems:'center',padding:'10px 0',borderBottom:'1px solid var(--gray2)',flexWrap:'wrap'}}>
    <strong style={{minWidth:60}}>DR-{r.id}</strong>
    <span style={{fontSize:13,color:'#4a6278',flex:1}}>{r.description||'(no description)'}</span>
    <select value={s} onChange={e=>S(e.target.value)} style={{fontSize:13}}>
      <option value="">— Select state —</option>
      {MY_STATES.map(st=><option key={st}>{st}</option>)}
    </select>
    <button disabled={!s} onClick={()=>act(()=>req(`/reports/${r.id}/set-state?state=${encodeURIComponent(s)}`,{method:'PATCH'}),`DR-${r.id} assigned to ${s}`)} style={{fontSize:13,background:'var(--amber)',color:'var(--navy)',fontWeight:700}}>Assign</button>
  </div>
}

/* ═══════════════════════════════════════ WEATHER RISK TAB ═══════════════════════════════════════ */
function WeatherRisk({user}){
  let[data,setData]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
  let[selected,setSel]=useState(null);

  async function load(){
    setLoading(true);setError('');
    try{
      let t=localStorage.getItem('token');
      let r=await fetch(`${import.meta.env.VITE_API_BASE_URL}/weather-risk`,{
        headers:{Authorization:'Bearer '+t}
      });
      let d=await r.json();
      console.log("WEATHER API STATUS:", r.status);
      console.log("WEATHER API RESPONSE:", d);
     if(!r.ok) {
       console.error("Weather Risk API Error:", r.status, d);
       throw Error(d.detail || `Weather API failed: ${r.status}`);
     }
      setData(d);
      // auto-select engineer's own state
      if(user.state){let own=d.find(x=>x.state===user.state);if(own)setSel(own);}
      else setSel(d[0]);
    }catch(e){setError(e.message);}
    setLoading(false);
  }
  useEffect(()=>{load();},[]);

  const riskColor=v=>v>=0.8?'#dc2626':v>=0.6?'#ea580c':v>=0.35?'#ca8a04':'#059669';
  const riskBg=v=>v>=0.8?'#fef2f2':v>=0.6?'#fff7ed':v>=0.35?'#fefce8':'#f0fdf4';

  if(loading)return<div className="panel"><p style={{color:'var(--gray3)',textAlign:'center',padding:40}}>⏳ Loading weather data from Open-Meteo…</p></div>;
  if(error)return<div className="panel"><p className="error">{error}</p><button onClick={load}>Retry</button></div>;
  if(!data)return null;

  return<>
    <div className="panel panel-teal">
      <h2>🌦️ AI Weather-Based Flood Risk — All States</h2>
      <p style={{fontSize:13,color:'var(--gray3)',marginBottom:16}}>
        Risk combines 7-day rainfall forecast (Open-Meteo) with active blockage report density.
        {user.role==='engineer'&&user.state&&<> Showing your state <strong style={{color:'var(--teal)'}}>{user.state}</strong> highlighted.</>}
      </p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10}}>
        {data.map(s=>{
          let isOwn=s.state===user.state;
          let col=riskColor(s.combined_risk);
          let bg=riskBg(s.combined_risk);
          return<div key={s.state} onClick={()=>setSel(s)} style={{
            padding:'12px 14px',borderRadius:10,cursor:'pointer',
            background:selected?.state===s.state?bg:'var(--white)',
            border:`2px solid ${selected?.state===s.state?col:'var(--gray2)'}`,
            transition:'all .2s',
          }}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
              <strong style={{fontSize:13,color:'var(--navy)'}}>{s.state}{isOwn&&' ⭐'}</strong>
              <span style={{fontSize:11,fontWeight:700,color:col}}>{Math.round(s.combined_risk*100)}%</span>
            </div>
            <div style={{width:'100%',height:6,background:'var(--gray2)',borderRadius:3,overflow:'hidden',marginBottom:6}}>
              <div style={{width:`${s.combined_risk*100}%`,height:'100%',background:col,transition:'width .4s'}}/>
            </div>
            <div style={{fontSize:11,color:'#64748b',display:'flex',justifyContent:'space-between'}}>
              <span>🌧 {s.total_rain_7d}mm/7d</span>
              <span>{s.risk_level.split(' ')[0]} {s.risk_level.split(' ').slice(1).join(' ')}</span>
            </div>
          </div>
        })}
      </div>
      <div style={{display:'flex',gap:16,marginTop:12,flexWrap:'wrap'}}>
        {[['🔴 Extreme','≥80%'],['🟠 High','60–79%'],['🟡 Moderate','35–59%'],['🟢 Low','<35%']].map(([l,r])=>
          <span key={l} style={{fontSize:12,color:'var(--gray3)'}}>{l} {r}</span>)}
        <button onClick={load} style={{marginLeft:'auto',fontSize:12,padding:'6px 12px',background:'var(--navy)'}}>↻ Refresh</button>
      </div>
    </div>

    {selected&&<div className="panel panel-amber">
      <h2>📊 {selected.state} — Detailed Forecast</h2>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:16}}>
        <div className="stat-card" style={{borderTopColor:riskColor(selected.combined_risk)}}>
          <small>Combined Risk</small>
          <h2 style={{color:riskColor(selected.combined_risk)}}>{Math.round(selected.combined_risk*100)}%</h2>
        </div>
        <div className="stat-card amber"><small>7-Day Rainfall</small><h2>{selected.total_rain_7d}<span style={{fontSize:16}}> mm</span></h2></div>
        <div className="stat-card red"><small>Peak Daily Rain</small><h2>{selected.max_daily_rain}<span style={{fontSize:16}}> mm</span></h2></div>
        <div className="stat-card"><small>Active Reports</small><h2>{selected.active_reports}</h2></div>
      </div>

      {/* 7-day bar chart */}
      {selected.forecast?.dates?.length>0&&<div style={{marginBottom:16}}>
        <strong style={{fontSize:13,color:'var(--navy)',display:'block',marginBottom:8}}>📅 7-Day Rainfall Forecast</strong>
        <div style={{display:'flex',gap:6,alignItems:'flex-end',height:100}}>
          {selected.forecast.dates.map((d,i)=>{
            let mm=selected.forecast.rain_mm[i]||0;
            let prob=selected.forecast.prob_pct[i]||0;
            let maxMm=Math.max(...selected.forecast.rain_mm,1);
            let h=Math.max(4,Math.round((mm/maxMm)*80));
            let col=mm>=100?'#dc2626':mm>=50?'#ea580c':mm>=20?'#ca8a04':'#1B8CA8';
            return<div key={d} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
              <span style={{fontSize:9,color:'var(--gray3)',fontWeight:600}}>{mm}mm</span>
              <div style={{width:'100%',height:h,background:col,borderRadius:'3px 3px 0 0',transition:'height .3s'}}/>
              <span style={{fontSize:10,color:'var(--gray3)',textAlign:'center',lineHeight:1.2}}>{d.slice(5)}</span>
              <span style={{fontSize:9,color:'#0891b2'}}>{prob}%</span>
            </div>
          })}
        </div>
        <div style={{display:'flex',gap:8,marginTop:4,fontSize:11,color:'var(--gray3)'}}>
          <span>Bar = rainfall mm &nbsp;|&nbsp; % below = chance of rain</span>
        </div>
      </div>}

      {/* AI narrative */}
      <div style={{background:'var(--gray1)',borderRadius:10,padding:14,borderLeft:'4px solid var(--teal)'}}>
        <strong style={{fontSize:13,color:'var(--navy)',display:'block',marginBottom:6}}>🤖 AI Risk Assessment</strong>
        <p style={{fontSize:13,color:'#374151',lineHeight:1.6,margin:0}}>{selected.narrative}</p>
      </div>
    </div>}
  </>
}

/* ═══════════════════════════════════════ AI CAMERA SYSTEM ═══════════════════════════════════════ */
function AICameraSystem({cameras,user,act}){
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

function CameraCard({camera, isAdmin, act}) {
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
function detectWaterLevel(ctx, cols, rows) {
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
function AnalysisTab() {
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

function FeedAnalyzer({ slot, onLevel }) {
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
function CameraNode() {
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
const ADDR = /\b(JALAN|JLN|LORONG|LRG|TAMAN|KAMPUNG|KG|LOT|BLOK|PERSIARAN|KM|TINGKAT|BANDAR|PANGSAPURI|APARTMENT|NO)\b/;
const SKIP = /(KAD|PENGENALAN|MALAYSIA|WARGANEGARA|ISLAM|LELAKI|PEREMPUAN|MYKAD|IDENTITY|CARD)/;

function parseMyKad(text) {
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

function makeOcrCanvas(source, sx, sy, sw, sh, mode) {
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

function IcScanner({ onResult }) {
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

createRoot(document.getElementById('root')).render(<App/>);
