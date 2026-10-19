import { isAdmin } from '@/lib/auth';
import { classId } from '@/lib/classes';
import { snapshot } from '@/lib/data';
export const dynamic='force-dynamic';
export async function GET(){try{if(!await isAdmin()&&!await classId())return Response.json({error:'Connecte-toi avec ton accès de classe.'},{status:401});return Response.json(await snapshot());}catch(e){console.error(e);return Response.json({error:'Données indisponibles.'},{status:503});}}
