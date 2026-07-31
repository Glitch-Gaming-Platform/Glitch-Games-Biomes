import unittest

import numpy as np

from voxeloo.py_ext.test_support import load_extension


class VoxelooPythonCoreBindingsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.voxeloo = load_extension()

    def test_exports_every_top_level_binding_module(self):
        self.assertEqual(self.voxeloo.__version__, "0.1.0")
        for name in [
            "biomes",
            "blocks",
            "culling",
            "galois",
            "geometry",
            "meshes",
            "noise",
            "primitives",
            "rasterization",
            "rays",
            "runs",
            "shards",
            "spatial",
            "tensors",
            "voronoi",
            "voxels",
        ]:
            with self.subTest(module=name):
                self.assertTrue(hasattr(self.voxeloo, name))

    def test_all_geometry_vector_types_round_trip_and_mutate(self):
        for dimensions in [2, 3, 4]:
            for suffix in ["b", "i", "u", "f", "d"]:
                name = f"Vec{dimensions}{suffix}"
                cls = getattr(self.voxeloo.geometry, name)
                if suffix == "b":
                    values = [index % 2 == 0 for index in range(dimensions)]
                    replacement = False
                elif suffix in ["f", "d"]:
                    values = [index + 0.5 for index in range(dimensions)]
                    replacement = 9.5
                else:
                    values = [index + 1 for index in range(dimensions)]
                    replacement = 9

                with self.subTest(vector=name):
                    vector = cls(*values)
                    self.assertEqual(vector.tuple(), values)
                    vector.x = replacement
                    self.assertEqual(vector.tuple()[0], replacement)

    def test_shard_encoding_is_binary_and_round_trips_signed_coordinates(self):
        encoded = self.voxeloo.shards.shard_encode(7, -12345, 0, 67890)
        self.assertIsInstance(encoded, bytes)
        self.assertEqual(
            self.voxeloo.shards.shard_decode(encoded),
            (7, -12345, 0, 67890),
        )

    def test_every_run_index_type_builds_overlays_and_serializes(self):
        for suffix in ["I8", "I16", "I32", "I64", "U8", "U16", "U32", "U64"]:
            with self.subTest(run_type=suffix):
                builder = getattr(self.voxeloo.runs, f"IndexBuilder_{suffix}")(6, 1)
                builder.add(2, 4)
                builder.add([4, 6], 5)
                index = builder.build()
                self.assertEqual(index.size(), 6)
                self.assertEqual([index.get(i) for i in range(6)], [1, 1, 4, 1, 5, 5])
                self.assertGreater(index.storage_size(), 0)

                restored = getattr(self.voxeloo.runs, f"Index_{suffix}")()
                restored.loads(index.dumps())
                self.assertEqual(
                    [restored.get(i) for i in range(6)], [1, 1, 4, 1, 5, 5]
                )

    def test_every_tensor_type_converts_assigns_fills_and_serializes(self):
        tensor_types = {
            "Bool": np.bool_,
            "I8": np.int8,
            "I16": np.int16,
            "I32": np.int32,
            "I64": np.int64,
            "U8": np.uint8,
            "U16": np.uint16,
            "U32": np.uint32,
            "U64": np.uint64,
            "F32": np.float32,
            "F64": np.float64,
        }
        for suffix, dtype in tensor_types.items():
            with self.subTest(tensor_type=suffix):
                source = np.arange(4).reshape((1, 2, 2)).astype(dtype)
                tensor_class = getattr(self.voxeloo.tensors, f"Tensor_{suffix}")
                tensor = tensor_class.fromarray(source)
                self.assertEqual(tensor.get(1, 1, 0), source[0, 1, 1])
                padded = tensor.array()
                self.assertEqual(padded.shape, (32, 32, 32))
                np.testing.assert_array_equal(padded[:1, :2, :2], source)

                replacement = True if suffix == "Bool" else 7
                tensor.assign(
                    np.array([[0, 0, 0]], dtype=np.int32),
                    np.array([replacement], dtype=dtype),
                )
                self.assertEqual(tensor.get(0, 0, 0), replacement)

                raw_restored = tensor_class([32, 32, 32])
                raw_restored.load(tensor.dump())
                np.testing.assert_array_equal(raw_restored.array(), tensor.array())

                compressed_restored = tensor_class([32, 32, 32])
                compressed_restored.loads(tensor.dumps())
                np.testing.assert_array_equal(
                    compressed_restored.array(), tensor.array()
                )

                tensor.fill(replacement)
                self.assertEqual(tensor.get(31, 31, 31), replacement)

    def test_every_volume_and_sparse_block_type_round_trips(self):
        block_types = {
            "Bool": np.bool_,
            "I8": np.int8,
            "I16": np.int16,
            "I32": np.int32,
            "I64": np.int64,
            "U8": np.uint8,
            "U16": np.uint16,
            "U32": np.uint32,
            "U64": np.uint64,
        }
        for suffix, dtype in block_types.items():
            with self.subTest(block_type=suffix):
                value = True if suffix == "Bool" else 7
                source = np.zeros((32, 32, 32), dtype=dtype)
                source[3, 2, 1] = value
                volume_class = getattr(self.voxeloo.biomes, f"VolumeBlock_{suffix}")
                volume = volume_class.fromarray(source)
                self.assertEqual(volume[1, 2, 3], value)
                np.testing.assert_array_equal(volume.array(), source)

                sparse_class = getattr(self.voxeloo.biomes, f"SparseBlock_{suffix}")
                sparse = sparse_class()
                sparse[1, 2, 3] = value
                self.assertEqual(sparse[1, 2, 3], value)
                self.assertIsNone(sparse[3, 2, 1])
                self.assertEqual(sparse.values(), [(1, 2, 3, value)])

        edits = self.voxeloo.biomes.SparseBlock_U32()
        edits[4, 5, 6] = 99
        volume = self.voxeloo.biomes.VolumeBlock_U32()
        volume.assign(edits)
        self.assertEqual(volume[4, 5, 6], 99)

        for dump_name, load_name in [
            ("dumps", "loads"),
            ("compressed_dumps", "compressed_loads"),
            ("raw_dumps", "raw_loads"),
        ]:
            with self.subTest(serialization=dump_name):
                restored = self.voxeloo.biomes.VolumeBlock_U32()
                getattr(restored, load_name)(getattr(volume, dump_name)())
                self.assertEqual(restored[4, 5, 6], 99)

                sparse_restored = self.voxeloo.biomes.SparseBlock_U32()
                getattr(sparse_restored, load_name)(getattr(edits, dump_name)())
                self.assertEqual(sparse_restored[4, 5, 6], 99)

    def test_blocks_meshes_and_voxel_meshes_preserve_layouts(self):
        source = np.zeros((2, 3, 4), dtype=np.uint32)
        source[1, 2, 3] = 0x11223344
        blocks = self.voxeloo.blocks.BlockList.from_numpy(source, 0.5, [10, 20, 30])
        self.assertEqual(blocks.scale, 0.5)
        self.assertEqual(blocks.shift().tuple(), [13, 22, 31])
        box_v0, box_v1 = blocks.bounding_box()
        self.assertEqual(box_v0.tuple(), [13, 22, 31])
        self.assertEqual(box_v1.tuple(), [14, 23, 32])
        self.assertEqual(blocks[13, 22, 31], 0x11223344)
        self.assertIsNone(blocks[12, 22, 31])
        np.testing.assert_array_equal(
            blocks.to_numpy(), np.array([[[0x11223344]]], np.uint32)
        )

        coords, values, scale = blocks.to_sparse_numpy()
        np.testing.assert_array_equal(coords, np.array([[13, 22, 31]], np.int32))
        np.testing.assert_array_equal(values, np.array([0x11223344], np.uint32))
        self.assertEqual(scale, 0.5)
        sparse_restored = self.voxeloo.blocks.BlockList.from_sparse_numpy(
            coords, values, scale
        )
        self.assertEqual(sparse_restored[13, 22, 31], 0x11223344)

        for compressed in [False, True]:
            restored = self.voxeloo.blocks.BlockList.loads(
                blocks.dumps(compressed), compressed
            )
            self.assertEqual(restored[13, 22, 31], 0x11223344)
        self.assertEqual(
            self.voxeloo.blocks.BlockList.from_json(blocks.to_json())[13, 22, 31],
            0x11223344,
        )
        self.assertEqual(blocks.clone()[13, 22, 31], 0x11223344)
        self.assertGreater(blocks.mesh().vertices.shape[0], 0)

        mesh = self.voxeloo.meshes.Mesh()
        mesh.vertices = np.array(
            [
                [0, 0, 0, 1, 0, 0],
                [1, 0, 0, 0, 1, 0],
                [0, 1, 0, 0, 0, 1],
            ],
            dtype=np.float32,
        )
        mesh.triangles = np.array([[0, 1, 2]], dtype=np.int32)
        restored_mesh = self.voxeloo.meshes.Mesh.loads(mesh.dumps())
        np.testing.assert_array_equal(restored_mesh.vertices, mesh.vertices)
        np.testing.assert_array_equal(restored_mesh.triangles, mesh.triangles)
        self.assertGreater(mesh.to_blocks().to_sparse_numpy()[0].shape[0], 0)

        voxels = np.zeros((1, 1, 1), dtype=np.uint32)
        voxels[0, 0, 0] = 0xFFFFFFFF
        voxel_mesh = self.voxeloo.voxels.voxels_to_mesh(voxels)
        self.assertEqual(voxel_mesh.vertices.shape, (24, 6))
        self.assertEqual(voxel_mesh.triangles.shape, (12, 3))

        box = self.voxeloo.voxels.Box([-1, 2, 3], [4, 5, 6])
        np.testing.assert_array_equal(
            box.numpy(), np.array([[-1, 2, 3], [4, 5, 6]], dtype=np.int32)
        )
        box.v0 = [7, 8, 9]
        self.assertEqual(box.v0, [7, 8, 9])
        self.assertEqual(int(self.voxeloo.voxels.X_NEG), 0)
        self.assertEqual(int(self.voxeloo.voxels.Z_POS), 5)

    def test_invalid_core_inputs_raise_python_exceptions(self):
        with self.assertRaises(ValueError):
            self.voxeloo.tensors.Tensor_U32.fromarray(np.zeros((2, 2), dtype=np.uint32))
        with self.assertRaises(ValueError):
            self.voxeloo.biomes.VolumeBlock_U32.fromarray(
                np.zeros((2, 2, 2), dtype=np.uint32)
            )
        with self.assertRaises(ValueError):
            self.voxeloo.blocks.BlockList.from_numpy(np.zeros((2, 2), dtype=np.uint32))

        mesh = self.voxeloo.meshes.Mesh()
        mesh.vertices = np.zeros((3, 5), dtype=np.float32)
        mesh.triangles = np.array([[0, 1, 2]], dtype=np.int32)
        with self.assertRaises(ValueError):
            mesh.dumps()

        mesh.vertices = np.zeros((3, 6), dtype=np.float32)
        mesh.triangles = np.array([[0, 1, 3]], dtype=np.int32)
        with self.assertRaises(ValueError):
            mesh.dumps()


if __name__ == "__main__":
    unittest.main()
