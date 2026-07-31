#include "voxeloo/biomes/migration.hpp"

#include <catch2/catch.hpp>
#include <optional>
#include <vector>

#include "voxeloo/biomes/biomes.hpp"
#include "voxeloo/common/geometry.hpp"
#include "voxeloo/tensors/tensors.hpp"

namespace voxeloo::biomes::migration {

TEST_CASE("Tensor migration from runs fills gaps and chunk tail", "[all]") {
  std::vector<Run<uint32_t>> runs{
      {tensors::encode_tensor_pos({0, 0, 0}), 2, 7},
      {tensors::encode_tensor_pos({4, 0, 0}), 1, 9},
  };
  auto tensor = tensor_from_runs(std::move(runs));

  REQUIRE(tensor.shape == tensors::kChunkShape);
  REQUIRE(tensor.get({0, 0, 0}) == 7);
  REQUIRE(tensor.get({1, 0, 0}) == 7);
  REQUIRE(tensor.get({2, 0, 0}) == 0);
  REQUIRE(tensor.get({4, 0, 0}) == 9);
  REQUIRE(tensor.get({31, 31, 31}) == 0);
}

TEST_CASE("Volume block migration preserves values and empty voxels", "[all]") {
  VolumeBlock<uint32_t> block;
  block.set(31, 0, 0, 3);
  block.set(0, 31, 0, 5);
  block.set(0, 0, 31, 7);
  block.set(17, 13, 11, 9);

  auto tensor = tensor_from_volume_block(block);

  REQUIRE(tensor.get({31, 0, 0}) == 3);
  REQUIRE(tensor.get({0, 31, 0}) == 5);
  REQUIRE(tensor.get({0, 0, 31}) == 7);
  REQUIRE(tensor.get({17, 13, 11}) == 9);
  REQUIRE(tensor.get({1, 1, 1}) == 0);
}

TEST_CASE("Sparse block migration preserves optional updates", "[all]") {
  SparseBlock<TerrainId> block;
  block.set(3, 2, 1, 17);
  block.set(31, 31, 31, 23);

  auto tensor = tensor_from_sparse_block(block);

  REQUIRE(tensor.get({3, 2, 1}) == std::optional<TerrainId>(17));
  REQUIRE(tensor.get({31, 31, 31}) == std::optional<TerrainId>(23));
  REQUIRE(tensor.get({0, 0, 0}) == std::nullopt);
}

}  // namespace voxeloo::biomes::migration
