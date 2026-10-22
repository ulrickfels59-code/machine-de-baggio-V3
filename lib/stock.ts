import {ensureMachineTooling} from './machine-tooling';
import {toolPosition} from './tooling-format';
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
statements.push(
 `CREATE TABLE IF NOT EXISTS stock_counts(id TEXT PRIMARY KEY,item_id TEXT NOT NULL REFERENCES stock_items(id),expected_quantity INTEGER NOT NULL,counted_quantity INTEGER NOT NULL CHECK(counted_quantity>=0 AND counted_quantity<=1000000),actor_key TEXT NOT NULL,actor_name TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL)`,
 `CREATE TRIGGER IF NOT EXISTS stock_validate_count BEFORE INSERT ON stock_counts BEGIN SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM stock_items WHERE id=NEW.item_id AND archived=0) THEN RAISE(ABORT,'stock_item_unavailable') WHEN (SELECT quantity FROM stock_items WHERE id=NEW.item_id)<>NEW.expected_quantity THEN RAISE(ABORT,'stock_count_changed') END; END`,
 `CREATE TRIGGER IF NOT EXISTS stock_apply_count AFTER INSERT ON stock_counts WHEN NEW.counted_quantity<>NEW.expected_quantity BEGIN INSERT INTO stock_movements(id,item_id,kind,delta,actor_key,actor_name,note,created_at) VALUES(NEW.id,NEW.item_id,'adjust',NEW.counted_quantity-NEW.expected_quantity,NEW.actor_key,NEW.actor_name,'Contrôle stock : compté '||NEW.counted_quantity||' (avant '||NEW.expected_quantity||'). '||NEW.note,NEW.created_at); END`
);
statements.push(
 `CREATE TABLE IF NOT EXISTS stock_movement_usage(id TEXT PRIMARY KEY NOT NULL REFERENCES stock_movements(id),machine_id TEXT NOT NULL,machine_name TEXT NOT NULL,tool_position TEXT NOT NULL,operation TEXT NOT NULL)`,
 `CREATE TRIGGER IF NOT EXISTS stock_usage_retry BEFORE INSERT ON stock_movement_usage WHEN EXISTS(SELECT 1 FROM stock_movement_usage WHERE id=NEW.id AND (machine_id<>NEW.machine_id OR machine_name<>NEW.machine_name OR tool_position<>NEW.tool_position OR operation<>NEW.operation)) BEGIN SELECT RAISE(ABORT,'stock_request_conflict'); END`
);
let ready:Promise<unknown>|undefined;
export async function ensureStock(){if(!ready)ready=db().batch(statements.map(sql=>db().prepare(sql))).then(()=>ensureMachineTooling()).then(ensureReturns).catch(e=>{ready=undefined;throw e});await ready}
export function stockText(v:unknown,max=100){return typeof v==='string'?v.trim().slice(0,max):''}
export function validInteger(v:unknown,min=0,max=1000000){return typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max}
export function mutationAllowed(request:Request){const origin=request.headers.get('origin');return !origin||origin===new URL(request.url).origin}
export async function insertMovement(b:{id:string;itemId:string;kind:string;delta:number;note:string;usage?:{machineId:string;machineName:string;position:string;operation:string}},a:StockActor){
 if(await db().prepare('SELECT id FROM stock_counts WHERE id=? UNION ALL SELECT id FROM stock_tool_returns WHERE id=?').bind(b.id,b.id).first())throw Error('stock_request_conflict');
 // ON CONFLICT is deliberately checked before the balance trigger, even after a retry.
 const existing=await db().prepare('SELECT m.item_id,m.kind,m.delta,m.actor_key,m.note,u.machine_id,u.tool_position,u.operation FROM stock_movements m LEFT JOIN stock_movement_usage u ON u.id=m.id WHERE m.id=?').bind(b.id).first<{item_id:string;kind:string;delta:number;actor_key:string;note:string;machine_id:string|null;tool_position:string|null;operation:string|null}>();
 if(existing){if(existing.item_id!==b.itemId||existing.kind!==b.kind||existing.delta!==b.delta||existing.actor_key!==a.key||existing.note!==b.note||(existing.machine_id||'')!==(b.usage?.machineId||'')||(existing.tool_position||'')!==(b.usage?.position||'')||(existing.operation||'')!==(b.usage?.operation||''))throw Error('stock_request_conflict');return;}
 const queries=[db().prepare('INSERT INTO stock_movements(id,item_id,kind,delta,actor_key,actor_name,class_id,note,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM stock_movements WHERE id=?)').bind(b.id,b.itemId,b.kind,b.delta,a.key,a.name,a.classId,b.note,new Date().toISOString(),b.id)];
 if(b.usage)queries.push(db().prepare('INSERT OR IGNORE INTO stock_movement_usage(id,machine_id,machine_name,tool_position,operation) VALUES (?,?,?,?,?)').bind(b.id,b.usage.machineId,b.usage.machineName,b.usage.position,b.usage.operation));

 await db().batch(queries);
}

