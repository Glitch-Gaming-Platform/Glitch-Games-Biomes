#!/bin/bash

set -euo pipefail

SCRIPTPATH="$(cd "$(dirname "$0")" >/dev/null 2>&1; pwd -P)"
REPOPATH="$(cd "$SCRIPTPATH/../../.." >/dev/null 2>&1; pwd -P)"

if [[ -n "${BIOMES_ASSET_PYTHON:-}" ]]; then
  PYTHON_BIN="$BIOMES_ASSET_PYTHON"
elif [[ -n "${VIRTUAL_ENV:-}" && -x "$VIRTUAL_ENV/bin/python" ]]; then
  PYTHON_BIN="$VIRTUAL_ENV/bin/python"
elif [[ -x "$REPOPATH/.venv/bin/python" ]]; then
  PYTHON_BIN="$REPOPATH/.venv/bin/python"
else
  PYTHON_BIN="python"
fi

cd "$SCRIPTPATH/../py/assets"
"$PYTHON_BIN" -m unittest discover -s test -p '*_test.py'
