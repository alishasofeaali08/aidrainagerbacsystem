import React,{useEffect,useState,useRef} from 'react';
import{createRoot}from'react-dom/client';
import{MapContainer,TileLayer,CircleMarker,Popup,Polyline,Marker,useMap}from'react-leaflet';
import L from 'leaflet';
import'leaflet/dist/leaflet.css';
import'./style.css';

const API=import.meta.env.VITE_API_URL||'/api';
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
let [user, setUser] = useState(() => {
  try {
    const savedUser = localStorage.getItem('user');
    if (!savedUser || savedUser === 'undefined') return null;
    return JSON.parse(savedUser);
  } catch {
    return null;
  }
});

  async function refresh(){
    try{
      let [r, f, c] = await Promise.all([
        req('/reports'),
        req('/map/flood'),
        req('/ai-cameras')
      ]);
      R(r);
      F(f);
      setCameras(c);
      if(user.role==='admin')U(await req('/admin/users'));
      X('');
    }catch(e){X(e.message)}
  }
  useEffect(()=>{if(user)refresh(); let itv=setInterval(()=>user&&refresh(), 10000); return ()=>clearInterval(itv);},[user?.id]);
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
            <p style={{fontWeight:600,color:'var(--navy)',fontSize:15,margin:0}}>Create Account</p>
            <p style={{fontSize:13,color:'var(--gray3)',margin:0}}>Fill in your details to register.</p>
            {/* Role Selection */}
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              <label style={{fontSize:12,fontWeight:700,color:'var(--navy)',textTransform:'uppercase',letterSpacing:.5}}>Account Type</label>
              <select value={rRole} onChange={e=>RR(e.target.value)} style={{padding:'8px',borderRadius:6,border:'1px solid #dde8ed'}}>
                <option value="citizen">Citizen</option>
                <option value="technician">Technician</option>
              </select>
            </div>
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
            {/* Department Office for Technician */}
            {rRole==='technician'&&<div style={{display:'flex',flexDirection:'column',gap:4}}>
              <label style={{fontSize:12,fontWeight:700,color:'var(--navy)',textTransform:'uppercase',letterSpacing:.5}}>Department Office</label>
              <input value={rDept} onChange={e=>RDPT(e.target.value)} placeholder="e.g. JPS Kuala Lumpur"/>
            </div>}
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
                  f.append('department_office',rDept);
                  f.append('role',rRole);
                  await req('/auth/register',{method:'POST',body:f});
                  M('Registration successful! Please sign in.');
                  SR(false);RN('');RE('');RP('');RI('');RDPT('');RR('citizen');
                }catch(e){X(e.message)}
              }}>
              Register as {rRole.charAt(0).toUpperCase() + rRole.slice(1)}
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
  let nav=['📊 Overview','📋 Reports','🗺️ Flood Map'];
  if(['engineer','admin'].includes(user.role))nav.push('🔍 My State Cases');
  if(user.role==='technician')nav.push('🛠️ My Cases');
  nav.push('🌊 AI Detection');
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
        {tab==='🌊 AI Detection'&&<AICameraSystem cameras={cameras} user={user} act={act}/>}
        {tab==='🗺️ Flood Map'&&<FloodMap flood={flood} reports={reports} user={user} cameras={cameras}/>}
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

