Deno.serve(()=>new Response('Gone',{status:410,headers:{'Cache-Control':'no-store'}}));
