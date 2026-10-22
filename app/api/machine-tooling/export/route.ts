import {isAdmin} from '@/lib/auth';
import {classId} from '@/lib/classes';
import {db,jsonError} from '@/lib/data';
import {machineTooling} from '@/lib/machine-tooling';
import {toolingSlots} from '@/lib/tooling-format';
import {stockWorkbook} from '@/lib/stock-xlsx';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 if(!await isAdmin()&&!await classId())return jsonError('Connecte-toi pour exporter l’outillage.',401);
 const id=new URL(request.url).searchParams.get('machineId')||'';if(!id||id.length>100)return jsonError('Machine manquante.');
 const machine=await db().prepare('SELECT name FROM machines WHERE id=?').bind(id).first<{name:string}>();if(!machine)return jsonError('Machine introuvable.',404);
 const rows=toolingSlots(await machineTooling(id));
 const bytes=stockWorkbook(['T','Outils','Fournisseur / Référence','Nombre de dents','Diamètre (mm)','Acier / Alu / Matière','Stock'],rows.map(({position,row})=>[position,row?.tool||'',row?[row.supplier,row.reference].filter(Boolean).join(' / '):'',row?.teeth??null,row?.diameter??null,row?.material||'',row?.status||'']),{widths:[10,32,34,18,18,23,21],dateColumn:null,sheetName:'Outillage'});
 const name=machine.name.replace(/[^a-z0-9_-]/gi,'-');
 return new Response(bytes.buffer as ArrayBuffer,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="Baggio-outillage-${name}.xlsx"`,'Cache-Control':'private, no-store'}});
}
