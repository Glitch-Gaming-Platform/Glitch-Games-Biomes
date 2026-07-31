#include "voxeloo/mapping/heights.hpp"

#include <catch2/catch.hpp>
#include <unordered_set>

#include "voxeloo/common/geometry.hpp"
#include "voxeloo/galois/terrain.hpp"
#include "voxeloo/tensors/sparse.hpp"
#include "voxeloo/tensors/tensors.hpp"

namespace voxeloo::mapping {
namespace {

template <typename T>
auto make_tensor(
    Vec3u shape, std::initializer_list<std::tuple<Vec3u, T>> entries) {
  tensors::SparseTensorBuilder<T> builder(shape);
  for (const auto& [position, value] : entries) {
    builder.set(position, value);
  }
  return std::move(builder).build();
}

}  // namespace

TEST_CASE(
    "Height builder applies filters and keeps maximum terrain heights",
    "[all]") {
  using galois::terrain::from_block_id;
  using galois::terrain::from_flora_id;

  const auto block = from_block_id(7);
  const auto ignored_block = from_block_id(9);
  const auto flora = from_flora_id(11);
  const auto ignored_flora = from_flora_id(13);

  HeightsBuilder builder({10, -4, 20}, {4, 3}, {block}, {flora});
  auto terrain = make_tensor<uint32_t>(
      {4, 8, 3},
      {
          {{1, 1, 1}, block},
          {{1, 6, 1}, block},
          {{2, 4, 0}, flora},
          {{0, 7, 2}, ignored_block},
          {{3, 7, 2}, ignored_flora},
      });
  builder.load_terrain({10, -4, 20}, terrain);
  auto heights = builder.build();

  REQUIRE(heights.block.get({1, 1}) == 7);
  REQUIRE(heights.flora.get({2, 0}) == 5);
  REQUIRE(heights.block.get({0, 2}) == 0);
  REQUIRE(heights.flora.get({3, 2}) == 0);
}

TEST_CASE(
    "Height builder offsets shards and combines water and muck", "[all]") {
  HeightsBuilder builder({100, 10, -50}, {4, 4}, {}, {});
  auto water = make_tensor<uint8_t>(
      {2, 4, 2},
      {
          {{0, 0, 0}, 1},
          {{0, 3, 0}, 2},
      });
  auto muck = make_tensor<uint8_t>(
      {2, 4, 2},
      {
          {{1, 1, 1}, 3},
      });

  builder.load_water({102, 15, -49}, water);
  builder.load_muck({101, 12, -48}, muck);
  auto heights = builder.build();

  REQUIRE(heights.water.get({2, 1}) == 9);
  REQUIRE(heights.muck.get({2, 3}) == 4);
  REQUIRE(heights.block.get({2, 1}) == 0);
  REQUIRE(heights.flora.get({2, 1}) == 0);
}

TEST_CASE("Height builder rejects data outside the requested tile", "[all]") {
  HeightsBuilder builder({0, 0, 0}, {2, 2}, {}, {});
  auto water = make_tensor<uint8_t>({1, 1, 1}, {{{0, 0, 0}, 1}});

  REQUIRE_THROWS_AS(
      builder.load_water({2, 0, 0}, water), std::invalid_argument);
  REQUIRE_THROWS_AS(
      builder.load_muck({0, 0, -1}, water), std::invalid_argument);
}

}  // namespace voxeloo::mapping
