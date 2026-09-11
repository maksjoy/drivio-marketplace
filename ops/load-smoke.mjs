const target = process.env.LOAD_TARGET || 'https://rjoipowznfokhvahuozf.supabase.co/rest/v1/listings?select=id&status=in.(active,sold)&limit=24';
const apiKey = process.env.LOAD_API_KEY || 'sb_publishable_J9fxpOkaIxvgEsTJ2IwHrw_7exploAN';
const total = Math.max(10, Number(process.env.LOAD_REQUESTS || 60));
const concurrency = Math.max(1, Math.min(20, Number(process.env.LOAD_CONCURRENCY || 6)));
const timeoutMs = Math.max(1000, Number(process.env.LOAD_TIMEOUT_MS || 10000));
const p95LimitMs = Math.max(250, Number(process.env.LOAD_P95_LIMIT_MS || 2500));

const durations=[];
let failures=0;
let next=0;

async function one(){
  const started=performance.now();
  try{
    const response=await fetch(target,{headers:{apikey:apiKey},signal:AbortSignal.timeout(timeoutMs)});
    await response.arrayBuffer();
    if(!response.ok) failures++;
  }catch{
    failures++;
  }finally{
    durations.push(performance.now()-started);
  }
}

async function worker(){
  while(true){
    const i=next++;
    if(i>=total) return;
    await one();
  }
}

await Promise.all(Array.from({length:concurrency},worker));
durations.sort((a,b)=>a-b);
const pct=p=>durations[Math.min(durations.length-1,Math.floor((durations.length-1)*p))]||0;
const result={requests:total,concurrency,failures,errorRate:Number((failures/total).toFixed(4)),p50Ms:Math.round(pct(.50)),p95Ms:Math.round(pct(.95)),maxMs:Math.round(durations.at(-1)||0)};
console.log(JSON.stringify(result,null,2));
if(result.errorRate>0.02) throw new Error(`Load smoke failed: ${(result.errorRate*100).toFixed(1)}% requests failed`);
if(result.p95Ms>p95LimitMs) throw new Error(`Load smoke failed: p95 ${result.p95Ms}ms exceeds ${p95LimitMs}ms`);
