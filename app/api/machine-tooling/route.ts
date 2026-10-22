import {isAdmin} from '@/lib/auth';
import {classId} from '@/lib/classes';
import {db,jsonError} from '@/lib/data';
import {machineTooling,ensureMachineTooling} from '@/lib/machine-tooling';
import {toolPosition,toolingStates,manufacturerUrl} from '@/lib/tooling-format';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(!await isAdmin()&&!await classId())return jsonError('Connecte-toi pour consulter l’outillage.',401);
 const id=new URL(request.url).searchParams.get('machineId')||'';
 if(!id||id.length>100)return jsonError('Machine manquante.');
 const machine=await db().prepare('SELECT id,name FROM machines WHERE id=?').bind(id).first();if(!machine)return jsonError('Machine introuvable.',404);
 return Response.json({machine,rows:await machineTooling(id)},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request:Request){
 if(!await isAdmin())return jsonError('Modification réservée aux administrateurs.',403);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return jsonError('Origine refusée.',403);
 const b=await request.json() as Record<string,unknown>;
 const text=(k:string,max:number)=>typeof b[k]==='string'?(b[k] as string).trim().slice(0,max):'';
 const machineId=text('machineId',100),position=toolPosition(text('position',30)),tool=text('tool',120),reference=text('reference',100),supplier=text('supplier',100),material=text('material',60),status=text('status',30),version=b.version;
 const manufacturer=b.manufacturer_url===undefined?null:manufacturerUrl(b.manufacturer_url);
 if(b.manufacturer_url!==undefined&&manufacturer===null)return jsonError('Lien fabricant : utilise une adresse complète http:// ou https://, sans identifiant ni mot de passe.');
 if(manufacturer&&!reference)return jsonError('Renseigne la référence associée au lien fabricant.');
 const teeth=b.teeth===null||b.teeth===''?null:b.teeth,diameter=b.diameter===null||b.diameter===''?null:b.diameter;
 if(!machineId||!position||!tool||!Number.isSafeInteger(version)||(version as number)<0||!toolingStates.includes(status as typeof toolingStates[number]))return jsonError('Position, outil et état valides requis.');
 if(teeth!==null&&(typeof teeth!=='number'||!Number.isSafeInteger(teeth)||teeth<1||teeth>1000))return jsonError('Nombre de dents : entier de 1 à 1000, ou champ vide.');
 if(diameter!==null&&(typeof diameter!=='number'||!Number.isFinite(diameter)||diameter<=0||diameter>10000))return jsonError('Diamètre positif en millimètres, ou champ vide.');
 if(!await db().prepare('SELECT id FROM machines WHERE id=?').bind(machineId).first())return jsonError('Machine introuvable.',404);
 await ensureMachineTooling();
 let result;try{result=await db().prepare(`INSERT INTO machine_tooling(machine_id,position,tool,reference,supplier,teeth,diameter,material,status,manufacturer_url,updated_at) SELECT ?,?,?,?,?,?,?,?,?,COALESCE(?,''),? WHERE ?=0 OR EXISTS(SELECT 1 FROM machine_tooling WHERE machine_id=? AND position=? AND version=?) ON CONFLICT(machine_id,position) DO UPDATE SET tool=excluded.tool,reference=excluded.reference,supplier=excluded.supplier,teeth=excluded.teeth,diameter=excluded.diameter,material=excluded.material,status=excluded.status,manufacturer_url=CASE WHEN ? THEN excluded.manufacturer_url WHEN machine_tooling.reference=excluded.reference THEN machine_tooling.manufacturer_url ELSE '' END,updated_at=excluded.updated_at,version=machine_tooling.version+1,item_id=CASE WHEN machine_tooling.reference=excluded.reference THEN machine_tooling.item_id ELSE NULL END WHERE machine_tooling.version=?`).bind(machineId,position,tool,reference,supplier,teeth,diameter,material,status,manufacturer,new Date().toISOString(),version,machineId,position,version,b.manufacturer_url!==undefined?1:0,version).run()}catch(e){if((String(e)+' '+String((e as any)?.cause)).includes('tooling_position_occupied'))return jsonError('Remets d’abord l’outil en stock avant de changer sa référence.',409);throw e}
 if(!result.meta.changes)return jsonError('Cette position a changé depuis son ouverture. Actualise le tableau avant de modifier.',409);
 return Response.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
}
