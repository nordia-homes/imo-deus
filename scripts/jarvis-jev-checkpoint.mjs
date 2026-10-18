import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const checkpoint=JSON.parse(fs.readFileSync('docs/jarvis/evals/JEV_ROLLBACK_CHECKPOINT.json','utf8'));
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim();
const local=checkpoint.local.commit;
if(git('rev-parse',checkpoint.local.branch)!==local)throw new Error('Safety branch moved');
git('cat-file','-e',local+'^{commit}');
for(const file of ['src/lib/ai-assistant/planner.ts','src/lib/ai-assistant/policy.ts','src/lib/ai-assistant/jev.ts','src/lib/meta-property-post.ts'])git('cat-file','-e',local+':'+file);
const tracked=git('ls-tree','-r','--name-only',local).split('\n');
if(tracked.some(file=>/^\.env(?:\.|$)/.test(file)))throw new Error('Environment file must not be tracked');
const production=checkpoint.production.builds;
if(checkpoint.production.trafficReconciling||production.length!==1||production[0].state!=='READY'||production[0].percent!==100)throw new Error('Production baseline was not stable');
if(process.argv.includes('--local-backups'))for(const name of ['.env.local','hosting.cache','production-runtime.private.json']){const target=checkpoint.local.privateBackupDirectory+'/'+name;if(!fs.statSync(target).isFile())throw new Error('Missing private backup');}
console.log(JSON.stringify({localCheckpoint:local,productionBuild:production[0].name.split('/').at(-1),productionCommit:production[0].commit,backupFilesChecked:process.argv.includes('--local-backups'),readOnly:true,note:'Checks saved metadata and local recovery objects; does not change or certify current production.'}));
