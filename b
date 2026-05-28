#!/usr/bin/env bash
set -e

# Resolve the repository root even when ./b is invoked through a symlink or
# from another working directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"


# Prefer a repo-compatible Node runtime before any Python bootstrap work starts.
# Homebrew's `node` may point at Node 24+, but this repo's native dependencies
# such as v8-profiler-next are built for the LTS-era toolchain. If a Node 20
# install exists through nvm, Homebrew, fnm, Volta, or an explicit override, put
# it first on PATH so yarn/corepack/node-gyp all use the same compatible Node.
node_major() {
    local node_bin="$1"
    "$node_bin" -p "process.versions.node.split('.')[0]" 2>/dev/null || true
}

prepend_node_bin_if_compatible() {
    local bin_dir="$1"
    if [ -x "$bin_dir/node" ]; then
        local major
        major="$(node_major "$bin_dir/node")"
        case "$major" in
            18|20|21|22)
                export PATH="$bin_dir:$PATH"
                return 0
                ;;
        esac
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

    # Only override PATH when there is no node or when the active one is too new
    # for this repo's native dependency tree. Prefer Node 20, then 22, then 18.
    if [ -z "$CURRENT_NODE_MAJOR" ] || [ "$CURRENT_NODE_MAJOR" -ge 23 ] 2>/dev/null; then
        for NODE_BIN_DIR in \
            "$HOME"/.nvm/versions/node/v20*/bin \
            /opt/homebrew/opt/node@20/bin \
            /usr/local/opt/node@20/bin \
            "$HOME"/.fnm/node-versions/v20*/installation/bin \
            "$HOME"/.volta/bin \
            "$HOME"/.nvm/versions/node/v22*/bin \
            /opt/homebrew/opt/node@22/bin \
            /usr/local/opt/node@22/bin \
            "$HOME"/.nvm/versions/node/v18*/bin \
            /opt/homebrew/opt/node@18/bin \
            /usr/local/opt/node@18/bin; do
            if prepend_node_bin_if_compatible "$NODE_BIN_DIR"; then
                break
            fi
        done
    fi
fi

# Prefer an explicit override, then the project virtualenv, then stable Python
# versions known to work with the Biomes tooling. Homebrew's `python3` may point
# at a newer externally-managed Python, which cannot accept project pip installs.
if [ -n "${BIOMES_PYTHON:-}" ]; then
    PYTHON="$BIOMES_PYTHON"
elif [ -x "$SCRIPT_DIR/.venv/bin/python" ]; then
    PYTHON="$SCRIPT_DIR/.venv/bin/python"
else
    PYTHON=""
    for CANDIDATE in python3.10 python3.11 python3.12 python3.9 python3.13 python3 python; do
        if command -v "$CANDIDATE" >/dev/null 2>&1; then
            PYTHON="$(command -v "$CANDIDATE")"
            break
        fi
    done
fi

if [ -z "$PYTHON" ]; then
    echo "Python is not installed or is not on PATH. Install Python 3.10+ and try again." >&2
    exit 1
fi

exec "$PYTHON" "$SCRIPT_DIR/scripts/b/bootstrap.py" "$@"
