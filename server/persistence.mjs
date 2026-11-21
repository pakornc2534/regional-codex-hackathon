import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {seedWorld} from './domain/index.mjs'

function atomic(file, value) {
  const tmp=file+'.'+randomUUID()+'.tmp'
  writeFileSync(tmp,JSON.stringify(value),{mode:0o600,flush:true})
  renameSync(tmp,file)
}
export function openShop(root) {
  mkdirSync(root,{recursive:true,mode:0o700})
  const pointer=join(root,'current.json')
  let world, owner, directory
  function fresh() {
    world=seedWorld()
    directory=join(root,world.runId)
    mkdirSync(directory,{mode:0o700})
    owner={schemaVersion:1,runId:world.runId,messages:[],memories:[]}
    atomic(join(directory,'simulator.json'),world)
    atomic(join(directory,'store.json'),owner)
    atomic(pointer,{directory:world.runId})
  }
  if (existsSync(pointer)) {
    directory=join(root,JSON.parse(readFileSync(pointer)).directory)
    world=JSON.parse(readFileSync(join(directory,'simulator.json')))
    owner=JSON.parse(readFileSync(join(directory,'store.json')))
    if (owner.runId!==world.runId || owner.schemaVersion!==1) throw Error('รูปแบบข้อมูลร้านไม่ตรงกัน')
    for(const msg of owner.messages) if(msg.status==='thinking'||msg.status==='queued') {msg.status='failed';msg.text='งานหยุดเมื่อปิดโปรแกรม กรุณาลองอีกครั้ง'}
    atomic(join(directory,'store.json'),owner)
  } else fresh()
  return {get world(){return world},get owner(){return owner},reset:fresh,
    saveWorld(next){atomic(join(directory,'simulator.json'),next);world=next},
    editOwner(fn){const next=structuredClone(owner);fn(next);atomic(join(directory,'store.json'),next);owner=next}}
}
