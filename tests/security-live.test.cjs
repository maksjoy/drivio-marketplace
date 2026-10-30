const test=require('node:test');
const assert=require('node:assert/strict');

const URL=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://rjoipowznfokhvahuozf.supabase.co';
const KEY=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'sb_publishable_J9fxpOkaIxvgEsTJ2IwHrw_7exploAN';
const headers={apikey:KEY,'Content-Type':'application/json'};

async function request(path,init={}){
  return fetch(URL+path,{...init,headers:{...headers,...(init.headers||{})},signal:AbortSignal.timeout(15000)});
}

// Supabase occasionally sheds load with 429 SlowDown (too_many_connections) or 503. Retry only
// those statuses, at most 3 tries with backoff. Every other status is returned as-is and still
// asserted by the caller, so no security check gets weaker.
const TRANSIENT_STATUSES=new Set([429,503]);
const MAX_TRIES=3;
async function withTransientRetry(send,{sleep=(ms)=>new Promise((r)=>setTimeout(r,ms))}={}){
  for(let attempt=1;;attempt++){
    const response=await send();
    if(!TRANSIENT_STATUSES.has(response.status)||attempt>=MAX_TRIES) return response;
    await response.arrayBuffer().catch(()=>{});
    const retryAfter=Number(response.headers.get('retry-after'));
    const backoff=500*2**(attempt-1);
    await sleep(Number.isFinite(retryAfter)&&retryAfter>0?Math.min(retryAfter*1000,5000):backoff);
  }
}

test('transient retry: only 429/503 are retried, at most 3 tries',async()=>{
  const fake=(statuses)=>{
    let i=0;
    const send=async()=>{const status=statuses[Math.min(i++,statuses.length-1)];return new Response(null,{status});};
    return {send,calls:()=>i};
  };
  const sleep=async()=>{};
  for(const [statuses,status,calls] of [
    [[200],200,1],
    [[429,200],200,2],
    [[503,429,200],200,3],
    [[429,429,429,200],429,3],
    [[403],403,1],
    [[400],400,1],
    [[500,200],500,1],
    [[429,404],404,2],
  ]){
    const f=fake(statuses);
    const r=await withTransientRetry(f.send,{sleep});
    assert.equal(r.status,status,`statuses ${statuses}`);
    assert.equal(f.calls(),calls,`calls for ${statuses}`);
  }
});

test('public catalog remains readable',async()=>{
  const r=await request('/rest/v1/listings?select=id&status=eq.active&limit=1');
  assert.equal(r.status,200);
  const body=await r.json();
  assert.ok(Array.isArray(body));
});

test('listing photo bucket is not anonymously public',async()=>{
  const meta=await request('/rest/v1/listings?select=id,listing_images(storage_path)&status=eq.active&listing_images.order=position.asc&limit=1');
  assert.equal(meta.status,200);
  const rows=await meta.json();
  const storagePath=rows[0]?.listing_images?.[0]?.storage_path;
  if(!storagePath) return;
  const path=storagePath.split('/').map(encodeURIComponent).join('/');
  const r=await fetch(`${URL}/storage/v1/object/public/listing-photos/${path}`,{signal:AbortSignal.timeout(15000)});
  assert.ok(r.status>=400,`private bucket unexpectedly returned ${r.status}`);
});

test('anonymous caller cannot read listing owner ids',async()=>{
  const denied=await request('/rest/v1/listings?select=user_id&status=eq.active&limit=1');
  assert.ok(denied.status>=400,`user_id select returned ${denied.status}`);
  const allowed=await request('/rest/v1/listings?select=id,make,model&status=eq.active&limit=1');
  assert.equal(allowed.status,200);
  const body=await allowed.json();
  assert.ok(Array.isArray(body)&&body.length>=1);
  assert.equal(Object.hasOwn(body[0],'user_id'),false);
});

