import {cookies,headers} from 'next/headers';
import {db} from './data';
import {isAdmin,digest} from './auth';
import {studentSession} from './students';
export type StockActor={key:string;name:string;classId:string|null;admin:boolean};
export async function stockActor():Promise<StockActor|null>{
 if(await isAdmin()){
  const h=await headers(),token=h.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]||(await cookies()).get('atelier_admin')?.value;
  if(!token)return null;const row=await db().prepare('SELECT username FROM admin_sessions WHERE token_hash=? AND expires_at>?').bind(await digest(token),Date.now()).first<{username:string}>();
  return row?{key:'admin:'+row.username,name:row.username,classId:null,admin:true}:null;
 }
 const s=await studentSession();if(!s||s.must_change_password)return null;
 const row=await db().prepare('SELECT username FROM students WHERE id=?').bind(s.id).first<{username:string}>();
 return row?{key:'student:'+s.id,name:row.username,classId:s.class_id,admin:false}:null;
}
const statements=[
 `CREATE TABLE IF NOT EXISTS stock_items(id TEXT PRIMARY KEY,reference TEXT NOT NULL COLLATE NOCASE UNIQUE,name TEXT NOT NULL,category TEXT NOT NULL,location TEXT NOT NULL DEFAULT '',quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity>=0 AND quantity<=1000000),minimum INTEGER NOT NULL DEFAULT 0 CHECK(minimum>=0),archived INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS stock_movements(id TEXT PRIMARY KEY,item_id TEXT NOT NULL REFERENCES stock_items(id),kind TEXT NOT NULL CHECK(kind IN ('withdraw','restock','adjust')),delta INTEGER NOT NULL CHECK(delta<>0),actor_key TEXT NOT NULL,actor_name TEXT NOT NULL,class_id TEXT,note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,balance_after INTEGER)`,
 `CREATE INDEX IF NOT EXISTS stock_movements_item_date ON stock_movements(item_id,created_at)`,
 `CREATE TRIGGER IF NOT EXISTS stock_validate_movement BEFORE INSERT ON stock_movements BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM stock_items WHERE id=NEW.item_id AND archived=0) THEN RAISE(ABORT,'stock_item_unavailable') WHEN (SELECT quantity FROM stock_items WHERE id=NEW.item_id)+NEW.delta<0 THEN RAISE(ABORT,'stock_insufficient') WHEN (SELECT quantity FROM stock_items WHERE id=NEW.item_id)+NEW.delta>1000000 THEN RAISE(ABORT,'stock_limit') END; END`,
 `CREATE TRIGGER IF NOT EXISTS stock_apply_movement AFTER INSERT ON stock_movements BEGIN UPDATE stock_items SET quantity=quantity+NEW.delta WHERE id=NEW.item_id; UPDATE stock_movements SET balance_after=(SELECT quantity FROM stock_items WHERE id=NEW.item_id) WHERE id=NEW.id; END`
];
let ready:Promise<unknown>|undefined;
export async function ensureStock(){if(!ready)ready=db().batch(statements.map(sql=>db().prepare(sql))).catch(e=>{ready=undefined;throw e});await ready}
export function stockText(v:unknown,max=100){return typeof v==='string'?v.trim().slice(0,max):''}
export function validInteger(v:unknown,min=0,max=1000000){return typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max}
export function mutationAllowed(request:Request){const origin=request.headers.get('origin');return !origin||origin===new URL(request.url).origin}
export async function insertMovement(b:{id:string;itemId:string;kind:string;delta:number;note:string},a:StockActor){
 // ON CONFLICT is deliberately checked before the balance trigger, even after a retry.
 const existing=await db().prepare('SELECT item_id,kind,delta,actor_key FROM stock_movements WHERE id=?').bind(b.id).first<{item_id:string;kind:string;delta:number;actor_key:string}>();
 if(existing){if(existing.item_id!==b.itemId||existing.kind!==b.kind||existing.delta!==b.delta||existing.actor_key!==a.key)throw Error('stock_request_conflict');return;}
 await db().prepare('INSERT INTO stock_movements(id,item_id,kind,delta,actor_key,actor_name,class_id,note,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM stock_movements WHERE id=?)').bind(b.id,b.itemId,b.kind,b.delta,a.key,a.name,a.classId,b.note,new Date().toISOString(),b.id).run();
}
