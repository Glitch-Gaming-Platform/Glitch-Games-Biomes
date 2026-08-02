import os
import platform
import re
import shutil
import subprocess
import sys
from sysconfig import get_config_var, get_path

from setuptools import Extension, setup
from setuptools.command.build_ext import build_ext


def win_path(path):
    match = re.match("(/(cygdrive/)?)(.*)", path)
    if not match:
        return path.replace("/", "\\")
    dirs = match.group(3).split("/")
    dirs[0] = f"{dirs[0].upper()}:"
    return "\\".join(dirs)


def platform_args(common_args=[], windows_args=[], posix_args=[]):
    if platform.system() == "Windows":
        return common_args + windows_args
    else:
        return common_args + posix_args


python_module_extension = "so" if platform.system() != "Windows" else "pyd"


class BazelExtension(Extension):
    """Provides a CPython extension build via Bazel."""

    def __init__(self, name, target, output):
        Extension.__init__(self, name, sources=[])
        self.target = target
        self.output = output


class BazelBuild(build_ext):
    """Build comand used to build extensions."""

    def run(self):
        # Fail if the required cmake version is not available.
        try:
            subprocess.check_output(["bazel", "--version"])
        except:
            # For some reason, at least on Windows, if the above line results
            # in an error we don't get a call stack or helpful errors, so
            # explicitly catch and rethrow.
            raise RuntimeError(
                "There was a problem running Bazel, is it installed?"
            )

        # Build each extension.
        for ext in self.extensions:
            self.build_extension(ext)

    def build_extension(self, ext):
        # Load default environment variables and set CXXFLAGS to match Python install.
        env = os.environ.copy()
        env["CXXFLAGS"] = (
            env.get("CXXFLAGS", "")
            + f' -DVERSION_INFO=\\"{self.distribution.get_version()}\\"'
        )

        if "PYTHON_LIB_PATH" not in env:
            env["PYTHON_LIB_PATH"] = get_path("purelib")

        if "PYTHON_BIN_PATH" not in env:
            env["PYTHON_BIN_PATH"] = sys.executable

        # The `--batch` switch is included because without it the lingering
        # bazel process will setup file watches that prevent setuptools from
        # removing the temporary directory that we build within, on Windows
        # at least.
        bazel_build_command = ["bazel", "--batch", "build"]
        if os.environ.get("BIOMES_BAZEL_NO_CACHE") == "1":
            bazel_build_command += ["--config=no-remote-cache"]

        # Bazel otherwise targets the host macOS SDK (for example macOS 26)
        # instead of the minimum version supported by the selected CPython.
        # That produces a loadable extension with an incompatible wheel tag,
        # which modern pip correctly rejects during `pip check`.
        if platform.system() == "Darwin":
            deployment_target = get_config_var("MACOSX_DEPLOYMENT_TARGET")
            if deployment_target:
                env["MACOSX_DEPLOYMENT_TARGET"] = deployment_target
                bazel_build_command += [
                    f"--macos_minimum_os={deployment_target}",
                    f"--host_macos_minimum_os={deployment_target}",
                ]

        # Add platform specific arguments.
        bazel_build_command += platform_args(
            windows_args=["--config=windows_release"],
            posix_args=["--config=release"],
        )

        # A bit of a hack so that we can still run bazel in its original
        # folder despite the fact that setuptools moves this script and its
        # folder into a temporary to run it.
        run_dir = (
            os.environ["PWD"]
            if platform.system() != "Windows"
            else win_path(os.environ["PWD"])
        )
        run_dir = os.path.abspath(run_dir)
        workspace_markers = ("MODULE.bazel", "WORKSPACE.bazel")
        if not any(
            os.path.exists(os.path.join(run_dir, marker))
            for marker in workspace_markers
        ):
            raise RuntimeError(
                "Run 'pip install' from a Bazel workspace containing "
                "MODULE.bazel or WORKSPACE.bazel."
            )

        subprocess.check_call(
            args=bazel_build_command + [ext.target],
            cwd=run_dir,
            env=env,
        )

        # Make sure that the output directory exists.
        python_extension_dir = os.path.abspath(
            os.path.dirname(self.get_ext_fullpath(ext.name))
        )
        os.makedirs(python_extension_dir, exist_ok=True)
        print(f"Copying extension files into {python_extension_dir}...")
        shutil.copyfile(
            src=os.path.join(run_dir, "bazel-bin", ext.output),
            dst=os.path.join(
                python_extension_dir,
                f"{ext.name}.{python_module_extension}",
            ),
        )


setup(
    name="voxeloo",
    version="0.2",
    author="Taylor Gordon, Thomas Dimson",
    description="Voxeloo python library",
    long_description="",
    ext_modules=[
        BazelExtension(
            "voxeloo",
            "//voxeloo/py_ext:py_ext.so",
            "voxeloo/py_ext/py_ext.so",
        ),
    ],
    cmdclass={"build_ext": BazelBuild},
    install_requires=[],
    zip_safe=False,
)
