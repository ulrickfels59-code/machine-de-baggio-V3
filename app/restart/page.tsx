'use client';
import { useEffect, useState } from 'react';
export default function Restart(){
 const [error,setError]=useState(false);
 async function reset(){setError(false);try{for(const [url,key] of [['/api/auth/logout','atelier_admin_token'],['/api/classes/logout','atelier_student_token']]){const token=sessionStorage.getItem(key);const r=await fetch(url,{method:'POST',credentials:'same-origin',headers:token?{Authorization:`Bearer ${token}`}:{}});if(!r.ok)throw Error('Déconnexion impossible');sessionStorage.removeItem(key)}window.location.replace('/')}catch{setError(true)}}
 useEffect(()=>{reset()},[]);
 return <main className="login-panel"><h1>Baggio Usinage</h1><p>{error?'Impossible de fermer la session précédente. Vérifie la connexion Internet puis réessaie.':'Fermeture de la session précédente…'}</p>{error&&<button className="primary" onClick={reset}>Réessayer</button>}</main>;
}
