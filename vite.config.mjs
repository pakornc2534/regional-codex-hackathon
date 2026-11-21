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
export default defineConfig({plugins:[react(),dotDownload],server:{host:'127.0.0.1',port:4310,strictPort:true,proxy:{'/api':'http://127.0.0.1:4311'}},build:{outDir:'dist/client'}})
