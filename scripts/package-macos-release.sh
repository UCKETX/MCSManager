#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <linux-release.tar.gz> <output-directory>" >&2
  exit 1
fi

source_archive="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
mkdir -p "$2"
output_dir="$(cd "$2" && pwd)"
repo_dir="$(cd "$(dirname "$0")/.." && pwd)"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

# The application bundles are platform independent; reuse this release's exact
# app.js and frontend assets, then supply macOS launchers and native runtimes.
mkdir "$work_dir/source"
tar -xzf "$source_archive" -C "$work_dir/source"
source_dir="$work_dir/source/mcsmanager"
test -f "$source_dir/daemon/app.js"
test -f "$source_dir/web/public/index.html"
curl --fail --location --retry 3 https://nodejs.org/dist/latest-v20.x/SHASUMS256.txt \
  -o "$work_dir/SHASUMS256.txt"

for arch in arm64 x64; do
  node_archive="$(awk -v suffix="-darwin-${arch}.tar.gz" \
    'substr($2, length($2) - length(suffix) + 1) == suffix { print $2 }' "$work_dir/SHASUMS256.txt")"
  [[ "$node_archive" =~ ^node-v20\.[0-9]+\.[0-9]+-darwin-${arch}\.tar\.gz$ ]] || {
    echo "Invalid Node.js archive name for $arch" >&2
    exit 1
  }
  node_version="${node_archive%-darwin-${arch}.tar.gz}"
  node_version="${node_version#node-}"
  curl --fail --location --retry 3 "https://nodejs.org/dist/$node_version/$node_archive" \
    -o "$work_dir/$node_archive"
  awk -v name="$node_archive" '$2 == name' "$work_dir/SHASUMS256.txt" > "$work_dir/node-checksum.txt"
  (cd "$work_dir" && shasum -a 256 -c node-checksum.txt)

  mkdir "$work_dir/node-$arch" "$work_dir/$arch"
  tar -xzf "$work_dir/$node_archive" --strip-components=1 -C "$work_dir/node-$arch"
  stage="$work_dir/$arch/mcsmanager"
  cp -R "$source_dir" "$stage"
  rm -f "$stage/install.sh" "$stage/start-daemon.sh" "$stage/start-web.sh"
  rm -rf "$stage/daemon/lib"
  mkdir -p "$stage/daemon/lib" "$stage/runtime/bin"
  cp "$repo_dir"/prod-scripts/macos/* "$stage/"
  cp "$work_dir/node-$arch/bin/node" "$stage/runtime/bin/node"
  cp "$work_dir/node-$arch/LICENSE" "$stage/runtime/LICENSE"
  cp "$source_dir/daemon/lib/pty_darwin_$arch" "$stage/daemon/lib/"
  cp "$source_dir/daemon/lib/7z_darwin_$arch" "$stage/daemon/lib/"
  zip_source="$source_dir/daemon/lib/file_zip_darwin_$arch"
  # Zip-Tools names its Intel artifact amd64; Node's runtime lookup uses x64.
  if [ "$arch" = x64 ] && [ ! -f "$zip_source" ]; then
    zip_source="$source_dir/daemon/lib/file_zip_darwin_amd64"
  fi
  cp "$zip_source" "$stage/daemon/lib/file_zip_darwin_$arch"
  cp "$source_dir"/daemon/lib/7z-*-license.txt "$stage/daemon/lib/"
  chmod +x "$stage"/start-*.sh "$stage/runtime/bin/node" \
    "$stage/daemon/lib/pty_darwin_$arch" "$stage/daemon/lib/7z_darwin_$arch" \
    "$stage/daemon/lib/file_zip_darwin_$arch"

  tar -czf "$output_dir/mcsmanager_macos_${arch}_release.tar.gz" -C "$work_dir/$arch" mcsmanager
  tar --exclude='mcsmanager/daemon' --exclude='mcsmanager/start-daemon.sh' \
    -czf "$output_dir/mcsmanager_macos_${arch}_web_only_release.tar.gz" -C "$work_dir/$arch" mcsmanager
  tar --exclude='mcsmanager/web' --exclude='mcsmanager/start-web.sh' \
    -czf "$output_dir/mcsmanager_macos_${arch}_daemon_only_release.tar.gz" -C "$work_dir/$arch" mcsmanager
done
