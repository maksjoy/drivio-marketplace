const test=require('node:test');
const assert=require('node:assert/strict');

const URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://rjoipowznfokhvahuozf.supabase.co';
const KEY=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'sb_publishable_J9fxpOkaIxvgEsTJ2IwHrw_7exploAN';
const headers={apikey:KEY,'Content-Type':'application/json'};

async function request(path,init={}){
  return fetch(URL+path,{...init,headers:{...headers,...(init.headers||{})},signal:AbortSignal.timeout(15000)});
}

test('public catalog remains readable',async()=>{
  const r=await request('/rest/v1/listings?select=id&status=eq.active&limit=1');
  assert.equal(r.status,200);
  const body=await r.json();
  assert.ok(Array.isArray(body));
});

test('anonymous caller cannot execute admin dashboard RPC',async()=>{
  const r=await request('/rest/v1/rpc/admin_dashboard_stats',{method:'POST',body:'{}'});
  assert.ok(r.status>=400,`unexpected status ${r.status}`);
});

test('anonymous caller cannot insert listings',async()=>{
  const r=await request('/rest/v1/listings',{method:'POST',body:JSON.stringify({
    user_id:'00000000-0000-0000-0000-000000000000',make:'Test',model:'Test',year:2020,price:1000,mileage:1,fuel:'Gasoline',seller_email:'nobody@example.invalid',status:'pending'
  })});
  assert.ok(r.status>=400,`unexpected status ${r.status}`);
});

test('telegram account mapping is not readable anonymously',async()=>{
  const r=await request('/rest/v1/telegram_accounts?select=user_id&limit=1');
  assert.equal(r.status,200);
  assert.deepEqual(await r.json(),[]);
});

test('privileged storage cleanup rejects calls without the cron secret',async()=>{
  const r=await request('/functions/v1/storage-cleanup',{method:'POST',body:'{}'});
  assert.equal(r.status,401);
});

test('telegram webhook rejects calls without Telegram secret header',async()=>{
  const r=await request('/functions/v1/telegram-bot',{method:'POST',body:'{}'});
  assert.equal(r.status,401);
});
