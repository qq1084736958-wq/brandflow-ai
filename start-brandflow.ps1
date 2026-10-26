$ErrorActionPreference = "Stop"

$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$brandFlowPort = 3010
$brandFlowUrl = "http://127.0.0.1:$brandFlowPort/"
Set-Location -LiteralPath $projectPath

function Test-TcpPortInUse {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  $client = New-Object System.Net.Sockets.TcpClient

  try {
    $connection = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    if (-not $connection.AsyncWaitHandle.WaitOne(500)) {
      return $false
    }

    $client.EndConnect($connection)
    return $client.Connected
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Test-BrandFlowReady {
  try {
    $response = Invoke-WebRequest -Uri $brandFlowUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200 -and $response.Content -match "BrandFlow"
  } catch {
    return $false
  }
}

if (Test-BrandFlowReady) {
  Start-Process $brandFlowUrl
  Write-Host "BrandFlow AI 已经在运行，正在打开网站。" -ForegroundColor Green
  Start-Sleep -Seconds 2
  exit 0
}

if (Test-TcpPortInUse -Port $brandFlowPort) {
  Write-Host "BrandFlow 专用端口 $brandFlowPort 已被其他程序占用，无法启动。" -ForegroundColor Red
  Write-Host "请关闭占用该端口的程序后重新点击快捷方式。" -ForegroundColor Yellow
  Read-Host "按 Enter 关闭窗口"
  exit 1
}

$host.UI.RawUI.WindowTitle = "BrandFlow AI - 请勿关闭此窗口"
Write-Host "正在启动 BrandFlow AI..." -ForegroundColor Cyan

$npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source

Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @(
  "-NoProfile",
  "-Command",
  "Start-Sleep -Seconds 2; Start-Process '$brandFlowUrl'"
)

& $npmCommand run dev

