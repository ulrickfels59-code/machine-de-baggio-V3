import { isAdmin } from '@/lib/auth';
import { bucket, jsonError } from '@/lib/data';
export async function POST(request:Request){
 if(!await isAdmin())return jsonError('Accès réservé à l’administration.',403);
 const form=await request.formData(), file=form.get('file');
 if(!(file instanceof File)||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)return jsonError('Choisir une image JPG, PNG ou WebP de 5 Mo maximum.');
 const id=crypto.randomUUID(),key=`images/${id}`;
 await bucket().put(key,file.stream(),{httpMetadata:{contentType:file.type}});return Response.json({url:`/api/image?id=${id}`});
}
export async function GET(request:Request){
 const id=new URL(request.url).searchParams.get('id');if(!id||!/^[a-f0-9-]{36}$/.test(id))return jsonError('Image invalide.');
 const file=await bucket().get(`images/${id}`);if(!file)return jsonError('Image introuvable.',404);
 return new Response(file.body,{headers:{'Content-Type':file.httpMetadata?.contentType||'image/jpeg','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}});
}
