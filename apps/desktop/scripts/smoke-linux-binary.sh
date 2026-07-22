#!/usr/bin/env bash
set -euo pipefail

binary=""
for candidate in \
  "target/release/schematica" \
  "apps/desktop/src-tauri/target/release/schematica"
do
  if [[ -x "$candidate" ]]; then
    binary="$candidate"
    break
  fi
done
log_file="${RUNNER_TEMP:-/tmp}/schematica-linux-smoke.log"

if [[ -z "$binary" ]]; then
  echo "Expected executable was not found in target/release or apps/desktop/src-tauri/target/release." >&2
  exit 1
fi

if ! command -v xvfb-run >/dev/null 2>&1; then
  echo "xvfb-run is required for the Linux desktop smoke test." >&2
  exit 127
fi

set +e
timeout 15s xvfb-run -a "$binary" >"$log_file" 2>&1
status=$?
set -e

cat "$log_file"

if [[ "$status" != "0" && "$status" != "124" ]]; then
  echo "Schematica exited during smoke test with status $status" >&2
  exit "$status"
fi

if grep -Eiq "panicked|error while running Schematica|PluginInitialization|could not start|failed to load" "$log_file"; then
  echo "Schematica smoke log contains a startup failure marker." >&2
  exit 1
fi
