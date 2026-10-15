#!/usr/bin/env sh
# Installs the Ghost Spicetify theme and applies it (restarts Spotify).
# macOS / Linux counterpart of install.ps1.
#
# Remote mode (default): installs small loader files that pull the latest theme
# from GitHub via jsDelivr. Updates arrive automatically after each push.
#
# Local mode (--local): links Spicetify's Themes/Ghost folder to this repo's dist/
# folder, for development with `npm run dev`.
#
#   curl -fsSL https://raw.githubusercontent.com/RazerGhost/spicetify-ghost/main/install.sh | sh
#   ./install.sh                # remote (auto-updating)
#   ./install.sh --local        # development link to ./dist
#   ./install.sh --scheme oled  # choose a colour scheme from color.ini
#   curl -fsSL …/install.sh | sh -s -- --scheme oled

set -eu

repo="RazerGhost/spicetify-ghost"
local=0
scheme="dark"

while [ $# -gt 0 ]; do
  case "$1" in
    --local) local=1 ;;
    --scheme) scheme="${2:?--scheme needs a value}"; shift ;;
    --scheme=*) scheme="${1#--scheme=}" ;;
    -h | --help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

command -v spicetify >/dev/null 2>&1 || {
  echo "spicetify not found - install it first: https://spicetify.app" >&2
  exit 1
}

theme_dir="$(spicetify path userdata)/Themes/Ghost"

# Remove a previous install. A symlink is removed without touching its target.
if [ -L "$theme_dir" ]; then
  rm "$theme_dir"
elif [ -e "$theme_dir" ]; then
  rm -rf "$theme_dir"
fi
mkdir -p "$(dirname "$theme_dir")"

if [ "$local" -eq 1 ]; then
  root="$(cd "$(dirname "$0")" && pwd)"
  if [ ! -f "$root/dist/theme.js" ]; then
    echo "dist/ not found - building first..."
    (cd "$root" && npm run build)
  fi
  ln -s "$root/dist" "$theme_dir"
  echo "Linked $theme_dir -> $root/dist"
else
  mkdir -p "$theme_dir"
  raw="https://raw.githubusercontent.com/$repo/main"
  curl -fsSL "$raw/remote/theme.js" -o "$theme_dir/theme.js"
  curl -fsSL "$raw/remote/user.css" -o "$theme_dir/user.css"
  curl -fsSL "$raw/color.ini" -o "$theme_dir/color.ini"
  echo "Installed remote loader into $theme_dir"
fi

# Same activation steps as install.ps1.
spicetify config inject_css 1 replace_colors 1 overwrite_assets 1 inject_theme_js 1
spicetify config current_theme Ghost color_scheme "$scheme"
spicetify apply
