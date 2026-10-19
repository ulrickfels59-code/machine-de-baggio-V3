import { isAdmin } from '@/lib/auth';
import Workshop from '../workshop';
export const dynamic='force-dynamic';
export default async function Admin(){return <Workshop admin={await isAdmin()} student={false} initialPage="Administration"/>}
