import {db} from '@/lib/data';
import {ensureMachineTooling} from '@/lib/machine-tooling';
import {isAdmin} from '@/lib/auth';
import {GET as machines} from '../data/route';
import {GET as classes} from '../classes/route';
import {GET as documents} from '../class-documents/route';
import {GET as stock} from '../stock/route';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(!await isAdmin())return Response.json({error:'Accès réservé à l’administration.'},{status:403,headers:{'Cache-Control':'private, no-store'}});
 try{
  const responses=await Promise.all([machines(),classes(),documents(),stock(request)]);
  if(responses.some(r=>!r.ok))throw Error('Export indisponible.');
  const values=await Promise.all(responses.map(r=>r.json()));
  await ensureMachineTooling();const tooling=(await db().prepare('SELECT * FROM machine_tooling ORDER BY machine_id,position').all()).results;
  return Response.json({format:'baggio-export-listes-v1',exportedAt:new Date().toISOString(),description:'Listes, stock actif et 100 derniers mouvements. Sans fichiers PDF, images, comptes ni mots de passe. Pas de restauration automatique.',machines:values[0],classes:values[1],documents:values[2],stock:values[3],outillage:tooling},{headers:{'Cache-Control':'private, no-store','Content-Disposition':`attachment; filename="Baggio-listes-${new Date().toISOString().slice(0,10)}.json"`,'X-Content-Type-Options':'nosniff'}});
 }catch{return Response.json({error:'Export indisponible. Réessaie.'},{status:503,headers:{'Cache-Control':'private, no-store'}})}
}
