#!/usr/bin/env bash
set -e

# Resolve the repository root even when ./b is invoked through a symlink or
# from another working directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"


# Prefer this fork's declared Node 24 LTS runtime before any Python bootstrap
# work starts. Keeping yarn, corepack, node-gyp, tests, and build scripts on one
# Node major avoids silently generating incompatible native/build artifacts.
node_major() {
    local node_bin="$1"
    "$node_bin" -p "process.versions.node.split('.')[0]" 2>/dev/null || true
}

prepend_node_bin_if_compatible() {
    local bin_dir="$1"
    if [ -x "$bin_dir/node" ]; then
        local major
        major="$(node_major "$bin_dir/node")"
        if [ "$major" = "24" ]; then
            export PATH="$bin_dir:$PATH"
            return 0
        fi
    fi
    return 1
}

if [ -n "${BIOMES_NODE:-}" ] && [ -x "$BIOMES_NODE" ]; then
    prepend_node_bin_if_compatible "$(cd "$(dirname "$BIOMES_NODE")" && pwd)" || true
elif [ -n "${BIOMES_NODE_BIN_DIR:-}" ]; then
    prepend_node_bin_if_compatible "$BIOMES_NODE_BIN_DIR" || true
else
    CURRENT_NODE_MAJOR=""
    if command -v node >/dev/null 2>&1; then
        CURRENT_NODE_MAJOR="$(node_major "$(command -v node)")"
    fi

    if [ "$CURRENT_NODE_MAJOR" != "24" ]; then
        for NODE_BIN_DIR in \
            "$HOME"/.nvm/versions/node/v24*/bin \
            /opt/homebrew/opt/node@24/bin \
            /usr/local/opt/node@24/bin \
            "$HOME"/.fnm/node-versions/v24*/installation/bin \
            "$HOME"/.volta/bin \
            /opt/homebrew/bin \
            /usr/local/bin; do
            if prepend_node_bin_if_compatible "$NODE_BIN_DIR"; then
                break
            fi
        done
    fi
fi

python_minor() {
    "$1" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true
}

python_is_312() {
    [ -x "$1" ] && [ "$(python_minor "$1")" = "3.12" ]
}

# The active fork uses one Python ABI everywhere: local tooling, Bazel, CI, and
# production images. Refuse to silently reuse an older .venv because native
# Voxeloo wheels are not portable between Python minors.
if [ -n "${BIOMES_PYTHON:-}" ]; then
    if ! python_is_312 "$BIOMES_PYTHON"; then
        echo "BIOMES_PYTHON must point to Python 3.12; got $(python_minor "$BIOMES_PYTHON")." >&2
        exit 1
    fi
    PYTHON="$BIOMES_PYTHON"
elif python_is_312 "$SCRIPT_DIR/.venv/bin/python"; then
    PYTHON="$SCRIPT_DIR/.venv/bin/python"
else
    PYTHON=""
    for CANDIDATE in python3.12 python3; do
        if command -v "$CANDIDATE" >/dev/null 2>&1 && python_is_312 "$(command -v "$CANDIDATE")"; then
            PYTHON="$(command -v "$CANDIDATE")"
            break
        fi
    done
fi

if [ -z "$PYTHON" ]; then
    echo "Python 3.12 is required and was not found. Install python@3.12 and recreate .venv." >&2
    exit 1
fi

exec "$PYTHON" "$SCRIPT_DIR/scripts/b/bootstrap.py" "$@"
