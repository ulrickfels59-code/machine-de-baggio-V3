import {bucket} from './data';
export function safeFileName(name:string){return name.replace(/[\x00-\x1f\x7f/\\"]/g,'_').slice(0,120)||'travail'}
export async function validatedFile(file:File,photoOnly=false){
 if(file.size<1||file.size>10*1024*1024)throw Error('Fichier de 10 Mo maximum requis.');
 const bytes=new Uint8Array(await file.arrayBuffer()),ext=file.name.toLowerCase().split('.').pop(),start=bytes.slice(0,16);let mime='';
 if(['jpg','jpeg'].includes(ext||'')&&start[0]===255&&start[1]===216&&start[2]===255)mime='image/jpeg';
 if(ext==='png'&&[137,80,78,71,13,10,26,10].every((v,i)=>start[i]===v))mime='image/png';
 if(ext==='webp'&&String.fromCharCode(...start.slice(0,4))==='RIFF'&&String.fromCharCode(...start.slice(8,12))==='WEBP')mime='image/webp';
 if(!photoOnly&&ext==='pdf'&&String.fromCharCode(...start.slice(0,5))==='%PDF-')mime='application/pdf';
 if(!photoOnly&&['txt','nc','cnc','tap','iso'].includes(ext||'')){try{const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(!text.includes('\0')&&!/[\x01-\x08\x0b\x0c\x0e-\x1f]/.test(text))mime='text/plain'}catch{}}
 if(!mime)throw Error(photoOnly?'Photo JPG, PNG ou WebP requise.':'Formats autorisés : PDF, JPG, PNG, WebP ou programme texte UTF-8 (.txt, .nc, .cnc, .tap, .iso).');
 return {bytes,mime,name:safeFileName(file.name)};
}
export async function storedResponse(key:string,mime:string,name:string){const file=await bucket().get(key);if(!file)return Response.json({error:'Fichier indisponible.'},{status:404});return new Response(file.body,{headers:{'Content-Type':mime,'Content-Disposition':`attachment; filename="${safeFileName(name).replace(/[^a-zA-Z0-9_.-]/g,'_')}"; filename*=UTF-8''${encodeURIComponent(safeFileName(name))}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}})}