/* ═══════════════════════════════════════ FLOOD MAP ═══════════════════════════════════════ */
function FloodMap({flood,reports,user,cameras}){
  let[sel,setSel]=useState(null);
  let[comments,setComments]=useState([]);
  let[loadingC,setLC]=useState(false);
  let[newComment,NC]=useState('');
  let[posting,setPosting]=useState(false);
  let[postErr,setPE]=useState('');
  
  // Technician Sharing state
  let[sharingLocation,setSharing]=useState(false);
  let[shareTimer,setTimer]=useState(null);
  
  // Route planning state
  let[showRoute,SR]=useState(false);
  let[originName,ON]=useState('');
  let[destName,DN]=useState('');
  let[originLat,setOriginLat]=useState('');
  let[originLon,setOriginLon]=useState('');
  let[destLat,setDestLat]=useState('');
  let[destLon,setDestLon]=useState('');
  let[routeData,RD]=useState(null);
  let[loadingRoute,LR]=useState(false);
  let[routeError,RE]=useState('');
  let[currentLoc,CL]=useState(null);
  
  // Navigation mode state
  let[navigationMode,NM]=useState(false);
  let[turnByTurn,TBT]=useState(null);
  let[loadingNav,LN]=useState(false);
  let[currentStep,CS]=useState(0);
  
  function MapFocus(){
    const map=useMap();
    useEffect(()=>{
      if(navigationMode && currentLoc){
        map.setView([currentLoc.lat, currentLoc.lon], 16);
      }
    },[navigationMode, currentLoc, map]);
    return null;
  }
  
  // Technician locator state
  let[showTechs,ST]=useState(false);
  let[nearbyTechs,NT]=useState([]);
  let[loadingTechs,LT]=useState(false);

  let selReport=sel?reports.find(r=>r.id===sel.id)||sel:null;

  async function loadComments(id){
    setLC(true);setComments([]);
    try{let d=await req(`/reports/${id}/comments`);setComments(d);}catch(e){}
    setLC(false);
  }

  function selectPin(p){setSel(p);setPE('');NC('');loadComments(p.id);}

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

  async function getCurrentLocation(){
    if(!navigator.geolocation){alert('Geolocation not supported');return;}
    LR(true);
    navigator.geolocation.getCurrentPosition(
      async p=>{
        setOriginLat(p.coords.latitude);
        setOriginLon(p.coords.longitude);
        CL({lat:p.coords.latitude,lon:p.coords.longitude});
        // Reverse geocode to get location name
        try{
          let d=await req(`/geocode?location=${p.coords.latitude},${p.coords.longitude}`);
          ON(d.display_name.split(',')[0]);
        }catch(e){
          ON('Current Location');
        }
        LR(false);
      },
      ()=>{
        alert('Could not get location');
        LR(false);
      }
    );
  }

  async function geocodeLocation(location){
    if(!location||location.length<2){return null;}
    try{
      let d=await req(`/geocode?location=${encodeURIComponent(location)}`);
      return d;
    }catch(e){
      return null;
    }
  }

  async function calculateRoute(){
    if(!originName){alert('Please enter origin location');return;}
    if(!destName){alert('Please enter destination location');return;}
    LR(true);RE('');
    
    try{
      // Geocode origin
      let originCoords = await geocodeLocation(originName);
      if(!originCoords){
        RE(`Could not find location: ${originName}`);
        LR(false);
        return;
      }
      setOriginLat(originCoords.latitude);
      setOriginLon(originCoords.longitude);
      
      // Geocode destination
      let destCoords = await geocodeLocation(destName);
      if(!destCoords){
        RE(`Could not find location: ${destName}`);
        LR(false);
        return;
      }
      setDestLat(destCoords.latitude);
      setDestLon(destCoords.longitude);
      
      // Calculate route
      let d=await req(`/route/flood-safe?origin_lat=${originCoords.latitude}&origin_lon=${originCoords.longitude}&dest_lat=${destCoords.latitude}&dest_lon=${destCoords.longitude}`);
      // Ensure coordinates are [lat, lon] for Leaflet
      if(d.route && d.route.coordinates && d.route.coordinates.length > 0){
        // Check if they need flipping (OSRM usually gives [lon, lat])
        // If the first coord's absolute value of the first element is > 90, it's definitely longitude first
        if(Math.abs(d.route.coordinates[0][0]) > 90){
          d.route.coordinates = d.route.coordinates.map(c => [c[1], c[0]]);
        }
      }
      RD(d);
    }catch(e){RE(e.message);}
    LR(false);
  }

  async function startNavigation(){
    if(!routeData){alert('Please calculate a route first');return;}
    LN(true);CS(0);
    try{
      let d=await req(`/route/turn-by-turn?origin_lat=${originLat}&origin_lon=${originLon}&dest_lat=${destLat}&dest_lon=${destLon}`);
      TBT(d);
      NM(true);
      // Close route planner to focus on navigation
      SR(false);
    }catch(e){alert(e.message);}
    LN(false);
  }

  async function findAllTechnicians(){
    LT(true);
    try{
      let d=await req(`/technicians/nearest?latitude=4.2105&longitude=101.9758&radius_km=3000`);
      NT(d.technicians);
    }catch(e){alert(e.message);}
    LT(false);
  }

  async function toggleLocationSharing(){
    if(sharingLocation){
      if(shareTimer)clearInterval(shareTimer);
      setTimer(null);
      setSharing(false);
    }else{
      setSharing(true);
      const update=()=>{
        navigator.geolocation.getCurrentPosition(async(p)=>{
          CL({lat:p.coords.latitude,lon:p.coords.longitude});
          try{
            await req(`/technicians/update-location?latitude=${p.coords.latitude}&longitude=${p.coords.longitude}`,{method:'POST'});
          }catch(e){console.error('Location update failed',e);}
        },null,{enableHighAccuracy:true});
      };
      update();
      setTimer(setInterval(update, 30000)); // Every 30 seconds
    }
  }

  function getAvatarStyle(style){
    const colors={
      'default':'#1B8CA8',
      'hero':'#E8A020',
      'expert':'#059669',
      'legend':'#8b5cf6'
    };
    return colors[style]||colors['default'];
  }

  const riskCol=v=>v>=0.7?'#dc2626':v>=0.5?'#d97706':'#059669';
  const statusCol=s=>({resolved:'#059669',pending_closure:'#8b5cf6',engineer_approved:'#1B8CA8',in_progress:'#d97706',reviewed:'#0891b2',rejected:'#dc2626'}[s]||'#64748b');
  const statusLabel=s=>({submitted:'Submitted',reviewed:'Reviewed',engineer_approved:'Engineer Approved',in_progress:'In Progress',pending_closure:'Pending Closure',resolved:'Resolved',rejected:'Rejected'}[s]||s);
  const roleCol=r=>r==='engineer'?'var(--teal)':r==='admin'?'var(--navy)':r==='technician'?'#8b5cf6':'#64748b';

  // Custom icons
  const originIcon = L.divIcon({
    className: 'custom-marker',
    html: '<div style="background:#1B8CA8;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  const destIcon = L.divIcon({
    className: 'custom-marker',
    html: '<div style="background:#dc2626;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  const turnByTurnIcon = L.divIcon({
    className: 'custom-marker',
    html: '<div style="background:#E8A020;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  const techIcon = (style) => L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${getAvatarStyle(style)};width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;color:white;">🔧</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  return<div className="panel" style={{padding:0,overflow:'hidden'}}>
    {/* Route planning toggle */}
    <div style={{padding:'10px 16px',borderBottom:'1px solid #dde8ed',background:'#f0f6f9',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
      <button onClick={()=>SR(!showRoute)} style={{background:showRoute?'var(--teal)':'var(--navy)',fontSize:13}}>
        {showRoute?'🗺️ Hide Route Planner':'🗺️ Plan Flood-Safe Route'}
      </button>
      {showRoute&&<button onClick={startNavigation} disabled={loadingNav} style={{background:loadingNav?'var(--gray3)':'#E8A020',fontSize:13,opacity:loadingNav?0.6:1}}>
          {loadingNav?'Loading…':'🧭 Start Navigation'}
        </button>}
      <button onClick={()=>{if(!showTechs)findAllTechnicians();ST(!showTechs)}} style={{background:showTechs?'#8b5cf6':'var(--navy)',fontSize:13}}>
        {showTechs?'🔧 Hide Technicians':'🔧 Show All Technicians'}
      </button>
      {showRoute&&<span style={{fontSize:12,color:'var(--gray3)',marginLeft:'auto'}}>Enter location names in Malaysia</span>}
      {user.role==='technician'&&<button onClick={toggleLocationSharing} style={{background:sharingLocation?'#059669':'var(--navy)',fontSize:13,marginLeft:showRoute?'0':'auto'}}>
        {sharingLocation?'📡 Sharing Location...':'📡 Share My Location'}
      </button>}
    </div>

    {/* Route planning panel */}
    {showRoute&&<div style={{padding:'12px 16px',borderBottom:'1px solid #dde8ed',background:'white',display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
      <div style={{display:'flex',flexDirection:'column',gap:4,flex:1,minWidth:200}}>
        <label style={{fontSize:11,fontWeight:700,color:'var(--navy)',textTransform:'uppercase'}}>Origin Location</label>
        <input type="text" value={originName} onChange={e=>ON(e.target.value)} placeholder="e.g. Kuala Lumpur, Petaling Jaya" style={{padding:'6px 8px',fontSize:12}}/>
      </div>
      <button onClick={getCurrentLocation} disabled={loadingRoute} style={{background:'var(--amber)',fontSize:12,padding:'6px 12px',height:32,opacity:loadingRoute?0.6:1}}>📍 Use Current</button>
      {currentLoc&&<span style={{fontSize:11,color:'var(--ok)',fontWeight:600}}>✓ Location active</span>}
      <div style={{display:'flex',flexDirection:'column',gap:4,flex:1,minWidth:200}}>
        <label style={{fontSize:11,fontWeight:700,color:'var(--navy)',textTransform:'uppercase'}}>Destination</label>
        <input type="text" value={destName} onChange={e=>DN(e.target.value)} placeholder="e.g. Shah Alam, Subang Jaya" style={{padding:'6px 8px',fontSize:12}}/>
      </div>
      <button onClick={calculateRoute} disabled={loadingRoute} style={{background:'var(--teal)',fontSize:12,padding:'6px 12px',height:32,opacity:loadingRoute?0.6:1}}>
        {loadingRoute?'Calculating…':'🚀 Calculate Route'}
      </button>
      {routeError&&<span style={{fontSize:12,color:'#dc2626',flex:'1 1 100%',marginTop:4}}>{routeError}</span>}
    </div>}

    {/* Route analysis result */}
    {routeData&&<div style={{padding:'10px 16px',borderBottom:'1px solid #dde8ed',background:routeData.flood_risk_analysis.overall_risk>=0.6?'#fef2f2':routeData.flood_risk_analysis.overall_risk>=0.35?'#fff7ed':'#f0fdf4',display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <span style={{fontSize:12,fontWeight:700,color:'var(--navy)'}}>Route Risk:</span>
        <span style={{fontSize:14,fontWeight:700,color:riskCol(routeData.flood_risk_analysis.overall_risk)}}>{Math.round(routeData.flood_risk_analysis.overall_risk*100)}%</span>
        <Badge label={routeData.flood_risk_analysis.risk_level} color={routeData.flood_risk_analysis.risk_level==='high'?'#dc2626':routeData.flood_risk_analysis.risk_level==='moderate'?'#d97706':'#059669'}/>
      </div>
      <span style={{fontSize:12,color:'#64748b'}}>📏 {(routeData.route.distance/1000).toFixed(1)} km · ⏱ {Math.round(routeData.route.duration/60)} min</span>
      <span style={{fontSize:12,color:'#64748b',flex:1}}>{routeData.flood_risk_analysis.recommendation}</span>
      <button onClick={()=>RD(null)} style={{fontSize:11,padding:'4px 8px',background:'var(--gray3)'}}>Clear</button>
    </div>}

    <div style={{display:'flex',height:showRoute||navigationMode?500:600}}>
      <div style={{flex:sel||navigationMode?'0 0 55%':'1',transition:'flex .3s',minWidth:0}}>
        <MapContainer center={[4.2105,101.9758]} zoom={6} style={{height:'100%',width:'100%'}}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap"/>
          <MapFocus/>
          
          {/* Route polyline with risk coloring */}
          {routeData&&routeData.route.coordinates&&<Polyline 
            positions={routeData.route.coordinates}
            color={riskCol(routeData.flood_risk_analysis.overall_risk)}
            weight={5}
            opacity={0.8}
          />}
          
          {/* Origin and destination markers */}
          {routeData&&originLat&&originLon&&<Marker position={[parseFloat(originLat),parseFloat(originLon)]} icon={originIcon}>
            <Popup>📍 Origin</Popup>
          </Marker>}
          {routeData&&destLat&&destLon&&<Marker position={[parseFloat(destLat),parseFloat(destLon)]} icon={destIcon}>
            <Popup>🎯 Destination</Popup>
          </Marker>}

          {/* Nearby Technicians */}
          {showTechs&&nearbyTechs.map(t=><Marker key={t.id} position={[t.latitude,t.longitude]} icon={techIcon(t.avatar_style)}>
            <Popup>
              <div style={{minWidth:140}}>
                <strong>{t.name}</strong><br/>
                <Badge label="Technician" color="#8b5cf6"/><br/>
                {t.department_office && <div style={{fontSize:11,color:'var(--teal)',fontWeight:600,margin:'4px 0'}}>🏢 {t.department_office}</div>}
                <small>{t.name.includes('Admin')?'Central Office':(t.distance_km < 1000 ? `${t.distance_km} km away` : 'Active in Malaysia')}</small>
              </div>
            </Popup>
          </Marker>)}

          {/* User Location Marker */}
          {currentLoc&&<Marker position={[currentLoc.lat,currentLoc.lon]} icon={L.divIcon({
            className:'user-loc',
            html:'<div style="background:#3b82f6;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 10px rgba(59,130,246,0.5);"></div>',
            iconSize:[14,14],iconAnchor:[7,7]
          })}>
            <Popup>You are here</Popup>
          </Marker>}

          {/* Turn by turn step markers */}
          {navigationMode&&turnByTurn&&turnByTurn.steps.map((s,i)=>(
            <Marker key={`step-${i}`} position={s.location} icon={turnByTurnIcon}>
              <Popup>
                <div style={{fontSize:12}}>
                  <strong>Step {i+1}</strong><br/>
                  {s.instruction}
                </div>
              </Popup>
            </Marker>
          ))}
          
          {/* AI Smart Cameras - Red/Green Areas */}
          {cameras && cameras.map(c => (
            <CircleMarker 
              key={`camera-${c.id}`} 
              center={[c.latitude, c.longitude]}
              radius={40}
              pathOptions={{
                color: c.status === 'red' ? '#dc2626' : '#059669',
                fillColor: c.status === 'red' ? '#dc2626' : '#059669',
                fillOpacity: 0.2,
                weight: 2,
                dashArray: '5, 10'
              }}
            >
              <Popup>
                <div style={{minWidth:160}}>
                  <div style={{fontSize:10,fontWeight:700,color:'var(--teal)',textTransform:'uppercase',marginBottom:4}}>🤖 AI Monitoring Station</div>
                  <strong style={{fontSize:14}}>{c.name}</strong>
                  {c.location && <div style={{fontSize:11,color:'var(--gray3)',margin:'2px 0'}}>{c.location}</div>}
                  <div style={{margin:'8px 0',padding:'5px',background:c.status==='red'?'#fef2f2':'#f0fdf4',borderRadius:4,border:`1px solid ${c.status==='red'?'#fee2e2':'#dcfce7'}`}}>
                    <div style={{fontSize:11,fontWeight:700,color:c.status==='red'?'#dc2626':'#059669',display:'flex',alignItems:'center',gap:4}}>
                      <span style={{width:8,height:8,borderRadius:'50%',background:c.status==='red'?'#dc2626':'#059669',display:'inline-block'}}></span>
                      {c.status==='red' ? 'FLOOD DETECTED' : 'FLOW NORMAL'}
                    </div>
                  </div>
                  <div style={{fontSize:10,color:'var(--gray3)'}}>Last processed: {new Date(c.last_update).toLocaleTimeString()}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {flood.map(p=>{
            let isSelected=sel?.id===p.id;
            let col=riskCol(p.risk_score);
            return<CircleMarker key={p.id} center={[p.latitude,p.longitude]}
              radius={isSelected?16:p.risk_score>=0.7?13:10}
              pathOptions={{color:isSelected?'#E8A020':col,fillColor:isSelected?'#E8A020':col,fillOpacity:.75,weight:isSelected?3:2}}
              eventHandlers={{click:()=>selectPin(p)}}>
              <Popup>
                <div style={{minWidth:150}}>
                  <strong style={{fontSize:13}}>Report #{p.id}</strong>
                  {p.state&&<div style={{fontSize:11,color:'#64748b'}}>{p.state}</div>}
                  <div style={{fontSize:12,color:col,fontWeight:700,margin:'4px 0'}}>{Math.round(p.risk_score*100)}% risk</div>
                  <button onClick={()=>selectPin(p)} style={{fontSize:12,padding:'5px 10px',width:'100%',background:'#1B8CA8'}}>💬 View &amp; Comment</button>
                </div>
              </Popup>
            </CircleMarker>
          })}
        </MapContainer>
      </div>

      {sel&&<div style={{flex:'0 0 45%',display:'flex',flexDirection:'column',borderLeft:'1px solid #dde8ed',background:'white',overflow:'hidden'}}>
        <div style={{padding:'12px 16px',borderBottom:'1px solid #dde8ed',background:'#f0f6f9',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <strong style={{fontSize:15,color:'#0D2535',flex:1}}>Report #{sel.id}</strong>
          {sel.state&&<span style={{fontSize:11,background:'#0D2535',color:'white',padding:'2px 8px',borderRadius:4,fontWeight:600}}>{sel.state}</span>}
          <span style={{fontSize:11,background:statusCol(sel.status),color:'white',padding:'2px 8px',borderRadius:4,fontWeight:600}}>{statusLabel(sel.status)}</span>
          <button onClick={()=>{setSel(null);setComments([]);}} style={{background:'transparent',color:'#94a3b8',padding:'4px 8px',fontSize:18,minWidth:0,boxShadow:'none',lineHeight:1}}>×</button>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'14px 16px',display:'flex',flexDirection:'column',gap:12}}>
          {selReport?.photo_path&&<img src={selReport.photo_path} alt="report" style={{width:'100%',maxHeight:180,objectFit:'cover',borderRadius:8,border:'1px solid #dde8ed'}}/>}

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

      {navigationMode&&turnByTurn&&<div style={{flex:'0 0 45%',display:'flex',flexDirection:'column',borderLeft:'1px solid #dde8ed',background:'white',overflow:'hidden'}}>
        <div style={{padding:'12px 16px',borderBottom:'1px solid #dde8ed',background:'var(--navy)',color:'white',display:'flex',alignItems:'center',gap:8}}>
          <strong style={{fontSize:15,flex:1}}>🧭 Navigation</strong>
          <button onClick={()=>{NM(false);TBT(null);}} style={{background:'var(--danger)',fontSize:12,padding:'4px 10px'}}>Stop</button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'14px 16px'}}>
          {turnByTurn.steps.map((s,i)=>(
            <div key={i} onClick={()=>CS(i)} style={{
              padding:'12px',
              borderRadius:8,
              background:currentStep===i?'#f0f6f9':'white',
              border:'1px solid '+ (currentStep===i?'var(--teal)':'#dde8ed'),
              marginBottom:8,
              cursor:'pointer',
              display:'flex',
              gap:12,
              alignItems:'center'
            }}>
              <div style={{fontSize:24}}>{s.maneuver.type.includes('turn')?(s.maneuver.modifier.includes('left')?'⬅️':'➡️'):'⬆️'}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600,color:'var(--navy)'}}>{s.instruction}</div>
                <div style={{fontSize:12,color:'#64748b'}}>{Math.round(s.distance)}m · {s.name||'Unnamed Road'}</div>
              </div>
            </div>
          ))}
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
  let[name,N]=useState(''),[email,E]=useState(''),[password,P]=useState('TempPass123!'),[role,R]=useState('engineer'),[state,ST]=useState(''),[iem,IM]=useState(''),[ic,IC]=useState(''),[dept,DEPT]=useState('');

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
        {role==='technician'&&<div style={{gridColumn:'1/-1',display:'flex',flexDirection:'column',gap:4}}>
          <label style={{fontSize:12,fontWeight:700,color:'var(--navy)',textTransform:'uppercase',letterSpacing:.5}}>Department Office</label>
          <input value={dept} onChange={e=>DEPT(e.target.value)} placeholder="e.g. JPS Kuala Lumpur, DBKL Engineering"/>
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
          act(()=>req(`/admin/users?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&role=${role}&state=${encodeURIComponent(state)}&iem_number=${encodeURIComponent(iem)}&ic_number=${encodeURIComponent(ic)}&department_office=${encodeURIComponent(dept)}`,{method:'POST'}),'User created');
          N('');E('');P('TempPass123!');R('engineer');ST('');IM('');IC('');DEPT('');
        }}>Create User</button>
      </div>
    </div>

    <div className="panel">
      <h2>👥 All Users</h2>
      <div className="scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>IC / IEM / Dept</th><th>State</th><th>Status</th><th>Actions</th></tr></thead><tbody>
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
      {u.ic_number?<span style={{color:'var(--navy)',fontFamily:'monospace',display:'block'}}>{u.ic_number.replace(/(\d{6})(\d{2})(\d{4})/,'$1-$2-$3')}</span>:null}
      {u.iem_number?<span style={{color:'var(--amber)',fontWeight:600,fontSize:11,display:'block'}}>IEM {u.iem_number}</span>:null}
      {u.department_office?<span style={{color:'var(--teal)',fontWeight:600,fontSize:11,display:'block'}}>🏢 {u.department_office}</span>:null}
      {!u.ic_number&&!u.iem_number&&!u.department_office&&<span style={{color:'var(--gray3)'}}>—</span>}
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
      let d=await req('/weather-risk');
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
              const res = await req(`/ai-cameras/${camera.id}/analyze-sam2`, {method:'POST', body:f});
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
            req(`/ai-cameras/${camera.id}`, {method:'PATCH', body:f}).catch(console.error);
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
            {c.location || `${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}`}
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
          {stream ? (useSam2 ? `SAM 2 ENHANCED: ${waterLevelRecognition} LEVEL` : `AI RECOGNIZING: ${waterLevelRecognition} LEVEL`) : 'CAMERA OFFLINE'}
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
      
createRoot(document.getElementById('root')).render(<App/>);
