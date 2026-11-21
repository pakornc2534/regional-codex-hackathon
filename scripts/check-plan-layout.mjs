import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
const url=process.env.TEST_ORIGIN||'http://127.0.0.1:4310'
const folder=process.env.SHOT_DIR||'docs/screenshots'
await mkdir(folder,{recursive:true})
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']})
try{
 for(const width of [1440,390,360]){
   const context=await browser.newContext({viewport:{width,height:width===1440?960:820},reducedMotion:'reduce'})
   const page=await context.newPage(),errors=[]
   page.on('pageerror',e=>errors.push(e.message))
   await page.goto(url,{waitUntil:'domcontentloaded'})
   const product=page.locator('.scene-caption button')
   await product.waitFor({timeout:60000})
   assert.match(await product.innerText(),/ROBOT/)
   await page.locator('.stage canvas, .diorama-fallback').first().waitFor({timeout:60000})
   await page.screenshot({path:folder+'/overview-'+width+'.png'})
   const overflow=()=>page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)
   assert.equal(await overflow(),false,'page exceeds '+width)
   await product.click()
   const openAds=page.getByRole('button',{name:'ยิงแอด',exact:true})
   await openAds.click();assert.equal(await page.locator('dialog[open]').count(),2)
   await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),1)
   await openAds.click()
   assert.equal(await page.locator('dialog[open]').last().evaluate(el=>el.scrollWidth>el.clientWidth+1),false)
   await page.getByRole('button',{name:'ประเมินแผนนี้'}).click()
   await page.locator('#plan-results .plan-answer').waitFor({timeout:60000})
   const answer=await page.locator('#plan-results').innerText()
   assert.match(answer,/19/);assert.match(answer,/58\.70?(?:\D|$)/)
   await page.locator('#plan-results').scrollIntoViewIfNeeded()
   await page.screenshot({path:folder+'/plan-'+width+'.png'})
   assert.equal(await overflow(),false)
   assert.deepEqual(errors,[])
   console.log('Verified nested plan, output and sizing at width',width)
   await context.close()
 }
}finally{await browser.close()}
