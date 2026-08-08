import json
import struct
import tempfile
import unittest
from pathlib import Path

import pygltflib

from impl import gltf
from impl.repo import init_workspace_dir, pop_file_log


class GltfLoadingTestCase(unittest.TestCase):
    def test_load_gltf_resolves_and_tracks_external_files(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            model_dir = root / "models"
            model_dir.mkdir()
            (model_dir / "mesh.bin").write_bytes(struct.pack("<3f", 0, 0, 0))
            (model_dir / "texture.png").write_bytes(b"png")
            (model_dir / "model.gltf").write_text(
                json.dumps(
                    {
                        "asset": {"version": "2.0"},
                        "buffers": [{"uri": "mesh.bin", "byteLength": 12}],
                        "images": [{"uri": "texture.png"}],
                    }
                )
            )

            init_workspace_dir(temp_dir)
            pop_file_log()
            loaded = gltf.load_gltf("models/model.gltf")

            self.assertEqual(loaded.buffers[0].uri, "mesh.bin")
            self.assertEqual(
                pop_file_log(),
                [
                    "models/model.gltf",
                    "models/mesh.bin",
                    "models/texture.png",
                ],
            )

    def test_load_glb_accepts_binary_gltf(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            binary_path = root / "model.glb"
            pygltflib.GLTF2(
                asset=pygltflib.Asset(version="2.0"),
                images=[pygltflib.Image(uri="texture.png")],
            ).save_binary(str(binary_path))
            (root / "texture.png").write_bytes(b"png")

            init_workspace_dir(temp_dir)
            pop_file_log()
            loaded = gltf.load_glb("model.glb")

            self.assertEqual(loaded.asset.version, "2.0")
            self.assertEqual(pop_file_log(), ["model.glb", "texture.png"])

    def test_embed_external_images_preserves_buffer_view_images(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "texture.png").write_bytes(b"external-image")
            content = pygltflib.GLTF2(
                asset=pygltflib.Asset(version="2.0"),
                images=[
                    pygltflib.Image(uri="texture.png"),
                    pygltflib.Image(bufferView=4, mimeType="image/png"),
                ],
            )

            init_workspace_dir(temp_dir)
            pop_file_log()
            gltf.embed_external_images(content, "model.glb")

            self.assertTrue(content.images[0].uri.startswith("data:image/png"))
            self.assertIsNone(content.images[0].bufferView)
            self.assertEqual(content.images[1].bufferView, 4)
            self.assertIsNone(content.images[1].uri)
            self.assertEqual(pop_file_log(), ["texture.png"])


if __name__ == "__main__":
    unittest.main()
