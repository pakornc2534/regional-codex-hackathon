function Get-DotThaiSpeech([string]$Text) {
    $memory = New-Object IO.MemoryStream
    $voiceName = $null
    try {
        Add-Type -AssemblyName System.Runtime.WindowsRuntime
        $synthType = [Windows.Media.SpeechSynthesis.SpeechSynthesizer,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime]
        $streamType = [Windows.Media.SpeechSynthesis.SpeechSynthesisStream,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime]
        $voice = $synthType::AllVoices | Where-Object Language -like 'th-*' | Select-Object -First 1
        if ($voice) {
            $synth = [Activator]::CreateInstance($synthType)
            try {
                $synth.Voice = $voice
                $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
                    $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetGenericArguments().Length -eq 1 -and
                    $_.GetParameters().Length -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
                } | Select-Object -First 1
                $op = $synth.SynthesizeTextToStreamAsync($Text)
                $stream = $asTask.MakeGenericMethod($streamType).Invoke($null,@($op)).GetAwaiter().GetResult()
                try {
                    $reader = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream.GetInputStreamAt(0))
                    try { $reader.CopyTo($memory) } finally { $reader.Dispose() }
                    $voiceName = $voice.DisplayName
                } finally { $stream.Dispose() }
            } finally { $synth.Dispose() }
        }
    } catch { $memory.SetLength(0); $voiceName = $null }
    if (!$voiceName) {
        try {
            Add-Type -AssemblyName System.Speech
            $sapi = New-Object System.Speech.Synthesis.SpeechSynthesizer
            try {
                $voice = $sapi.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like 'th-*' } | Select-Object -First 1
                if ($voice) {
                    $sapi.SelectVoice($voice.VoiceInfo.Name)
                    $sapi.SetOutputToWaveStream($memory)
                    $sapi.Speak($Text)
                    $voiceName = $voice.VoiceInfo.Name
                }
            } finally { $sapi.Dispose() }
        } catch { $voiceName = $null }
    }
    $bytes = $memory.ToArray()
    $memory.Dispose()
    if (!$voiceName -or $bytes.Length -lt 44) { return }
    $rate = 0; $pcm = $false
    for ($pos = 12; $pos + 8 -le $bytes.Length;) {
        $chunk = [Text.Encoding]::ASCII.GetString($bytes,$pos,4)
        $length = [BitConverter]::ToUInt32($bytes,$pos+4)
        $start = $pos+8
        if ($chunk -eq 'fmt ' -and $length -ge 16 -and $start+16 -le $bytes.Length) {
            $rate = [BitConverter]::ToInt32($bytes,$start+8)
            $pcm = [BitConverter]::ToUInt16($bytes,$start) -eq 1 -and [BitConverter]::ToUInt16($bytes,$start+14) -eq 16
        }
        if ($chunk -eq 'data' -and $rate -gt 0) {
            $count = [math]::Min([long]$length,[long]($bytes.Length-$start))
            if ($count -gt 0) {
                return @{ voice=$voiceName; bytes=$bytes; start=$start; rate=$rate; seconds=$count/$rate; pcm=$pcm }
            }
        }
        $pos = $start + [long]$length + ($length % 2)
    }
}

function Get-DotClip([ValidateSet('preview','morning','spike')]$Kind) {
    foreach ($folder in 'voice','../../public/dot-voice') {
        $file = Join-Path $PSScriptRoot "$folder/$Kind.mp3"
        if ([IO.File]::Exists($file)) { return [IO.Path]::GetFullPath($file) }
    }
}

