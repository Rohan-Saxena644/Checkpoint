$ErrorActionPreference = 'Stop'
# Offline Windows speech; no voice impersonation, external service or music.
$planJson = & node --input-type=module -e "import {plan} from './scripts/submission/final-plan.mjs'; console.log(JSON.stringify(plan))"
if ($LASTEXITCODE -ne 0) { throw 'Cannot read narration plan' }
$segments = $planJson | ConvertFrom-Json
$audioDirectory = Join-Path (Get-Location) 'submission/final/audio'
New-Item -ItemType Directory -Force -Path $audioDirectory | Out-Null
Add-Type -AssemblyName System.Speech
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $speaker.SelectVoice('Microsoft Zira Desktop')
  $speaker.Rate = 1
  for ($index = 0; $index -lt $segments.Count; $index++) {
    $audioPath = Join-Path $audioDirectory ("segment-{0}.wav" -f $index)
    $speaker.SetOutputToWaveFile($audioPath)
    $speaker.Speak($segments[$index].narration)
    $speaker.SetOutputToNull()
  }
} finally { $speaker.Dispose() }
Write-Output 'Offline synthetic narration generated. No music or source microphone audio is used.'
