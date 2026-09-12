const {test,expect}=require('@playwright/test');

test('iPhone layout has no horizontal overflow and primary navigation is usable',async({page})=>{
  await page.goto('/');
  await expect(page.locator('.logo')).toContainText('P2PCars');
  await expect(page.locator('.searchbox')).toBeVisible();
  await expect(page.locator('.mobile')).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.locator('.mobile .sellnav').click();
  await expect(page.locator('#modal h2')).toHaveText('Sign in');
  const box=await page.locator('#modal').boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x+box.width).toBeLessThanOrEqual((await page.evaluate(()=>window.innerWidth))+1);
  await page.getByRole('button',{name:'Close'}).click();
});

test('Share copies a deep link and the deep link opens the listing',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'share',{value:undefined,configurable:true});
    Object.defineProperty(navigator,'clipboard',{value:{writeText:async(text)=>{window.__p2pCopied=text}},configurable:true});
  });
  await page.goto('/');
  const firstCard=page.locator('#cards .card').first();
  await expect(firstCard).toBeVisible({timeout:15000});
  await firstCard.locator('.body').click();

  const share=page.locator('[data-share-listing]');
  await expect(share).toBeVisible();
  const listingId=await share.getAttribute('data-share-listing');
  expect(listingId).toMatch(/^[0-9a-f-]{36}$/i);
  await share.click();
  await expect.poll(()=>page.evaluate(()=>window.__p2pCopied||'')).toContain(`?listing=${listingId}`);
  const copied=await page.evaluate(()=>window.__p2pCopied);

  await page.goto(copied);
  await expect(page.locator('#mbg')).toHaveClass(/show/,{timeout:15000});
  await expect(page.locator('#modal h2')).toBeVisible();
  await expect(page.locator('[data-share-listing]')).toHaveAttribute('data-share-listing',listingId);
});
