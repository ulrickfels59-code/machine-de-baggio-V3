import {jsonError} from '@/lib/data';
import {stockActor,readToolReturns,returnTool,stockText,validInteger,mutationAllowed} from '@/lib/stock';
import {toolPosition} from '@/lib/tooling-format';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(!await stockActor())return jsonError('Connecte-toi pour ranger un outil.',401);
 const params=new URL(request.url).searchParams,itemId=params.get('itemId')||undefined,machineId=params.get('machineId')||undefined;
 if((itemId?.length||0)>100||(machineId?.length||0)>100)return jsonError('Filtre invalide.');
 return Response.json({assignments:await readToolReturns(itemId,machineId)},{headers:{'Cache-Control':'private, no-store'}});
}
export async function POST(request:Request){
 const a=await stockActor();if(!a)return jsonError('Connecte-toi pour ranger un outil.',401);
 if(!mutationAllowed(request))return jsonError('Origine refusée.',403);
 const b=await request.json() as Record<string,unknown>,id=stockText(b.requestId,80),itemId=stockText(b.itemId,80),machineId=stockText(b.machineId,100),position=toolPosition(stockText(b.position,30));
 if(!/^[a-f0-9-]{32,80}$/i.test(id)||!itemId||!machineId||!position||!validInteger(b.quantity,1)||!validInteger(b.version,1,Number.MAX_SAFE_INTEGER)||b.stored!==true)return jsonError('Choisis l’affectation, la quantité et confirme le rangement.');
 try{await returnTool({id,itemId,machineId,position,quantity:b.quantity as number,version:b.version as number,note:stockText(b.note,300)},a);return Response.json({ok:true},{headers:{'Cache-Control':'no-store'}})}
 catch(e){const message=String(e)+' '+String((e as any)?.cause);
 if(message.includes('stock_return_changed'))return jsonError('Cette affectation a changé ou la quantité est trop élevée. Actualise les retours disponibles.',409);
 if(message.includes('stock_request_conflict'))return jsonError('Cette demande a déjà été utilisée pour une autre opération.',409);
 if(message.includes('stock_item_unavailable'))return jsonError('Outil archivé ou introuvable. Demande à un admin de le réactiver.',409);
 if(message.includes('stock_limit'))return jsonError('Limite de stock dépassée.',409);
 console.error(e);return jsonError('Retour non enregistré. Réessaie avec le même formulaire.',503)}
}
