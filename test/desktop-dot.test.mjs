import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

test('Windows Dot distinguishes fresh incidents, restart baselines and Bangkok morning delivery', {
  skip: process.platform !== 'win32',
}, () => {
  const fixture = fileURLToPath(new URL('./desktop-dot-fixtures.ps1', import.meta.url))
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-File', fixture], {
    windowsHide: true,
  })
})
