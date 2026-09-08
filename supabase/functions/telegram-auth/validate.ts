const enc = new TextEncoder();
export async function mac(key: string | Uint8Array, value: string) {
  const raw = typeof key === 'string' ? enc.encode(key) : new Uint8Array(key);
  const k = await crypto.subtle.importKey('raw', raw, {name:'HMAC',hash:'SHA-256'},false,['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode(value)));
}
export const hex = (bytes: Uint8Array) => Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
export async function validateTelegram(raw: string, token: string, now = Date.now()/1000) {
  if (typeof raw !== 'string' || !raw || raw.length > 16384) throw Error('Invalid Telegram data');
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) throw Error('Invalid bot configuration');
  const p = new URLSearchParams(raw);
  if ([...p.keys()].length !== new Set(p.keys()).size) throw Error('Duplicate fields');
  const hash = p.get('hash') || '';
  if (!/^[0-9a-f]{64}$/.test(hash)) throw Error('Invalid signature');
  p.delete('hash');
  const date = Number(p.get('auth_date'));
  if (!/^\d+$/.test(p.get('auth_date')||'') || !Number.isSafeInteger(date) || now-date > 300 || date-now > 30) throw Error('Please reopen the Mini App');
  // HMAC includes every field except hash, including signature when supplied.
  const check = [...p.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('\n');
  const expected = hex(await mac(await mac('WebAppData',token),check));
  let diff=0;for(let i=0;i<64;i++)diff|=expected.charCodeAt(i)^hash.charCodeAt(i);
  if(diff)throw Error('Invalid signature');
  const u=JSON.parse(p.get('user')||'{}');
  if(!u || !Number.isSafeInteger(u.id) || u.id<=0 || u.is_bot)throw Error('Invalid Telegram user');
  const username=typeof u.username==='string'&&/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(u.username)?u.username:null;
  return {id:String(u.id),username,name:[u.first_name,u.last_name].filter(x=>typeof x==='string').join(' ').slice(0,140)||username||'Telegram user'};
}
