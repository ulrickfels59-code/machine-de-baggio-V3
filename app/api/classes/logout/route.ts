import { logoutStudent } from '@/lib/students';
export async function POST(){await logoutStudent();return Response.json({ok:true})}
