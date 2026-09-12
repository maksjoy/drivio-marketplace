const enc = new TextEncoder();
export async function mac(key: string | Uint8Array, value: string) {
  const raw = typeof key === 'string' ? enc.encode(key) : new Uint8Array(key);
  const k = await crypto.subtle.importKey('raw', raw, {name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode(value)));
}
export const hex = (bytes: Uint8Array) => Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
const TELEGRAM_PROD_ED25519='e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d';
function hexBytes(value:string){if(!/^[0-9a-f]+$/i.test(value)||value.length%2)throw Error('Invalid public key');const out=new Uint8Array(value.length/2);for(let i=0;i<out.length;i++)out[i]=parseInt(value.slice(i*2,i*2+2),16);return out}
function base64UrlBytes(value:string){if(!/^[A-Za-z0-9_-]+$/.test(value))throw Error('Invalid signature');let s=value.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';const raw=atob(s);return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function verifyThirdParty(p:URLSearchParams,botId:string){
  const signature=p.get('signature')||'';
  if(!/^\d+$/.test(botId)||!signature)return false;
  const pairs=[...p.entries()].filter(([k])=>k!=='hash'&&k!=='signature').sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('\n');
  const check=botId+':WebAppData\n'+pairs;
  const key=await crypto.subtle.importKey('raw',hexBytes(TELEGRAM_PROD_ED25519),{name:'Ed25519'},false,['verify']);
  return crypto.subtle.verify('Ed25519',key,base64UrlBytes(signature),enc.encode(check));
}
export async function validateTelegram(raw: string, token = '', now = Date.now()/1000, botId = '') {
  if (typeof raw !== 'string' || !raw || raw.length > 16384) throw Error('Invalid Telegram data');
  const p = new URLSearchParams(raw);
  if ([...p.keys()].length !== new Set(p.keys()).size) throw Error('Duplicate fields');
  const hash = p.get('hash') || '';
  if (!/^[0-9a-f]{64}$/.test(hash)) throw Error('Invalid signature');
  const date = Number(p.get('auth_date'));
  if (!/^\d+$/.test(p.get('auth_date')||'') || !Number.isSafeInteger(date) || now-date > 300 || date-now > 30) throw Error('Please reopen the Mini App');

  let valid=false;
  if(/^\d+:[A-Za-z0-9_-]+$/.test(token)){
    const hmacParams=new URLSearchParams(p);
    hmacParams.delete('hash');
    const check=[...hmacParams.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('\n');
    const expected=hex(await mac(await mac('WebAppData',token),check));
    let diff=0;for(let i=0;i<64;i++)diff|=expected.charCodeAt(i)^hash.charCodeAt(i);
    valid=diff===0;
  }
  if(!valid)valid=await verifyThirdParty(p,botId);
  if(!valid)throw Error('Invalid signature');

  const u=JSON.parse(p.get('user')||'{}');
  if(!u || !Number.isSafeInteger(u.id) || u.id<=0 || u.is_bot)throw Error('Invalid Telegram user');
  const username=typeof u.username==='string'&&/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(u.username)?u.username:null;
  return {id:String(u.id),username,name:[u.first_name,u.last_name].filter(x=>typeof x==='string').join(' ').slice(0,140)||username||'Telegram user'};
}
