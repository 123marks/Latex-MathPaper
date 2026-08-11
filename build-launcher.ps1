$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$project = Join-Path $root "launcher\PaperOS.Launcher.csproj"
$publishDir = Join-Path $root "dist\launcher"
$launcherFiles = @(
  "PaperOS.exe",
  "PaperOS.dll",
  "PaperOS.deps.json",
  "PaperOS.runtimeconfig.json"
)
$env:DOTNET_CLI_HOME = Join-Path $root ".dotnet"
$env:DOTNET_SKIP_FIRST_TIME_EXPERIENCE = "1"
$env:DOTNET_NOLOGO = "1"

if (Test-Path -LiteralPath $publishDir) {
  Remove-Item -LiteralPath $publishDir -Recurse -Force
}

dotnet restore $project --ignore-failed-sources
if ($LASTEXITCODE -ne 0) { throw "dotnet restore failed with exit code $LASTEXITCODE" }

dotnet publish $project `
  -c Release `
  --no-restore `
  -p:DebugType=None `
  -p:DebugSymbols=false `
  -o $publishDir

if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed with exit code $LASTEXITCODE" }

foreach ($file in $launcherFiles) {
  $published = Join-Path $publishDir $file
  if (-not (Test-Path -LiteralPath $published)) {
    throw "Expected launcher file was not produced: $published"
  }
  Copy-Item -LiteralPath $published -Destination (Join-Path $root $file) -Force
}

Get-ChildItem -LiteralPath $publishDir -Filter "Microsoft.Web.WebView2*.dll" -ErrorAction SilentlyContinue | ForEach-Object {
  Copy-Item $_.FullName -Destination $root -Force
}
$runtimeSrc = Join-Path $publishDir "runtimes"
if (Test-Path -LiteralPath $runtimeSrc) {
  $runtimeDst = Join-Path $root "runtimes"
  if (Test-Path -LiteralPath $runtimeDst) { Remove-Item -LiteralPath $runtimeDst -Recurse -Force }
  Copy-Item -LiteralPath $runtimeSrc -Destination $runtimeDst -Recurse -Force
}

Write-Host "Built PaperOS.exe (native IDE window) -> $root"
