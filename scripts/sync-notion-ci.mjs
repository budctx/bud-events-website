import { pathToFileURL } from 'node:url';

// Run-level CI evidence only; never change detailed tests, stage gates or approvals.
export function evidence(run) {
  if (!/^[a-f0-9]{40}$/i.test(run.sha || '')) throw Error('Invalid SHA');
  if (!/^[1-9][0-9]*$/.test(String(run.id || ''))) throw Error('Invalid run ID');
  if (!/^[1-9][0-9]*$/.test(String(run.attempt || ''))) throw Error('Invalid attempt');
  if (run.url !== 'https://github.com/budctx/bud-events-website/actions/runs/' + run.id) throw Error('Invalid evidence URL');
  if (!['success','failure','timed_out','cancelled','skipped','action_required'].includes(run.conclusion)) throw Error('Invalid conclusion');
  if (!/^\d{4}-\d{2}-\d{2}T/.test(run.updatedAt || '')) throw Error('Invalid date');
  const result = run.conclusion === 'success' ? 'PASS' : ['failure','timed_out'].includes(run.conclusion) ? 'FAILED' : 'IN REVIEW';
  const id = 'BUD-CI-' + run.id + '-A' + run.attempt;
  const txt = v => ({ rich_text:[{ text:{ content:String(v).slice(0,1900) } }] });
  return { id, properties:{
    Name:{title:[{text:{content:'Website checks / main / run ' + run.id + ' attempt ' + run.attempt}}]},
    'Test ID':txt(id),
    'Record Scope':{select:{name:'Historical evidence'}},
    'Stage ID':txt('S11'),
    Result:{status:{name:result}},
    Evidence:{url:run.url},
    'Version SHA':txt(run.sha),
    Environment:txt('GitHub Actions / main'),
    'Test Type':txt('Automated repository CI, not detailed stage acceptance'),
    'Tested By':txt('GitHub Actions'),
    'Actual Observation':txt('Workflow result: ' + run.conclusion + '. Does not certify any project stage.'),
    'Run Date':{date:{start:run.updatedAt.slice(0,10)}}
  }};
}

export async function publish(config, transport=fetch) {
  if (!/^[a-f0-9-]{36}$/i.test(config.dataSourceId || '') || !config.token) throw Error('Notion connection missing');
  const entry = evidence(config.run);
  const headers = {Authorization:'Bearer '+config.token,'Notion-Version':'2025-09-03','Content-Type':'application/json'};
  const request = async (path,body) => {
    const response=await transport('https://api.notion.com/v1'+path,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    if(!response.ok) throw Error('Notion API error '+response.status);
    return response.json();
  };
  const queried=await request('/data_sources/'+config.dataSourceId+'/query',{filter:{property:'Test ID',rich_text:{equals:entry.id}},page_size:2});
  if(!Array.isArray(queried.results)) throw Error('Unexpected Notion response');
  if(queried.results.length>1) throw Error('Duplicate evidence IDs need manual audit');
  if(queried.results.length===1) return {status:'already-present',id:entry.id};
  const created=await request('/pages',{parent:{type:'data_source_id',data_source_id:config.dataSourceId},properties:entry.properties});
  if(!created.id) throw Error('Missing creation receipt');
  return {status:'created',id:entry.id,url:created.url};
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  publish({token:process.env.BUD_NOTION_TOKEN,dataSourceId:process.env.BUD_NOTION_TESTS_DATA_SOURCE_ID,
    run:{sha:process.env.BUD_CI_SHA,id:process.env.BUD_CI_ID,attempt:process.env.BUD_CI_ATTEMPT,
      url:process.env.BUD_CI_URL,conclusion:process.env.BUD_CI_CONCLUSION,updatedAt:process.env.BUD_CI_UPDATED_AT}
  }).then(r=>console.log('BU’D Notion evidence:',r.status,r.id,r.url||''))
    .catch(e=>{console.error('BU’D Notion evidence sync failed:',e.message);process.exitCode=1;});
}
