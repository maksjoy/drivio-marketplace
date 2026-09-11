const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const index=fs.readFileSync('production/index.html','utf8');
const rootVercel=fs.readFileSync('vercel.json','utf8');
const standaloneVercel=fs.readFileSync('production/vercel.json','utf8');

test('web production does not load Telegram runtime or styles',()=>{
  assert.doesNotMatch(index,/telegram\.js/i);
  assert.doesNotMatch(index,/telegram\.css/i);
  assert.equal(fs.existsSync('production/telegram.js'),false);
  assert.equal(fs.existsSync('production/telegram.css'),false);
});

test('web CSP cannot be framed by Telegram and does not allow Telegram scripts',()=>{
  for(const config of [rootVercel,standaloneVercel]){
    assert.doesNotMatch(config,/telegram\.org|web\.telegram\.org/i);
    assert.match(config,/frame-ancestors 'none'/i);
  }
});

test('web SEO essentials are present',()=>{
  assert.match(index,/rel="canonical" href="https:\/\/p2pcars\.ca\/"/i);
  assert.match(index,/property="og:title"/i);
  assert.match(index,/application\/ld\+json/i);
  assert.match(index,/manifest\.webmanifest/i);
});
