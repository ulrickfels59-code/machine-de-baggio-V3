import {stockActor,readStockHistory} from '@/lib/stock';
import {stockWorkbook,excelParisDate} from '@/lib/stock-xlsx';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const a=await stockActor();if(!a)return Response.json({error:'Connecte-toi pour exporter le suivi.'},{status:401,headers:{'Cache-Control':'no-store'}});
 const url=new URL(request.url),itemId=url.searchParams.get('itemId')||undefined,machineId=url.searchParams.get('machineId')||undefined;
 if((itemId?.length||0)>100||(machineId?.length||0)>100)return Response.json({error:'Filtre invalide.'},{status:400});
 const rows=await readStockHistory(a,{itemId,machineId});
 const labels:Record<string,string>={return:'Retour rangement',withdraw:'Retrait',restock:'Réapprovisionnement',adjust:'Correction',count:'Contrôle'};
 const workbook=stockWorkbook(['Date (heure de Paris)','Élève / administrateur','Classe','Référence','Outil','Mouvement','Quantité (+/−)','Stock après','Machine','Position','Utilisation','Commentaire'],rows.map(m=>[excelParisDate(m.created_at),m.actor_name,m.class_label,m.reference,m.name,labels[m.kind]||m.kind,m.delta,m.balance_after,m.machine_name,m.tool_position,m.operation,m.note]));
 return new Response(workbook.buffer as ArrayBuffer,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="Baggio-suivi-outils-${new Date().toISOString().slice(0,10)}.xlsx"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
