#include "voxeloo/anima/find_surfaces.hpp"

#include <catch2/catch.hpp>
#include <tuple>
#include <vector>

#include "voxeloo/common/geometry.hpp"
#include "voxeloo/tensors/sparse.hpp"
#include "voxeloo/tensors/tensors.hpp"

using Catch::Matchers::UnorderedEquals;

namespace voxeloo::anima {
namespace {

auto extract(const std::vector<SurfacePoint>& points) {
  std::vector<std::tuple<Vec3i, TerrainId>> out;
  for (const auto& point : points) {
    out.emplace_back(point.position, point.terrain_id);
  }
  return out;
}

TerrainTensor make_terrain(
    std::initializer_list<std::tuple<Vec3u, TerrainId>> entries) {
  tensors::SparseTensorBuilder<TerrainId> builder(tensors::kChunkShape);
  for (const auto& [position, terrain_id] : entries) {
    builder.set(position, terrain_id);
  }
  return std::move(builder).build();
}

}  // namespace

TEST_CASE("Find surfaces handles empty terrain", "[all]") {
  auto terrain = tensors::make_tensor<TerrainId>(tensors::kChunkShape);
  REQUIRE(find_surfaces(terrain).empty());
}

TEST_CASE("Find surfaces returns only exposed terrain", "[all]") {
  auto terrain = make_terrain({
      {{1, 0, 1}, 10},
      {{2, 0, 2}, 20},
      {{2, 1, 2}, 21},
      {{4, 10, 4}, 40},
      {{4, 11, 4}, 41},
      {{4, 12, 4}, 42},
  });

  REQUIRE_THAT(
      extract(find_surfaces(terrain)),
      UnorderedEquals(std::vector<std::tuple<Vec3i, TerrainId>>{
          {{1, 0, 1}, 10},
          {{2, 1, 2}, 21},
          {{4, 12, 4}, 42},
      }));
}

TEST_CASE("Find surfaces excludes the shard top boundary", "[all]") {
  auto terrain = make_terrain({
      {{3, 30, 3}, 30},
      {{5, 31, 5}, 31},
      {{7, 30, 7}, 70},
      {{7, 31, 7}, 71},
  });

  REQUIRE_THAT(
      extract(find_surfaces(terrain)),
      UnorderedEquals(std::vector<std::tuple<Vec3i, TerrainId>>{
          {{3, 30, 3}, 30},
      }));
}

}  // namespace voxeloo::anima
