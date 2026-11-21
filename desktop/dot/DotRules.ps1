function New-DotCheckpoint {
    return [ordered]@{ runId = ''; clock = ''; revision = $null; inSpike = $false; morningDate = '' }
}

function Test-DotCount($Value) {
    return ($Value -is [int] -or $Value -is [long] -or $Value -is [double] -or $Value -is [decimal]) -and
        $Value -ge 0 -and $Value -le [int]::MaxValue -and [math]::Floor($Value) -eq $Value
}

function Test-DotSummary($Summary) {
    if ($null -eq $Summary -or $Summary.runId -isnot [string] -or [string]::IsNullOrWhiteSpace($Summary.runId) -or
        $Summary.stale -isnot [bool] -or ($null -ne $Summary.revision -and !(Test-DotCount $Summary.revision))) { return $false }
    $date = [DateTimeOffset]::MinValue
    if (![DateTimeOffset]::TryParse([string]$Summary.clock, [ref]$date)) { return $false }
    if ($Summary.stale) { return $true }
    if ($Summary.spike -isnot [bool]) { return $false }
    foreach ($key in 'orders','queue','approval','returns','supplies') {
        if (!(Test-DotCount $Summary.$key)) { return $false }
    }
    if ($null -ne $Summary.overdue -and !(Test-DotCount $Summary.overdue)) { return $false }
    foreach ($key in 'amount','baseline') {
        $value = $Summary.$key
        if (!($value -is [int] -or $value -is [long] -or $value -is [double] -or $value -is [decimal]) -or
            [double]::IsNaN($value) -or [double]::IsInfinity($value) -or $value -lt 0) { return $false }
    }
    return $true
}

function Get-DotMorningText($Summary) {
    if ($Summary.stale) { return 'อรุณสวัสดิ์ค่ะ ข้อมูลร้านจำลองยังไม่อัปเดต ดอตยังสรุปจำนวนงานเช้านี้ไม่ได้ค่ะ' }
    $items = @(
        if ($Summary.overdue -gt 0) { "เริ่มจากออเดอร์เลยกำหนด $($Summary.overdue) ออเดอร์" }
        if ($Summary.queue -gt 0) { "คิวเตรียมส่งทั้งหมด $($Summary.queue) ออเดอร์" }
        if ($Summary.approval -gt 0) { "มี $($Summary.approval) เคสรออนุมัติ" }
        if ($Summary.returns -gt 0) { "ตรวจพัสดุคืน $($Summary.returns) ชิ้น" }
        if ($Summary.supplies -gt 0) { "เติมวัสดุแพ็ก $($Summary.supplies) รายการ" }
    )
    if ($items.Count -eq 0) { return 'อรุณสวัสดิ์ค่ะ ตอนนี้ไม่มีงานรอในคิวเตรียมส่ง เคสอนุมัติ ของคืน หรือวัสดุแพ็กของร้านจำลองค่ะ' }
    return ('อรุณสวัสดิ์ค่ะ วันนี้ร้านจำลองมีงานดังนี้ ' + ($items -join ' · ') + ' ค่ะ')
}

# The feed clock belongs to the simulator. Delivery time belongs to Bangkok.
function Get-DotDecision($Previous, $Summary, [DateTimeOffset]$Now, $UnavailableSince = $null) {
    $state = New-DotCheckpoint
    foreach ($key in @($state.Keys)) { $state[$key] = $Previous.$key }
    $alerts = @()
    $local = $Now.ToOffset([TimeSpan]::FromHours(7))
    $day = $local.ToString('yyyy-MM-dd',[cultureinfo]::InvariantCulture)
    $morningDue = $local.Hour -ge 8 -and $local.Hour -lt 12 -and $state.morningDate -ne $day
    if (!(Test-DotSummary $Summary)) {
        if ($morningDue -and $null -ne $UnavailableSince -and ($Now - [DateTimeOffset]$UnavailableSince).TotalMinutes -ge 5) {
            $alerts += @{kind='morning'; title='สรุปงานเช้า'; text='อรุณสวัสดิ์ค่ะ ดอตยังอ่านข้อมูลร้านจำลองไม่ได้ จึงยังสรุปจำนวนงานเช้านี้ไม่ได้ค่ะ'}
            $state.morningDate = $day
        }
        return @{ state = $state; alerts = $alerts }
    }
    $sameRun = $state.runId -eq $Summary.runId
    if ($sameRun -and $state.clock -and
        (([DateTimeOffset]$Summary.clock -lt [DateTimeOffset]$state.clock) -or
        ($null -ne $Summary.revision -and $null -ne $state.revision -and $Summary.revision -lt $state.revision))) {
        return @{ state = $state; alerts = $alerts }
    }
    if ($morningDue) {
        $alerts += @{ kind = 'morning'; title = 'สรุปงานเช้า'; text = Get-DotMorningText $Summary }
        $state.morningDate = $day
    }
    if (!$Summary.stale) {
        if ($sameRun -and !$state.inSpike -and $Summary.spike) {
            $amount = ([decimal]$Summary.amount).ToString('#,##0.##', [cultureinfo]::InvariantCulture)
            $alerts += @{ kind = 'spike'; title = 'ยอดซื้อพุ่ง'; text = "ดอตพบยอดซื้อพุ่งค่ะ ร้านจำลองมี $($Summary.orders) ออเดอร์ชำระแล้วในหนึ่งชั่วโมง รวม $amount บาท" }
        }
        $state.runId = $Summary.runId
        $state.clock = $Summary.clock
        $state.revision = $Summary.revision
        $state.inSpike = $Summary.spike
    }
    return @{ state = $state; alerts = $alerts }
}
