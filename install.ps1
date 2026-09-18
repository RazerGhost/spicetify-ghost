<#
.SYNOPSIS
  Installs the Ghost Spicetify theme and applies it (restarts Spotify).

.DESCRIPTION
  Remote mode (default): installs small loader files that pull the latest theme
  from GitHub via jsDelivr. Updates arrive automatically after each push.

  Local mode (-Local): links Spicetify's Themes\Ghost folder to this repo's dist\
  folder, for development with `npm run dev`.

.EXAMPLE
  .\install.ps1              # remote (auto-updating)
  .\install.ps1 -Local       # development link to .\dist
  .\install.ps1 -Scheme oled # choose a colour scheme from color.ini
#>
param(
  [switch]$Local,
  [string]$Scheme = "dark"
)

$ErrorActionPreference = "Stop"
$repo = "RazerGhost/spicetify-ghost"
$themeDir = Join-Path (spicetify path userdata) "Themes\Ghost"

# Remove a previous install. A junction is removed without touching its target.
if (Test-Path $themeDir) {
  $item = Get-Item $themeDir -Force
  if ($item.LinkType) { $item.Delete() } else { Remove-Item $themeDir -Recurse -Force }
}

if ($Local) {
  $dist = Join-Path $PSScriptRoot "dist"
  if (-not (Test-Path (Join-Path $dist "theme.js"))) {
    Write-Host "dist\ not found - building first..."
    Push-Location $PSScriptRoot
    try { npm run build } finally { Pop-Location }
  }
  New-Item -ItemType Junction -Path $themeDir -Target $dist | Out-Null
  Write-Host "Linked $themeDir -> $dist"
} else {
  New-Item -ItemType Directory -Path $themeDir -Force | Out-Null
  $raw = "https://raw.githubusercontent.com/$repo/main"
  foreach ($f in @(
      @{ src = "remote/theme.js"; dst = "theme.js" },
      @{ src = "remote/user.css"; dst = "user.css" },
      @{ src = "color.ini"; dst = "color.ini" }
    )) {
    Invoke-WebRequest "$raw/$($f.src)" -OutFile (Join-Path $themeDir $f.dst) -UseBasicParsing
  }
  Write-Host "Installed remote loader into $themeDir"
}

# Same activation steps as the Lucid and Hazy installers.
spicetify config inject_css 1 replace_colors 1 overwrite_assets 1 inject_theme_js 1
spicetify config current_theme Ghost color_scheme $Scheme
spicetify apply
