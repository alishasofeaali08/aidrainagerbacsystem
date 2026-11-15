import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { API, MY_STATES, getPhotoUrl, req, SC, PC, SL, Badge } from './shared.jsx';

export function MapController({ center, route }) {
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
export function FloodMap({flood,reports,user}){
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
