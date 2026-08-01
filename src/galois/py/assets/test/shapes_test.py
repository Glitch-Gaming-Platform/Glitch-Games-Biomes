import unittest

import numpy as np
from impl import shapes
from impl import types as t


class ShapesTestCase(unittest.TestCase):
    def test_full_and_empty_shape_occlusion_masks(self):
        full = shapes.Isomorphism(np.ones((8, 8, 8), dtype=bool))
        empty = shapes.Isomorphism(np.zeros((8, 8, 8), dtype=bool))

        self.assertEqual(shapes.generate_occlusion_mask(full), 0b111111)
        self.assertEqual(shapes.generate_occlusion_mask(empty), 0)

    def test_shape_index_includes_named_and_void_shapes(self):
        full = t.BlockShape(mask=np.ones((8, 8, 8), dtype=bool))

        index = shapes.to_index([[1, "full", full]])

        self.assertEqual(index.ids, {"void": 0, "full": 1})
        encoded = index.impl.dumps()
        index.impl.loads(encoded)
