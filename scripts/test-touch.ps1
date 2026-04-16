$f = Join-Path $PSScriptRoot "..\app\(tabs)\journal.tsx"
(Get-Item $f).LastWriteTime = Get-Date
Write-Host "Touched: $f"
Start-Sleep -Seconds 3
Write-Host "Done - check CLAUDE.md for a new log entry"
