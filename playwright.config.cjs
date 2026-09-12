const {defineConfig,devices}=require('@playwright/test');

module.exports=defineConfig({
  testDir:'./tests/e2e',
  timeout:30000,
  expect:{timeout:7000},
  fullyParallel:false,
  retries:1,
  reporter:'line',
  use:{
    baseURL:'http://127.0.0.1:4173',
    trace:'retain-on-failure',
    screenshot:'only-on-failure'
  },
  webServer:{
    command:'python3 -m http.server 4173 --directory production',
    url:'http://127.0.0.1:4173',
    reuseExistingServer:false,
    timeout:15000
  },
  projects:[
    {
      name:'webkit-iphone',
      use:{...devices['iPhone 13']}
    }
  ]
});
