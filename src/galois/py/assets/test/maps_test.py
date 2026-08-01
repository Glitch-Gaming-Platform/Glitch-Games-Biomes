import unittest

import numpy as np
from impl import maps


class MapsTestCase(unittest.TestCase):
    def test_compress_preserves_xyz_origin_for_zyx_storage(self):
        values = np.zeros(shape=(5, 6, 7), dtype=np.uint32)
        values[2, 3, 4] = 9
        values[3, 4, 5] = 10

        compressed = maps.Map(origin=(10, 20, 30), values=values).compress()

        np.testing.assert_array_equal(compressed.origin, [14, 23, 32])
        self.assertEqual(compressed.values.shape, (2, 2, 2))
        self.assertEqual(compressed.values[0, 0, 0], 9)
        self.assertEqual(compressed.values[1, 1, 1], 10)

    def test_sparse_coordinates_are_emitted_as_xyzw(self):
        values = np.zeros(shape=(2, 2, 3), dtype=np.uint8)
        values[1, 0, 2] = 7

        coordinates = maps.to_sparse_coords(
            maps.Map(origin=(4, 5, 6), values=values)
        )

        np.testing.assert_array_equal(coordinates, [[6, 5, 7, 7]])

    def test_align_maps_preserves_values_in_world_coordinates(self):
        lhs = maps.Map(
            origin=(0, 0, 0), values=np.ones((1, 1, 2), dtype=np.uint8)
        )
        rhs = maps.Map(
            origin=(2, 0, 0), values=np.full((1, 1, 2), 2, dtype=np.uint8)
        )

        aligned_lhs, aligned_rhs = maps.align_maps(lhs, rhs)

        self.assertEqual(aligned_lhs.values.shape, (1, 1, 4))
        np.testing.assert_array_equal(aligned_lhs.values, [[[1, 1, 0, 0]]])
        np.testing.assert_array_equal(aligned_rhs.values, [[[0, 0, 2, 2]]])
