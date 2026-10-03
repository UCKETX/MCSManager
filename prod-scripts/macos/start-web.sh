#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$script_dir/web"
exec "$script_dir/runtime/bin/node" --max-old-space-size=8192 --enable-source-maps app.js "$@"
