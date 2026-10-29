import {isAdmin} from '@/lib/auth';
import {db,jsonError} from '@/lib/data';
import {mutationAllowed} from '@/lib/stock';
import {festiveModes,type FestiveMode} from '@/lib/festive';
export const dynamic='force-dynamic';
export async function GET(){const row=await db().prepare("SELECT value FROM settings WHERE key='festive_mode'").first<{value:string}>();const mode=festiveModes.includes(row?.value as FestiveMode)?row!.value:'auto';return Response.json({mode},{headers:{'Cache-Control':'no-store'}})}
export async function POST(request:Request){
 if(!await isAdmin())return jsonError('Réglage réservé à un administrateur.',403);
 if(!mutationAllowed(request))return jsonError('Origine refusée.',403);
 const b=await request.json() as {mode:unknown};if(!festiveModes.includes(b.mode as FestiveMode))return jsonError('Thème inconnu.');
 await db().prepare("INSERT INTO settings(key,value) VALUES ('festive_mode',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(b.mode).run();return Response.json({ok:true,mode:b.mode},{headers:{'Cache-Control':'no-store'}});
}
