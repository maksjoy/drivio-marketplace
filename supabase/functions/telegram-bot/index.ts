import { mac, hex } from '../telegram-auth/validate.ts';
export async function webhookSecret(token:string){return hex(await mac(token,'P2Pcars Telegram webhook v1'))}
export function createBotHandler(env:(name:string)=>string|undefined) {
 return async(req:Request)=>{
  if(req.method!=='POST')return new Response('Method not allowed',{status:405});
  const token=env('P2PCARS_TELEGRAM_BOT_TOKEN');
  if(!token)return new Response('Bot setup required',{status:503});
  const expected=await webhookSecret(token),received=req.headers.get('X-Telegram-Bot-Api-Secret-Token')||'';
  let diff=received.length^expected.length;for(let i=0;i<expected.length;i++)diff|=(received.charCodeAt(i)||0)^expected.charCodeAt(i);
  if(diff)return new Response('Unauthorized',{status:401});
  try{
   if(Number(req.headers.get('content-length'))>30000)return new Response('Too large',{status:413});
   const raw=await req.text();if(raw.length>30000)return new Response('Too large',{status:413});
   const update=JSON.parse(raw),msg=update.message;
   if(!msg||msg.chat?.type!=='private'||!Number.isSafeInteger(msg.chat.id)||msg.from?.is_bot)return new Response('OK');
   if(!/^\/(start|help|id)(?:@P2pcarsalbertabot)?(?:\s|$)/i.test(msg.text||''))return new Response('OK');
   if(/^\/id(?:@P2pcarsalbertabot)?(?:\s|$)/i.test(msg.text||'')){
    return Response.json({method:'sendMessage',chat_id:msg.chat.id,text:'Your Telegram ID: '+String(msg.from?.id||msg.chat.id)+'\n\nSend this number only to the P2Pcars owner/admin setup. Your @username can change; this numeric ID is the stable account identifier.'});
   }
   const url=new URL(env('P2PCARS_APP_URL')||'https://p2pcars-telegram.vercel.app');
   url.searchParams.set('miniapp','1');
   const start=(msg.text||'').split(/\s+/)[1]||'';
   if(/^car_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(start))url.searchParams.set('listing',start.slice(4));
   // Telegram executes this reply only in response to the user's /start or /help.
   return Response.json({method:'sendMessage',chat_id:msg.chat.id,text:'Welcome to P2Pcars — Alberta’s private car marketplace.\n\nFind a car, list yours and message sellers directly in Telegram. Your Telegram account is all you need.',reply_markup:{inline_keyboard:[[{text:'🚘 OPEN P2PCARS',web_app:{url:url.href}}]]}});
  }catch{return new Response('Invalid update',{status:400})}
 };
}
if(typeof Deno!=='undefined')Deno.serve(createBotHandler(name=>Deno.env.get(name)));
