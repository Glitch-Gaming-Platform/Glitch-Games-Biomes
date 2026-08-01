import json
import tempfile
import unittest
from pathlib import Path

from build import exec_program
from impl.incremental import QueryIndex
from impl.lru_cache_by_hash import LRUCacheByHash
from impl.repo import init_workspace_dir
from impl.stats import TimerMap


class BuildSystemTestCase(unittest.TestCase):
    def test_exec_program_materializes_dependency_order(self):
        program = [
            {"node": "literal", "kind": "I32", "type": "I32", "data": 7},
            {
                "node": "literal",
                "kind": "Str",
                "type": "Str",
                "data": "axe",
            },
            {
                "node": "derived",
                "kind": "Tuple",
                "type": "Tuple",
                "deps": [0, 1],
            },
            {
                "node": "derived",
                "kind": "List",
                "type": "List",
                "deps": [2],
            },
        ]

        result = json.loads(exec_program(json.dumps(program), False, TimerMap()))

        self.assertEqual(result, [[7, "axe"]])

    def test_exec_program_serializes_materialization_errors(self):
        program = [
            {
                "node": "literal",
                "kind": "MissingMaterializer",
                "type": "Str",
                "data": "value",
            }
        ]

        result = json.loads(exec_program(json.dumps(program), False, TimerMap()))

        self.assertEqual(result["kind"], "Error")
        self.assertTrue(any("MissingMaterializer" in line for line in result["info"]))

    def test_materialized_values_are_cached_by_node_hash(self):
        cache = LRUCacheByHash(2)
        calls = 0

        def compute():
            nonlocal calls
            calls += 1
            return {"value": calls}

        first = cache.set_default("same-node", compute)
        second = cache.set_default("same-node", compute)

        self.assertIs(first, second)
        self.assertEqual(calls, 1)

    def test_incremental_index_survives_cache_hits_and_detects_source_changes(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            source = root / "source.vox"
            index_path = root / "hashes.db"
            source.write_bytes(b"first")
            init_workspace_dir(temp_dir)
            code = '[{"node":"literal","kind":"Str","data":"asset"}]'

            with QueryIndex(index_path) as index:
                self.assertFalse(index.unchanged(code))
                index.update(code, ["source.vox"])

            # A read-only cache hit must not erase the persisted entry.
            with QueryIndex(index_path) as index:
                self.assertTrue(index.unchanged(code))

            with QueryIndex(index_path) as index:
                self.assertTrue(index.unchanged(code))

            source.write_bytes(b"second")
            with QueryIndex(index_path) as index:
                self.assertFalse(index.unchanged(code))


if __name__ == "__main__":
    unittest.main()
