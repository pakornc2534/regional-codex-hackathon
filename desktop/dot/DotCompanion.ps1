[CmdletBinding(DefaultParameterSetName='Listen')]
param(
    [Parameter(ParameterSetName='Preview')][switch]$Preview,
    [Parameter(ParameterSetName='Stop')][switch]$Stop,
    [Parameter(ParameterSetName='Check')][switch]$Check
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'DotRules.ps1')
. (Join-Path $PSScriptRoot 'DotWindow.ps1')
$feed = 'https://raan-rao-regional-hackathon.niicez54.chatgpt.site/api/dot-summary'
$previewAlert = @{kind='preview';title='ทดสอบเสียง Dot';text='สวัสดีค่ะ ดอตพร้อมแจ้งยอดซื้อพุ่ง และอ่านสรุปงานตอนแปดโมงเช้าให้ฟังค่ะ'}
$userId = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$signalName = "Global\RaanRao.Dot.Stop.$userId"
$mutexName = "Global\RaanRao.Dot.Listener.$userId"
$stateDir = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'RaanRao\Dot'
$checkpointFile = Join-Path $stateDir 'state.json'
$statusFile = Join-Path $stateDir 'status.json'

function Read-DotJson($File) {
    if ([IO.File]::Exists($File)) {
        try { return (ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($File))) } catch {}
    }
}
function Write-DotJson($File,$Value) {
    $temporary = "$File.$PID.tmp"
    [IO.File]::WriteAllText($temporary, (ConvertTo-Json -InputObject $Value -Compress))
    try {
        if ([IO.File]::Exists($File)) { [IO.File]::Replace($temporary,$File,"$File.bak") }
        else { [IO.File]::Move($temporary,$File) }
    } finally { if ([IO.File]::Exists($temporary)) { [IO.File]::Delete($temporary) } }
}
function Get-DotSignal {
    try { return [Threading.EventWaitHandle]::OpenExisting($signalName) }
    catch [Threading.WaitHandleCannotBeOpenedException] { return }
}

if ($Stop) {
    $signal = Get-DotSignal
    if ($signal) {
        try {
            [void]$signal.Set()
            try {
                $listener = [Threading.Mutex]::OpenExisting($mutexName)
                try {
                    try { $ended = $listener.WaitOne(12000) } catch [Threading.AbandonedMutexException] { $ended = $true }
                    if (!$ended) { throw 'Dot ยังปิดไม่สำเร็จ กรุณาลองอีกครั้ง' }
                    $listener.ReleaseMutex()
                } finally { $listener.Dispose() }
            } catch [Threading.WaitHandleCannotBeOpenedException] {}
        } finally { $signal.Dispose() }
    }
    return
}
if ($Check) {
    $signal = Get-DotSignal
    $speech = Get-DotThaiSpeech 'ทดสอบเสียงภาษาไทยค่ะ'
    $status = Read-DotJson $statusFile
    [ordered]@{ running=($null -ne $signal); voice=$speech.voice; waveBytes=$speech.bytes.Length;
        fallbackAudio=[bool](Get-DotClip preview); lastPollUtc=$status.lastPollUtc; feedStatus=$status.feedStatus } | ConvertTo-Json -Compress
    if ($signal) { $signal.Dispose() }
    return
}
if ([Threading.Thread]::CurrentThread.GetApartmentState() -ne 'STA') { throw 'เปิดด้วย Windows PowerShell -STA เพื่อแสดงหุ่น Dot' }
if ($Preview) { Show-DotWindow $previewAlert; return }

