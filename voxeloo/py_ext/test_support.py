import importlib.util
import os
from pathlib import Path


def load_extension():
    runfiles = Path(os.environ["TEST_SRCDIR"]) / os.environ["TEST_WORKSPACE"]
    extension = runfiles / "voxeloo/py_ext/py_ext.so"
    if not extension.exists():
        raise FileNotFoundError(f"Missing pybind extension: {extension}")
    spec = importlib.util.spec_from_file_location("voxeloo", extension)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load pybind extension: {extension}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