export async function recordCount(b:{id:string;itemId:string;expected:number;counted:number;note:string},a:StockActor){
 const prior=await db().prepare('SELECT item_id,expected_quantity,counted_quantity,actor_key FROM stock_counts WHERE id=?').bind(b.id).first<{item_id:string;expected_quantity:number;counted_quantity:number;actor_key:string}>();
 if(prior){if(prior.item_id!==b.itemId||prior.expected_quantity!==b.expected||prior.counted_quantity!==b.counted||prior.actor_key!==a.key)throw Error('stock_request_conflict');return;}
 if(await db().prepare('SELECT id FROM stock_movements WHERE id=?').bind(b.id).first())throw Error('stock_request_conflict');
 await db().prepare('INSERT INTO stock_counts(id,item_id,expected_quantity,counted_quantity,actor_key,actor_name,note,created_at) SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM stock_counts WHERE id=?)').bind(b.id,b.itemId,b.expected,b.counted,a.key,a.name,b.note,new Date().toISOString(),b.id).run();
}

export type StockHistoryRow={id:string;item_id:string;reference:string;name:string;kind:string;actor_name:string;class_label:string|null;delta:number;balance_after:number;note:string;created_at:string;machine_id:string|null;machine_name:string|null;tool_position:string|null;operation:string|null};
export async function readStockHistory(a:StockActor,filters:{itemId?:string;machineId?:string;limit?:number}={}){
 await ensureStock();const conditions=[a.admin?'1=1':'m.actor_key=?'],args:string[]=[];
 if(!a.admin)args.push(a.key);if(filters.itemId){conditions.push('m.item_id=?');args.push(filters.itemId)}if(filters.machineId){conditions.push('u.machine_id=?');args.push(filters.machineId)}
 const limit=filters.limit?' LIMIT '+Math.min(10000,Math.max(1,Math.floor(filters.limit))):'';
 const rows=await db().prepare(`SELECT m.id,m.item_id,m.delta,m.actor_key,m.actor_name,m.class_id,m.note,m.created_at,m.balance_after,CASE WHEN EXISTS(SELECT 1 FROM stock_tool_returns r WHERE r.id=m.id) THEN 'return' ELSE m.kind END AS kind,i.reference,i.name,c.label AS class_label,u.machine_id,u.machine_name,u.tool_position,u.operation FROM (SELECT id,item_id,kind,delta,actor_key,actor_name,class_id,note,created_at,balance_after FROM stock_movements WHERE id NOT IN(SELECT id FROM stock_counts) UNION ALL SELECT id,item_id,'count' AS kind,counted_quantity-expected_quantity AS delta,actor_key,actor_name,NULL AS class_id,'Contrôle stock : compté '||counted_quantity||' (avant '||expected_quantity||'). '||note AS note,created_at,counted_quantity AS balance_after FROM stock_counts) m JOIN stock_items i ON i.id=m.item_id LEFT JOIN school_classes c ON c.id=m.class_id LEFT JOIN stock_movement_usage u ON u.id=m.id WHERE ${conditions.join(' AND ')} ORDER BY m.created_at DESC,m.id DESC${limit}`).bind(...args).all<StockHistoryRow>();
 return rows.results;
}

