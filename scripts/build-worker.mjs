import fs from 'node:fs/promises'
import path from 'node:path'
import {gzipSync} from 'node:zlib'
import {build} from 'vite'
import {buildDotDownload, dotDownloadName} from './dot-download.mjs'
await fs.mkdir('dist/client/downloads',{recursive:true})
await fs.writeFile(path.join('dist/client/downloads',dotDownloadName),await buildDotDownload())
const names=await fs.readdir('dist/client',{recursive:true})
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2','.json':'application/json','.zip':'application/zip','.mp3':'audio/mpeg'}
const assets={}
for(const item of names){const full=path.join('dist/client',item);if(!(await fs.stat(full)).isFile())continue
  assets['/'+item.split(path.sep).join('/')]=[types[path.extname(item)]||'application/octet-stream',gzipSync(await fs.readFile(full)).toString('base64')]}
const [workerBuild] = await build({
  configFile:false,
  logLevel:'warn',
  build:{
    write:false,
    target:'es2022',
    minify:false,
    lib:{entry:'web-host/worker.mjs',formats:['es'],fileName:'index'},
    rolldownOptions:{output:{codeSplitting:false}}
  }
})
const worker = workerBuild.output.find(file => file.type === 'chunk' && file.isEntry)
if (!worker || worker.imports.length || worker.dynamicImports.length) throw Error('Expected one self-contained Site worker')
let src = worker.code
src+='\nconst ASSET_MAP='+JSON.stringify(assets)+';\n'+`function serveAsset(path){
 const file=ASSET_MAP[path.endsWith('/')?path+'index.html':path];
 if(!file)return new Response('Not found',{status:404});
 const compressed=Uint8Array.from(atob(file[1]),c=>c.charCodeAt(0));
 return new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')),{headers:{'Content-Type':file[0],'Cache-Control':path.startsWith('/assets/')?'public,max-age=31536000,immutable':'no-cache','X-Content-Type-Options':'nosniff'}})
}`
await fs.mkdir('dist/server',{recursive:true});await fs.writeFile('dist/server/index.js',src)
await fs.mkdir('dist/.openai',{recursive:true});await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json')
