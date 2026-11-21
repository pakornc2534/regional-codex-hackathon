import {spawn} from 'node:child_process'
const api=spawn(process.execPath,['server/api.mjs'],{stdio:'inherit',env:{...process.env,PORT:'4311'}})
const ui=spawn(process.execPath,['node_modules/vite/bin/vite.js'],{stdio:'inherit'})
let exiting=false
function stop(code=0){if(exiting)return;exiting=true;api.kill();ui.kill();process.exitCode=code}
for (const child of [api,ui]) child.on('exit',code=>stop(code??0))
for (const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>stop())
