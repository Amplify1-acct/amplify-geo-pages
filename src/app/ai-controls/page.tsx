'use client';
import { useState } from 'react';
export default function AIControls() {
  const [token,setToken]=useState('');
  const [message,setMessage]=useState('Use your administrator access to pause or resume AI calls.');
  const [busy,setBusy]=useState(false);
  async function update(paused:boolean) {
    if(busy)return;
    setBusy(true);
    try {
      const response=await fetch('/api/ai-control',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({paused})});
      const value=await response.json();
      if(!response.ok)throw new Error(value.error || 'AI control update failed');
      setMessage(value.paused?'AI is paused. No new API calls will be sent. Calls already accepted by the provider may finish.':'AI is enabled for explicit user-started tasks.');
    } catch(error){setMessage(error instanceof Error?error.message:'AI control update failed');}
    finally{setBusy(false);}
  }
  return <main style={{maxWidth:640,margin:'60px auto',padding:24,fontFamily:'system-ui'}}>
    <h1>AI controls</h1><p>Pause new AI calls across this app. Existing content stays available.</p>
    <label>Administrator token (if this app requires one)<input type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} style={{display:'block',width:'100%',margin:'12px 0',padding:12}} /></label>
    <button disabled={busy} onClick={()=>void update(true)}>Pause AI</button>{' '}
    <button disabled={busy} onClick={()=>void update(false)}>Resume AI</button>
    <p role="status">{message}</p>
  </main>;
}
