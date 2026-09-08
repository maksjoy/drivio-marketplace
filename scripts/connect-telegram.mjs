/** Configure this bot only, once the Telegram branch has a public deployment. Never logs secrets. */
import {createHmac} from 'node:crypto';
const token=process.env.P2PCARS_TELEGRAM_BOT_TOKEN;
const appUrl=process.env.P2PCARS_APP_URL;
if(!token||!appUrl)throw Error('Set P2PCARS_TELEGRAM_BOT_TOKEN and P2PCARS_APP_URL in your environment.');
const app=new URL(appUrl);
if(app.protocol!=='https:'||app.username||app.password)throw Error('A public HTTPS app URL is required.');
const page=await fetch(app,{signal:AbortSignal.timeout(15000)});
if(!page.ok||!(await page.text()).includes('name="p2p-app" content="telegram"'))throw Error('Deploy the Telegram branch at P2PCARS_APP_URL before connecting the bot.');
async function api(method,data={}){
 try{
  const r=await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(20000)});
  const body=await r.json();if(!body.ok)throw Error();return body.result;
 }catch{throw Error('Telegram API request failed: '+method)}
}
const bot=await api('getMe');
if(bot.username?.toLowerCase()!=='p2pcarsalbertabot')throw Error('This token belongs to a different bot. No settings changed.');
const webhook='https://rjoipowznfokhvahuozf.supabase.co/functions/v1/telegram-bot';
const current=await api('getWebhookInfo');
if(current.url&&current.url!==webhook&&!process.argv.includes('--replace-webhook'))throw Error('Another webhook is already configured. Inspect it before using --replace-webhook.');
const secret=createHmac('sha256',token).update('P2Pcars Telegram webhook v1').digest('hex');
// Confirm the deployed webhook has the same secret without sending a user message.
const health=await fetch(webhook,{method:'POST',headers:{'Content-Type':'application/json','X-Telegram-Bot-Api-Secret-Token':secret},body:'{}',signal:AbortSignal.timeout(15000)});
if(!health.ok)throw Error('First set the same P2PCARS_TELEGRAM_BOT_TOKEN and P2PCARS_APP_URL in Supabase Edge Function secrets.');
app.searchParams.set('miniapp','1');
await api('setChatMenuButton',{menu_button:{type:'web_app',text:'Open P2Pcars',web_app:{url:app.href}}});
await api('setMyCommands',{commands:[{command:'start',description:'Open the car marketplace'},{command:'help',description:'How to use P2Pcars'}]});
await api('setMyDescription',{description:'Private cars. Real people. Alberta.\n\nFind a car, list yours and message sellers directly in Telegram. Tap Start to open P2Pcars.'});
await api('setMyShortDescription',{short_description:'People to People car sales in Alberta. Browse, list and chat directly with sellers.'});
await api('setWebhook',{url:webhook,secret_token:secret,allowed_updates:['message'],drop_pending_updates:false});
const menu=await api('getChatMenuButton'),info=await api('getWebhookInfo');
if(menu.type!=='web_app'||menu.web_app?.url!==app.href||info.url!==webhook)throw Error('Bot settings did not match after saving.');
console.log('Verified: @P2pcarsalbertabot menu button and /start launch button connected.');
console.log('Set the Main Mini App URL to the same app URL in BotFather to enable its profile launch button and ?startapp links.');
