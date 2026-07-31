import unittest

import defs
from ecs_ast import (
    AstConfig,
    Component,
    ComponentVisibility,
    Entity,
    FieldDef,
    Generator,
    IndexType,
    Selector,
    TypeDef,
    TypeGenerator,
    TypeHelpers,
    TypeNode,
)
from gen import gen_defs, gen_types
from ts import AST_CONFIG


class TypeAstTest(unittest.TestCase):
    def test_rejects_missing_helper_parentheses_with_actionable_error(self):
        with self.assertRaisesRegex(ValueError, "Missing parentheses around 'String'"):
            TypeHelpers.List(TypeHelpers.String)

    def test_hashes_are_structural_and_order_sensitive(self):
        first = TypeHelpers.Dict(a=TypeHelpers.String(), b=TypeHelpers.U32())
        same = TypeHelpers.Dict(a=TypeHelpers.String(), b=TypeHelpers.U32())
        reordered = TypeHelpers.Dict(b=TypeHelpers.U32(), a=TypeHelpers.String())

        self.assertEqual(first.hash, same.hash)
        self.assertNotEqual(first.hash, reordered.hash)

    def test_build_deduplicates_synthetic_types_and_orders_dependencies(self):
        generator = TypeGenerator(AstConfig({}))
        generator.add_type(
            "First", TypeHelpers.List(TypeHelpers.Dict(value=TypeHelpers.U32()))
        )
        generator.add_type(
            "Second", TypeHelpers.List(TypeHelpers.Dict(value=TypeHelpers.U32()))
        )

        built = generator.build()
        by_name = {type_def.name: type_def for type_def in built}
        first_child = by_name["First"].subs[0]
        second_child = by_name["Second"].subs[0]

        self.assertIs(first_child, second_child)
        self.assertLess(first_child.rank, by_name["First"].rank)
        self.assertLess(first_child.subs["value"].rank, first_child.rank)

    def test_rejects_duplicate_and_reserved_type_names(self):
        generator = TypeGenerator(AstConfig({}))
        generator.add_type("Custom", TypeHelpers.String())
        with self.assertRaisesRegex(ValueError, "already defined"):
            generator.add_type("Custom", TypeHelpers.String())
        with self.assertRaisesRegex(ValueError, "Illegal type name"):
            generator.add_type("Entity", TypeHelpers.String())


