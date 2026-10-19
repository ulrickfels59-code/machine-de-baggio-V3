import { studentSession } from '@/lib/students';
export async function GET(){const row=await studentSession();return Response.json({student:!!row,mustChange:!!row?.must_change_password})}
