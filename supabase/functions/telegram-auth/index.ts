import { validateTelegram } from './validate.ts';
export function createAuthHandler(env: (name: string) => string | undefined, request: typeof fetch = fetch) {
  return async (req: Request) => {
    const appUrl=env('P2PCARS_APP_URL')||'https://p2pcars-telegram.vercel.app';
    if(req.method==='GET')return Response.json({ok:true,app_origin:new URL(appUrl).origin,bot_token_configured:!!env('P2PCARS_TELEGRAM_BOT_TOKEN')},{headers:{'Cache-Control':'no-store'}});
    const origin=new URL(appUrl).origin;
    const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type,apikey,authorization','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
    const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
    if(req.headers.get('origin')!==origin)return reply({error:'Origin not allowed'},403);
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    if(req.method!=='POST')return reply({error:'Method not allowed'},405);
    const token=env('P2PCARS_TELEGRAM_BOT_TOKEN');
    if(!token)return reply({error:'Telegram sign-in is not connected yet. The owner needs to finish bot setup.',code:'SETUP_REQUIRED'},503);
    const url=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY');
    if(!url||!key)return reply({error:'Sign-in temporarily unavailable'},503);
    let u;
    try{
      if(Number(req.headers.get('content-length'))>20000)throw Error();
      const body=await req.text();if(body.length>20000)throw Error();
      u=await validateTelegram(JSON.parse(body).initData,token);
    }catch{return reply({error:'Telegram verification failed. Close and reopen the Mini App.'},401)}
    async function api(path:string,method='GET',body?:unknown,extra:Record<string,string>={}) {
      const r=await request(url+path,{method,headers:{apikey:key!,Authorization:'Bearer '+key,'Content-Type':'application/json',...extra},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
      const d=await r.json().catch(()=>null);if(!r.ok)throw Error('Auth service request failed');return d;
    }
    try{
      let rows=await api('/rest/v1/telegram_accounts?telegram_id=eq.'+u.id+'&select=*');
      let account=rows[0];
      if(!account){
        // Random, non-deliverable internal address; never collected or shown to a user.
        const email='p2p-'+crypto.randomUUID()+'@telegram.invalid';
        const created=await api('/auth/v1/admin/users','POST',{email,email_confirm:true,user_metadata:{display_name:u.name},app_metadata:{telegram_id:u.id,telegram_username:u.username,login_provider:'telegram'}});
        const uid=created.id;if(!uid)throw Error();
        try{
          rows=await api('/rest/v1/telegram_accounts?on_conflict=telegram_id','POST',{telegram_id:u.id,user_id:uid,username:u.username,display_name:u.name},{Prefer:'resolution=ignore-duplicates,return=representation'});
          account=rows[0];
          if(!account){
            await api('/auth/v1/admin/users/'+uid,'DELETE');
            account=(await api('/rest/v1/telegram_accounts?telegram_id=eq.'+u.id+'&select=*'))[0];
          }
        }catch(error){await api('/auth/v1/admin/users/'+uid,'DELETE').catch(()=>{});throw error}
      }
      if(!account)throw Error();
      // Atomic per-account throttle; repeated signed payloads cannot flood sessions.
      const before=new Date(Date.now()-2000).toISOString();
      const claimed=await api('/rest/v1/telegram_accounts?telegram_id=eq.'+u.id+'&last_auth_at=lt.'+encodeURIComponent(before),'PATCH',{last_auth_at:new Date().toISOString()},{Prefer:'return=representation'});
      if(!claimed.length)return reply({error:'Please wait a moment and retry.'},429);
      const authUser=await api('/auth/v1/admin/users/'+account.user_id);
      if(String(authUser.app_metadata?.telegram_id)!==u.id||authUser.id!==account.user_id)throw Error();
      if(authUser.banned_until&&new Date(authUser.banned_until).getTime()>Date.now())return reply({error:'This account is suspended.'},403);
      // Updating the mapping also updates contacts through an atomic database trigger.
      await api('/rest/v1/telegram_accounts?telegram_id=eq.'+u.id,'PATCH',{username:u.username,display_name:u.name});
      await api('/auth/v1/admin/users/'+account.user_id,'PUT',{app_metadata:{...authUser.app_metadata,telegram_id:u.id,telegram_username:u.username,login_provider:'telegram'},user_metadata:{...authUser.user_metadata,display_name:u.name}});
      await api('/rest/v1/profiles?id=eq.'+account.user_id,'PATCH',{display_name:u.name});
      // Owner-only Telegram admin. The allowlist uses the immutable numeric Telegram ID,
      // never a username or user-editable profile field.
      const adminTelegramId=(env('P2PCARS_TELEGRAM_ADMIN_ID')||'').trim();
      if(adminTelegramId && adminTelegramId===u.id){
        await api('/rest/v1/admins?on_conflict=user_id','POST',{user_id:account.user_id},{Prefer:'resolution=ignore-duplicates,return=minimal'});
      }
      // Internal one-time exchange: no email is sent, no email address is requested.
      const link=await api('/auth/v1/admin/generate_link','POST',{type:'magiclink',email:authUser.email});
      // GoTrue REST returns user fields at the top level (the JS SDK wraps them).
      if(link.id!==account.user_id||!link.hashed_token)throw Error();
      const session=await api('/auth/v1/verify','POST',{type:'magiclink',token_hash:link.hashed_token});
      if(session.user?.id!==account.user_id||!session.access_token||!session.refresh_token)throw Error();
      return reply({access_token:session.access_token,refresh_token:session.refresh_token,expires_in:session.expires_in,token_type:session.token_type,user:session.user});
    }catch{return reply({error:'Could not sign in. Please reopen the app and try again.'},503)}
  };
}
if(typeof Deno!=='undefined')Deno.serve(createAuthHandler(name=>Deno.env.get(name)));
