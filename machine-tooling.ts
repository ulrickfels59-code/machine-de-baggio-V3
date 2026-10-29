import {db} from './data';
import {toolPosition,type ToolingRow} from './tooling-format';
let ready:Promise<unknown>|undefined;
async function seedPreviousAssignments(){
 const d=db();if(await d.prepare("SELECT value FROM settings WHERE key='machine_tooling_seeded_v1'").first())return;
 if(!await d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stock_movement_usage'").first())return;
 const past=await d.prepare(`SELECT u.machine_id,u.tool_position,u.operation,m.id,m.item_id,m.created_at,i.reference FROM stock_movement_usage u JOIN stock_movements m ON m.id=u.id JOIN stock_items i ON i.id=m.item_id JOIN machines machine ON machine.id=u.machine_id WHERE m.kind='withdraw' ORDER BY m.created_at DESC,m.rowid DESC`).all<{machine_id:string;tool_position:string;operation:string;id:string;item_id:string;created_at:string;reference:string}>();
 const seen=new Set<string>(),queries=[];
 for(const row of past.results){const position=toolPosition(row.tool_position),key=JSON.stringify([row.machine_id,position]);if(seen.has(key))continue;seen.add(key);queries.push(d.prepare("INSERT OR IGNORE INTO machine_tooling(machine_id,position,tool,reference,item_id,status,source_movement_id,updated_at) VALUES (?,?,?,?,?,'En stock',?,?)").bind(row.machine_id,position,row.operation,row.reference,row.item_id,row.id,row.created_at))}
 queries.push(d.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES ('machine_tooling_seeded_v1','1')"));await d.batch(queries);
}
export async function ensureMachineTooling(){if(!ready)ready=db().prepare(`CREATE TABLE IF NOT EXISTS machine_tooling(machine_id TEXT NOT NULL REFERENCES machines(id) ON DELETE CASCADE,position TEXT NOT NULL,tool TEXT NOT NULL DEFAULT '',reference TEXT NOT NULL DEFAULT '',supplier TEXT NOT NULL DEFAULT '',manufacturer_url TEXT NOT NULL DEFAULT '',tracked_quantity INTEGER NOT NULL DEFAULT 0 CHECK(tracked_quantity>=0),teeth INTEGER,diameter REAL,material TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'Non renseigné',item_id TEXT,source_movement_id TEXT,updated_at TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(machine_id,position))`).run().then(ensureManufacturerColumn).then(ensureTrackedQuantity).then(seedPreviousAssignments).catch(e=>{ready=undefined;throw e});await ready}
export async function machineTooling(machineId:string){await ensureMachineTooling();return (await db().prepare('SELECT * FROM machine_tooling WHERE machine_id=?').bind(machineId).all<ToolingRow>()).results}

async function ensureManufacturerColumn(){
 const hasColumn=async()=> (await db().prepare('PRAGMA table_info(machine_tooling)').all<{name:string}>()).results.some(c=>c.name==='manufacturer_url');
 if(await hasColumn())return;
 try{await db().prepare("ALTER TABLE machine_tooling ADD COLUMN manufacturer_url TEXT NOT NULL DEFAULT ''").run()}
 catch(error){if(!await hasColumn())throw error}
}

async function ensureTrackedQuantity(){
 const has=async()=> (await db().prepare('PRAGMA table_info(machine_tooling)').all<{name:string}>()).results.some(c=>c.name==='tracked_quantity');
 if(!await has()){try{await db().prepare('ALTER TABLE machine_tooling ADD COLUMN tracked_quantity INTEGER NOT NULL DEFAULT 0 CHECK(tracked_quantity>=0)').run()}catch(e){if(!await has())throw e}}
 await db().batch([
  db().prepare("UPDATE machine_tooling SET status='En stock' WHERE status='Sortie'"),
  db().prepare(`CREATE TRIGGER IF NOT EXISTS tooling_keep_assigned_reference BEFORE UPDATE ON machine_tooling WHEN OLD.tracked_quantity>0 AND (NEW.item_id IS NOT OLD.item_id OR NEW.reference<>OLD.reference) BEGIN SELECT RAISE(ABORT,'tooling_position_occupied'); END`),
  db().prepare(`CREATE TRIGGER IF NOT EXISTS tooling_keep_active_machine BEFORE DELETE ON machines WHEN EXISTS(SELECT 1 FROM machine_tooling WHERE machine_id=OLD.id AND tracked_quantity>0) BEGIN SELECT RAISE(ABORT,'tooling_machine_active'); END`)
 ]);
}
