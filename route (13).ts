import {db,jsonError} from '@/lib/data';
import {stockActor,validInteger,mutationAllowed} from '@/lib/stock';
import {ensureDisposals,disposalList} from '@/lib/tool-disposals';
import {clean} from '@/lib/learning';
import {toolPosition} from '@/lib/tooling-format';
export const dynamic='force-dynamic';
export async function GET(){const a=await stockActor();if(!a)return jsonError('Connexion requise.',401);return Response.json({requests:await disposalList(a)},{headers:{'Cache-Control':'private, no-store'}})}
export async function POST(request:Request){
 const a=await stockActor();if(!a)return jsonError('Connexion requise.',401);if(!mutationAllowed(request))return jsonError('Origine refusée.',403);await ensureDisposals();const b=await request.json() as Record<string,unknown>,action=clean(b.action,20),d=db();
 if(action==='request'){
  const machineId=clean(b.machineId,80),position=toolPosition(clean(b.position,30)),reason=clean(b.reason,1500),id=clean(b.requestId,80);
  if(!/^[a-f0-9-]{32,80}$/i.test(id)||!validInteger(b.quantity,1)||!validInteger(b.version,1,Number.MAX_SAFE_INTEGER)||reason.length<5)return jsonError('Quantité, motif et affectation valides requis.');
  const old=await d.prepare('SELECT actor_key,machine_id,position,quantity,expected_version,reason FROM tool_disposals WHERE id=?').bind(id).first<{actor_key:string;machine_id:string;position:string;quantity:number;expected_version:number;reason:string}>();
  if(old){if(old.actor_key!==a.key||old.machine_id!==machineId||old.position!==position||old.quantity!==b.quantity||old.expected_version!==b.version||old.reason!==reason)return jsonError('Demande déjà utilisée.',409);return Response.json({id})}
  const row=await d.prepare('SELECT t.item_id,t.reference,t.tool,t.tracked_quantity,t.version,m.name FROM machine_tooling t JOIN machines m ON m.id=t.machine_id WHERE t.machine_id=? AND t.position=?').bind(machineId,position).first<{item_id:string;reference:string;tool:string;tracked_quantity:number;version:number;name:string}>();
  if(!row||!row.item_id||row.tracked_quantity<(b.quantity as number)||row.version!==b.version)return jsonError('Affectation modifiée ou quantité indisponible. Actualise.',409);
  try{await d.prepare('INSERT INTO tool_disposals(id,item_id,reference,machine_id,machine_name,position,tool,quantity,expected_version,reason,actor_key,actor_name,class_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,row.item_id,row.reference,machineId,row.name,position,row.tool,b.quantity,b.version,reason,a.key,a.name,a.classId,new Date().toISOString()).run()}catch(e){const msg=String(e)+' '+String((e as any)?.cause);if(msg.includes('stock_request_conflict')||msg.includes('UNIQUE'))return jsonError('Demande déjà utilisée. Actualise.',409);throw e}return Response.json({id},{status:201});
 }
 if(action==='review'){
  if(!a.admin)return jsonError('Validation réservée à un administrateur.',403);const status=clean(b.status,20),id=clean(b.id,80),comment=clean(b.teacherComment,1500);if(!['approved','rejected'].includes(status))return jsonError('Décision invalide.');
  const previous=await d.prepare('SELECT status FROM tool_disposals WHERE id=?').bind(id).first<{status:string}>();if(!previous)return jsonError('Demande inconnue.',404);if(previous.status===status)return Response.json({ok:true});if(previous.status!=='pending')return jsonError('Demande déjà traitée.',409);
  try{const result=await d.prepare("UPDATE tool_disposals SET status=?,teacher_comment=?,reviewed_by=?,reviewed_at=? WHERE id=? AND status='pending'").bind(status,comment,a.name,new Date().toISOString(),id).run();if(!result.meta.changes)return jsonError('Demande déjà traitée. Actualise.',409);return Response.json({ok:true})}
  catch(e){if((String(e)+' '+String((e as any)?.cause)).includes('disposal_changed'))return jsonError('La quantité ou la fiche a changé depuis le signalement. Refuse cette demande puis crée une demande actualisée.',409);throw e}
 }
 return jsonError('Action inconnue.');
}