class GeneratorValidationTest(unittest.TestCase):
    def setUp(self):
        type_generator = TypeGenerator(AST_CONFIG)
        self.types = type_generator.build()
        self.generator = Generator(AST_CONFIG, self.types)
        self.string = self.generator.symbols.String

    def add_component(self, component_id=1, name="Example", **kwargs):
        self.generator.add_component(
            id=component_id,
            name=name,
            visibility=kwargs.pop("visibility", ComponentVisibility.EVERYONE),
            fields=kwargs.pop("fields", {1: FieldDef(name="value", kind=self.string)}),
            **kwargs,
        )
        return getattr(self.generator.symbols, name)

    def test_preserves_sparse_field_ids_visibility_and_hfc(self):
        component = self.add_component(
            component_id=17,
            name="PlayerSessionState",
            visibility=ComponentVisibility.SELF,
            fields={
                2: FieldDef(name="first", kind=self.string),
                9: FieldDef(name="last", kind=self.string),
            },
            hfc=True,
        )

        self.assertEqual(component.prop_name, "player_session_state")
        self.assertEqual([field_id for field_id, _ in component.fields], [2, 9])
        self.assertEqual(component.visibility, ComponentVisibility.SELF)
        self.assertTrue(component.hfc)

    def test_rejects_duplicate_active_and_deprecated_component_ids(self):
        self.add_component(component_id=4)
        with self.assertRaises(AssertionError):
            self.add_component(component_id=4, name="Duplicate")

        self.generator.mark_deprecated_component(7)
        with self.assertRaises(AssertionError):
            self.add_component(component_id=7, name="ReusedDeprecated")
        with self.assertRaises(AssertionError):
            self.generator.mark_deprecated_component(4)

    def test_rejects_reserved_component_and_event_field_names(self):
        with self.assertRaises(AssertionError):
            self.add_component(name="Id")
        with self.assertRaises(AssertionError):
            self.add_component(name="Edit")
        with self.assertRaises(AssertionError):
            self.generator.add_event("Invalid", {"kind": self.string})

    def test_rejects_duplicate_symbols_and_out_of_range_ids(self):
        self.generator.add_event("Ping", {"message": self.string})
        with self.assertRaises(AssertionError):
            self.generator.add_event("Ping", {"message": self.string})
        with self.assertRaises(AssertionError):
            self.add_component(component_id=200, name="TooLarge")

    def test_spatial_selectors_require_position_or_box(self):
        label = self.add_component(name="Label")
        with self.assertRaises(AssertionError):
            self.generator.add_selector(
                "SpatialLabel", [label], index_type=IndexType.SPATIAL
            )

        position = self.add_component(component_id=2, name="Position")
        self.generator.add_selector(
            "SpatialPosition", [label, position], index_type=IndexType.SPATIAL
        )
        selector = self.generator.defs.selectors[-1]
        self.assertEqual(selector.prop_name, "spatial_position_selector")

    def test_selector_matching_requires_every_component(self):
        first = self.add_component(name="First")
        second = self.add_component(component_id=2, name="Second")
        selector = Selector("BothSelector", [first, second], IndexType.SIMPLE)

        self.assertTrue(selector.matches(Entity("Both", [first, second])))
        self.assertFalse(selector.matches(Entity("OnlyFirst", [first])))


class ProductionSchemaContractTest(unittest.TestCase):
    def test_schema_has_unique_stable_identifiers_and_valid_references(self):
        generated_types = gen_types(AST_CONFIG)
        generated_defs = gen_defs(AST_CONFIG, generated_types)

        component_ids = [component.id for component in generated_defs.components]
        component_names = [component.name for component in generated_defs.components]
        self.assertEqual(len(component_ids), len(set(component_ids)))
        self.assertEqual(len(component_names), len(set(component_names)))
        self.assertTrue(all(0 < component_id < 200 for component_id in component_ids))
        self.assertTrue(
            set(component_ids).isdisjoint(generated_defs.deprecated_component_ids)
        )

        known_components = set(generated_defs.components)
        for component in generated_defs.components:
            field_ids = [field_id for field_id, _ in component.fields]
            field_names = [field.name for _, field in component.fields]
            self.assertEqual(len(field_ids), len(set(field_ids)), component.name)
            self.assertEqual(len(field_names), len(set(field_names)), component.name)
            self.assertTrue(all(field_id > 0 for field_id in field_ids))

        for entity in generated_defs.entities:
            self.assertTrue(set(entity.components).issubset(known_components))
        for selector in generated_defs.selectors:
            self.assertTrue(set(selector.components).issubset(known_components))

    def test_critical_wire_ids_remain_pinned(self):
        generated_defs = gen_defs(AST_CONFIG, gen_types(AST_CONFIG))
        ids = {component.name: component.id for component in generated_defs.components}
        self.assertEqual(
            {
                "Position": ids["Position"],
                "Orientation": ids["Orientation"],
                "RigidBody": ids["RigidBody"],
                "Label": ids["Label"],
                "Inventory": ids["Inventory"],
                "NpcState": ids["NpcState"],
                "ShardSeed": ids["ShardSeed"],
                "ShardDiff": ids["ShardDiff"],
            },
            {
                "Position": 54,
                "Orientation": 55,
                "RigidBody": 32,
                "Label": 37,
                "Inventory": 41,
                "NpcState": 67,
                "ShardSeed": 34,
                "ShardDiff": 35,
            },
        )


if __name__ == "__main__":
    unittest.main()
