import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {crc32} from 'node:zlib'

export const dotDownloadName = 'raan-rao-dot-windows-1.zip'
const scripts = ['DotCompanion.ps1', 'DotRules.ps1', 'DotWindow.ps1', 'Manage.ps1', 'Install.cmd', 'Stop.cmd', 'Uninstall.cmd', 'README.md']
const clips = ['preview.mp3', 'morning.mp3', 'spike.mp3']

// Standard stored ZIP entries: MP3s are already compressed. Stable names,
// CRLF and a fixed 1980-01-01 timestamp give the same archive on every host.
function zip(entries) {
  const localParts = []
  const directory = []
  let offset = 0
  for (const [filename, bytes] of entries) {
    const name = Buffer.from(filename, 'ascii')
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50)
    local.writeUInt16LE(20, 4) // required ZIP version
    local.writeUInt16LE(0x21, 12) // DOS date
    local.writeUInt32LE(crc32(bytes), 14)
    local.writeUInt32LE(bytes.length, 18)
    local.writeUInt32LE(bytes.length, 22)
    local.writeUInt16LE(name.length, 26)
    const record = Buffer.alloc(46)
    record.writeUInt32LE(0x02014b50)
    record.writeUInt16LE(20, 4)
    local.copy(record, 6, 4, 30)
    record.writeUInt32LE(offset, 42)
    localParts.push(local, name, bytes)
    directory.push(record, name)
    offset += local.length + name.length + bytes.length
  }
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directory.reduce((size, entry) => size + entry.length, 0), 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...localParts, ...directory, end])
}

export async function buildDotDownload(root = '.') {
  const entries = await Promise.all(scripts.map(async name => {
    const text = await readFile(join(root, 'desktop', 'dot', name), 'utf8')
    // Windows PowerShell 5.1 uses the legacy code page for BOM-less scripts.
    const bom = name.endsWith('.ps1') ? '\uFEFF' : ''
    const bytes = Buffer.from(bom + text.replace(/^\uFEFF/, '').replace(/\r?\n/g, '\r\n'), 'utf8')
    return [name, bytes]
  }))
  for (const name of clips) {
    entries.push(['voice/' + name, await readFile(join(root, 'public', 'dot-voice', name))])
  }
  return zip(entries)
}
