import tempfile
import unittest
from pathlib import Path

from gen import gen_defs, gen_types
from ts import AST_CONFIG, gen_ts


class TypeScriptTypeContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.types = {type_def.name: type_def for type_def in gen_types(AST_CONFIG)}

    def test_scalar_bigint_collection_and_union_mappings(self):
        self.assertEqual(self.types["U32"].ts_type, "number")
        self.assertEqual(self.types["U64"].ts_type, "bigint")
        self.assertTrue(self.types["U64"].bigint)
        self.assertEqual(self.types["Vec3f"].ts_type, "[number,number,number]")
        self.assertEqual(
            self.types["Vec3f"].readonly_ts_type,
            "readonly [number,number,number]",
        )
        self.assertTrue(self.types["OptionalBool"].ts_type.endswith("| undefined"))
        self.assertTrue(self.types["ItemBag"].ts_type.startswith("Map<"))
        self.assertIn('kind: "water"', self.types["FarmingPlayerAction"].ts_type)

    def test_default_and_serialization_expression_selection(self):
        self.assertEqual(self.types["U64"].default_value, "defaultU64")
        self.assertEqual(self.types["Vec3f"].default_value, "defaultVec3f()")
        self.assertEqual(self.types["Vec3f"].serialize("value"), "value")
        self.assertEqual(self.types["Item"].serialize("value"), "serializeItem(value)")
        self.assertEqual(
            self.types["Item"].deserialize("data", "ext"),
            "ext.deserializeItem(data)",
        )


class TypeScriptGenerationContractTest(unittest.TestCase):
    GENERATED_SHARED_FILES = [
        "types.ts",
        "components.ts",
        "entities.ts",
        "delta.ts",
        "events.ts",
        "json_serde.ts",
        "selectors.ts",
    ]

    def generate(self, root: Path):
        shared = root / "shared"
        server = root / "server"
        gen_ts(gen_types, gen_defs, str(shared), str(server))
        return shared, server

    @staticmethod
    def content_hash(source: str):
        prefix = "// Content Hash: "
        return next(
            line.removeprefix(prefix)
            for line in source.splitlines()
            if line.startswith(prefix)
        )

    def test_generation_is_deterministic_and_contains_resolved_hashes(self):
        with tempfile.TemporaryDirectory() as first_dir, tempfile.TemporaryDirectory() as second_dir:
            first_shared, first_server = self.generate(Path(first_dir))
            second_shared, second_server = self.generate(Path(second_dir))

            for filename in self.GENERATED_SHARED_FILES:
                first = (first_shared / filename).read_text()
                second = (second_shared / filename).read_text()
                self.assertEqual(first, second, filename)
                self.assertIn("Content Hash:", first)
                self.assertNotIn("$$OUTPUT_HASH$$", first)

            self.assertEqual(
                (first_server / "lazy.ts").read_text(),
                (second_server / "lazy.ts").read_text(),
            )

    def test_checked_in_generated_sources_match_the_schema(self):
        repository = Path(__file__).resolve().parent.parent
        with tempfile.TemporaryDirectory() as output_dir:
            shared, server = self.generate(Path(output_dir))

            for filename in self.GENERATED_SHARED_FILES:
                self.assertEqual(
                    self.content_hash((shared / filename).read_text()),
                    self.content_hash(
                        (repository / "src/shared/ecs/gen" / filename).read_text()
                    ),
                    f"{filename} is stale; run ./b gen:ecs",
                )
            self.assertEqual(
                self.content_hash((server / "lazy.ts").read_text()),
                self.content_hash(
                    (repository / "src/server/shared/ecs/gen/lazy.ts").read_text()
                ),
                "lazy.ts is stale; run ./b gen:ecs",
            )


if __name__ == "__main__":
    unittest.main()
