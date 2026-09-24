'use client';
import {useEffect,useRef,useState,useTransition} from 'react';
export default function RecoveryControl({action,running}:{action:()=>Promise<void>;running:boolean}){
 const [autoStopped,setAutoStopped]=useState(false);
 const [pending,start]=useTransition();const [error,setError]=useState('');const started=useRef(Date.now());
 function check(){started.current=Date.now();setAutoStopped(false);setError('');start(async()=>{try{await action();}catch(e){setError(e instanceof Error?e.message:'The status check failed. Try again.');}});}
 useEffect(()=>{if(!running||pending||error)return;if(Date.now()-started.current>600000){setAutoStopped(true);return;}const timer=setTimeout(()=>{start(async()=>{try{await action();}catch(e){setError(e instanceof Error?e.message:"Status check failed.");}});},15000);return()=>clearTimeout(timer);},[running,pending,error,action]);
 return <div><button disabled={pending} onClick={check}>{pending?'Checking writing job…':running?'Check progress now':'Check and recover saved writing job'}</button>{running&&<p>{autoStopped ? "Automatic checks paused after ten minutes. Check progress to resume." : "Progress checks automatically while this page is open."}</p>}{error&&<p role="alert">{error}</p>}</div>;
}
