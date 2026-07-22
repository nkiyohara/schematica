#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
project_dir=$(CDPATH= cd -- "$script_dir/.." && pwd)
package_version=$(sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' "$project_dir/package.json" | head -n 1)
source_appimage=${1:-"$project_dir/target/release/bundle/appimage/Schematica_${package_version}_amd64.AppImage"}
data_dir=${XDG_DATA_HOME:-"$HOME/.local/share"}
binary_dir="$HOME/.local/bin"
install_dir="$HOME/.local/opt/schematica"
icon_root="$data_dir/icons/hicolor"
desktop_dir="$data_dir/applications"
desktop_template="$project_dir/packaging/linux/dev.schematica.editor.desktop"

if [ ! -f "$source_appimage" ]; then
  printf '%s\n' "AppImage not found: $source_appimage" >&2
  exit 1
fi

install -d -m 0755 "$install_dir" "$binary_dir" "$desktop_dir"
install -m 0755 "$source_appimage" "$install_dir/Schematica.AppImage.new"
mv -f "$install_dir/Schematica.AppImage.new" "$install_dir/Schematica.AppImage"
ln -sfn "$install_dir/Schematica.AppImage" "$binary_dir/schematica"

install_icon() {
  size=$1
  source_icon=$2
  destination="$icon_root/$size/apps"
  install -d -m 0755 "$destination"
  install -m 0644 "$source_icon" "$destination/dev.schematica.editor.png"
}

install_icon 32x32 "$project_dir/apps/desktop/src-tauri/icons/32x32.png"
install_icon 64x64 "$project_dir/apps/desktop/src-tauri/icons/64x64.png"
install_icon 128x128 "$project_dir/apps/desktop/src-tauri/icons/128x128.png"
install_icon 256x256 "$project_dir/apps/desktop/src-tauri/icons/128x128@2x.png"
install_icon 512x512 "$project_dir/apps/desktop/src-tauri/icons/icon.png"

escaped_appimage=$(printf '%s' "$install_dir/Schematica.AppImage" | sed 's/[\\&|]/\\&/g')
sed "s|@APPIMAGE@|$escaped_appimage|g" "$desktop_template" > "$desktop_dir/dev.schematica.editor.desktop.new"
chmod 0644 "$desktop_dir/dev.schematica.editor.desktop.new"
mv -f "$desktop_dir/dev.schematica.editor.desktop.new" "$desktop_dir/dev.schematica.editor.desktop"
rm -f "$desktop_dir/schematica.desktop"

if command -v desktop-file-validate >/dev/null 2>&1; then
  desktop-file-validate "$desktop_dir/dev.schematica.editor.desktop"
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache --force --ignore-theme-index "$icon_root"
fi
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$desktop_dir"
fi

printf '%s\n' "Installed Schematica to $install_dir/Schematica.AppImage"
