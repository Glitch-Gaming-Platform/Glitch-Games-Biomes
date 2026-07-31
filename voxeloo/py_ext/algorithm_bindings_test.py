import unittest

import numpy as np

from voxeloo.py_ext.test_support import load_extension


class VoxelooPythonAlgorithmBindingsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.voxeloo = load_extension()

    def test_simplex_noise_supports_every_dimension_and_seed(self):
        for dimensions in [2, 3, 4]:
            with self.subTest(dimensions=dimensions):
                points = np.array(
                    [[0.25] * dimensions, [1.5] * dimensions], dtype=np.float32
                )
                first = self.voxeloo.noise.SimplexNoise(42).noise(points)
                second = self.voxeloo.noise.SimplexNoise(42).noise(points)
                self.assertEqual(first.shape, (2,))
                np.testing.assert_array_equal(first, second)

        points = np.array([[0.25, 0.5], [1.5, 2.0]], dtype=np.float32)
        np.testing.assert_array_equal(
            self.voxeloo.noise.noise(points),
            self.voxeloo.noise.noise(points),
        )
        with self.assertRaises(ValueError):
            self.voxeloo.noise.noise(np.zeros((2, 5), dtype=np.float32))

    def test_2d_and_3d_primitives_get_transform_union_and_rasterize(self):
        xy = self.voxeloo.primitives.xy
        disk = xy.make_disk(1.0)
        rectangle = xy.make_rect(2.0, 2.0)
        self.assertGreater(disk.get(0.0, 0.0), 0.0)
        self.assertEqual(disk.get(2.0, 0.0), 0.0)
        translated_disk = xy.transform(disk, [2.0, 0.0], 0.0)
        self.assertGreater(translated_disk.get(2.0, 0.0), 0.0)
        union_2d = xy.union([translated_disk, rectangle])
        raster_2d = xy.rasterize(union_2d, [5, 5])
        self.assertEqual(raster_2d.shape, (5, 5))
        self.assertGreater(np.count_nonzero(raster_2d), 0)

        xyz = self.voxeloo.primitives.xyz
        ball = xyz.make_ball(1.0)
        box = xyz.make_box(2.0, 2.0, 2.0)
        self.assertGreater(ball.get(0.0, 0.0, 0.0), 0.0)
        self.assertEqual(ball.get(2.0, 0.0, 0.0), 0.0)
        translated_ball = xyz.transform(ball, [2.0, 0.0, 0.0], [0, 0, 0, 1])
        self.assertGreater(translated_ball.get(2.0, 0.0, 0.0), 0.0)
        union_3d = xyz.union([translated_ball, box])
        raster_3d = xyz.rasterize(union_3d, [5, 5, 5])
        self.assertEqual(raster_3d.shape, (5, 5, 5))
        self.assertGreater(np.count_nonzero(raster_3d), 0)

    def test_voronoi_rasterizers_choose_nearest_points(self):
        raster_2d = self.voxeloo.voronoi.rasterize_2d(
            np.array([[0, 0], [3, 3]], dtype=np.float32), [4, 4]
        )
        self.assertEqual(raster_2d.shape, (4, 4))
        self.assertEqual(raster_2d[0, 0], 0)
        self.assertEqual(raster_2d[3, 3], 1)

        raster_3d = self.voxeloo.voronoi.rasterize_3d(
            np.array([[0, 0, 0], [2, 2, 2]], dtype=np.float32), [3, 3, 3]
        )
        self.assertEqual(raster_3d.shape, (3, 3, 3))
        self.assertEqual(raster_3d[0, 0, 0], 0)
        self.assertEqual(raster_3d[2, 2, 2], 1)

        with self.assertRaises(ValueError):
            self.voxeloo.voronoi.rasterize_2d(
                np.zeros((0, 2), dtype=np.float32), [2, 2]
            )
        with self.assertRaises(ValueError):
            self.voxeloo.voronoi.rasterize_3d(
                np.zeros((2, 2), dtype=np.float32), [2, 2, 2]
            )

    def test_spatial_maps_convert_update_and_emit_blocks(self):
        density = self.voxeloo.spatial.DensityMap()
        density.update([(0, 0, 0, 1.0), (1, 0, 0, 0.5)])
        self.assertTrue(density.has(0, 0, 0))
        self.assertFalse(density.has(2, 0, 0))
        self.assertEqual(density.get(1, 0, 0), 0.5)
        self.assertEqual(density.values(), [(0, 0, 0, 1.0), (1, 0, 0, 0.5)])
        v0, v1 = density.bounding_box()
        self.assertEqual(v0.tuple(), [0, 0, 0])
        self.assertEqual(v1.tuple(), [2, 1, 1])
        np.testing.assert_array_equal(
            density.numpy(), np.array([[[1.0, 0.5]]], dtype=np.float32)
        )
        self.assertEqual(density.blocks(0.75)[0, 0, 0], 0xFFFFFFFF)

        colors = self.voxeloo.spatial.ColorMap()
        colors.update([(0, 0, 0, 0x11223344), (1, 0, 0, 0xFFFFFFFF)])
        self.assertTrue(colors.has(0, 0, 0))
        self.assertEqual(colors.get(0, 0, 0), 0x11223344)
        self.assertEqual(len(colors.values()), 2)
        np.testing.assert_array_equal(
            colors.numpy(),
            np.array([[[0x11223344, 0xFFFFFFFF]]], dtype=np.uint32),
        )
        self.assertEqual(colors.blocks()[1, 0, 0], 0xFFFFFFFF)

    def test_ray_integrators_renderers_and_camera_reduction(self):
        density = self.voxeloo.spatial.DensityMap()
        density.update([(0, 0, 0, 1.0), (1, 0, 0, 0.5)])
        source = [-1.0, 0.5, 0.5]
        direction = [1.0, 0.0, 0.0]
        exact = self.voxeloo.rays.integrate(density, source, direction, 5.0)
        approximate = self.voxeloo.rays.integrate_approx(
            density, source, direction, 5.0
        )
        self.assertGreater(exact, 0.0)
        self.assertGreater(approximate, 0.0)

        orthographic = self.voxeloo.rays.render_orthographic(
            density, [1, 1], source, direction, far=5.0
        )
        approximate_image = self.voxeloo.rays.render_orthographic_approx(
            density, [1, 1], source, direction, far=5.0
        )
        self.assertEqual(orthographic.shape, (1, 1))
        self.assertEqual(approximate_image.shape, (1, 1))
        self.assertAlmostEqual(orthographic[0, 0], exact)

        cameras = [[*source, *direction]]
        sequence = self.voxeloo.rays.render_camera_sequence(
            density, cameras, [1, 1], far=5.0
        )
        reduced = self.voxeloo.rays.reduce_rays(density, cameras, [1, 1], far=5.0)
        self.assertEqual(sequence.shape, (1, 1, 1, 7))
        np.testing.assert_array_equal(reduced, sequence)

        colors = self.voxeloo.spatial.ColorMap()
        colors.update([(0, 0, 0, 0xFFFFFFFF)])
        normals = np.zeros((1, 1, 1, 3), dtype=np.float32)
        normals[0, 0, 0] = [-1, 0, 0]
        color_image = self.voxeloo.rays.render_orthographic_color(
            colors,
            normals,
            [1, 1],
            source,
            direction,
            [-1, 0, 0],
            far=5.0,
        )
        self.assertEqual(color_image.shape, (1, 1, 4))
        self.assertGreater(color_image[0, 0, 3], 0.0)

    def test_culling_buffers_rasterizers_and_culler(self):
        identity = [
            1.0,
            0.0,
            0.0,
            0.0,
            0.0,
            1.0,
            0.0,
            0.0,
            0.0,
            0.0,
            1.0,
            0.0,
            0.0,
            0.0,
            0.0,
            1.0,
        ]
        box = self.voxeloo.culling.AABB([-0.5, -0.5, 0], [0.5, 0.5, 0.5])
        self.assertEqual(box.v0, [-0.5, -0.5, 0.0])
        self.assertEqual(box.v1, [0.5, 0.5, 0.5])

        inclusive = self.voxeloo.culling.OcclusionBuffer(4, 4)
        self.voxeloo.culling.rasterize_aabb_inclusive(inclusive, identity, box)
        self.assertTrue(inclusive.get(2, 2))
        exclusive = self.voxeloo.culling.OcclusionBuffer(4, 4)
        self.voxeloo.culling.rasterize_aabb_exclusive(exclusive, identity, box)
        self.assertTrue(exclusive.get(2, 2))
        self.assertFalse(exclusive.get(1, 1))

        many_inclusive = self.voxeloo.culling.OcclusionBuffer(4, 4)
        self.voxeloo.culling.rasterize_many_aabb_inclusive(
            many_inclusive, identity, [box]
        )
        self.assertTrue(many_inclusive.get(2, 2))
        many_exclusive = self.voxeloo.culling.OcclusionBuffer(4, 4)
        self.voxeloo.culling.rasterize_many_aabb_exclusive(
            many_exclusive, identity, [box]
        )
        self.assertTrue(many_exclusive.get(2, 2))

        culler = self.voxeloo.culling.OcclusionCuller(identity, [4, 4])
        self.assertTrue(culler.test(box))
        culler.write(box)
        self.assertIsInstance(culler.test(box), bool)

    def test_mesh_rasterization_supports_strategies_bounds_and_validation(self):
        vertices = np.array(
            [[0, 0, 0, 1], [1, 0, 0, 2], [0, 1, 0, 3]], dtype=np.float64
        )
        triangles = np.array([[0, 1, 2]], dtype=np.int32)
        for strategy in ["none", "nearest", "weighted"]:
            with self.subTest(strategy=strategy):
                coords, values = self.voxeloo.rasterization.voxelize_mesh(
                    vertices, triangles, 1.0, strategy
                )
                self.assertEqual(coords.shape[1], 3)
                self.assertEqual(values.shape, (coords.shape[0], 1))
                self.assertGreater(coords.shape[0], 0)

        coords, _ = self.voxeloo.rasterization.voxelize_mesh(
            vertices,
            triangles,
            1.0,
            bounding_box=[[0, 0, 0], [1, 1, 1]],
        )
        self.assertTrue(np.all(coords >= -1))
        self.assertTrue(np.all(coords <= 1))

        with self.assertRaises(ValueError):
            self.voxeloo.rasterization.voxelize_mesh(
                vertices, np.array([[0, 1]], dtype=np.int32), 1.0
            )
        with self.assertRaises(ValueError):
            self.voxeloo.rasterization.voxelize_mesh(
                vertices, np.array([[0, 1, 3]], dtype=np.int32), 1.0
            )


if __name__ == "__main__":
    unittest.main()