function Show-DotWindow($Alert, $StopSignal = $null, [ScriptBlock]$OnShown = {}) {
    Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase
    $speech = Get-DotThaiSpeech $Alert.text
    $clip = if (!$speech) { Get-DotClip $Alert.kind }
    [xml]$layout = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
 xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" Title="Dot · แจ้งเตือนร้าน"
 Width="414" SizeToContent="Height" MaxHeight="540" WindowStyle="None" ResizeMode="NoResize"
 AllowsTransparency="True" Background="Transparent" ShowInTaskbar="False" ShowActivated="False" Topmost="True">
 <Border CornerRadius="18" Background="#102D32" BorderBrush="#47807F" BorderThickness="1.5" Padding="18">
  <Grid><Grid.RowDefinitions><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/></Grid.RowDefinitions>
   <Grid.ColumnDefinitions><ColumnDefinition Width="92"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
   <Viewbox Width="82" Height="100" VerticalAlignment="Top" Margin="0,0,9,0">
    <Canvas Width="88" Height="106">
     <Rectangle Canvas.Left="43" Canvas.Top="8" Width="3" Height="14" Fill="#EDE7D5"/>
     <Ellipse Canvas.Left="39" Canvas.Top="3" Width="11" Height="11" Fill="#FF9363"/>
     <Rectangle Canvas.Left="21" Canvas.Top="73" Width="46" Height="25" RadiusX="8" RadiusY="8" Fill="#D3D8C9"/>
     <Rectangle Canvas.Left="30" Canvas.Top="79" Width="29" Height="8" RadiusX="4" RadiusY="4" Fill="#537772"/>
     <Ellipse Canvas.Left="34" Canvas.Top="81" Width="4" Height="4" Fill="#A5F3DD"/>
     <Rectangle Canvas.Left="16" Canvas.Top="95" Width="22" Height="7" RadiusX="3" RadiusY="3" Fill="#8CA7A0"/>
     <Rectangle Canvas.Left="51" Canvas.Top="95" Width="22" Height="7" RadiusX="3" RadiusY="3" Fill="#8CA7A0"/>
     <Rectangle Canvas.Left="0" Canvas.Top="37" Width="10" Height="23" RadiusX="4" RadiusY="4" Fill="#789D99"/>
     <Rectangle Canvas.Left="78" Canvas.Top="37" Width="10" Height="23" RadiusX="4" RadiusY="4" Fill="#789D99"/>
     <Rectangle Canvas.Left="5" Canvas.Top="17" Width="78" Height="59" RadiusX="14" RadiusY="14" Fill="#F0ECDA"/>
     <Rectangle Canvas.Left="11" Canvas.Top="23" Width="66" Height="46" RadiusX="11" RadiusY="11" Fill="#113D44"/>
     <Rectangle Canvas.Left="23" Canvas.Top="34" Width="10" Height="11" RadiusX="5" RadiusY="5" Fill="#9CFFEA"/>
     <Rectangle Canvas.Left="55" Canvas.Top="34" Width="10" Height="11" RadiusX="5" RadiusY="5" Fill="#9CFFEA"/>
     <Rectangle x:Name="Mouth" Canvas.Left="34" Canvas.Top="52" Width="20" Height="3" RadiusX="3" RadiusY="3" Fill="#8EF5E2"/>
    </Canvas>
   </Viewbox>
   <StackPanel Grid.Column="1">
    <TextBlock Text="DOT · ผู้ช่วยร้าน" FontFamily="Leelawadee UI" FontSize="13" FontWeight="SemiBold" Foreground="#98E8D9"/>
    <TextBlock x:Name="Heading" FontFamily="Leelawadee UI" FontSize="23" FontWeight="Bold" Foreground="#FFF4DE" TextWrapping="Wrap" Margin="0,3,0,5"/>
    <TextBlock x:Name="BodyText" FontFamily="Leelawadee UI" FontSize="15" LineHeight="23" Foreground="#EBF0E9" TextWrapping="Wrap"/>
   </StackPanel>
   <StackPanel Grid.Row="1" Grid.ColumnSpan="2" Orientation="Horizontal" HorizontalAlignment="Right" Margin="0,15,0,0">
    <Button x:Name="OpenShop" Content="เปิดหน้าร้าน" FontFamily="Leelawadee UI" Background="#91DFCC" Foreground="#123735" BorderThickness="0" Padding="14,6" Margin="0,0,8,0"/>
    <Button x:Name="Dismiss" Content="ปิดเสียงและหน้าต่าง" FontFamily="Leelawadee UI" Background="#254449" Foreground="#FFF4DE" Padding="12,6" BorderBrush="#547176"/>
   </StackPanel>
  </Grid>
 </Border>
</Window>
'@
    $window = [Windows.Markup.XamlReader]::Load((New-Object Xml.XmlNodeReader $layout))
    $window.FindName('Heading').Text = $Alert.title
    $window.FindName('BodyText').Text = $Alert.text
    $mouth = $window.FindName('Mouth')
    $window.FindName('Dismiss').Add_Click({ $window.Close() })
    $window.Add_KeyDown({ if ($_.Key -eq 'Escape') { $window.Close() } })
    $url = switch ($Alert.kind) {
        'spike' { 'https://raan-rao-regional-hackathon.niicez54.chatgpt.site/?dot#sales-watch' }
        'morning' { 'https://raan-rao-regional-hackathon.niicez54.chatgpt.site/?dot#morning-work' }
        default { 'https://raan-rao-regional-hackathon.niicez54.chatgpt.site/?dot' }
    }
    $window.FindName('OpenShop').Add_Click({ Start-Process $url; $window.Close() })
    $player = $null; $audio = $null; $media = $null
    $play = @{ active = $false; end = 12.0 }
    if ($speech) {
        $audio = New-Object IO.MemoryStream(,$speech.bytes)
        $player = New-Object System.Media.SoundPlayer $audio
        $player.Load()
        $play.end = $speech.seconds
    } elseif ($clip) {
        $media = New-Object Windows.Media.MediaPlayer
        $media.Open([Uri]$clip)
        $media.Add_MediaOpened({ if ($media.NaturalDuration.HasTimeSpan) { $play.end = $media.NaturalDuration.TimeSpan.TotalSeconds } })
        $media.Add_MediaEnded({ $play.active = $false })
        $media.Add_MediaFailed({ $play.active = $false })
    }
    $watch = New-Object Diagnostics.Stopwatch
    $timer = New-Object Windows.Threading.DispatcherTimer
    $timer.Interval = [TimeSpan]::FromMilliseconds(75)
    $timer.Add_Tick({
        $t = $watch.Elapsed.TotalSeconds
        if (($StopSignal -and $StopSignal.WaitOne(0)) -or $t -gt [math]::Max(8,$play.end+3)) { $window.Close(); return }
        $opening = 0
        if ($play.active -and $t -lt $play.end) {
            if ($speech -and $speech.pcm) {
                $at = $speech.start + 2 * [int][math]::Floor($t*$speech.rate/2)
                $peak = 0
                for ($i = $at; $i -lt [math]::Min($at+640, $speech.bytes.Length-1); $i += 12) {
                    $peak = [math]::Max($peak,[math]::Abs([int][BitConverter]::ToInt16($speech.bytes,$i)))
                }
                $opening = [math]::Min(10,$peak/1350)
            } else { $opening = 5 + 4 * [math]::Sin($t * 18) }
        }
        $mouth.Height = 3 + $opening
    })
    $window.Add_ContentRendered({
        $bounds = [Windows.SystemParameters]::WorkArea
        $window.Left = $bounds.Right-$window.ActualWidth-16
        $window.Top = $bounds.Bottom-$window.ActualHeight-16
        & $OnShown
        $watch.Start()
        if ($player) { $player.Play(); $play.active = $true }
        elseif ($media) { $media.Play(); $play.active = $true }
        $timer.Start()
    })
    try { [void]$window.ShowDialog() } finally {
        $timer.Stop()
        if ($player) { $player.Stop(); $player.Dispose(); $audio.Dispose() }
        if ($media) { $media.Stop(); $media.Close() }
    }
}
