import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
export default defineConfig({plugins:[react(),tailwind()], resolve:{alias:{'@':fileURLToPath(new URL('./src/client',import.meta.url))}},server:{port:4310,strictPort:true, proxy:{'/api':'http://127.0.0.1:4311'}}})
