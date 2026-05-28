#!/usr/bin/env python

import os
import shutil
import subprocess
import sys
from enum import Enum
from pathlib import Path

import click
from watchfiles import watch

SCRIPT_DIR = Path(os.path.dirname(os.path.realpath(__file__)))
REPO_DIR = (SCRIPT_DIR / ".." / "..").resolve()
MAIN_BASE_PATH = REPO_DIR / ".ts_deps_mainbase"
GEN_DIR = REPO_DIR / "src" / "gen"

# The Bazel target that we run in order to deploy the generated files.
BAZEL_DEPLOY_TARGET = "//src:deploy_all_ts_deps"


def run_with_hidden_output(
    hide_output_for_seconds, args, output_header=None, **kwargs
) -> int:
    """
    Runs the specified function with hidden output if it completes quickly.
    """
    process = subprocess.Popen(
        args,
        **kwargs,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    # Completely hide the output for 2 seconds, after which we'll be more
    # verbose about what's going on.
    if hide_output_for_seconds > 0:
        try:
            done = process.wait(hide_output_for_seconds)
            if done == 0:
                # We did it successfully and quickly, return without any messages.
                return 0
        except subprocess.TimeoutExpired:
            pass

    # Okay, either there was an error, or we took longer than 2 seconds, so
    # start showing the output log.
    if output_header:
        click.secho(output_header)

    for line_b in process.stdout:
        line = line_b.decode("utf-8")
        # Need to use `sys.stdout` for control characters to forward properly.
        sys.stdout.write(line)
        sys.stdout.flush()

    result = process.wait()
    return result


def _command_exists(command: str) -> bool:
    return shutil.which(command) is not None


def _resolve_yarn_command() -> list[str]:
    """Return a yarn-compatible command without assuming global yarn exists.

    Newer macOS/Homebrew Node installs often have npm/corepack but do not expose
    a global `yarn` binary.  The old bootstrap crashed with FileNotFoundError
    before it could explain the problem.  Prefer the real yarn binary, then
    Corepack, then npx as a last-resort one-shot runner for Yarn Classic.
    """
    if _command_exists("yarn"):
        return ["yarn"]

    if _command_exists("corepack"):
        return ["corepack", "yarn"]

    if _command_exists("npx"):
        return ["npx", "--yes", "yarn@1.22.22"]

    raise click.ClickException(
        "Yarn is required but was not found. Install it with `npm install -g yarn` "
        "or enable Corepack with `corepack enable`, then rerun ./b."
    )


def _resolve_bazel_command() -> list[str]:
    """Return a Bazel-compatible command.

    npm's @bazel/bazelisk commonly installs `bazelisk`; some environments also
    expose it as `bazel`.  Support either so ./b does not depend on one exact
    global binary name.
    """
    if _command_exists("bazel"):
        return ["bazel"]

    if _command_exists("bazelisk"):
        return ["bazelisk"]

    raise click.ClickException(
        "Bazel/Bazelisk is required but was not found. Install it with "
        "`npm install -g @bazel/bazelisk`, then rerun ./b."
    )


def _subprocess_text(args, env=None) -> str:
    try:
        return subprocess.run(
            args,
            env=env,
            cwd=REPO_DIR,
            capture_output=True,
            text=True,
            check=False,
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return ""


def _node_major(env=None):
    version = _subprocess_text(["node", "-p", "process.versions.node"], env=env)
    if not version:
        return None
    try:
        return int(version.split(".", 1)[0])
    except ValueError:
        return None


def _node_gyp_env():
    """Return an environment that keeps node-gyp off Homebrew Python 3.14.

    v8-profiler-next falls back to node-gyp when a matching prebuilt binary is
    unavailable. node-gyp@8 imports distutils, which is missing from Python 3.12+
    and especially the Homebrew Python 3.14 shown in the failure log. Force
    native addon builds to use the same project venv interpreter that is already
    running ./b.
    """
    env = os.environ.copy()
    python = str(Path(sys.executable).resolve())
    env["PYTHON"] = python
    env["npm_config_python"] = python
    env["NODE_GYP_FORCE_PYTHON"] = python
    return env


def _assert_compatible_node_for_native_deps(env) -> None:
    major = _node_major(env=env)
    if major is None:
        raise click.ClickException(
            "Node is required but was not found on PATH. Install/use Node 20, "
            "for example: `nvm install 20 && nvm use 20`, then rerun ./b."
        )

    if major >= 23:
        raise click.ClickException(
            "The active Node runtime is too new for this repo's native deps "
            f"(detected Node {major}). v8-profiler-next@1.9.0 does not ship "
            "Node 24 prebuilt binaries, so Yarn falls back to node-gyp and fails. "
            "Use Node 20 before rerunning ./b: `nvm install 20 && nvm use 20`. "
            "If Node 20 is installed somewhere non-standard, set "
            "BIOMES_NODE=/path/to/node or BIOMES_NODE_BIN_DIR=/path/to/bin."
        )


def run_yarn_install(hide_output_for_seconds=0):
    env = _node_gyp_env()
    _assert_compatible_node_for_native_deps(env)

    yarn_command = _resolve_yarn_command()
    command = [
        *yarn_command,
        "install",
        "--frozen-lockfile",
        "--non-interactive",
        # Ensure devDependencies are also installed, regardless of what
        # NODE_ENV is set to.
        "--production=false",
    ]

    result = run_with_hidden_output(
        hide_output_for_seconds,
        command,
        output_header=f"Running `{' '.join(command)}`...",
        close_fds=True,
        cwd=REPO_DIR,
        env=env,
    )

    if result != 0:
        raise click.ClickException(
            f"There was an error while running `{' '.join(command)}`."
        )


def run_bazel(build_config, print_command=False, hide_output_for_seconds=0):
    """Ensure TypeScript dependencies are generated."""
    terminal_style = (
        ["--color=yes", "--curses=yes"] if sys.stdout.isatty() else []
    )
    command = [
        str(x)
        for x in [
            *_resolve_bazel_command(),
            "run",
            f"--config={build_config}",
            "--show_result=0",
            "--ui_event_filters=-INFO",
            *terminal_style,
            BAZEL_DEPLOY_TARGET,
            "--",
            GEN_DIR,
        ]
    ]

    if print_command:
        click.secho(" ".join(command))

    result = run_with_hidden_output(
        hide_output_for_seconds,
        command,
        output_header=f"Generating TypeScript dependencies ({build_config})...",
        close_fds=True,
        cwd=REPO_DIR,
    )

    if result != 0:
        raise click.ClickException(
            "There was an error while generating the TypeScript dependencies."
        )

    # Stamp the gen folder with the config used to build it.
    with open(GEN_DIR / ".build_config", "w") as f:
        f.write(build_config)
    return result


class TsDep(Enum):
    yarn_install = "yarn_install"
    bazel = "bazel"


def ensure_ts_deps_up_to_date(
    build_config, hide_output_for_seconds=0
) -> set[TsDep]:
    """
    Does a light, quick check that TypeScript deps are up-to-date.

    Light and quick means that we just check if the git merge base with
    origin/main has changed since the last time we build deps. In the case
    of bazel build, we also check if the config has changed. It is possible
    that a rebuild is needed even if the checks say otherwise though, such
    as if you're locally iterating on the generated file source dependencies.
    """
    deps_updated = set()

    if not _mainbase_up_to_date():
        run_yarn_install(hide_output_for_seconds)
        deps_updated.add(TsDep.yarn_install)
    if not _bazel_up_to_date(build_config):
        run_bazel(build_config, hide_output_for_seconds)
        deps_updated.add(TsDep.bazel)

    try:
        _stamp_mainbase()
    except:
        # If git isn't installed (e.g. during a dockerfile build), don't
        # complain.
        pass

    return deps_updated


def _get_mainbase():
    return subprocess.run(
        ["git", "merge-base", "HEAD", "origin/main"],
        capture_output=True,
        text=True,
    ).stdout.strip()


def _stamp_mainbase():
    """
    Store the git hash along the main branch that this change came from,
    so that other scripts can make quick decisions about whether the generated
    files are likely up-to-date or not.
    """
    with open(MAIN_BASE_PATH, "w") as f:
        f.write(_get_mainbase())


def _mainbase_up_to_date():
    """
    Returns true if TypeScript deps are generated for the branch's base.

    Can be a very quick way of knowing if we're definitely out of date or not.
    """
    try:
        with open(MAIN_BASE_PATH) as f:
            if _get_mainbase() != f.read().strip():
                return False
    except:
        return False

    return True


def _bazel_up_to_date(build_config):
    try:
        with open("src/gen/.build_config") as f:
            if f.read().strip() != build_config:
                return False
    except:
        return False

    return _mainbase_up_to_date()


def get_watch_sources():
    workspace_sources = [f"{REPO_DIR}/WORKSPACE.bazel"]

    def bazel_path_to_file_path(x: str):
        return str(REPO_DIR / x[:].lstrip("/:").replace(":", "/"))

    build_sources = list(
        map(
            bazel_path_to_file_path,
            filter(
                lambda x: x.startswith("//"),
                subprocess.run(
                    [
                        *_resolve_bazel_command(),
                        "query",
                        "--noshow_progress",
                        f"buildfiles(deps({BAZEL_DEPLOY_TARGET}))",
                    ],
                    stdout=subprocess.PIPE,
                    text=True,
                    cwd=REPO_DIR,
                )
                .stdout.strip()
                .split("\n"),
            ),
        )
    )
    file_sources = list(
        map(
            lambda x: x[: x.find(":1:1:")],
            filter(
                lambda x: x.startswith(str(REPO_DIR)),
                subprocess.run(
                    [
                        *_resolve_bazel_command(),
                        "query",
                        "--noshow_progress",
                        "--output=location",
                        f'kind("source file", deps({BAZEL_DEPLOY_TARGET}))',
                    ],
                    stdout=subprocess.PIPE,
                    text=True,
                    cwd=REPO_DIR,
                )
                .stdout.strip()
                .split("\n"),
            ),
        )
    )

    all_sources = workspace_sources + build_sources + file_sources
    for source in all_sources:
        assert Path(source).is_file(), str(source)

    return all_sources


# Watch for changes and rebuild if they are detected.
def watch_ts_deps(build_config, disable_sigint=False):
    watch_sources = get_watch_sources()
    do_loop = True

    while do_loop:
        do_loop = disable_sigint
        for _ in watch(*watch_sources, raise_interrupt=not disable_sigint):
            # We don't actually care about what changed, so long as it was
            # in the list of sources.
            try:
                run_bazel(build_config)
            except:
                # The log output from running Bazel should be enough to indicate
                # that an error occurred.
                pass
