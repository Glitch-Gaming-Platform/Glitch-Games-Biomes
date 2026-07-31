import unittest

import numpy as np

from voxeloo.py_ext.test_support import load_extension


class VoxelooPythonGaloisBindingsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.voxeloo = load_extension()
        cls.galois = cls.voxeloo.galois

    def make_block_index(self):
        builder = self.galois.blocks.IndexBuilder(1, 0)
        builder.add_block(0, [(("white", 0, "none", "zero"), 7)])
        builder.add_block(1, [(("white", 0, "none", "zero"), 8)])
        return builder.build()

    def make_flora_index(self):
        vertex = self.galois.florae.QuadVertex([0, 0, 0], [0, 1, 0], [0, 0], 2.0, 4)
        quads = self.galois.florae.Quads(
            [vertex, vertex, vertex, vertex], [0, 1, 2, 0, 2, 3]
        )
        builder = self.galois.florae.IndexBuilder()
        builder.set_fallback(1)
        builder.add_samples(1, [(0, ("adult", "none"))])
        builder.set_animation(1, "none", "none")
        builder.add_quads(0, quads)
        return builder.build()

    def make_shape_index(self):
        quads_builder = self.galois.shapes.QuadsBuilder()
        quads_builder.add(
            [[0, 0, 0]], self.voxeloo.voxels.X_POS, self.galois.shapes.MACRO
        )
        boxes_builder = self.galois.shapes.BoxesBuilder()
        boxes_builder.add([0, 0, 0], 1)
        wireframe_builder = self.galois.shapes.WireframeMeshBuilder()
        wireframe_builder.add_triangles([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [0, 1, 2])

        builder = self.galois.shapes.IndexBuilder(1)
        offset = builder.add_isomorphism(
            quads_builder.build(),
            boxes_builder.build(),
            wireframe_builder.build(),
            3,
            [False] * 512,
        )
        isomorphism_id = self.galois.shapes.to_isomorphism_id(1, 0)
        builder.set_offset(0, offset)
        builder.set_offset(isomorphism_id, offset)
        return builder.build(), isomorphism_id

    def test_exports_every_galois_submodule(self):
        for name in [
            "blocks",
            "csg",
            "florae",
            "groups",
            "lighting",
            "material_properties",
            "sbo",
            "shapes",
            "terrain",
            "transforms",
            "water",
        ]:
            with self.subTest(module=name):
                self.assertTrue(hasattr(self.galois, name))

    def test_csg_supports_every_bound_type_and_operation(self):
        supported = {
            "Bool": np.bool_,
            "I8": np.int8,
            "I16": np.int16,
            "I32": np.int32,
            "U8": np.uint8,
            "U16": np.uint16,
            "U32": np.uint32,
        }
        mask = self.voxeloo.tensors.Tensor_Bool([2, 2, 2], False)
        mask.assign(
            np.array([[0, 0, 0]], dtype=np.int32),
            np.array([True], dtype=np.bool_),
        )
        for suffix, dtype in supported.items():
            with self.subTest(tensor_type=suffix):
                value = True if suffix == "Bool" else 3
                replacement = True if suffix == "Bool" else 9
                tensor = getattr(self.voxeloo.tensors, f"Tensor_{suffix}")(
                    [2, 2, 2], value
                )
                self.assertEqual(self.galois.csg.clear(tensor, mask).get(0, 0, 0), 0)
                self.assertEqual(self.galois.csg.slice(tensor, mask).get(1, 0, 0), 0)
                self.assertEqual(
                    self.galois.csg.write(tensor, mask, replacement).get(0, 0, 0),
                    replacement,
                )

                right = getattr(self.voxeloo.tensors, f"Tensor_{suffix}")([2, 2, 2], 0)
                right.assign(
                    np.array([[1, 0, 0]], dtype=np.int32),
                    np.array([replacement], dtype=dtype),
                )
                self.assertEqual(
                    self.galois.csg.merge(tensor, right).get(1, 0, 0), replacement
                )

    def test_tensor_transforms_shift_permute_reflect_compose_and_apply(self):
        shifted = self.galois.transforms.shift(2, 3, 4)
        self.assertEqual(shifted.shift, [2, 3, 4])
        permuted = self.galois.transforms.permute(2, 1, 0)
        self.assertEqual(permuted.permute, [2, 1, 0])
        reflected = self.galois.transforms.reflect(True, False, False)
        self.assertEqual(reflected.reflect, [True, False, False])
        composed = self.galois.transforms.compose(shifted, reflected)
        self.assertEqual(len(composed.shift), 3)

        tensor = self.voxeloo.tensors.Tensor_U8([2, 3, 4], 0)
        tensor.assign(
            np.array([[1, 2, 3]], dtype=np.int32),
            np.array([7], dtype=np.uint8),
        )
        shifted_array = self.galois.transforms.apply(tensor, shifted).array()
        np.testing.assert_array_equal(np.argwhere(shifted_array == 7), [[7, 5, 3]])
        permuted_array = self.galois.transforms.apply(tensor, permuted).array()
        np.testing.assert_array_equal(np.argwhere(permuted_array == 7), [[1, 2, 3]])
        reflected_array = self.galois.transforms.apply(tensor, reflected).array()
        np.testing.assert_array_equal(np.argwhere(reflected_array == 7), [[3, 2, 30]])

    def test_terrain_ids_extractors_water_surface_and_geometry(self):
        cases = [
            ("block", "to_blocks"),
            ("flora", "to_florae"),
            ("glass", "to_glass"),
        ]
        for kind, extractor_name in cases:
            with self.subTest(terrain_kind=kind):
                encode = getattr(self.galois.terrain, f"from_{kind}_id")
                validate = getattr(self.galois.terrain, f"is_valid_{kind}_id")
                encoded = encode(17)
                self.assertTrue(validate(17))
                extracted = getattr(self.galois.terrain, extractor_name)(
                    self.voxeloo.tensors.Tensor_U32([1, 1, 1], encoded)
                )
                self.assertEqual(extracted.get(0, 0, 0), 17)

        water = self.voxeloo.tensors.Tensor_U8([2, 2, 2], 0)
        water.assign(
            np.array([[0, 0, 0]], dtype=np.int32),
            np.array([15], dtype=np.uint8),
        )
        surface = self.galois.water.to_surface(water)
        self.assertGreater(np.count_nonzero(surface.array()), 0)
        geometry = self.galois.water.to_geometry(water)
        self.assertGreater(len(geometry.vertices), 0)
        self.assertGreater(len(geometry.indices), 0)
        self.assertEqual(len(geometry.origin), 3)
        self.assertEqual(len(geometry.vertices[0].pos), 3)
        self.assertEqual(len(geometry.vertices[0].uv), 2)
        self.assertGreater(len(geometry.vertex_data()), 0)
        self.assertGreater(len(geometry.index_data()), 0)

    def test_block_index_sampling_material_and_validation(self):
        index = self.make_block_index()
        index.loads(index.dumps())
        sampler = index.get_sampler(1)
        self.assertEqual(sampler.get(0).count, 1)
        self.assertEqual(sampler.get(0).offsets[0], 8)

        terrain = self.voxeloo.tensors.Tensor_U32([1, 1, 1], 0)
        terrain.assign(
            np.array([[0, 0, 0]], dtype=np.int32),
            np.array([1], dtype=np.uint32),
        )
        dye = self.voxeloo.tensors.Tensor_U8([1, 1, 1], 0)
        muck = self.voxeloo.tensors.Tensor_U8([1, 1, 1], 0)
        moisture = self.voxeloo.tensors.Tensor_U8([1, 1, 1], 0)
        self.assertEqual(
            self.galois.blocks.to_surface_tensor(terrain, muck).get(0, 0, 0), 1
        )
        self.assertEqual(
            self.galois.blocks.to_block_sample_tensor(
                terrain, dye, muck, moisture, index
            ).get(0, 0, 0),
            9,
        )

        material = self.galois.blocks.to_material_buffer(terrain, dye, muck)
        self.assertEqual(len(material.rank.shape), 2)
        self.assertEqual(len(material.data.shape), 2)
        self.assertEqual(len(material.rank.view()), 4 * len(material.rank.data))
        self.assertEqual(len(material.data.view()), 4 * len(material.data.data))

        with self.assertRaises(ValueError):
            self.galois.blocks.IndexBuilder(0, 1)
        invalid = self.galois.blocks.IndexBuilder(1, 0)
        invalid.add_block(1, [(("white", 0, "none", "zero"), 8)])
        with self.assertRaises(ValueError):
            invalid.build()

    def test_flora_index_serialization_samples_and_geometry(self):
        index = self.make_flora_index()
        index.loads(index.dumps())
        self.assertEqual(len(index.quads), 1)
        samples = index.samples
        self.assertTrue(any(sample.count == 1 for sample in samples))

        terrain = self.voxeloo.tensors.Tensor_U32([1, 1, 1], 0)
        terrain.assign(
            np.array([[0, 0, 0]], dtype=np.int32),
            np.array([1], dtype=np.uint32),
        )
        growth = self.voxeloo.tensors.Tensor_U8([1, 1, 1], 0)
        growth.assign(
            np.array([[0, 0, 0]], dtype=np.int32),
            np.array([4], dtype=np.uint8),
        )
        muck = self.voxeloo.tensors.Tensor_U8([1, 1, 1], 0)
        geometry = self.galois.florae.to_geometry(terrain, growth, muck, index)
        self.assertEqual(len(geometry.vertices), 4)
        self.assertEqual(len(geometry.indices), 6)
        self.assertEqual(geometry.vertices[0].pos(), [0.0, 0.0, 0.0])
        self.assertGreater(len(geometry.vertex_data()), 0)
        self.assertGreater(len(geometry.index_data()), 0)

    def test_shape_builders_index_tensors_occlusion_and_geometry(self):
        index, isomorphism_id = self.make_shape_index()
        index.loads(index.dumps())
        self.assertEqual(index.occlusion_masks, [3])
        self.assertEqual(len(index.quads), 1)

        shapes = self.voxeloo.tensors.Tensor_U32([1, 1, 1], 0)
        shapes.assign(
            np.array([[0, 0, 0]], dtype=np.int32),
            np.array([isomorphism_id], dtype=np.uint32),
        )
        dye = self.voxeloo.tensors.Tensor_U8([1, 1, 1], 0)
        glass = self.voxeloo.tensors.Tensor_U32([1, 1, 1], 1)
        block_tensor = self.voxeloo.tensors.Tensor_U32([1, 1, 1], 0)
        block_tensor.assign(
            np.array([[0, 0, 0]], dtype=np.int32),
            np.array([1], dtype=np.uint32),
        )
        self.assertEqual(
            self.galois.shapes.to_tensor(block_tensor, isomorphism_id).get(0, 0, 0),
            isomorphism_id,
        )
        self.assertNotEqual(
            self.galois.shapes.to_occlusion_tensor(shapes, index).get(0, 0, 0), 0
        )
        self.assertIsInstance(
            self.galois.shapes.to_glass_occlusion_tensor(shapes, glass, dye, index).get(
                0, 0, 0
            ),
            int,
        )

        geometry = self.galois.shapes.to_geometry(shapes, dye, index)
        self.assertGreater(len(geometry.vertices), 0)
        self.assertGreater(len(geometry.indices), 0)
        self.assertEqual(len(geometry.vertices[0].pos), 3)
        self.assertEqual(len(geometry.vertices[0].uv), 2)
        self.assertGreater(len(geometry.vertex_data()), 0)
        self.assertGreater(len(geometry.index_data()), 0)

    def test_group_texture_tensor_index_mesh_wireframe_and_lighting(self):
        texture_pixels = np.array([[[1, 2, 3, 4], [5, 6, 7, 8]]], dtype=np.uint8)
        texture = self.galois.groups.Texture.fromarray(texture_pixels)
        self.assertEqual(texture.shape(), [1, 2])
        np.testing.assert_array_equal(texture.data, texture_pixels)

        block_index = self.make_block_index()
        flora_index = self.make_flora_index()
        shape_index, _ = self.make_shape_index()
        group_index = self.galois.groups.to_index(
            block_index,
            shape_index,
            flora_index,
            block_index,
            [texture],
            [0] * 64,
            [0],
            [0] * 64,
        )
        group_index.loads(group_index.dumps())

        zero_u32 = self.voxeloo.tensors.Tensor_U32([32, 32, 32], 0)
        zero_u8 = self.voxeloo.tensors.Tensor_U8([32, 32, 32], 0)
        group_tensor = self.galois.groups.to_tensor(
            zero_u32, zero_u32, zero_u8, zero_u8, zero_u8
        )
        group_tensor.loads(group_tensor.dumps())
        combined = self.galois.groups.to_mesh(group_tensor, group_index)
        for mesh in [combined.blocks, combined.florae, combined.glass]:
            self.assertEqual(len(mesh.texture.shape()), 2)

        wireframe = self.galois.groups.to_wireframe_mesh(group_tensor, shape_index)
        self.assertEqual(len(wireframe.vertex_data()), 0)
        self.assertEqual(len(wireframe.index_data()), 0)

        lighting = self.galois.lighting.to_buffer(zero_u8, zero_u32)
        self.assertEqual(len(lighting.rank.shape), 2)
        self.assertEqual(len(lighting.data.shape), 2)
        self.assertEqual(len(lighting.rank.view()), 4 * len(lighting.rank.data))
        self.assertEqual(len(lighting.data.view()), 4 * len(lighting.data.data))


if __name__ == "__main__":
    unittest.main()
