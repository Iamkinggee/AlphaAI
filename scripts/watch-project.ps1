# ============================================================
#  AlphaAI - CLAUDE.md Auto-Updater
#  Watches all .ts/.tsx files and prepends a Dev Log entry
#  to CLAUDE.md whenever a file is saved/created/deleted.
#
#  Usage (terminal):
#    powershell -ExecutionPolicy Bypass -File .\scripts\watch-project.ps1
#
#  Or via npm:
#    npm run watch:claude
# ============================================================

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ClaudeMd    = Join-Path $ProjectRoot "CLAUDE.md"
$WatchPaths  = @(
    (Join-Path $ProjectRoot "app"),
    (Join-Path $ProjectRoot "src")
)

# ── Status line builder ──────────────────────────────────────

function Get-StatusLine {
    param([string]$fullPath, [string]$changeType)

    $rel  = $fullPath.Replace($ProjectRoot + "\", "").Replace("\", "/")
    $ts   = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss")

    $tag = switch -Regex ($fullPath) {
        "\(auth\)"           { "[AUTH]"       }
        "\(tabs\)"           { "[SCREEN]"     }
        "components"         { "[COMPONENT]"  }
        "constants"          { "[CONSTANTS]"  }
        "store|zustand"      { "[STORE]"      }
        "hooks"              { "[HOOK]"       }
        "chat|notifications|watchlist" { "[MODAL]" }
        "_layout"            { "[LAYOUT]"     }
        default              { "[FILE]"       }
    }

    $verb = switch ($changeType) {
        "Created" { "Created"  }
        "Deleted" { "Deleted"  }
        "Renamed" { "Renamed"  }
        default   { "Saved"    }
    }

    return "| $ts | $tag ``$rel`` $verb |"
}

# ── CLAUDE.md updater ────────────────────────────────────────

function Update-ClaudeMd {
    param([string]$newLogLine)

    if (-not (Test-Path $ClaudeMd)) {
        Write-Warning "CLAUDE.md not found at $ClaudeMd"
        return
    }

    # Read current content
    $content = [System.IO.File]::ReadAllText($ClaudeMd, [System.Text.Encoding]::UTF8)

    # 1. Refresh "Last snapshot" timestamp
    $ts = Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz"
    $content = [regex]::Replace($content, "(?<=Last snapshot: ).*", $ts)

    # 2. Inject new log row right after the table header rows
    $headerPattern = "| Timestamp | Event |`r`n|---|---|"
    $headerPatternLF = "| Timestamp | Event |`n|---|---|"

    $newHeader = "| Timestamp | Event |`n|---|---|`n$newLogLine"

    if ($content.Contains($headerPattern)) {
        $content = $content.Replace($headerPattern, $newHeader)
    } elseif ($content.Contains($headerPatternLF)) {
        $content = $content.Replace($headerPatternLF, $newHeader)
    } else {
        # Fallback: append to end
        $content += "`n$newLogLine"
    }

    # Write back as UTF-8 without BOM
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($ClaudeMd, $content, $utf8NoBom)
}

# ── File system watchers ─────────────────────────────────────

$watchers = @()
foreach ($dir in $WatchPaths) {
    if (-not (Test-Path $dir)) {
        Write-Warning "Watch path not found, skipping: $dir"
        continue
    }
    $w = New-Object System.IO.FileSystemWatcher
    $w.Path                    = $dir
    $w.Filter                  = "*.*"
    $w.IncludeSubdirectories   = $true
    $w.NotifyFilter            = [System.IO.NotifyFilters]"FileName, LastWrite"
    $w.EnableRaisingEvents     = $true
    $watchers += $w
}

# Shared debounce state (avoid double-fire on single save)
$global:LastFiredPath = ""
$global:LastFiredTime = [datetime]::MinValue

$onChange = {
    param($source, $e)

    # Skip non-source files and node_modules
    if ($e.FullPath -notmatch '\.(tsx?|ts)$') { return }
    if ($e.FullPath -match "node_modules")    { return }
    if ($e.FullPath -match "\.expo")          { return }

    # Debounce: ignore same file within 2 seconds
    $now = Get-Date
    if ($e.FullPath -eq $global:LastFiredPath -and
        ($now - $global:LastFiredTime).TotalSeconds -lt 2) { return }

    $global:LastFiredPath = $e.FullPath
    $global:LastFiredTime = $now

    # Small delay to let editor finish flushing the file
    Start-Sleep -Milliseconds 600

    $line = Get-StatusLine -fullPath $e.FullPath -changeType $e.ChangeType
    Update-ClaudeMd -newLogLine $line

    $rel = $e.FullPath.Replace($ProjectRoot + "\", "")
    $time = Get-Date -Format "HH:mm:ss"
    Write-Host "[$time] CLAUDE.md updated  <--  $rel ($($e.ChangeType))" -ForegroundColor Cyan
}

foreach ($w in $watchers) {
    Register-ObjectEvent $w "Changed" -Action $onChange | Out-Null
    Register-ObjectEvent $w "Created" -Action $onChange | Out-Null
    Register-ObjectEvent $w "Deleted" -Action $onChange | Out-Null
    Register-ObjectEvent $w "Renamed" -Action $onChange | Out-Null
}

# ── Banner ───────────────────────────────────────────────────

Write-Host ""
Write-Host "  =============================================" -ForegroundColor DarkCyan
Write-Host "   AlphaAI  --  CLAUDE.md Watcher" -ForegroundColor Cyan
Write-Host "  =============================================" -ForegroundColor DarkCyan
Write-Host ""
$watchDirs = ($WatchPaths | ForEach-Object { $_.Replace($ProjectRoot + "\", "") }) -join ", "
Write-Host "  Watching : $watchDirs" -ForegroundColor Green
Write-Host "  Updating : CLAUDE.md" -ForegroundColor Green
Write-Host "  Stop     : Ctrl+C" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Watcher is running. Edit any .ts/.tsx file to trigger an update." -ForegroundColor DarkGray
Write-Host ""

# ── Keep alive ───────────────────────────────────────────────

try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    foreach ($w in $watchers) {
        $w.EnableRaisingEvents = $false
        $w.Dispose()
    }
    Get-EventSubscriber -ErrorAction SilentlyContinue | Unregister-Event -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "  Watcher stopped." -ForegroundColor Yellow
}
