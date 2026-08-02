import os
import subprocess
import tempfile
from pathlib import Path

import pygltflib


GLTFPACK_VERSION = "1.2"
REPOSITORY_ROOT = Path(__file__).resolve().parents[5]
NATIVE_GLTFPACK_PATH = (
    REPOSITORY_ROOT
    / ".cache"
    / "biomes-tools"
    / "gltfpack"
    / GLTFPACK_VERSION
    / ("gltfpack.exe" if os.name == "nt" else "gltfpack")
)


def gltfpack_command(texture_mode: str) -> list[str]:
    override = os.environ.get("BIOMES_GLTFPACK")
    if override:
        executable = Path(override)
        if not executable.is_file():
            raise RuntimeError(f"BIOMES_GLTFPACK does not exist: {executable}")
        return [str(executable)]
    if NATIVE_GLTFPACK_PATH.is_file():
        return [str(NATIVE_GLTFPACK_PATH)]
    if texture_mode == "legacy":
        # The npm/WebAssembly build can still provide emergency mesh-only
        # compression, but it is compiled without BasisU support.
        return ["yarn", "gltfpack"]
    raise RuntimeError(
        "KTX2 compression requires the pinned native gltfpack build. Run "
        "`npm run assets:install-gltfpack`, or set BIOMES_GLTFPACK to a "
        "reviewed native gltfpack 1.2 executable."
    )


# TODO(top): The fact that we're shelling out here to a subprocess isn't
#            excellent:
#
#              1. The subprocess interfaces through files, so we need to create
#                 temporary files, introducing a dependency on the filesystem.
#              2. It introduces a difficult-to-track dependency on the
#                 environment in that the `gltfpack` yarn command needs to be
#                 available.
#
#            However, Python doesn't really offer any options for glTF
#            compression libraries. The ideal solution would have us depend on
#            the C++ library that backs gltfpack, https://meshoptimizer.org/,
#            and call it directly here. Because we don't currently have a
#            great setup here for arbitrary C++ <-> Python interaction
#            (especially for C++ libraries that have nothing to do with Python).
#
#            Additionally, for concern 1 above, we do cleanup the files
#            afterwards, and for concern 2 we do test this function in our CI
#            tests, this seems like a reasonable solution for the near term.
def compress_gltf(gltf: pygltflib.GLTF2) -> bytes:
    gltf_bytes = gltf.gltf_to_json()
    with tempfile.TemporaryDirectory() as temp_dir:
        GLTF_FILE_NAME = Path(temp_dir) / "to_compress.gltf"
        GLB_FILE_NAME = Path(temp_dir) / "compressed.glb"

        with open(GLTF_FILE_NAME, "w") as gltf_file:
            gltf_file.write(gltf_bytes)

        # If we're on Windows, run this through a shell or else it can't
        # find yarn.
        useShell = os.name == "nt"

        texture_mode = os.environ.get("BIOMES_GLTFPACK_TEXTURE_MODE", "ktx2")
        cmd = gltfpack_command(texture_mode) + [
            "-i",
            str(GLTF_FILE_NAME),
            "-o",
            str(GLB_FILE_NAME),
            "-kn",  # Don't prune empty nodes, used as attachment points.
            "-c",  # EXT_meshopt_compression; decoded by the shared GLTF loader.
        ]
        if texture_mode != "legacy":
            # ETC1S gives color maps a strong size reduction. UASTC avoids the
            # block artifacts that ETC1S can introduce in normal/data maps.
            cmd.extend(["-tc", "color", "-tu", "normal,attrib", "-tq", "8"])
        subprocess.run(
            cmd,
            check=True,
            stdout=subprocess.DEVNULL,
            shell=useShell,
        )

        if not GLB_FILE_NAME.is_file() or GLB_FILE_NAME.stat().st_size == 0:
            raise RuntimeError("gltfpack completed without producing a non-empty GLB")

        with open(GLB_FILE_NAME, "rb") as glb_file:
            out_bytes = glb_file.read()
            return out_bytes
