import fs from 'node:fs/promises'
import path from 'node:path'
import {gzipSync} from 'node:zlib'
await fs.mkdir('dist/client/guide',{recursive:true})
await fs.copyFile('docs/guide/index.html','dist/client/guide/index.html')
const names=await fs.readdir('dist/client',{recursive:true})
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.json':'application/json'}
const assets={}
for(const item of names){const full=path.join('dist/client',item);if(!(await fs.stat(full)).isFile())continue
  assets['/'+item]=[types[path.extname(item)]||'application/octet-stream',gzipSync(await fs.readFile(full)).toString('base64')]}
let src=await fs.readFile('web-host/worker.mjs','utf8')
src=src.replace("import {decode,encode,bounded} from './codec.mjs'",(await fs.readFile('web-host/codec.mjs','utf8')).replace(/^export /gm,''))
src+='\nconst ASSET_MAP='+JSON.stringify(assets)+';\n'+`function serveAsset(path){
 const file=ASSET_MAP[path.endsWith('/')?path+'index.html':path];
 if(!file)return new Response('Not found',{status:404});
 const compressed=Uint8Array.from(atob(file[1]),c=>c.charCodeAt(0));
 return new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')),{headers:{'Content-Type':file[0],'Cache-Control':path.startsWith('/assets/')?'public,max-age=31536000,immutable':'no-cache','X-Content-Type-Options':'nosniff'}})
}`
await fs.mkdir('dist/server',{recursive:true});await fs.writeFile('dist/server/index.js',src)
await fs.mkdir('dist/.openai',{recursive:true});await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json')
