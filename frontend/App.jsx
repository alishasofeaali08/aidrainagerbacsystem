import React, { useEffect, useState } from 'react';
import './style.css';
import { req } from './components/shared.jsx';

import DashboardPage from './pages/DashboardPage.jsx';
import FloodWeatherPage from './pages/FloodWeatherPage.jsx';
import CameraAnalysisPage from './pages/CameraAnalysisPage.jsx';
import AIDetectionPage from './pages/AIDetectionPage.jsx';
import AdminPage from './pages/AdminPage.jsx';

import {
  Overview, RewardPopup, ReportsTab, EngineerCases, TechnicianCases, TechLeaderboard,
  FloodMap, WeatherRisk, AICameraSystem, AnalysisTab, CameraNode, IcScanner
} from './components/index.jsx';
import { Users } from './components/adminComponents.jsx';

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


function App(){

  const [cameras, setCameras] = useState([]);
  let[user,setUser]=useState(JSON.parse(localStorage.getItem('user')||'null'));
  let[email,E]=useState('admin@example.com'),[password,P]=useState('Admin123!'),[name,N]=useState(''),[showReg,SR]=useState(false);
  // Register form state
  let[rName,RN]=useState(''),[rEmail,RE]=useState(''),[rPw,RP]=useState(''),[rIc,RI]=useState(''),[rPhone,RPH]=useState('');
  let[tab,T]=useState('dashboard'),[reports,R]=useState([]),[flood,F]=useState([]),[users,U]=useState([]);
  let[error,X]=useState(''),[msg,M]=useState('');

  let[reward,setReward]=useState(null);

  // Compare each report's reward_points against what this citizen has already seen;
  // anything new triggers the reward pop-up.
  function checkRewards(me,reps){
    if(me.role!=='citizen')return;
    let key=`seenRewards_${me.id}`, raw=localStorage.getItem(key);
    let now={};reps.forEach(r=>{if(r.reward_points>0)now[r.id]=r.reward_points});
    localStorage.setItem(key,JSON.stringify(now));
    if(raw===null)return; // first visit: set baseline, no pop-up for old rewards
    let seen=JSON.parse(raw);
    let items=reps.filter(r=>(now[r.id]||0)>(seen[r.id]||0))
      .map(r=>({id:r.id,pts:now[r.id]-(seen[r.id]||0),status:r.status}));
    if(!items.length)return;
    let gained=items.reduce((s,i)=>s+i.pts,0);
    let prevLevel=1+Math.floor(((me.points||0)-gained)/100);
    setReward({items,gained,total:me.points||0,level:me.level||1,levelUp:(me.level||1)>prevLevel});
  }

  async function refresh(){
    try{
      const reportRoles=['admin','engineer','technician','citizen'];
      const mapRoles=['admin','engineer','technician','citizen'];
      let reps=reportRoles.includes(user.role)?await req('/reports'):[];R(reps);
      F(mapRoles.includes(user.role)?await req('/map/flood'):[]);
      if(['admin','engineer','technician'].includes(user.role))setCameras(await req('/ai-cameras'));
      else setCameras([]);
      if(user.role==='admin')U(await req('/admin/users'));
      // Pull latest points/level so rewards show up without re-login
      let me=await req('/auth/me');localStorage.setItem('user',JSON.stringify(me));setUser(me);
      checkRewards(me,reps);
      X('');
    }catch(e){X(e.message)}
  }
  useEffect(()=>{if(user)refresh()},[user?.id]);

  // Citizens: poll quietly so the reward pop-up appears soon after an engineer approves
  useEffect(()=>{
    if(user?.role!=='citizen')return;
    let t=setInterval(async()=>{
      try{
        let reps=await req('/reports'),me=await req('/auth/me');
        R(reps);localStorage.setItem('user',JSON.stringify(me));setUser(me);checkRewards(me,reps);
      }catch{}
    },30000);
    return()=>clearInterval(t);
  },[user?.id,user?.role]);
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
            <button onClick={async()=>{try{let f=new FormData();f.append('email',email.trim());f.append('password',password);let d=await req('/auth/login',{method:'POST',body:f});localStorage.setItem('token',d.access_token);localStorage.setItem('user',JSON.stringify(d.user));setUser(d.user)}catch(e){X(e.message)}}}>Sign in</button>
            {error&&<p className="error">{error}</p>}
            {msg&&<p className="success">{msg}</p>}
            <button className="link" onClick={()=>{SR(true);X('');M('')}}>No account? Register</button>
            <p className="login-hint">Demo admin: admin@example.com / Admin123!</p>
          </>
        }
      </div>
    </div>
  );

  /* ── Five role-aware primary destinations ── */
  const canSeeOperations=['admin','engineer','technician'].includes(user.role);
  const canSeeMaps=['admin','engineer','technician','citizen'].includes(user.role);
  const nav=[
    {id:'dashboard',label:'Dashboard',icon:'⌂'},
    {id:'flood-weather',label:'Flood & Weather',icon:'🌧',roles:['admin','engineer','technician','citizen']},
    {id:'camera-analysis',label:'Camera & Analysis',icon:'📡',roles:['admin','engineer','technician']},
    {id:'ai-detection',label:'AI Detection',icon:'◉',roles:['admin','engineer','technician']},
    {id:'workspace',label:user.role==='admin'?'Administration':'My Account',icon:user.role==='admin'?'⚙':'◎'}
  ];
  const activeTab=nav.some(item=>item.id===tab)?tab:'dashboard';

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
          {user.role==='citizen'&&<small style={{color:'var(--amber)',fontSize:12,marginTop:4,fontWeight:700}} aria-label={`${user.points||0} reward points, level ${user.level||1}`}>⭐ {user.points||0} pts · Lv {user.level||1}</small>}
        </div>
        <nav>{nav.map(n=><button key={n.id} disabled={n.roles&&!n.roles.includes(user.role)} title={n.roles&&!n.roles.includes(user.role)?'Your role does not have access to this section':n.label} className={activeTab===n.id?'active':''} onClick={()=>T(n.id)}><span className="nav-icon">{n.icon}</span><span>{n.label}</span></button>)}</nav>
        <button className="signout" onClick={()=>{localStorage.clear();setUser(null)}}>Sign out</button>
      </aside>
      <main>
        <header>
          <div><small>Municipal Operations</small><h1>{nav.find(item=>item.id===activeTab)?.label||'Dashboard'}</h1></div>
          <button onClick={refresh}>↻ Refresh</button>
        </header>
        {error&&<p className="error">{error}</p>}
        {msg&&<p className="success">{msg}</p>}
        {reward&&<RewardPopup reward={reward} onClose={()=>setReward(null)}/>}
        {activeTab==='dashboard'&&<DashboardPage Overview={Overview} ReportsTab={ReportsTab} EngineerCases={EngineerCases} TechnicianCases={TechnicianCases} TechLeaderboard={TechLeaderboard} reports={reports} flood={flood} user={user} act={act}/>}
        
        {activeTab==='flood-weather'&&canSeeMaps&&<FloodWeatherPage FloodMap={FloodMap} WeatherRisk={WeatherRisk} flood={flood} reports={reports} user={user}/>}
        {activeTab==='ai-detection'&&canSeeOperations&&<AIDetectionPage AICameraSystem={AICameraSystem} cameras={cameras} user={user} act={act}/>}
        
        {activeTab==='camera-analysis'&&canSeeOperations&&<CameraAnalysisPage AnalysisTab={AnalysisTab} CameraNode={CameraNode}/>}
        
        
        
        {activeTab==='workspace'&&user.role==='admin'&&<AdminPage Users={Users} users={users} act={act} user={user} reports={reports}/>}{activeTab==='workspace'&&user.role!=='admin'&&<div className="panel"><h2>My Account</h2><p><strong>{user.name}</strong></p><p>{user.role}{user.state?` · ${user.state}`:''}</p><p>Access to reports, cases and operational tools is determined by your assigned role.</p><button className="signout-inline" onClick={()=>{localStorage.clear();setUser(null)}}>Sign out</button></div>}
        
      </main>
    </div>
  );
}

/* ═══════════════════════════════════════ OVERVIEW ═══════════════════════════════════════ */

export default App;