Add-Type -AssemblyName System.Net.Http,System.Windows.Forms,System.Drawing
$mutex = New-Object Threading.Mutex($false,$mutexName)
try { $owner = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $owner = $true }
if (!$owner) { $mutex.Dispose(); return }
$signal = $null; $tray = $null; $http = $null
try {
    $signal = New-Object Threading.EventWaitHandle($false,[Threading.EventResetMode]::ManualReset,$signalName)
    [void]$signal.Reset()
    [void][IO.Directory]::CreateDirectory($stateDir)
    $state = Read-DotJson $checkpointFile
    if (!$state -or $state.inSpike -isnot [bool]) { $state = Read-DotJson "$checkpointFile.bak" }
    if (!$state -or $state.inSpike -isnot [bool]) { $state = New-DotCheckpoint }
    $handler = New-Object Net.Http.HttpClientHandler
    $handler.AllowAutoRedirect = $false
    $http = New-Object Net.Http.HttpClient($handler)
    $http.Timeout = [TimeSpan]::FromSeconds(15)
    $http.MaxResponseContentBufferSize = 65536
    $http.DefaultRequestHeaders.CacheControl = New-Object Net.Http.Headers.CacheControlHeaderValue
    $http.DefaultRequestHeaders.CacheControl.NoCache = $true
    $http.DefaultRequestHeaders.Accept.ParseAdd('application/json')
    $tray = New-Object Windows.Forms.NotifyIcon
    $tray.Icon = [Drawing.SystemIcons]::Information
    $tray.Text = 'Dot · ผู้ช่วยร้านจำลอง'
    $menu = New-Object Windows.Forms.ContextMenuStrip
    [void]$menu.Items.Add('ทดสอบเสียง Dot',$null,{ Show-DotWindow $previewAlert $signal })
    [void]$menu.Items.Add('เปิดหน้าร้าน',$null,{ Start-Process 'https://raan-rao-regional-hackathon.niicez54.chatgpt.site/?dot' })
    [void]$menu.Items.Add('ออกจาก Dot',$null,{ [void]$signal.Set() })
    $tray.ContextMenuStrip = $menu
    $tray.Visible = $true
    $nextPoll = [DateTimeOffset]::MinValue
    $retrySeconds = 30
    $offlineSince = $null
    while (!$signal.WaitOne(0)) {
        [Windows.Forms.Application]::DoEvents()
        $now = [DateTimeOffset]::UtcNow
        if ($now -lt $nextPoll) { [void]$signal.WaitOne(250); continue }
        $summary = $null
        try {
            $request = $http.GetStringAsync($feed)
            while (!$request.IsCompleted -and !$signal.WaitOne(150)) { [Windows.Forms.Application]::DoEvents() }
            if ($signal.WaitOne(0)) { break }
            $summary = ConvertFrom-Json -InputObject $request.GetAwaiter().GetResult()
            if (!(Test-DotSummary $summary)) { throw 'Invalid shop summary' }
            $freshness = if ($summary.stale) { 'stale' } else { 'ok' }
            $offlineSince = $null
        } catch {
            $summary = $null
            $freshness = 'unavailable'
            if ($null -eq $offlineSince) { $offlineSince = $now }
        }
        $displayFailed = $false
        try {
            $result = Get-DotDecision $state $summary ([DateTimeOffset]::UtcNow) $offlineSince
            $checkpoint = $result.state
            foreach ($alert in $result.alerts) {
                if ($alert.kind -eq 'morning') { $checkpoint.morningDate = $state.morningDate }
                if ($alert.kind -eq 'spike') { $checkpoint.inSpike = $state.inSpike }
            }
            if ((ConvertTo-Json $state -Compress) -ne (ConvertTo-Json $checkpoint -Compress)) {
                Write-DotJson $checkpointFile $checkpoint
            }
            $state = $checkpoint
            foreach ($alert in $result.alerts) {
                if ($signal.WaitOne(0)) { break }
                # Once the user can see this specific alert, claim its delivery.
                # A popup creation failure leaves the previous delivery marker.
                $scheduledDay = $now.ToOffset([TimeSpan]::FromHours(7)).ToString('yyyy-MM-dd',[cultureinfo]::InvariantCulture)
                Show-DotWindow $alert $signal {
                    if ($alert.kind -eq 'morning') { $state.morningDate = $scheduledDay }
                    if ($alert.kind -eq 'spike') { $state.inSpike = $true }
                    Write-DotJson $checkpointFile $state
                }
            }
        } catch { $displayFailed = $true }
        Write-DotJson $statusFile @{lastPollUtc=$now.ToString('o'); feedStatus=$freshness; displayFailed=$displayFailed}
        if ($null -eq $summary -or $displayFailed) {
            $nextPoll = [DateTimeOffset]::UtcNow.AddSeconds($retrySeconds)
            $retrySeconds = [math]::Min(300,$retrySeconds*2)
        } else {
            $retrySeconds = 30
            $now = [DateTimeOffset]::UtcNow
            # UTC quarter hours coincide with Bangkok quarter hours, including 08:00.
            $nextPoll = [DateTimeOffset]::FromUnixTimeSeconds(([long][math]::Floor($now.ToUnixTimeSeconds()/900)+1)*900)
        }
    }
} finally {
    if ($tray) { $tray.Visible=$false; $tray.Dispose(); $menu.Dispose() }
    if ($http) { $http.Dispose() }
    if ($signal) { $signal.Dispose() }
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
