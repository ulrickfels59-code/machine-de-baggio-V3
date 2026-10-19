import { seedClasses } from '@/lib/classes';
import { loginStudent } from '@/lib/students';
import { jsonError } from '@/lib/data';
export async function POST(request:Request){await seedClasses();const b=await request.json() as Record<string,unknown>,username=typeof b.username==='string'?b.username.trim():'',password=typeof b.password==='string'?b.password:'';if(!username||!password||username.length>40||password.length>128)return jsonError('Identifiant ou mot de passe incorrect.',401);const session=await loginStudent(username,password);if(!session)return jsonError('Identifiant ou mot de passe incorrect ou accès temporairement bloqué.',401);return Response.json({ok:true,...session})}
