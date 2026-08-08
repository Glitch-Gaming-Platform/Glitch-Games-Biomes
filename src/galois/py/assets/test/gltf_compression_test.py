import base64
import io
import struct
import unittest

import pygltflib
from PIL import Image

from impl.gltf_compression import compress_gltf


def textured_triangle() -> pygltflib.GLTF2:
    positions = struct.pack("<9f", 0, 0, 0, 1, 0, 0, 0, 1, 0)
    texcoords = struct.pack("<6f", 0, 0, 1, 0, 0, 1)
    indices = struct.pack("<3H", 0, 1, 2)
    binary = positions + texcoords + indices + b"\0\0"

    image_bytes = io.BytesIO()
    Image.new("RGBA", (4, 4), (255, 0, 0, 255)).save(
        image_bytes, format="PNG"
    )

    animation_times = struct.pack("<2f", 0, 1)
    constant_translation = struct.pack("<6f", 0, 0, 0, 0, 0, 0)
    animation_offset = len(binary)
    binary += animation_times + constant_translation

    return pygltflib.GLTF2(
        asset=pygltflib.Asset(version="2.0"),
        scene=0,
        scenes=[pygltflib.Scene(nodes=[0])],
        nodes=[pygltflib.Node(mesh=0)],
        meshes=[
            pygltflib.Mesh(
                primitives=[
                    pygltflib.Primitive(
                        attributes=pygltflib.Attributes(
                            POSITION=0, TEXCOORD_0=1
                        ),
                        indices=2,
                        material=0,
                    )
                ]
            )
        ],
        accessors=[
            pygltflib.Accessor(
                bufferView=0,
                componentType=pygltflib.FLOAT,
                count=3,
                type="VEC3",
                min=[0, 0, 0],
                max=[1, 1, 0],
            ),
            pygltflib.Accessor(
                bufferView=1,
                componentType=pygltflib.FLOAT,
                count=3,
                type="VEC2",
            ),
            pygltflib.Accessor(
                bufferView=2,
                componentType=pygltflib.UNSIGNED_SHORT,
                count=3,
                type="SCALAR",
            ),
            pygltflib.Accessor(
                bufferView=3,
                componentType=pygltflib.FLOAT,
                count=2,
                type="SCALAR",
                min=[0],
                max=[1],
            ),
            pygltflib.Accessor(
                bufferView=4,
                componentType=pygltflib.FLOAT,
                count=2,
                type="VEC3",
            ),
        ],
        bufferViews=[
            pygltflib.BufferView(
                buffer=0,
                byteOffset=0,
                byteLength=len(positions),
                target=pygltflib.ARRAY_BUFFER,
            ),
            pygltflib.BufferView(
                buffer=0,
                byteOffset=len(positions),
                byteLength=len(texcoords),
                target=pygltflib.ARRAY_BUFFER,
            ),
            pygltflib.BufferView(
                buffer=0,
                byteOffset=len(positions) + len(texcoords),
                byteLength=len(indices),
                target=pygltflib.ELEMENT_ARRAY_BUFFER,
            ),
            pygltflib.BufferView(
                buffer=0,
                byteOffset=animation_offset,
                byteLength=len(animation_times),
            ),
            pygltflib.BufferView(
                buffer=0,
                byteOffset=animation_offset + len(animation_times),
                byteLength=len(constant_translation),
            ),
        ],
        buffers=[
            pygltflib.Buffer(
                byteLength=len(binary),
                uri="data:application/octet-stream;base64,"
                + base64.b64encode(binary).decode(),
            )
        ],
        images=[
            pygltflib.Image(
                uri="data:image/png;base64,"
                + base64.b64encode(image_bytes.getvalue()).decode()
            )
        ],
        textures=[pygltflib.Texture(source=0)],
        materials=[
            pygltflib.Material(
                pbrMetallicRoughness=pygltflib.PbrMetallicRoughness(
                    baseColorTexture=pygltflib.TextureInfo(index=0)
                )
            )
        ],
        animations=[
            pygltflib.Animation(
                name="ConstantAttachmentPose",
                samplers=[
                    pygltflib.AnimationSampler(input=3, output=4)
                ],
                channels=[
                    pygltflib.AnimationChannel(
                        sampler=0,
                        target=pygltflib.AnimationChannelTarget(
                            node=0, path="translation"
                        ),
                    )
                ],
            )
        ],
    )


class GltfCompressionTestCase(unittest.TestCase):
    def test_native_gltfpack_emits_meshopt_and_ktx2(self):
        output = compress_gltf(textured_triangle())
        self.assertTrue(output.startswith(b"glTF"))

        compressed = pygltflib.GLTF2().load_from_bytes(output)
        self.assertIn("EXT_meshopt_compression", compressed.extensionsUsed)
        self.assertIn("KHR_texture_basisu", compressed.extensionsUsed)
        self.assertEqual(compressed.images[0].mimeType, "image/ktx2")
        self.assertIsNotNone(compressed.images[0].bufferView)
        self.assertIn("KHR_texture_basisu", compressed.textures[0].extensions)
        self.assertEqual(compressed.animations[0].name, "ConstantAttachmentPose")


if __name__ == "__main__":
    unittest.main()
