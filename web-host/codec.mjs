const encoder=new TextEncoder(), decoder=new TextDecoder('utf-8',{fatal:true})
export const wireLimit=2_000_000, rawLimit=8_000_000
export async function bounded(stream,limit){
  if(!stream)throw Error('ไม่มีข้อมูล')
  const reader=stream.getReader(), chunks=[];let size=0
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('ข้อมูลมีขนาดเกินกำหนด')}chunks.push(value)}}finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0
  for(const c of chunks){bytes.set(c,offset);offset+=c.length}
  return bytes
}
export async function encode(value){
  const json=JSON.stringify(value), bytes=encoder.encode(json)
  if(bytes.length<=wireLimit)return json
  if(bytes.length>rawLimit)throw Error('ข้อมูลมีขนาดเกินกำหนด')
  const zipped=await bounded(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')),wireLimit)
  let binary='';for(let i=0;i<zipped.length;i+=8192)binary+=String.fromCharCode(...zipped.subarray(i,i+8192))
  const envelope=JSON.stringify({encoding:'gzip-base64',data:btoa(binary)})
  if(envelope.length>wireLimit)throw Error('ข้อมูลบีบอัดมีขนาดเกินกำหนด')
  return envelope
}
export async function decode(stream){
  const obj=JSON.parse(decoder.decode(await bounded(stream,wireLimit)))
  if(obj?.encoding!=='gzip-base64')return obj
  const zip=Uint8Array.from(atob(obj.data),c=>c.charCodeAt(0))
  return JSON.parse(decoder.decode(await bounded(new Blob([zip]).stream().pipeThrough(new DecompressionStream('gzip')),rawLimit)))
}
