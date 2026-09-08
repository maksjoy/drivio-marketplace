const url = Deno.env.get('SUPABASE_URL')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers = { apikey: service, Authorization: 'Bearer ' + service, 'Content-Type': 'application/json' };

async function json(path:string, init:RequestInit={}) {
  const r = await fetch(url + path, { ...init, headers: { ...headers, ...(init.headers||{}) } });
  const text = await r.text();
  let body:any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!r.ok) throw new Error((body && (body.message||body.error)) || ('HTTP '+r.status));
  return body;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', {status:405});
  try {
    const rows = await json('/rest/v1/storage_cleanup_queue?select=id,bucket_id,object_path,attempts&processed_at=is.null&order=created_at.asc&limit=50');
    if (!Array.isArray(rows) || !rows.length) return Response.json({ok:true,processed:0});

    let processed = 0, failed = 0;
    for (const row of rows) {
      try {
        const r = await fetch(url + '/storage/v1/object/' + encodeURIComponent(row.bucket_id), {
          method:'DELETE',
          headers,
          body: JSON.stringify({prefixes:[row.object_path]})
        });
        if (!r.ok && r.status !== 404) {
          let msg = 'Storage delete failed';
          try { const j = await r.json(); msg = j.message || j.error || msg; } catch {}
          throw new Error(msg);
        }
        await json('/rest/v1/storage_cleanup_queue?id=eq.'+row.id, {
          method:'PATCH',
          headers:{Prefer:'return=minimal'},
          body:JSON.stringify({processed_at:new Date().toISOString(),attempts:Number(row.attempts||0)+1,last_error:null})
        });
        processed++;
      } catch (e) {
        failed++;
        await json('/rest/v1/storage_cleanup_queue?id=eq.'+row.id, {
          method:'PATCH',
          headers:{Prefer:'return=minimal'},
          body:JSON.stringify({attempts:Number(row.attempts||0)+1,last_error:String(e?.message||e).slice(0,500)})
        });
      }
    }
    return Response.json({ok:true,processed,failed});
  } catch (e) {
    return Response.json({ok:false,error:String(e?.message||e)}, {status:500});
  }
});
