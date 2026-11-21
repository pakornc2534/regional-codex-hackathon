$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../desktop/dot/DotRules.ps1')
function Require($Condition,[string]$Message) { if (!$Condition) { throw $Message } }

$before = [DateTimeOffset]'2026-11-21T07:59:00+07:00'
$eight = $before.AddMinutes(1)
$normal = @{runId='demo-a';clock='2026-10-02T10:00:00Z';revision=1;stale=$false;spike=$false;
    orders=1;baseline=2;amount=100;overdue=2;queue=17;approval=1;returns=1;supplies=1}
$spike = $normal.Clone()
$spike.orders=8; $spike.amount=999; $spike.spike=$true; $spike.revision=2
$initial = Get-DotDecision (New-DotCheckpoint) $spike $before
Require ($initial.alerts.Count -eq 0 -and $initial.state.inSpike) 'First poll is a baseline, including existing spike'
$baseline = Get-DotDecision (New-DotCheckpoint) $normal $before
$incident = Get-DotDecision $baseline.state $spike $before
Require ($incident.alerts.Count -eq 1 -and $incident.alerts[0].kind -eq 'spike') 'New spike'
Require ($incident.alerts[0].text -match '999') 'Actual amount'
$restored = $incident.state | ConvertTo-Json | ConvertFrom-Json
Require ((Get-DotDecision $restored $spike $before).alerts.Count -eq 0) 'Dedup after restart'
$stale = $normal.Clone()
$stale.revision=3; $stale.stale=$true; $stale.spike=$null
Require ((Get-DotDecision $restored $stale $before).state.inSpike) 'Stale does not re-arm'
Require ((Get-DotDecision $restored $normal $before).state.inSpike) 'Older revision does not re-arm'
$calm = $normal.Clone(); $calm.revision=4
$rearmed = Get-DotDecision $restored $calm $before
Require (!$rearmed.state.inSpike) 'Fresh calm ends episode'
$another = $spike.Clone(); $another.revision=5
Require ((Get-DotDecision $rearmed.state $another $before).alerts.Count -eq 1) 'New episode after clear'
$newRun = $spike.Clone(); $newRun.runId='demo-b'
Require ((Get-DotDecision $baseline.state $newRun $before).alerts.Count -eq 0) 'Reset is a baseline'
$morning = Get-DotDecision $incident.state $another $eight
Require ($morning.alerts.Count -eq 1 -and $morning.alerts[0].kind -eq 'morning' -and $morning.alerts[0].text -match '17') '08:00 Bangkok reads queue'
$later = $eight.AddHours(2)
Require ((Get-DotDecision $morning.state $another $later).alerts.Count -eq 0) 'Same morning stays quiet'
Require ((Get-DotDecision $incident.state $another $later).alerts.Count -eq 1) 'Morning catch-up before noon'
Require ((Get-DotDecision $incident.state $another $eight.AddHours(4)).alerts.Count -eq 0) 'No outdated summary after noon'
Require ((Get-DotDecision $morning.state $another $eight.AddDays(1)).alerts.Count -eq 1) 'Next day new morning'
$unknown = Get-DotDecision $incident.state $stale $eight
Require ($unknown.alerts.Count -eq 1 -and $unknown.alerts[0].text -notmatch '\d') 'Stale morning reads no previous counts'
Require ((Get-DotDecision $baseline.state $null $eight $before).alerts.Count -eq 0) 'Momentary outage waits'
$unavailable = Get-DotDecision $baseline.state $null $eight $eight.AddMinutes(-5)
Require ($unavailable.alerts.Count -eq 1 -and $unavailable.alerts[0].kind -eq 'morning') 'Sustained outage gets daily notice'
Require ((Get-DotDecision $unavailable.state $normal $later).alerts.Count -eq 0) 'No duplicate morning after recovery'
$broken = $normal.Clone(); $broken.Remove('orders')
Require (!(Test-DotSummary $broken)) 'Missing count rejected'
