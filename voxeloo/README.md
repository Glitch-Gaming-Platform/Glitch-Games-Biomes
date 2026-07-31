# Voxeloo

Voxeloo is the native C++ library behind Biomes voxel storage, tensors, geometry, terrain simulation, mapping, Anima surface extraction, and asset processing. It is consumed through native C++ APIs, Emscripten/Embind WebAssembly bindings, and a pybind11 Python extension.

Architecture and upgrade documentation:

- `docs/docs/basics/voxeloo.md`: system overview and application integration;
- `docs/docs/voxeloo/native-modules.md`: package ownership and native invariants;
- `docs/docs/voxeloo/bindings-and-testing.md`: Embind, pybind, memory ownership, and the test matrix.

## Building WebAssembly

From the Biomes repository root:

```shell
scripts/build_wasm.sh -t all
```

This builds the normal and SIMD variants used by the generated TypeScript loaders. Treat the C++ implementation, Embind registration, generated loader, `.wasm` file, TypeScript declarations, and wrappers as one compatibility unit.

## Working in C++

## Setup

1. Install Bazel, https://bazel.build/install

   - OSX
     - This will be `brew install bazelisk` (or `port install bazelisk`).
   - Windows

     - Recommended to install the latest binary release of bazelisk
       (https://github.com/bazelbuild/bazelisk/releases) and then
       manually add it to your Windows `PATH`.
       Installing via `npm` results in issues with `pip install` not being
       able to find the Bazel binary
     - if running through Git Bash, you will need to `export MSYS_NO_PATHCONV=1`.
     - you will likely also need to point `PYTHON_BIN_PATH` and/or
       `PYTHON_LIB_PATH` to your Python executable, e.g.:
       ```
       export PYTHON_BIN_PATH=C:/Python39/python.exe
       export PYTHON_LIB_PATH=C:/Python39/Lib/
       ```
     - You may also need to point `BAZEL_VC` to your visual C++ install
       directory, e.g.:
       ```
       export BAZEL_VC="C:/Program Files (x86)/Microsoft Visual Studio/2019/BuildTools/VC"
       ```

2. Install the VSCode 'clangd' extension
3. When prompted, disable Intellisense in favour of clangd.

The following commands are run from the repository root.

### Running tests

```shell
bazel test //voxeloo/...
./b test -p 'src/shared/wasm/test/*.test.ts'
```

The Bazel suite includes native Catch2 tests and three Python boundary tests that load the built `py_ext.so` and cover every exported submodule. The TypeScript suite loads both WebAssembly variants and checks runtime exports, behavior parity, mapping integration, and native-object cleanup.

### Building everything

```shell
bazel build //voxeloo/...
```

### Installing the Python extension

```shell
pip install ./voxeloo
```

The Python boundary uses NumPy arrays and binary Python `bytes`. Tensor arrays use `[z, y, x]` shape order and native tensor conversion pads dimensions to 32-voxel chunk boundaries. See the binding documentation before changing layouts or return types.
