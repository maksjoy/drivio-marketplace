const test=require('node:test'),assert=require('node:assert/strict');
const {createHmac}=require('node:crypto');
const token='123456789:TEST_TOKEN_NOT_A_REAL_SECRET',webhook='test-webhook-secret',origin='https://p2pcars-telegram.vercel.app';
const now=Math.floor(Date.now()/1000);
function signed(user={id:90000001,first_name:'Test',username:'alberta_seller'},extra={}){
 const p=new URLSearchParams({auth_date:String(now),query_id:'test-query',user:JSON.stringify(user),...extra});
 const check=[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n');
 const secret=createHmac('sha256','WebAppData').update(token).digest();
 p.set('hash',createHmac('sha256',secret).update(check).digest('hex'));return p.toString();
}
function request(initData,from=origin){return new Request(origin,{method:'POST',headers:{origin:from,'Content-Type':'application/json'},body:JSON.stringify({initData})})}
const uid='30000000-0000-4000-8000-000000000001';
function backend({existing=true,race=false,throttle=false,banned=false}={}){
 const calls=[];let lookup=0;
 const account={telegram_id:'90000001',user_id:uid,username:'old_username'};
 const user={id:uid,email:'opaque@telegram.invalid',app_metadata:{login_provider:'telegram',telegram_id:'90000001',telegram_username:'alberta_seller'},...(banned?{banned_until:'2099-01-01T00:00:00Z'}:{})};
 const env=k=>({P2PCARS_APP_URL:origin,P2PCARS_TELEGRAM_BOT_TOKEN:token,P2PCARS_TELEGRAM_WEBHOOK_SECRET:webhook,SUPABASE_URL:'https://database.invalid',SUPABASE_SERVICE_ROLE_KEY:'server-secret'})[k];
 const fetch=async(url,opt={})=>{
  const path=new URL(url).pathname,method=opt.method||'GET';calls.push({url,opt});let body=null;
  if(path==='/rest/v1/telegram_accounts'&&method==='GET')body=existing||lookup++>0?[account]:[];
  else if(path==='/auth/v1/admin/users'&&method==='POST')body={id:race?'30000000-0000-4000-8000-000000000002':uid};
  else if(path==='/rest/v1/telegram_accounts'&&method==='POST')body=race?[]:[account];
  else if(path==='/rest/v1/telegram_accounts'&&method==='PATCH')body=throttle?[]:[account];
  else if(path==='/auth/v1/admin/users/'+uid&&method==='GET')body=user;
  else if(path==='/auth/v1/admin/generate_link')body={...user,hashed_token:'one-time-hash'};
  else if(path==='/auth/v1/verify')body={user,access_token:'access',refresh_token:'refresh',expires_in:3600,token_type:'bearer'};
  return Response.json(body);
 };return {env,fetch,calls};
}
test('signed Telegram identity verifies with this bot, and rejects forged, old, future, duplicate and cross-bot data',async()=>{
 const {validateTelegram}=await import('../supabase/functions/telegram-auth/validate.ts');
 assert.equal((await validateTelegram(signed(),token,now)).id,'90000001');
 assert.equal((await validateTelegram(signed(undefined,{signature:'optional-signed-field'}),token,now)).username,'alberta_seller');
 for(const raw of [signed().replace('alberta_seller','forged_seller'),signed(undefined,{auth_date:String(now-301)}),signed(undefined,{auth_date:String(now+31)}),signed()+'&auth_date='+now,'user=%7B%22id%22%3A1%7D'])await assert.rejects(()=>validateTelegram(raw,token,now));
 await assert.rejects(()=>validateTelegram(signed(),'55555:OTHER_BOT',now));
});
test('users without a username still have an identity and bot identities are refused',async()=>{
 const {validateTelegram}=await import('../supabase/functions/telegram-auth/validate.ts');
 assert.equal((await validateTelegram(signed({id:90000001,first_name:'No username'}),token,now)).username,null);
 await assert.rejects(()=>validateTelegram(signed({id:90000001,is_bot:true}),token,now));
});
test('CORS and signature validation reject requests before privileged API access',async()=>{
 const {createAuthHandler}=await import('../supabase/functions/telegram-auth/index.ts'),b=backend(),handler=createAuthHandler(b.env,b.fetch);
 assert.equal((await handler(request(signed(),'https://attacker.invalid'))).status,403);
 assert.equal((await handler(request('user=forged'))).status,401);
 assert.equal(b.calls.length,0);
 assert.equal((await handler(new Request(origin,{method:'OPTIONS',headers:{origin}}))).status,204);
 const minimalEnv=k=>k==='P2PCARS_APP_URL'?origin:k==='P2PCARS_TELEGRAM_BOT_ID'?'8402702055':undefined;assert.equal((await createAuthHandler(minimalEnv,b.fetch)(request(signed()))).status,503);
});
test('repeat login keeps the same owner ID, refreshes username and returns an ordinary RLS session',async()=>{
 const {createAuthHandler}=await import('../supabase/functions/telegram-auth/index.ts'),b=backend();
 const r=await createAuthHandler(b.env,b.fetch)(request(signed())),data=await r.json();
 assert.equal(r.status,200);assert.equal(data.user.id,uid);assert.equal(data.access_token,'access');assert.equal(r.headers.get('Cache-Control'),'no-store');
 assert.ok(!b.calls.some(x=>x.url.endsWith('/admin/users')&&x.opt.method==='POST'));
 assert.ok(b.calls.some(x=>x.url.includes('telegram_accounts')&&JSON.parse(x.opt.body||'{}').username==='alberta_seller'));
 assert.ok(!JSON.stringify(data).includes('server-secret'));assert.ok(!b.calls.some(x=>x.url.includes('/otp')));
});
test('first login creates one mapped account; a concurrent winner is reused and the orphan is deleted',async()=>{
 const {createAuthHandler}=await import('../supabase/functions/telegram-auth/index.ts');
 for(const race of [false,true]){const b=backend({existing:false,race});const r=await createAuthHandler(b.env,b.fetch)(request(signed()));assert.equal(r.status,200);assert.equal((await r.json()).user.id,uid);assert.equal(b.calls.filter(x=>x.opt.method==='DELETE').length,race?1:0)}
});
test('throttled and banned accounts receive no session',async()=>{
 const {createAuthHandler}=await import('../supabase/functions/telegram-auth/index.ts');
 for(const [options,status] of [[{throttle:true},429],[{banned:true},403]]){const b=backend(options);assert.equal((await createAuthHandler(b.env,b.fetch)(request(signed()))).status,status);assert.ok(!b.calls.some(x=>x.url.includes('generate_link')))}
});
test('bot authenticates webhook, ignores groups, and replies to start with one full-width Web App button',async()=>{
 const {createBotHandler,webhookSecret}=await import('../supabase/functions/telegram-bot/index.ts');const b=backend();const handler=createBotHandler(b.env);
 function update(body,secret){return new Request(origin,{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':secret||''},body:JSON.stringify(body)})}
 const body={message:{chat:{id:90000001,type:'private'},from:{id:90000001},text:'/start'}};
 assert.equal((await handler(update(body))).status,401);
 const secret=webhook;
 const data=await (await handler(update(body,secret))).json();assert.equal(data.chat_id,90000001);assert.equal(data.reply_markup.inline_keyboard.length,1);assert.equal(data.reply_markup.inline_keyboard[0].length,1);assert.equal(data.reply_markup.inline_keyboard[0][0].text,'🚘 OPEN P2PCARS');assert.match(data.reply_markup.inline_keyboard[0][0].web_app.url,/miniapp=1/);
 body.message.chat.type='group';assert.equal(await (await handler(update(body,secret))).text(),'OK');
});

test('bot /id returns the stable numeric Telegram ID without opening the Mini App',async()=>{const {createBotHandler}=await import('../supabase/functions/telegram-bot/index.ts');const b=backend(),handler=createBotHandler(b.env),secret=webhook;const req=new Request(origin,{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':secret},body:JSON.stringify({message:{chat:{id:90000001,type:'private'},from:{id:90000001},text:'/id'}})});const data=await (await handler(req)).json();assert.equal(data.chat_id,90000001);assert.match(data.text,/90000001/);assert.ok(!data.reply_markup);});
