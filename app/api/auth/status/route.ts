import { account, ownerCanSetup, isAdmin } from '@/lib/auth';
export async function GET(){return Response.json({configured:!!await account(),canSetup:await ownerCanSetup(),admin:await isAdmin()})}
