#!/usr/bin/env python3
"""Install the pinned native gltfpack used by the Galois asset pipeline."""

from __future__ import annotations

import argparse
import hashlib
import os
import platform
import shutil
import stat
import subprocess
import tempfile
import urllib.request
import zipfile
from pathlib import Path


GLTFPACK_VERSION = "1.2"
RELEASE_BASE_URL = (
    "https://github.com/zeux/meshoptimizer/releases/download/"
    f"v{GLTFPACK_VERSION}"
)
ARCHIVES = {
    ("Darwin", "arm64"): (
        "gltfpack-macos.zip",
        "9f5288a6ad585bef3befbc2907c9f9b9fdeeb0b5a29eaa57f0fe15521b82eb28",
        "gltfpack",
    ),
    ("Darwin", "x86_64"): (
        "gltfpack-macos-intel.zip",
        "bcbd379f212552a84ca19fc986750ce8a4c3fd6c13344df6dbcff7bbf6bc121c",
        "gltfpack",
    ),
    ("Linux", "x86_64"): (
        "gltfpack-ubuntu.zip",
        "ebc236f5f6c08c7e5c5750476a187d24805d44d8c680449c4b7369c333f817b1",
        "gltfpack",
    ),
    ("Windows", "AMD64"): (
        "gltfpack-windows.zip",
        "52e0c061d8b42f1c6bd8fe1cbc1e26a9da579ad5a4f5dd30a8ee0d599062f6c4",
        "gltfpack.exe",
    ),
}


def repository_root() -> Path:
    return Path(__file__).resolve().parents[2]


def default_output_path() -> Path:
    executable = "gltfpack.exe" if os.name == "nt" else "gltfpack"
    return (
        repository_root()
        / ".cache"
        / "biomes-tools"
        / "gltfpack"
        / GLTFPACK_VERSION
        / executable
    )


def current_archive() -> tuple[str, str, str]:
    system = platform.system()
    machine = platform.machine()
    aliases = {"aarch64": "arm64", "amd64": "x86_64"}
    if system != "Windows":
        machine = aliases.get(machine.lower(), machine)
    archive = ARCHIVES.get((system, machine))
    if archive is None:
        supported = ", ".join(f"{name}/{arch}" for name, arch in ARCHIVES)
        raise RuntimeError(
            f"No official gltfpack {GLTFPACK_VERSION} build for "
            f"{system}/{machine}. Supported platforms: {supported}."
        )
    return archive


def executable_version(path: Path) -> str | None:
    if not path.is_file():
        return None
    try:
        result = subprocess.run(
            [str(path), "-v"], check=True, capture_output=True, text=True
        )
    except (OSError, subprocess.CalledProcessError):
        return None
    return (result.stdout or result.stderr).strip()


def install(output: Path, force: bool = False) -> Path:
    expected_version = f"gltfpack {GLTFPACK_VERSION}"
    if not force and executable_version(output) == expected_version:
        print(f"Using pinned native {expected_version}: {output}")
        return output

    archive_name, expected_sha256, executable_name = current_archive()
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="biomes-gltfpack-") as temp_dir:
        archive_path = Path(temp_dir) / archive_name
        request = urllib.request.Request(
            f"{RELEASE_BASE_URL}/{archive_name}",
            headers={"User-Agent": "biomes-gltfpack-installer"},
        )
        with urllib.request.urlopen(request) as response, open(
            archive_path, "wb"
        ) as archive_file:
            shutil.copyfileobj(response, archive_file)

        actual_sha256 = hashlib.sha256(archive_path.read_bytes()).hexdigest()
        if actual_sha256 != expected_sha256:
            raise RuntimeError(
                f"Checksum mismatch for {archive_name}: expected "
                f"{expected_sha256}, got {actual_sha256}."
            )

        with zipfile.ZipFile(archive_path) as archive:
            if set(archive.namelist()) != {executable_name}:
                raise RuntimeError(
                    f"Unexpected {archive_name} contents: "
                    f"{sorted(archive.namelist())}"
                )
            extracted = Path(temp_dir) / executable_name
            with archive.open(executable_name) as source, open(
                extracted, "wb"
            ) as destination:
                shutil.copyfileobj(source, destination)

        executable_mode = (
            extracted.stat().st_mode
            | stat.S_IXUSR
            | stat.S_IXGRP
            | stat.S_IXOTH
        )
        extracted.chmod(executable_mode)
        temporary_output = output.with_name(f".{output.name}.installing")
        shutil.copyfile(extracted, temporary_output)
        temporary_output.chmod(executable_mode)
        os.replace(temporary_output, output)

    actual_version = executable_version(output)
    if actual_version != expected_version:
        raise RuntimeError(
            f"Expected '{expected_version}' from {output}, got "
            f"'{actual_version}'."
        )
    print(f"Installed pinned native {expected_version}: {output}")
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=default_output_path())
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    install(args.output.resolve(), args.force)


if __name__ == "__main__":
    main()
