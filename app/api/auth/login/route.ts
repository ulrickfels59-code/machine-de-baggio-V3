import { startSession, adminCookie, verifyAccount } from '@/lib/auth';
import { jsonError } from '@/lib/data';
export async function POST(request:Request){
 const body=await request.json() as Record<string,unknown>,username=typeof body.username==='string'?body.username.trim():'',password=typeof body.password==='string'?body.password:'';
 if(!username||!password||username.length>30||password.length>128)return jsonError('Identifiant ou mot de passe incorrect.',401);
 try{if(!await verifyAccount(username,password))return jsonError('Identifiant ou mot de passe incorrect.',401)}catch(e){return jsonError(e instanceof Error?e.message:'Connexion indisponible.',429)}
 const token=await startSession(username);return Response.json({ok:true,token},{headers:{'Set-Cookie':adminCookie(token)}});
}
