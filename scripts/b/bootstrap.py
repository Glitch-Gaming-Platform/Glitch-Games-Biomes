#!/usr/bin/env python

import importlib
import os
from pathlib import Path
import shutil
import subprocess
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[2]
PROJECT_VENV = PROJECT_ROOT / ".venv"
PROJECT_VENV_PYTHON = PROJECT_VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
THIS_FILE = Path(__file__).resolve()


def check_version():
    version = sys.version_info
    if version.major != 3 or version.minor != 12:
        raise Exception("This fork requires Python 3.12 exactly.")


def running_inside_virtualenv():
    return sys.prefix != getattr(sys, "base_prefix", sys.prefix)


def project_venv_enabled():
    return os.environ.get("BIOMES_B_NO_VENV", "").lower() not in {"1", "true", "yes"}


def reexec_with_project_venv():
    os.execv(
        str(PROJECT_VENV_PYTHON),
        [str(PROJECT_VENV_PYTHON), str(THIS_FILE), *sys.argv[1:]],
    )


def ensure_project_venv_and_reexec():
    """Create/use a repo-local venv before installing Python deps.

    Homebrew Python 3.12+ can be marked as externally managed by PEP 668, so
    installing project packages into the global interpreter fails with:
    `error: externally-managed-environment`. Keeping b's Python deps inside the
    repo-local .venv avoids touching Homebrew/system Python.
    """
    if not project_venv_enabled() or running_inside_virtualenv():
        return False

    if PROJECT_VENV_PYTHON.exists():
        detected = subprocess.run(
            [
                str(PROJECT_VENV_PYTHON),
                "-c",
                "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')",
            ],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        if detected != "3.12":
            raise RuntimeError(
                f"Existing {PROJECT_VENV} uses Python {detected}; move it aside and "
                "recreate it with `python3.12 -m venv .venv`."
            )
    else:
        print(f"Creating project Python virtualenv at {PROJECT_VENV}...")
        subprocess.run([sys.executable, "-m", "venv", str(PROJECT_VENV)], check=True)

    print("Re-running ./b inside the project Python virtualenv...")
    reexec_with_project_venv()
    return True


def install_package(package):
    subprocess.run(
        [sys.executable, "-m", "pip", "install", package],
        check=True,
    )


def ensure_deps_are_available(deps):
    missing = []
    for dep in deps:
        if isinstance(dep, tuple):
            import_name, install_package_name = dep
        else:
            import_name = dep
            install_package_name = dep
        try:
            importlib.import_module(import_name)
        except ModuleNotFoundError:
            missing.append((import_name, install_package_name))

    if missing:
        ensure_project_venv_and_reexec()

    for import_name, install_package_name in missing:
        try:
            importlib.import_module(import_name)
            continue
        except ModuleNotFoundError:
            pass

        print(f"{import_name} is not installed. Installing {install_package_name}...")
        try:
            install_package(install_package_name)
        except subprocess.CalledProcessError as exc:
            print()
            print("Failed to install Python dependency for ./b.")
            print(f"Interpreter: {sys.executable}")
            print(f"Package: {install_package_name}")
            print()
            print("Recommended fix:")
            print("  python3.12 -m venv .venv")
            print("  . .venv/bin/activate")
            print(
                "  python -m pip install click click-default-group psutil python-dotenv requests watchfiles"
            )
            print()
            print("Then re-run ./b. You can also set BIOMES_PYTHON=/path/to/python.")
            sys.exit(exc.returncode)


def check_git_lfs_is_installed():
    """Check that your local repository used git-lfs correctly."""
    try:
        subprocess.run(
            ["git", "lfs", "version"],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except:
        print(
            "git-lfs is not installed. Please install it: https://git-lfs.github.com/"
        )
        print("Once installed, you need to run: git lfs pull")
        sys.exit(1)


def check_bazel_installed():
    """Check that you have Bazel installed."""
    if shutil.which("bazel") == None:
        print(
            "Bazel is not installed. Please install it: https://bazel.build/install"
        )
        print("  An easy way to install it is by running:")
        print()
        print("    npm install -g @bazel/bazelisk")
        print()
        sys.exit(1)


def check_rsync_installed():
    """
    Check that you have rsync installed.

    Used by `deploy_bazel_ts_deps.sh` script to copy files into the /gen
    directory. Should be installed by default on macos, but not necessarily
    Ubuntu (at least not in their Docker image).
    """
    if shutil.which("rsync") == None:
        print(
            "'rsync' is not installed. Please install it (e.g. with `sudo apt install rsync`)."
        )
        sys.exit(1)


def main():
    check_version()
    ensure_deps_are_available(
        [
            "click",
            ("click_default_group", "click-default-group"),
            "psutil",
            ("dotenv", "python-dotenv"),
            "requests",
            "watchfiles",
        ]
    )
    check_git_lfs_is_installed()
    check_bazel_installed()
    check_rsync_installed()

    from b import entrypoint

    entrypoint()


if __name__ == "__main__":
    main()