async function ensureReturns(){
 await db().batch([
 db().prepare(`CREATE TABLE IF NOT EXISTS stock_tool_returns(id TEXT PRIMARY KEY,item_id TEXT NOT NULL,machine_id TEXT NOT NULL,machine_name TEXT NOT NULL,position TEXT NOT NULL,operation TEXT NOT NULL,quantity INTEGER NOT NULL CHECK(quantity>0),expected_version INTEGER NOT NULL,note TEXT NOT NULL,actor_key TEXT NOT NULL,actor_name TEXT NOT NULL,class_id TEXT,created_at TEXT NOT NULL)`),
 db().prepare(`CREATE TRIGGER IF NOT EXISTS tooling_assign_withdrawal AFTER INSERT ON stock_movement_usage WHEN (SELECT kind FROM stock_movements WHERE id=NEW.id)='withdraw' BEGIN
 INSERT INTO machine_tooling(machine_id,position,tool,reference,item_id,status,source_movement_id,updated_at,tracked_quantity)
 SELECT NEW.machine_id,NEW.tool_position,NEW.operation,i.reference,i.id,'En stock',m.id,m.created_at,-m.delta FROM stock_movements m JOIN stock_items i ON i.id=m.item_id WHERE m.id=NEW.id
 ON CONFLICT(machine_id,position) DO UPDATE SET tool=excluded.tool,reference=excluded.reference,item_id=excluded.item_id,status='En stock',source_movement_id=excluded.source_movement_id,updated_at=excluded.updated_at,tracked_quantity=machine_tooling.tracked_quantity+excluded.tracked_quantity,version=machine_tooling.version+1,
 manufacturer_url=CASE WHEN machine_tooling.reference=excluded.reference THEN machine_tooling.manufacturer_url ELSE '' END,
 supplier=CASE WHEN machine_tooling.reference=excluded.reference THEN machine_tooling.supplier ELSE '' END,
 teeth=CASE WHEN machine_tooling.reference=excluded.reference THEN machine_tooling.teeth ELSE NULL END,
 diameter=CASE WHEN machine_tooling.reference=excluded.reference THEN machine_tooling.diameter ELSE NULL END,
 material=CASE WHEN machine_tooling.reference=excluded.reference THEN machine_tooling.material ELSE '' END;
 END`),
 db().prepare(`CREATE TRIGGER IF NOT EXISTS tooling_validate_return BEFORE INSERT ON stock_tool_returns BEGIN
 SELECT CASE WHEN EXISTS(SELECT 1 FROM stock_movements WHERE id=NEW.id) OR EXISTS(SELECT 1 FROM stock_counts WHERE id=NEW.id) THEN RAISE(ABORT,'stock_request_conflict')
 WHEN NOT EXISTS(SELECT 1 FROM machine_tooling WHERE machine_id=NEW.machine_id AND position=NEW.position AND item_id=NEW.item_id AND tracked_quantity>=NEW.quantity AND version=NEW.expected_version) THEN RAISE(ABORT,'stock_return_changed') END;
 END`),
 db().prepare(`CREATE TRIGGER IF NOT EXISTS tooling_apply_return AFTER INSERT ON stock_tool_returns BEGIN
 INSERT INTO stock_movements(id,item_id,kind,delta,actor_key,actor_name,class_id,note,created_at) VALUES(NEW.id,NEW.item_id,'restock',NEW.quantity,NEW.actor_key,NEW.actor_name,NEW.class_id,NEW.note,NEW.created_at);
 INSERT INTO stock_movement_usage(id,machine_id,machine_name,tool_position,operation) VALUES(NEW.id,NEW.machine_id,NEW.machine_name,NEW.position,NEW.operation);
 UPDATE machine_tooling SET tracked_quantity=tracked_quantity-NEW.quantity,updated_at=NEW.created_at,version=version+1 WHERE machine_id=NEW.machine_id AND position=NEW.position;
 DELETE FROM machine_tooling WHERE machine_id=NEW.machine_id AND position=NEW.position AND tracked_quantity=0;
 END`),
 db().prepare(`CREATE TRIGGER IF NOT EXISTS tooling_keep_stock_item BEFORE UPDATE ON stock_items WHEN (NEW.archived=1 OR NEW.reference<>OLD.reference) AND EXISTS(SELECT 1 FROM machine_tooling WHERE item_id=OLD.id AND tracked_quantity>0) BEGIN SELECT RAISE(ABORT,'tooling_item_active'); END`)
 ]);
}
export async function readToolReturns(itemId?:string,machineId?:string){
 await ensureStock();const conditions=['t.tracked_quantity>0','i.archived=0'],args:string[]=[];
 if(itemId){conditions.push('t.item_id=?');args.push(itemId)}if(machineId){conditions.push('t.machine_id=?');args.push(machineId)}
 return (await db().prepare(`SELECT t.machine_id,t.position,t.item_id,t.reference,t.tool,t.version,t.tracked_quantity,m.name AS machine_name,i.location FROM machine_tooling t JOIN machines m ON m.id=t.machine_id JOIN stock_items i ON i.id=t.item_id WHERE ${conditions.join(' AND ')} ORDER BY m.name,t.position`).bind(...args).all()).results;
}
export async function returnTool(b:{id:string;itemId:string;machineId:string;position:string;quantity:number;version:number;note:string},a:StockActor):Promise<void>{
 await ensureStock();
 const previous=await db().prepare('SELECT * FROM stock_tool_returns WHERE id=?').bind(b.id).first<{item_id:string;machine_id:string;position:string;quantity:number;expected_version:number;note:string;actor_key:string}>();
 const note='Retour rangement. '+b.note;
 if(previous){if(previous.item_id!==b.itemId||previous.machine_id!==b.machineId||previous.position!==b.position||previous.quantity!==b.quantity||previous.expected_version!==b.version||previous.note!==note||previous.actor_key!==a.key)throw Error('stock_request_conflict');return}
 const current=await db().prepare('SELECT t.tool,m.name FROM machine_tooling t JOIN machines m ON m.id=t.machine_id WHERE t.machine_id=? AND t.position=? AND t.item_id=?').bind(b.machineId,b.position,b.itemId).first<{tool:string;name:string}>();
 if(!current){const raced=await db().prepare('SELECT id FROM stock_tool_returns WHERE id=?').bind(b.id).first();if(raced)return returnTool(b,a);throw Error('stock_return_changed')}
 await db().prepare(`INSERT INTO stock_tool_returns(id,item_id,machine_id,machine_name,position,operation,quantity,expected_version,note,actor_key,actor_name,class_id,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM stock_tool_returns WHERE id=?)`).bind(b.id,b.itemId,b.machineId,current.name,b.position,current.tool,b.quantity,b.version,note,a.key,a.name,a.classId,new Date().toISOString(),b.id).run();
 const saved=await db().prepare('SELECT item_id,machine_id,position,quantity,expected_version,note,actor_key FROM stock_tool_returns WHERE id=?').bind(b.id).first<{item_id:string;machine_id:string;position:string;quantity:number;expected_version:number;note:string;actor_key:string}>();
 if(!saved||saved.item_id!==b.itemId||saved.machine_id!==b.machineId||saved.position!==b.position||saved.quantity!==b.quantity||saved.expected_version!==b.version||saved.note!==note||saved.actor_key!==a.key)throw Error('stock_request_conflict');
}
