import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {buildDotDownload, dotDownloadName} from './scripts/dot-download.mjs'

const dotDownload = {
  name: 'dot-desktop-download',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (req.url?.split('?')[0] !== '/downloads/' + dotDownloadName || !['GET', 'HEAD'].includes(req.method)) return next()
      try {
        const file = await buildDotDownload(server.config.root)
        res.writeHead(200, {'Content-Type':'application/zip', 'Content-Length':file.length})
        res.end(req.method === 'HEAD' ? undefined : file)
      } catch (error) {
        next(error)
      }
    })
  },
}

const guideEntry = 'docs/guide/index.html'
const guideAvatar = {
  name: 'guide-avatar',
  transformIndexHtml: {
    order: 'pre',
    handler(html, { filename }) {
      if (filename.replaceAll('\\', '/').endsWith('/' + guideEntry)) {
        return html.replace('</main>', '</main><script type="module" src="/src/guide-dot.tsx"></script>')
      }
    },
  },
  generateBundle: {
    order: 'post',
    handler(_options, bundle) {
      const guide = bundle[guideEntry]
      if (guide) {
        this.emitFile({type: 'asset', fileName: 'guide/index.html', source: guide.source})
        delete bundle[guideEntry]
      }
    },
  },
}

export default defineConfig({
  plugins:[react(),dotDownload,guideAvatar],
  server:{host:'127.0.0.1',port:4310,strictPort:true,proxy:{'/api':'http://127.0.0.1:4311'}},
  build:{outDir:'dist/client',rolldownOptions:{input:['index.html', guideEntry]}},
})
