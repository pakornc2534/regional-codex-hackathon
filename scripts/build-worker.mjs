import fs from 'node:fs/promises'
import path from 'node:path'
import {gzipSync} from 'node:zlib'
import {buildDotDownload, dotDownloadName} from './dot-download.mjs'
await fs.mkdir('dist/client/downloads',{recursive:true})
await fs.writeFile(path.join('dist/client/downloads',dotDownloadName),await buildDotDownload())
const names=await fs.readdir('dist/client',{recursive:true})
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.json':'application/json','.zip':'application/zip','.mp3':'audio/mpeg'}
const assets={}
for(const item of names){const full=path.join('dist/client',item);if(!(await fs.stat(full)).isFile())continue
  assets['/'+item.split(path.sep).join('/')]=[types[path.extname(item)]||'application/octet-stream',gzipSync(await fs.readFile(full)).toString('base64')]}
let src=await fs.readFile('web-host/worker.mjs','utf8')
src=src.replace("import {decode,encode,bounded} from './codec.mjs'",(await fs.readFile('web-host/codec.mjs','utf8')).replace(/^export /gm,''))
const customerMoney = (await fs.readFile('shared/baht.mjs','utf8')).replace(/^export /gm,'')
const customerCatalog = (await fs.readFile('shared/customer-catalog.mjs','utf8'))
  .replace("import {bahtAmount} from './baht.mjs'", '').replace(/^export /gm,'')
src=src.replace(/^import .* from '\.\.\/shared\/customer-catalog\.mjs'$/m,()=>customerMoney+'\n'+customerCatalog)
const rateLimit = await fs.readFile('shared/ai-rate-limit.mjs','utf8')
src=src.replace("import {createAiRateLimit} from '../shared/ai-rate-limit.mjs'",()=>rateLimit.replace(/^export /gm,''))
const dotMonitor=await fs.readFile('shared/dot-monitor.mjs','utf8')
src=src.replace("import {dotSummary} from '../shared/dot-monitor.mjs'",()=>dotMonitor.replace(/^export /gm,''))
src+='\nconst ASSET_MAP='+JSON.stringify(assets)+';\n'+`function serveAsset(path){
 const file=ASSET_MAP[path.endsWith('/')?path+'index.html':path];
 if(!file)return new Response('Not found',{status:404});
 const compressed=Uint8Array.from(atob(file[1]),c=>c.charCodeAt(0));
 return new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')),{headers:{'Content-Type':file[0],'Cache-Control':path.startsWith('/assets/')?'public,max-age=31536000,immutable':'no-cache','X-Content-Type-Options':'nosniff'}})
}`
await fs.mkdir('dist/server',{recursive:true});await fs.writeFile('dist/server/index.js',src)
await fs.mkdir('dist/.openai',{recursive:true});await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json')
