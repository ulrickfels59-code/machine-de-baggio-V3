export function toolPosition(value:string){const s=value.trim().replace(/\s+/g,' ').toLocaleUpperCase('fr');const t=/^T\s*0*(\d+)$/.exec(s);return t?'T'+t[1].replace(/^0+(?=\d)/,'').padStart(2,'0'):s}
export function sortPositions(a:{position:string},b:{position:string}){return a.position.localeCompare(b.position,'fr',{numeric:true})}
export const toolingStates=['En stock','Sortie','À remplacer','Non renseigné'] as const;
export type ToolingRow={machine_id:string;position:string;tool:string;reference:string;supplier:string;manufacturer_url:string;teeth:number|null;diameter:number|null;material:string;status:string;item_id:string|null;source_movement_id:string|null;updated_at:string;version:number};
export function toolingSlots(rows:ToolingRow[]){const map=new Map(rows.map(r=>[r.position,r]));const slots=new Set([...Array.from({length:20},(_,i)=>'T'+String(i+1).padStart(2,'0')),...map.keys()]);return Array.from(slots,position=>({position,row:map.get(position)||null})).sort(sortPositions)}

export function manufacturerUrl(value:unknown):string|null {
 if(typeof value!=='string')return null;
 const input=value.trim();if(!input)return '';
 if(input.length>2048||!/^https?:\/\//i.test(input)||/[\u0000-\u0020\u007f\\]/.test(input))return null;
 try{const url=new URL(input);return ['https:','http:'].includes(url.protocol)&&url.hostname&&!url.username&&!url.password?url.href:null}catch{return null}
}
