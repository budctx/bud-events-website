import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { validateLaunchReadiness } from './launch-readiness.mjs';
const manifest=JSON.parse(await readFile('config/launch-readiness.example.json','utf8'));
const report=validateLaunchReadiness(manifest,{expectedSha:process.env.GITHUB_SHA});
await mkdir('test-results',{recursive:true});
await writeFile('test-results/launch-readiness.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({commercialReady:report.commercialReady,blockers:report.blockers.length,scope:report.scope}));
// Recording known blockers is allowed in engineering CI. This is never a launch approval.
