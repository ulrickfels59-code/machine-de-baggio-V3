import {writeFileSync} from 'node:fs';
const databaseId=process.env.BAGGIO_DATABASE_ID;
if(!databaseId||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(databaseId))throw Error('Ajoute BAGGIO_DATABASE_ID aux variables de build Cloudflare : identifiant UUID de la base D1 baggio-db.');
const config={name:process.env.BAGGIO_WORKER_NAME||'machine-de-baggio-v3',main:'vinext/server/fetch-handler',compatibility_date:'2026-05-15',compatibility_flags:['nodejs_compat'],d1_databases:[{binding:'DB',database_name:'baggio-db',database_id:databaseId,migrations_dir:'drizzle'}],r2_buckets:[{binding:'BUCKET',bucket_name:process.env.BAGGIO_BUCKET_NAME||'baggio-documents'}]};
writeFileSync('wrangler.json',JSON.stringify(config,null,2)+'\n');
