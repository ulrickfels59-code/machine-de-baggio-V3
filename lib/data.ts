import { env } from 'cloudflare:workers';
export function db() { return env.DB!; }
export function bucket() { return env.BUCKET!; }
const initial = [
 ['vf1','Fraiseuse HAAS VF-1','Fraiseuse verticale','https://www.azorobotics.com/images/equipments/EquipmentImage_472.jpg'],
 ['super-mini','Super Mini Mill','Fraiseuse compacte','https://www.haascnc.com/content/dam/haascnc/machines/vertical-mills/minimill/models/mini-mill/gallery/haasminimill-rangle.png'],
 ['umc500','Centre 5 axes HAAS UMC-500','Centre 5 axes','https://www.haascnc.com/content/dam/haascnc/machines/vertical-mills/universal-machine/models/umc-500ss/gallery/UMC500SS_Straight.jpg'],
 ['mini-mill','Mini Mill','Fraiseuse compacte','https://www.haascnc.com/content/dam/haascnc/machines/vertical-mills/minimill/models/mini-mill/gallery/haasminimill-rangle.png'],
 ['sl20','Tour HAAS SL-20','Tour CNC','https://static.machinetools.com/uploads/509276/101561816018642722.jpg']
];
export async function seed() {
 const d = db();
 const flag = await d.prepare("SELECT value FROM settings WHERE key = 'seeded'").first();
 if(flag) return;
 const statements = initial.flatMap(([id,name,kind,image],i) => [
  d.prepare('INSERT OR IGNORE INTO machines (id,name,kind,description,image,sort) VALUES (?,?,?,?,?,?)').bind(id,name,kind,'',image,i),
  ...['Documentation','Programmes CN','Outillage','Réglages','Maintenance','Procédures'].map((section,j)=>d.prepare('INSERT OR IGNORE INTO sections (id,machine_id,name,sort) VALUES (?,?,?,?)').bind(`${id}-${j}`,id,section,j))
 ]);
 statements.push(d.prepare("INSERT OR IGNORE INTO settings (key,value) VALUES ('seeded','1')"));
 await d.batch(statements);
}
export async function snapshot(){
 await seed(); const d=db();
 const [m,s,docs]=await Promise.all([
  d.prepare('SELECT * FROM machines ORDER BY sort,name').all(),
  d.prepare('SELECT * FROM sections ORDER BY sort,name').all(),
  d.prepare('SELECT * FROM documents ORDER BY created_at DESC').all()
 ]);
 return {machines:m.results,sections:s.results,documents:docs.results};
}
export function jsonError(message:string,status=400){return Response.json({error:message},{status});}
export function safeName(value:unknown,max=100){return typeof value==='string'?value.trim().slice(0,max):'';}
