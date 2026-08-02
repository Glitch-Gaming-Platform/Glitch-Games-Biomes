#!/usr/bin/env python3

import os
import sys
from pathlib import Path

import clang_format


def main() -> None:
    binary = Path(clang_format.__file__).parent / "data" / "bin" / "clang-format"
    if not binary.is_file():
        raise RuntimeError(f"clang-format wheel binary is missing: {binary}")
    os.execv(str(binary), [str(binary), *sys.argv[1:]])


if __name__ == "__main__":
    main()
