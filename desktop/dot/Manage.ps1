#Requires -Version 5.1
param([ValidateSet('Install', 'Stop', 'Uninstall', 'Status')][string]$Action = 'Install')
$ErrorActionPreference = 'Stop'

$ps = Join-Path $PSHOME 'powershell.exe'
$local = [Environment]::GetFolderPath('LocalApplicationData')
$base = Join-Path $local 'RaanRao\Dot'
$app = Join-Path $base 'app'
$entry = Join-Path $app 'DotCompanion.ps1'
$startup = Join-Path ([Environment]::GetFolderPath('Startup')) 'Raan Rao Dot.lnk'
$menu = Join-Path ([Environment]::GetFolderPath('Programs')) 'Raan Rao Dot'
$files = @('DotCompanion.ps1', 'DotRules.ps1', 'DotWindow.ps1', 'Manage.ps1')
$clips = @('preview.mp3', 'morning.mp3', 'spike.mp3')
$flags = '-NoLogo -NoProfile -NonInteractive -STA -WindowStyle Hidden -ExecutionPolicy RemoteSigned'
$shell = New-Object -ComObject WScript.Shell

# These are the only links managed by this installation. A pre-existing
# unrelated link with the same name stays under the user's control.
$shortcuts = @(
    @{ Path = $startup; Script = $entry; Extra = '' }
    @{ Path = (Join-Path $menu 'Start Dot.lnk'); Script = $entry; Extra = '' }
    @{ Path = (Join-Path $menu 'Preview Dot.lnk'); Script = $entry; Extra = ' -Preview' }
    @{ Path = (Join-Path $menu 'Stop Dot.lnk'); Script = $entry; Extra = ' -Stop' }
    @{ Path = (Join-Path $menu 'Uninstall Dot.lnk'); Script = (Join-Path $app 'Manage.ps1'); Extra = ' -Action Uninstall' }
)

function Assert-ManagedLinks {
    foreach ($item in $shortcuts) {
        if (Test-Path -LiteralPath $item.Path) {
            $link = $shell.CreateShortcut($item.Path)
            if ($link.TargetPath -ne $ps -or $link.Arguments -notlike ('* -File "' + [WildcardPattern]::Escape($item.Script) + '"*')) {
                throw ('An unrelated shortcut already exists: ' + $item.Path)
            }
        }
    }
}

function Stop-Dot {
    if (Test-Path -LiteralPath $entry -PathType Leaf) {
        & $ps -NoProfile -NonInteractive -STA -ExecutionPolicy RemoteSigned -File $entry -Stop
        if ($LASTEXITCODE -ne 0) { throw 'Dot could not stop. Close Dot and try again.' }
    }
}

if ($Action -eq 'Status') {
    [pscustomobject]@{ Installed = (Test-Path -LiteralPath $entry); AtLogon = (Test-Path -LiteralPath $startup); Directory = $app }
    return
}
if ($Action -eq 'Stop') { Stop-Dot; return }

foreach ($dir in @((Join-Path $local 'RaanRao'), $base, $app, (Join-Path $app 'voice'), $menu)) {
    if ((Test-Path -LiteralPath $dir) -and ((Get-Item -LiteralPath $dir).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw ('A managed folder is redirected: ' + $dir)
    }
}
Assert-ManagedLinks
if ($Action -eq 'Uninstall') {
    Stop-Dot
    foreach ($item in $shortcuts) {
        if (Test-Path -LiteralPath $item.Path) { Remove-Item -LiteralPath $item.Path }
    }
    foreach ($name in $files + @($clips | ForEach-Object { 'voice\' + $_ })) {
        $target = Join-Path $app $name
        if (Test-Path -LiteralPath $target -PathType Leaf) { Remove-Item -LiteralPath $target }
    }
    foreach ($dir in @((Join-Path $app 'voice'), $app, $menu)) {
        if ([IO.Directory]::Exists($dir) -and [IO.Directory]::GetFileSystemEntries($dir).Length -eq 0) {
            [IO.Directory]::Delete($dir)
        }
    }
    Write-Output 'Dot was removed. Its local notification history was kept.'
    return
}

$voiceSource = Join-Path $PSScriptRoot 'voice'
if (-not (Test-Path -LiteralPath $voiceSource -PathType Container)) {
    $voiceSource = Join-Path $PSScriptRoot '..\..\public\dot-voice'
}
$payload = @{}
foreach ($name in $files) { $payload[$name] = Join-Path $PSScriptRoot $name }
foreach ($name in $clips) { $payload['voice\' + $name] = Join-Path $voiceSource $name }
foreach ($source in $payload.Values) {
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw ('Missing package file: ' + $source) }
}
Stop-Dot
[void][IO.Directory]::CreateDirectory((Join-Path $app 'voice'))
[void][IO.Directory]::CreateDirectory($menu)
foreach ($name in $payload.Keys) {
    $target = Join-Path $app $name
    if ([IO.Path]::GetFullPath($payload[$name]) -ne $target) {
        Copy-Item -LiteralPath $payload[$name] -Destination $target -Force
    }
}
foreach ($item in $shortcuts) {
    $link = $shell.CreateShortcut($item.Path)
    $link.TargetPath = $ps
    $link.WorkingDirectory = $app
    $link.Arguments = $flags + ' -File "' + $item.Script + '"' + $item.Extra
    $link.WindowStyle = 7
    $link.Description = 'Raan Rao Dot - personal shop notifications'
    $link.Save()
}
Start-Process -FilePath $ps -ArgumentList ($flags + ' -File "' + $entry + '"') -WorkingDirectory $app -WindowStyle Hidden
Write-Output ('Dot is installed for this Windows account. Start menu: ' + $menu)
