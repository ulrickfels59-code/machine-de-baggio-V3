import { classId } from '@/lib/classes';
import { isAdmin } from '@/lib/auth';
import Workshop from './workshop';
export const dynamic='force-dynamic';
export default async function Home(){return <Workshop admin={await isAdmin()} student={!!await classId()}/>}
