import "dotenv/config";
import { Client } from "pg";
import { randomBytes } from "node:crypto";
import {readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=process.cwd();
const base=new URL(process.env.DATABASE_URL ?? 'postgresql://invalid');
if (!['127.0.0.1','localhost','[::1]'].includes(base.hostname)) throw new Error('Requires local PostgreSQL with CREATE DATABASE permission.');
base.pathname='/postgres';
const admin=new Client({connectionString:base.href});await admin.connect();
const name=`dispatch_seed_${randomBytes(6).toString('hex')}_test`;
// Dedicated fresh test database, never drop or reset an existing database.
await admin.query(`CREATE DATABASE ${name}`);
base.pathname='/'+name;
const url=base.href;
const db=new Client({connectionString:url});await db.connect();
try {
for (const dir of (await readdir(root+'/prisma/migrations')).filter(x=>x!=='migration_lock.toml').sort()) await db.query(await readFile(root+'/prisma/migrations/'+dir+'/migration.sql','utf8'));
await db.query(`INSERT INTO "User" (id,email,name,role,"updatedAt") VALUES ('preserve-admin','preserve@example.invalid','Existing admin','ADMIN',now()); INSERT INTO "Team" (id,name,"updatedAt") VALUES ('preserve-team','Existing team',now());`);
await db.query(`INSERT INTO "Account" (id,"accountId","providerId","userId",password,"updatedAt") VALUES ('preserve-account','preserve-admin','credential','preserve-admin','sentinel-not-a-real-password-hash',now());
INSERT INTO "Session" (id,token,"userId","expiresAt","updatedAt") VALUES ('preserve-session','sentinel-session-never-used','preserve-admin',now()+interval '1 day',now());
INSERT INTO "Lead" (id,name,notes,"updatedAt") VALUES ('preserve-lead','Existing lead','Keep this note',now());
INSERT INTO "PerformanceEntry" (id,"dispatcherId","submittedById",date,loads,currency,notes,"updatedAt") VALUES ('preserve-performance','preserve-admin','preserve-admin',CURRENT_DATE,0,'USD','Keep this record',now());`, []);
const snapshot=async()=>JSON.stringify((await db.query(`SELECT row_to_json(u) AS data FROM "User" u WHERE id='preserve-admin' UNION ALL SELECT row_to_json(t) FROM "Team" t WHERE id='preserve-team' UNION ALL SELECT row_to_json(a) FROM "Account" a WHERE id='preserve-account' UNION ALL SELECT row_to_json(s) FROM "Session" s WHERE id='preserve-session' UNION ALL SELECT row_to_json(l) FROM "Lead" l WHERE id='preserve-lead' UNION ALL SELECT row_to_json(p) FROM "PerformanceEntry" p WHERE id='preserve-performance'`)).rows);
const before=await snapshot();
function run(env={}, confirmation=true){ return spawnSync(process.execPath,['node_modules/tsx/dist/cli.mjs','scripts/seed-demo.ts',...(confirmation?['--confirm-local-demo']:[])],{cwd:root,env:{...process.env,DATABASE_URL:url,NODE_ENV:'development',...env},encoding:'utf8'}); }
let result=run({NODE_ENV:'production'});assert.notEqual(result.status,0);
for (const env of [{NODE_ENV:'test'}, {DATABASE_URL:'postgresql://postgres@remote.invalid/dispatch_demo'}, {DATABASE_URL:'postgresql://postgres@localhost/production'}, {DATABASE_URL:url+(url.includes('?')?'&':'?')+'host=remote.invalid'}]) assert.notEqual(run(env).status,0);
assert.notEqual(run({},false).status,0);
assert.equal((await db.query('SELECT count(*)::int n FROM "User"')).rows[0].n,1);
result=run();assert.equal(result.status,0,result.stderr);console.log(result.stdout.trim());
const counts=await db.query(`SELECT (SELECT count(*)::int FROM "User" WHERE role='DISPATCHER') dispatchers,(SELECT count(*)::int FROM "User" WHERE role='MANAGER') managers,(SELECT count(*)::int FROM "Team" WHERE starts_with(id, 'northlane_demo_v1_')) teams,(SELECT count(*)::int FROM "Campaign") campaigns,(SELECT count(*)::int FROM "PerformanceEntry" WHERE starts_with(id, 'northlane_demo_v1_')) performance,(SELECT count(DISTINCT date)::int FROM "PerformanceEntry" WHERE starts_with(id, 'northlane_demo_v1_')) days,(SELECT count(*)::int FROM "Lead" WHERE starts_with(id, 'northlane_demo_v1_')) leads,(SELECT count(*)::int FROM "Account") accounts,(SELECT count(*)::int FROM "Session") sessions`);
assert.deepEqual(counts.rows[0],{dispatchers:64,managers:4,teams:4,campaigns:8,performance:3840,days:60,leads:192,accounts:1,sessions:1});
const allBefore=JSON.stringify((await db.query(`SELECT md5(string_agg(row_to_json(p)::text,',' ORDER BY id)) hash FROM "PerformanceEntry" p`)).rows);
result=run();assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/already installed/);
assert.equal(JSON.stringify((await db.query(`SELECT md5(string_agg(row_to_json(p)::text,',' ORDER BY id)) hash FROM "PerformanceEntry" p`)).rows),allBefore);
assert.equal(await snapshot(),before);
await db.query(`DELETE FROM "Setting" WHERE key='northlane_demo_v1_manifest'`);
result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/namespace collision/);
assert.equal(await snapshot(),before);
console.log('PASS: exact counts, 60 dates, production refusal, repeat without changes, collision refusal, existing Admin/team unchanged, existing auth/lead/performance rows unchanged; no new accounts or sessions.');
} finally {await db.end();await admin.query(`DROP DATABASE ${name}`);await admin.end();}
