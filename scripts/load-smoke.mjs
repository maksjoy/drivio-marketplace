const APP=process.env.P2P_APP_URL||'https://p2pcars-telegram-8km78p7mxw-2551.vercel.app';
const SUPABASE=process.env.P2P_SUPABASE_URL||'https://rjoipowznfokhvahuozf.supabase.co';
const KEY=process.env.P2P_SUPABASE_KEY||'sb_publishable_J9fxpOkaIxvgEsTJ2IwHrw_7exploAN';
const concurrency=Number(process.env.P2P_LOAD_CONCURRENCY||20);
const rounds=Number(process.env.P2P_LOAD_ROUNDS||10);
const samples=[];let failures=0;

async function timed(url,options={}){
 const started=performance.now();
 try{
  const r=await fetch(url,{...options,signal:AbortSignal.timeout(10000)});
  const ms=performance.now()-started;samples.push(ms);
  if(!r.ok){failures++;return false}
  await r.arrayBuffer();return true;
 }catch{failures++;samples.push(performance.now()-started);return false}
}

for(let round=0;round<rounds;round++){
 const jobs=[];
 for(let i=0;i<concurrency;i++){
  jobs.push(timed(APP+'/?miniapp=1'));
  jobs.push(timed(SUPABASE+'/rest/v1/listings?select=id,make,model,year,price&status=eq.active&limit=24',{headers:{apikey:KEY}}));
 }
 await Promise.all(jobs);
}
samples.sort((a,b)=>a-b);
const total=rounds*concurrency*2;
const p95=samples[Math.max(0,Math.ceil(samples.length*.95)-1)]||0;
const avg=samples.reduce((a,b)=>a+b,0)/Math.max(1,samples.length);
const failureRate=failures/total;
console.log(JSON.stringify({total,failures,failureRate:Number(failureRate.toFixed(4)),avgMs:Math.round(avg),p95Ms:Math.round(p95)},null,2));
if(failureRate>.01)process.exitCode=1;
