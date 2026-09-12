const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const index=fs.readFileSync('production/index.html','utf8');
const css=fs.readFileSync('production/ux-fixes.css','utf8');
const js=fs.readFileSync('production/ux-fixes.js','utf8');
const rootVercel=fs.readFileSync('vercel.json','utf8');
const standaloneVercel=fs.readFileSync('production/vercel.json','utf8');

new vm.Script(js,{filename:'production/ux-fixes.js'});

test('UX fixes load after the main production bundle',()=>{
  assert.match(index,/ux-fixes\.css/);
  assert.match(index,/ux-fixes\.js/);
  assert.ok(index.indexOf('/ux-fixes.js')>index.indexOf('/app.js'));
});

test('vehicle cards keep a stable photo area and have a local fallback',()=>{
  assert.match(css,/\.photo-wrap\s*\{[\s\S]*?aspect-ratio:4\/3/);
  assert.match(js,/car-placeholder\.svg/);
  assert.equal(fs.existsSync('production/car-placeholder.svg'),true);
  assert.match(js,/img\.style\.display='block'/);
});

test('seeded Wikimedia photos are permitted by production CSP',()=>{
  for(const config of [rootVercel,standaloneVercel]){
    assert.match(config,/img-src[^;]*https:\/\/upload\.wikimedia\.org/);
  }
});

test('mobile city filter spans the full search grid',()=>{
  assert.match(css,/@media\(max-width:820px\)[\s\S]*?#city\s*\{grid-column:1\/-1\}/);
});

test('mobile sort keeps a visible short label',()=>{
  assert.match(js,/recent:'Newest'/);
  assert.match(js,/price_asc:'Price ↑'/);
  assert.match(js,/price_desc:'Price ↓'/);
  assert.match(css,/@media\(max-width:520px\)[\s\S]*?\.sortlabel\s*\{display:inline\}/);
  assert.match(css,/\.sorter select\s*\{[\s\S]*?opacity:0/);
});

test('dialog close target is at least 44 by 44 pixels',()=>{
  assert.match(css,/\.close\s*\{[\s\S]*?width:44px!important;[\s\S]*?height:44px!important/);
});

test('gallery paging is disabled when there is only one photo',()=>{
  assert.match(js,/const noPaging=photoCount<=1/);
  assert.match(js,/button\.hidden=noPaging/);
  assert.match(css,/\.viewer\.single-photo \.gallerynav/);
});
