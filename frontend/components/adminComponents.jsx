import React, { useEffect, useMemo, useRef, useState } from 'react';
import { API, MY_STATES, getPhotoUrl, req, SC, PC, SL, Badge } from './shared.jsx';

export function Users({users,act,user,reports}){
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

export function UserRow({u,me,act}){
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

export function ReportStateRow({r,act}){
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
export function WeatherRisk({user,flood=[]}){
  let[data,setData]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
  let[selected,setSel]=useState(null);

  async function load(){
    setLoading(true);setError('');
    try{
      let t=localStorage.getItem('token');
      let r=await fetch(`${API}/weather-risk`,{
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
      <h2>🌦️ Weather + Flood Situation — All States</h2>
      <p style={{fontSize:13,color:'var(--gray3)',marginBottom:16}}>
        Combined risk uses the 7-day rainfall forecast and active report density. The flood map above shows the underlying reported locations; state-level report counts below help connect those incidents to the weather outlook.
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
              <span>{flood.filter(point=>point.state===s.state).length} mapped reports · {s.risk_level.split(' ')[0]} {s.risk_level.split(' ').slice(1).join(' ')}</span>
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
