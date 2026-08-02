load("@bazel_tools//tools/build_defs/repo:git.bzl", "git_repository")
load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")


def _legacy_repositories_impl(_module_ctx):
    # Libraries with fork-specific BUILD overlays remain pinned while the
    # requested compiler/toolchain layers move to Bazel 9 and bzlmod.
    http_archive(
        name = "cereal",
        build_file = "//voxeloo/third_party:cereal.BUILD",
        patch_args = ["-p1"],
        patches = ["//bzlmod:cereal-emscripten6-clang.patch"],
        sha256 = "16a7ad9b31ba5880dac55d62b5d6f243c3ebc8d46a3514149e56b5e7ea81f85f",
        strip_prefix = "cereal-1.3.2",
        urls = ["https://github.com/USCiLab/cereal/archive/refs/tags/v1.3.2.tar.gz"],
    )

    http_archive(
        name = "catch2",
        sha256 = "06dbc7620e3b96c2b69d57bf337028bf245a211b3cddb843835bfe258f427a52",
        strip_prefix = "Catch2-2.13.9",
        urls = ["https://github.com/catchorg/Catch2/archive/v2.13.9.tar.gz"],
    )

    http_archive(
        name = "eigen",
        build_file = "//voxeloo/third_party:eigen.BUILD",
        sha256 = "b4c198460eba6f28d34894e3a5710998818515104d6e74e5cc331ce31e46e626",
        strip_prefix = "eigen-3.4.0",
        urls = ["https://gitlab.com/libeigen/eigen/-/archive/3.4.0/eigen-3.4.0.tar.bz2"],
    )

    http_archive(
        name = "robin-hood-hashing",
        build_file = "//voxeloo/third_party:robin-hood-hashing.BUILD",
        sha256 = "3693e44dda569e9a8b87ce8263f7477b23af448a3c3600c8ab9004fe79c20ad0",
        strip_prefix = "robin-hood-hashing-3.11.5",
        urls = ["https://github.com/martinus/robin-hood-hashing/archive/refs/tags/3.11.5.tar.gz"],
    )

    http_archive(
        name = "zstd",
        build_file = "//voxeloo/third_party:zstd.BUILD",
        sha256 = "a364f5162c7d1a455cc915e8e3cf5f4bd8b75d09bc0f53965b0c9ca1383c52c8",
        strip_prefix = "zstd-1.4.4",
        urls = ["https://github.com/facebook/zstd/archive/v1.4.4.tar.gz"],
    )

    http_archive(
        name = "opensimplex",
        build_file = "//voxeloo/third_party:opensimplex.BUILD",
        sha256 = "d97474d870360f38774e434664992ed45de37eae6675e873372fe2ee43dd02f2",
        strip_prefix = "OpenSimplexNoise-026c5d8d6b4921f37f0caf94a698ace33f0f6801",
        urls = ["https://github.com/deerel/OpenSimplexNoise/archive/026c5d8d6b4921f37f0caf94a698ace33f0f6801.tar.gz"],
    )

    http_archive(
        name = "com_github_jupp0r_prometheus_cpp",
        patch_args = ["-p1"],
        patches = ["//voxeloo/third_party:prometheus.patch"],
        sha256 = "281b6d9a26da35375c9958954e03616d71ea28d57ec193b0e75c3e10ff3da55d",
        strip_prefix = "prometheus-cpp-1.0.1",
        urls = ["https://github.com/jupp0r/prometheus-cpp/archive/refs/tags/v1.0.1.zip"],
    )

    http_archive(
        name = "hedron_compile_commands",
        patch_args = ["-p1"],
        patches = ["//bzlmod:hedron-bazel9-python-rule.patch"],
        sha256 = "1b08abffbfbe89f6dbee6a5b33753792e8004f6a36f37c0f72115bec86e68724",
        strip_prefix = "bazel-compile-commands-extractor-abb61a688167623088f8768cc9264798df6a9d10",
        urls = ["https://github.com/hedronvision/bazel-compile-commands-extractor/archive/abb61a688167623088f8768cc9264798df6a9d10.tar.gz"],
    )

    git_repository(
        name = "bazel_clang_tidy",
        commit = "c4d35e0d0b838309358e57a2efed831780f85cd0",
        remote = "https://github.com/erenon/bazel_clang_tidy.git",
    )

    http_archive(
        name = "glslang",
        patch_args = ["-p1"],
        patches = ["//voxeloo/third_party:glslang.patch"],
        sha256 = "7cb45842ec1d4b6ea775d624c3d2d8ba9450aa416b0482b0cc7e4fdd399c3d75",
        strip_prefix = "glslang-12.0.0",
        urls = ["https://github.com/KhronosGroup/glslang/archive/refs/tags/12.0.0.tar.gz"],
    )


legacy_repositories = module_extension(
    implementation = _legacy_repositories_impl,
)