test('anonymous caller cannot list or download listing photos except through a signed URL',async()=>{
  const meta=await request('/rest/v1/listings?select=id,listing_images(storage_path)&status=eq.active&listing_images.order=position.asc&limit=1');
  assert.equal(meta.status,200);
  const rows=await meta.json();
  const storagePath=rows[0]?.listing_images?.[0]?.storage_path;
  assert.ok(storagePath,'expected an active listing photo');

  const list=await request('/storage/v1/object/list/listing-photos',{
    method:'POST',
    headers:{Authorization:`Bearer ${KEY}`},
    body:JSON.stringify({prefix:'',limit:20,offset:0}),
  });
  if(list.status===200){
    const listed=await list.json();
    assert.ok(Array.isArray(listed)&&listed.length===0,`anon list returned objects`);
  }else{
    assert.ok(list.status>=400,`anon list returned ${list.status}`);
  }

  const path=storagePath.split('/').map(encodeURIComponent).join('/');
  const direct=await fetch(`${URL}/storage/v1/object/authenticated/listing-photos/${path}`,{
    headers:{apikey:KEY,Authorization:`Bearer ${KEY}`},
    signal:AbortSignal.timeout(15000),
  });
  assert.ok(direct.status>=400,`authenticated path returned ${direct.status}`);
  await direct.arrayBuffer().catch(()=>{});

  const signed=await withTransientRetry(()=>request('/storage/v1/object/sign/listing-photos',{
    method:'POST',
    headers:{Authorization:`Bearer ${KEY}`},
    body:JSON.stringify({expiresIn:60,paths:[storagePath]}),
  }));
  const signedText=await signed.text();
  assert.equal(signed.status,200,`sign returned ${signed.status} ${signedText.slice(0,300)}`);
  const items=JSON.parse(signedText);
  const signedURL=items?.[0]?.signedURL||items?.[0]?.signedUrl;
  assert.ok(signedURL,`missing signed URL`);
  const absolute=String(signedURL).startsWith('http')?signedURL:`${URL}/storage/v1${signedURL}`;
  const download=await withTransientRetry(()=>fetch(absolute,{signal:AbortSignal.timeout(15000)}));
  assert.equal(download.status,200,`signed download returned ${download.status}`);
  assert.match(download.headers.get('content-type')||'',/^image\//);
  await download.arrayBuffer();
});

test('anonymous caller cannot execute admin dashboard RPC',async()=>{
  const r=await request('/rest/v1/rpc/admin_dashboard_stats',{method:'POST',body:'{}'});
  assert.ok(r.status>=400,`unexpected status ${r.status}`);
});

test('anonymous caller cannot read admin records',async()=>{
  const r=await request('/rest/v1/admins?select=user_id&limit=1');
  assert.equal(r.status,200);
  assert.deepEqual(await r.json(),[]);
});

test('anonymous caller cannot insert listings',async()=>{
  const r=await request('/rest/v1/listings',{method:'POST',body:JSON.stringify({
    user_id:'00000000-0000-0000-0000-000000000000',make:'Test',model:'Test',year:2020,price:1000,mileage:1,fuel:'Gasoline',seller_email:'nobody@example.invalid',status:'pending'
  })});
  assert.ok(r.status>=400,`unexpected status ${r.status}`);
});

test('anonymous caller cannot create listing reports',async()=>{
  const r=await request('/rest/v1/listing_reports',{method:'POST',body:JSON.stringify({
    listing_id:'00000000-0000-0000-0000-000000000000',reporter_id:'00000000-0000-0000-0000-000000000000',reason:'test',status:'open'
  })});
  assert.ok(r.status>=400,`unexpected status ${r.status}`);
});

test('anonymous caller can read catalog spec columns but not color_legacy',async()=>{
  const allowed=await request('/rest/v1/listings?select=id,engine_l,power_hp,color,features&limit=1');
  assert.equal(allowed.status,200,`spec columns returned ${allowed.status}`);
  const deniedLegacy=await request('/rest/v1/listings?select=color_legacy&limit=1');
  assert.ok(deniedLegacy.status>=400,`color_legacy select returned ${deniedLegacy.status}`);
  const deniedOwner=await request('/rest/v1/listings?select=user_id&limit=1');
  assert.ok(deniedOwner.status>=400,`user_id select returned ${deniedOwner.status}`);
});

test('privileged storage cleanup rejects calls without the cron secret',async()=>{
  const r=await request('/functions/v1/storage-cleanup',{method:'POST',body:'{}'});
  assert.equal(r.status,401);
});
