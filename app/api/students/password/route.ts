import { changeStudentPassword } from '@/lib/students';
import { jsonError } from '@/lib/data';
export async function POST(request:Request){const body=await request.json() as Record<string,unknown>,password=typeof body.password==='string'?body.password:'';if(password.length!==6)return jsonError('Choisis un nouveau mot de passe de 6 caractères.');if(!await changeStudentPassword(password))return jsonError('Session élève expirée. Reconnecte-toi.',403);return Response.json({ok:true})}
