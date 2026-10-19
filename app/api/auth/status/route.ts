import {env} from 'cloudflare:workers';
import { account, isAdmin } from '@/lib/auth';
export async function GET(){return Response.json({configured:!!await account(),canSetup:!!env.ADMIN_SETUP_KEY,admin:await isAdmin()})}
