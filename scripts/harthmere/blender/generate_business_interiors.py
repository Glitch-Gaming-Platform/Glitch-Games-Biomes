#!/usr/bin/env python3
"""Generate optimized Blender-authored interiors for all 19 Harthmere businesses.

The generator is the editable source of truth. It intentionally does not commit a
large .blend binary: headless Blender rebuilds deterministic GLBs, preview images,
collision boxes, interaction anchors, and a JSON manifest from this file.

Coordinate contract:
  Blender X -> world X
  Blender Y -> world Z (entrance toward the back wall)
  Blender Z -> world height
  One Blender unit -> one world meter
  Every interior asset is grounded at the building's first-floor southwest origin.

Run:
  blender --background --python scripts/harthmere/blender/generate_business_interiors.py -- \
    --repo-root "$PWD" --render-previews
"""

from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import bpy
from mathutils import Vector


GENERATOR_VERSION = 1
ASSET_VERSION = "harthmere-business-interiors-blender-v1"

OUTPOST_ID_BY_BUSINESS_TYPE = {
    "exotic_matter_refinery": "outpost_refinery_ashline",
    "biome_maintenance_repair": "outpost_biome_repair_north",
    "biome_design_studio": "outpost_design_glassyard",
    "security_defense_contractor": "outpost_security_redoubt",
    "portal_transit_company": "outpost_portal_eastgate",
    "biome_farming_rare_foods": "outpost_rare_foods_southplot",
    "weapons_tools": "outpost_tools_cinderlane",
    "magic_goods": "outpost_magic_moonstall",
    "exploration_guide": "outpost_exploration_westtrail",
    "custom_home_property_development": "outpost_property_keylot",
    "general_trader": "outpost_trader_brightcart",
    "hunter_wild_meat": "outpost_hunter_ridgecooler",
    "medical_doctor": "outpost_clinic_greenlamp",
    "teleport_owner": "outpost_teleport_returnstone",
    "waste_sanitation_cleanup": "outpost_sanitation_clearbarrel",
    "repair_maintenance_person": "outpost_repair_hingehall",
    "food_service_restaurant": "outpost_restaurant_redpot",
    "courier": "outpost_courier_stampspur",
    "hospitality_inn_hotel_shelter": "outpost_hospitality_lanternrest",
}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--render-previews", action="store_true")
    parser.add_argument("--only", action="append", default=[])
    return parser.parse_args(argv)


def clamp_channel(value: float) -> float:
    return max(0.0, min(1.0, value))


def tint(color: tuple[float, float, float], amount: float) -> tuple[float, float, float]:
    if amount >= 0:
        return tuple(clamp_channel(channel + (1.0 - channel) * amount) for channel in color)
    return tuple(clamp_channel(channel * (1.0 + amount)) for channel in color)


@dataclass(frozen=True)
class Piece:
    label: str
    kind: str
    zone: str | None
    dimensions: tuple[float, float, float]
    location: tuple[float, float, float] | None = None
    role: str = "decor"
    collidable: bool = True
    rotation_degrees: float = 0.0


@dataclass(frozen=True)
class Business:
    slug: str
    name: str
    business_type: str
    footprint: tuple[int, int]
    origin: tuple[int, int, int]
    desk_world: tuple[float, float, float]
    palette: tuple[tuple[float, float, float], tuple[float, float, float], tuple[float, float, float]]
    pieces: tuple[Piece, ...]
    expanded: bool = False
    floors: int = 1


SMALL_ZONES = {
    "A": (12.5, 14.5, 0.0),
    "B": (19.5, 17.6, 0.0),
    "C": (19.2, 10.5, 0.0),
    "D": (6.0, 18.0, 0.0),
    "E": (1.45, 9.0, 0.0),
    "F": (22.55, 7.5, 0.0),
    "G": (1.75, 5.5, 0.0),
    "H": (6.0, 10.5, 0.0),
    "J": (12.5, 18.6, 0.9),
    "K": (6.0, 6.0, 0.0),
}

LARGE_ZONES = {
    "A": (14.5, 16.5, 0.0),
    "B": (23.5, 19.2, 0.0),
    "C": (23.0, 11.5, 0.0),
    "D": (8.0, 19.4, 0.0),
    "E": (1.45, 9.0, 0.0),
    "F": (26.55, 8.0, 0.0),
    "G": (1.75, 5.5, 0.0),
    "H": (7.0, 12.0, 0.0),
    "J": (14.5, 20.4, 0.9),
    "K": (7.0, 6.0, 0.0),
    "U1": (15.0, 18.8, 4.0),
    "U2": (15.0, 10.5, 4.0),
    "U3": (26.5, 13.0, 4.0),
    "U4": (1.75, 7.0, 4.0),
    "U5": (23.0, 19.4, 4.0),
    "U6": (24.0, 6.5, 4.0),
}


def P(label: str, kind: str, zone: str, dimensions, role="decor", collidable=True, rotation_degrees=0.0):
    return Piece(label, kind, zone, tuple(dimensions), None, role, collidable, rotation_degrees)


def L(label: str, kind: str, location, dimensions, role="decor", collidable=True, rotation_degrees=0.0):
    return Piece(label, kind, None, tuple(dimensions), tuple(location), role, collidable, rotation_degrees)


BUSINESSES: tuple[Business, ...] = (
    Business(
        "ashline_containment_works", "Ashline Containment Works", "exotic_matter_refinery",
        (28, 22), (660, 66, -55), (674.5, 67, -38.5),
        ((0.20, 0.12, 0.08), (0.10, 0.34, 0.52), (0.94, 0.45, 0.08)),
        (
            P("Containment desk", "counter", "A", (7.0, 1.2, 1.05), "service_counter"),
            P("Thermoblaster", "reactor", "B", (3.0, 1.8, 2.2), "primary_station"),
            P("Stabilizer chamber bank", "machine", "C", (3.2, 1.5, 2.0), "workstation"),
            P("Quarantine cage", "cage", "D", (4.0, 1.2, 2.3), "stock_storage"),
            P("Spent filter shelving", "shelf", "E", (0.6, 3.0, 2.1), "stock_storage"),
            P("Coolant tank bank", "tank", "F", (0.9, 4.0, 2.5), "stock_storage"),
            P("PPE bench and lockers", "locker_bench", "G", (0.75, 2.4, 1.8), "seating"),
            P("Sample conveyor", "conveyor", "H", (4.0, 1.3, 1.1), "workstation"),
            P("Contamination meter", "board", "J", (4.0, 0.25, 1.8), "dashboard", False),
        ),
    ),
    Business(
        "north_anchor_repair_shed", "North Anchor Repair Shed", "biome_maintenance_repair",
        (28, 22), (752, 62, 27), (766.5, 63, 43.5),
        ((0.27, 0.18, 0.08), (0.08, 0.35, 0.56), (0.22, 0.62, 0.36)),
        (
            P("Anchor repair desk", "counter", "A", (7.0, 1.2, 1.05), "service_counter"),
            P("Anchor calibration rig", "machine", "B", (3.0, 1.6, 2.2), "primary_station"),
            P("Repair workbench", "workbench", "C", (3.2, 1.3, 1.0), "workstation"),
            P("Spare parts shelves", "shelf", "D", (4.0, 0.65, 2.2), "stock_storage"),
            P("Diagnostic tree panel", "board", "E", (0.35, 3.5, 2.0), "dashboard", False),
            P("Tool cabinets", "cabinet", "F", (0.7, 3.0, 2.1), "stock_storage"),
            P("Repair waiting bench", "bench", "G", (0.75, 2.4, 0.95), "seating"),
            P("Parts preview table", "table", "H", (2.6, 1.2, 0.95), "service_table"),
            P("Emergency board", "board", "J", (4.0, 0.25, 1.8), "dashboard", False),
        ), expanded=True,
    ),
    Business(
        "glassyard_biome_studio", "Glassyard Biome Studio", "biome_design_studio",
        (24, 20), (1171, 45, 128), (1183.5, 46, 142.5),
        ((0.38, 0.22, 0.10), (0.84, 0.60, 0.12), (0.24, 0.58, 0.38)),
        (
            P("Mood board counter", "counter", "A", (6.0, 1.2, 1.05), "service_counter"),
            P("Dye-O-Matic", "dye_machine", "B", (2.5, 1.5, 2.0), "primary_station"),
            P("Palette table", "table", "C", (2.6, 1.3, 0.95), "workstation"),
            P("Sample cabinet", "cabinet", "D", (4.0, 0.6, 2.1), "stock_storage"),
            P("Material swatch wall", "swatch_board", "E", (0.3, 4.0, 2.3), "decor", False),
            P("Lighting sample rack", "rack", "F", (0.6, 3.0, 2.0), "stock_storage"),
            P("Client lounge bench", "bench", "G", (0.75, 2.4, 0.95), "seating"),
            P("Drafting table", "drafting", "H", (3.0, 1.4, 1.0), "workstation"),
            P("Trend panel", "board", "J", (4.0, 0.25, 1.8), "dashboard", False),
            P("Showroom plinth", "plinth", "K", (1.2, 1.2, 1.1), "decor"),
        ),
    ),
    Business(
        "redoubt_contract_yard", "Redoubt Contract Yard", "security_defense_contractor",
        (28, 22), (1438, 46, 66), (1452.5, 47, 82.5),
        ((0.18, 0.10, 0.07), (0.47, 0.055, 0.045), (0.50, 0.52, 0.49)),
        (
            P("Fortified contract desk", "counter", "A", (7.0, 1.2, 1.05), "service_counter"),
            P("Perimeter planning rig", "machine", "B", (3.0, 1.5, 2.1), "primary_station"),
            P("Threat card table", "table", "C", (3.0, 1.5, 1.0), "workstation"),
            P("Armory cabinets", "armory", "D", (4.5, 0.7, 2.3), "stock_storage"),
            P("Threat wall", "board", "E", (0.3, 4.0, 2.2), "dashboard", False),
            P("Guard lockers", "locker", "F", (0.7, 3.5, 2.2), "stock_storage"),
            P("Patrol bench", "bench", "G", (0.75, 2.8, 1.0), "seating"),
            P("Armor stand", "armor_stand", "H", (1.2, 1.2, 2.0), "decor"),
            P("Panic and flare panel", "board", "J", (4.0, 0.25, 1.8), "dashboard", False),
            P("Commander desk", "desk", "U1", (3.0, 1.2, 1.0), "workstation"),
            P("War table", "table", "U2", (4.0, 2.0, 1.0), "workstation"),
            P("Archive wall", "shelf", "U3", (0.7, 4.0, 2.2), "stock_storage"),
            P("Squad bench", "bench", "U4", (0.8, 3.0, 1.0), "seating"),
            P("Reserve armory", "armory", "U5", (3.5, 0.7, 2.2), "stock_storage"),
        ), floors=2,
    ),
    Business(
        "eastgate_portal_office", "Eastgate Portal Office", "portal_transit_company",
        (28, 22), (1564, 65, -147), (1578.5, 66, -130.5),
        ((0.20, 0.15, 0.08), (0.08, 0.34, 0.67), (0.07, 0.74, 0.89)),
        (
            P("Route fare terminal", "counter", "A", (7.0, 1.2, 1.05), "service_counter"),
            P("Gate control console", "portal_console", "B", (3.0, 1.5, 2.0), "primary_station"),
            P("Fuel inspection table", "table", "C", (3.0, 1.4, 1.0), "workstation"),
            P("Fuel canister rack", "tank", "D", (4.0, 0.8, 2.2), "stock_storage"),
            P("Route board", "board", "E", (0.3, 4.0, 2.0), "dashboard", False),
            P("Cargo assignment rail", "rack", "F", (0.6, 4.0, 2.2), "stock_storage"),
            P("Passenger bench", "bench", "G", (0.75, 3.0, 0.95), "seating"),
            P("Safety hold console", "machine", "H", (2.5, 1.3, 1.4), "workstation"),
            P("Portal status panel", "board", "J", (4.0, 0.25, 1.8), "dashboard", False),
            P("Decorative portal arch", "arch", "K", (3.0, 0.6, 2.8), "decor", False),
            P("Route operator desk", "desk", "U1", (3.2, 1.4, 1.0), "workstation"),
            P("Regional route table", "table", "U2", (4.0, 2.0, 1.0), "workstation"),
            P("Ticket records wall", "shelf", "U3", (0.7, 4.0, 2.2), "stock_storage"),
            P("Overflow bench", "bench", "U4", (0.8, 3.0, 0.95), "seating"),
            P("Power control cabinet", "machine", "U5", (3.0, 0.7, 2.0), "workstation"),
        ), floors=2,
    ),
    Business(
        "southplot_rare_foods", "Southplot Rare Foods", "biome_farming_rare_foods",
        (24, 20), (1711, 49, -598), (1723.5, 50, -583.5),
        ((0.34, 0.20, 0.08), (0.23, 0.56, 0.22), (0.83, 0.45, 0.09)),
        (
            P("Harvest scale counter", "counter", "A", (6.0, 1.2, 1.05), "service_counter"),
            P("Seed mill", "seed_mill", "B", (2.5, 1.5, 1.8), "primary_station"),
            P("Freshness grading table", "table", "C", (2.8, 1.4, 1.0), "workstation"),
            P("Cold larder cabinet", "cold_larder", "D", (4.0, 0.8, 2.3), "stock_storage"),
            P("Herb drying rack", "rack", "E", (0.6, 3.5, 2.0), "stock_storage"),
            P("Produce bins", "produce_bins", "F", (0.9, 3.0, 1.2), "stock_storage"),
            P("Basket bench", "bench", "G", (0.75, 2.4, 0.95), "seating"),
            P("Seedling planter", "planter", "H", (2.6, 1.2, 0.6), "decor"),
            P("Freshness board", "board", "J", (4.0, 0.25, 1.8), "dashboard", False),
            P("Spoilage bin", "crate", "K", (1.2, 1.2, 1.2), "stock_storage"),
        ),
    ),
    Business(
        "cinderlane_tool_forge", "Cinderlane Tool Forge", "weapons_tools",
        (28, 22), (1616, 42, -791), (1630.5, 43, -774.5),
        ((0.20, 0.09, 0.04), (0.56, 0.12, 0.045), (0.44, 0.47, 0.50)),
        (
            P("Iron and oak repair desk", "counter", "A", (7.0, 1.2, 1.05), "service_counter"),
            P("Forge hearth", "hearth", "B", (3.5, 2.0, 2.5), "primary_station"),
            P("Anvil island", "anvil", "C", (1.4, 1.0, 1.1), "workstation"),
            P("Finished blade rack", "armory", "D", (4.0, 0.6, 2.2), "stock_storage"),
            P("Material rack", "rack", "E", (0.7, 3.5, 2.2), "stock_storage"),
            P("Quench trough", "trough", "F", (0.9, 2.5, 1.0), "workstation"),
            P("Repair intake bench", "bench", "G", (0.75, 2.4, 1.0), "seating"),
            L("Drawers workbench", "workbench", (7.4, 12.0, 0.0), (3.2, 1.3, 1.0), "workstation"),
            P("Quality and horseshoe wall", "board", "J", (4.0, 0.25, 1.8), "dashboard", False),
            P("Work order desk", "desk", "U1", (3.0, 1.2, 1.0), "workstation"),
            P("Apprentice assembly bench", "workbench", "U2", (4.0, 1.6, 1.0), "workstation"),
            P("Tool pattern wall", "armory", "U3", (0.7, 4.0, 2.2), "stock_storage"),
            P("Gear inspection bench", "bench", "U4", (0.8, 3.0, 0.95), "seating"),
            P("Metal stock cabinet", "cabinet", "U5", (3.5, 0.8, 2.2), "stock_storage"),
        ), floors=2,
    ),
    Business(
        "moonstall_ward_shop", "Moonstall Ward Shop", "magic_goods",
        (24, 20), (1715, 26, -916), (1727.5, 27, -901.5),
        ((0.24, 0.10, 0.26), (0.47, 0.13, 0.58), (0.08, 0.74, 0.84)),
        (
            P("Ward tray counter", "counter", "A", (6.0, 1.2, 1.05), "service_counter"),
            P("Thermolite", "crystal_machine", "B", (2.0, 1.5, 2.0), "primary_station"),
            P("Brewing cauldron", "cauldron", "C", (1.5, 1.5, 1.3), "workstation"),
            P("Potion and charm shelves", "potion_shelf", "D", (4.0, 0.6, 2.2), "stock_storage"),
            P("Charm wall", "potion_shelf", "E", (0.6, 3.5, 2.1), "stock_storage"),
            P("Rare component cabinet", "cabinet", "F", (0.7, 3.0, 2.2), "stock_storage"),
            P("Arcane reading bench", "bench", "G", (0.75, 2.4, 0.95), "seating"),
            P("Ward circle plinth", "ward_plinth", "H", (2.0, 2.0, 0.15), "decor", False),
            P("Anomaly warning panel", "board", "J", (4.0, 0.25, 1.8), "dashboard", False),
            P("Rune lantern", "lantern", "K", (0.5, 0.5, 1.8), "decor", False),
        ),
    ),
    Business(
        "westtrail_guide_table", "Westtrail Guide Table", "exploration_guide",
        (24, 20), (1529, 51, -705), (1541.5, 52, -690.5),
        ((0.28, 0.17, 0.08), (0.29, 0.43, 0.19), (0.67, 0.47, 0.22)),
        (
            P("Map table customer desk", "counter", "A", (6.0, 1.2, 1.05), "service_counter"),
            P("Survey camera station", "camera_tripod", "B", (2.2, 1.4, 1.7), "primary_station"),
            P("Expedition planning table", "table", "C", (3.0, 1.5, 1.0), "workstation"),
            P("Trail supply rack", "rack", "D", (4.0, 0.7, 2.1), "stock_storage"),
            P("Route wall map", "map_board", "E", (0.25, 4.0, 2.0), "dashboard", False),
            P("Lantern and gear rack", "rack", "F", (0.6, 3.0, 2.1), "stock_storage"),
            P("Customer bench", "bench", "G", (0.75, 2.4, 0.95), "seating"),
            P("Field kit display", "plinth", "H", (2.0, 1.2, 1.1), "decor"),
            P("Hazard pin board", "board", "J", (4.0, 0.25, 1.8), "dashboard", False),
        ),
    ),
    Business(
        "keylot_property_office", "Keylot Property Office", "custom_home_property_development",
        (24, 20), (1217, 53, -799), (1229.5, 54, -784.5),
        ((0.34, 0.20, 0.10), (0.10, 0.32, 0.58), (0.82, 0.70, 0.46)),
        (
            P("Blueprint desk", "counter", "A", (6.0, 1.2, 1.05), "service_counter"),
            P("Model home display", "model_home", "B", (2.0, 1.5, 1.2), "primary_station"),
            P("Drafting table", "drafting", "C", (3.0, 1.5, 1.2), "workstation"),
            P("Deed and permit cabinet", "cabinet", "D", (4.0, 0.6, 2.2), "stock_storage"),
            P("Finish sample wall", "swatch_board", "E", (0.4, 4.0, 2.0), "decor", False),
            P("Material rack", "rack", "F", (0.7, 3.0, 2.2), "stock_storage"),
            P("Signing bench", "bench", "G", (0.75, 2.4, 0.95), "seating"),
            P("Sample table", "table", "H", (2.4, 1.2, 0.95), "service_table"),
            P("Permit stage board", "board", "J", (4.0, 0.25, 1.8), "dashboard", False),
            P("Survey tool stand", "rack", "K", (1.2, 1.2, 1.8), "decor"),
        ),
    ),
    Business(
        "brightcart_general_house", "Brightcart General House", "general_trader",
        (24, 20), (974, 52, -944), (986.5, 53, -929.5),
        ((0.39, 0.22, 0.08), (0.76, 0.48, 0.08), (0.25, 0.50, 0.22)),
        (
            P("Stock ledger counter", "counter", "A", (6.0, 1.2, 1.05), "service_counter"),
            P("Parcel and trade scale", "scale_table", "B", (2.2, 1.4, 1.2), "primary_station"),
            P("General prep table", "table", "C", (2.6, 1.3, 1.0), "workstation"),
            P("Ready order shelves", "shelf", "D", (4.0, 0.7, 2.1), "stock_storage"),
            P("Dry goods shelves", "shelf", "E", (0.7, 4.0, 2.2), "stock_storage"),
            P("Tool cabinets", "cabinet", "F", (0.7, 3.0, 2.2), "stock_storage"),
            P("Customer basket bench", "bench", "G", (0.75, 2.4, 0.95), "seating"),
            P("Produce display", "produce_bins", "H", (2.8, 1.3, 1.1), "stock_storage"),
            P("Price chalkboard", "board", "J", (4.0, 0.25, 1.8), "dashboard", False),
            P("Barrel and crate cluster", "crate_cluster", "K", (1.8, 1.5, 1.3), "stock_storage"),
        ),
    ),
    Business(
        "ridgecooler_larder", "Ridgecooler Larder", "hunter_wild_meat",
        (28, 22), (762, 36, -678), (776.5, 37, -661.5),
        ((0.22, 0.11, 0.06), (0.33, 0.55, 0.66), (0.52, 0.08, 0.06)),
        (
            P("Stone top cold counter", "counter", "A", (7.0, 1.2, 1.05), "service_counter"),
            P("Cold prep table", "cold_table", "B", (3.2, 1.5, 1.0), "primary_station"),
            P("Ice display trough", "ice_trough", "C", (3.0, 1.4, 1.0), "stock_storage"),
            P("Walk-in larder face", "cold_larder", "D", (5.0, 1.2, 2.4), "stock_storage"),
            P("Hanging cuts rack", "meat_rack", "E", (0.8, 4.0, 2.3), "stock_storage"),
            P("Wrapped meat shelving", "meat_shelf", "F", (0.7, 4.0, 2.2), "stock_storage"),
            P("Packing bench", "bench", "G", (0.75, 2.4, 0.95), "seating"),
            P("Wash table", "wash_table", "H", (2.4, 1.2, 1.0), "workstation"),
            P("Ecology and freshness board", "board", "J", (4.0, 0.25, 1.8), "dashboard", False),
        ),
    ),
    Business(
        "greenlamp_walk_in_clinic", "Greenlamp Walk-In Clinic", "medical_doctor",
        (28, 22), (642, 64, -193), (656.5, 65, -176.5),
        ((0.66, 0.55, 0.34), (0.19, 0.52, 0.31), (0.82, 0.83, 0.74)),
        (
            P("Triage desk", "counter", "A", (7.0, 1.2, 1.05), "service_counter"),
            P("Treatment cot", "bed", "B", (1.2, 2.2, 0.75), "primary_station"),
            P("Diagnostic Thermolite", "crystal_machine", "C", (2.0, 1.4, 1.8), "workstation"),
            P("Medicine cabinet", "potion_shelf", "D", (4.0, 0.6, 2.2), "stock_storage"),
            P("Patient record shelf", "shelf", "E", (0.6, 3.0, 2.0), "stock_storage"),
            P("Wash station", "wash_table", "F", (0.8, 2.5, 1.2), "workstation"),
            P("Clinic waiting bench", "bench", "G", (0.75, 3.0, 0.95), "seating"),
            P("Second treatment cot", "bed_screen", "H", (1.2, 2.2, 0.75), "workstation"),
            P("Severity triage board", "board", "J", (4.0, 0.25, 1.8), "dashboard", False),
        ), expanded=True,
    ),
    Business(
        "returnstone_pad_office", "Returnstone Pad Office", "teleport_owner",
        (24, 20), (30, 40, -40), (42.5, 41, -25.5),
        ((0.21, 0.16, 0.09), (0.12, 0.40, 0.70), (0.18, 0.78, 0.87)),
        (
            P("Pad terminal", "counter", "A", (6.0, 1.2, 1.05), "service_counter"),
            P("Homestone console", "crystal_machine", "B", (2.2, 1.6, 1.8), "primary_station"),
            P("Calibration table", "table", "C", (2.4, 1.3, 1.0), "workstation"),
            P("Access token cabinet", "cabinet", "D", (4.0, 0.6, 2.1), "stock_storage"),
            P("Link stability panel", "board", "E", (0.3, 3.5, 2.0), "dashboard", False),
            P("Fuel cell rack", "tank", "F", (0.7, 3.0, 2.1), "stock_storage"),
            P("Access waiting bench", "bench", "G", (0.75, 2.4, 0.95), "seating"),
            P("Return pad plinth", "ward_plinth", "H", (2.8, 2.8, 0.2), "decor", False),
            P("Private route ledger", "board", "J", (4.0, 0.25, 1.8), "dashboard", False),
            P("Calibration lantern", "lantern", "K", (0.5, 0.5, 1.8), "decor", False),
        ),
    ),
    Business(
        "clearbarrel_cleanup_yard", "Clearbarrel Cleanup Yard", "waste_sanitation_cleanup",
        (24, 20), (423, 44, -357), (435.5, 45, -342.5),
        ((0.43, 0.38, 0.25), (0.20, 0.57, 0.34), (0.84, 0.68, 0.10)),
        (
            P("Cleanup dispatch desk", "counter", "A", (6.0, 1.2, 1.05), "service_counter"),
            P("Composter", "composter", "B", (2.2, 1.6, 2.0), "primary_station"),
            P("Decontamination spray station", "wash_machine", "C", (2.2, 1.4, 1.8), "workstation"),
            P("Reagent and PPE cabinet", "cabinet", "D", (4.0, 0.6, 2.2), "stock_storage"),
            P("Waste sorting rack", "rack", "E", (0.8, 4.0, 2.0), "stock_storage"),
            P("Sealed barrel rack", "tank", "F", (0.9, 3.5, 2.0), "stock_storage"),
            P("Cleanup gear bench", "bench", "G", (0.75, 2.4, 0.95), "seating"),
            P("Wash trough", "trough", "H", (2.8, 1.3, 1.1), "workstation"),
            P("Classification board", "board", "J", (4.0, 0.25, 1.8), "dashboard", False),
            P("Spill kit cabinet", "cabinet", "K", (1.2, 0.8, 1.4), "stock_storage"),
        ),
    ),
    Business(
        "hingehall_repair_shop", "Hingehall Repair Shop", "repair_maintenance_person",
        (28, 22), (415, 45, -328), (429.5, 46, -311.5),
        ((0.30, 0.17, 0.08), (0.11, 0.34, 0.55), (0.86, 0.39, 0.07)),
        (
            P("Fix-it customer desk", "counter", "A", (7.0, 1.2, 1.05), "service_counter"),
            P("Main repair workbench", "workbench", "B", (3.2, 1.4, 1.1), "primary_station"),
            P("Vise bench", "workbench", "C", (2.5, 1.2, 1.0), "workstation"),
            P("Parts cabinet", "cabinet", "D", (4.5, 0.7, 2.2), "stock_storage"),
            P("Tool pegboard", "tool_board", "E", (0.4, 4.0, 2.0), "decor", False),
            P("Broken object rack", "rack", "F", (0.8, 4.0, 2.2), "stock_storage"),
            P("Waiting and intake bench", "bench", "G", (0.75, 3.0, 0.95), "seating"),
            P("Repair intake table", "table", "H", (2.8, 1.3, 1.0), "service_table"),
            P("Work order board", "board", "J", (4.0, 0.25, 1.8), "dashboard", False),
            P("Parts cart", "cart", "K", (1.2, 0.9, 1.0), "stock_storage"),
        ), expanded=True,
    ),
    Business(
        "redpot_service_kitchen", "Redpot Service Kitchen", "food_service_restaurant",
        (28, 22), (411, 43, -393), (425.5, 44, -376.5),
        ((0.38, 0.16, 0.06), (0.63, 0.08, 0.045), (0.74, 0.42, 0.09)),
        (
            P("Pass window service counter", "counter", "A", (7.0, 1.3, 1.1), "service_counter"),
            P("Cooking range and hearth", "kitchen_range", "B", (4.0, 1.8, 2.4), "primary_station"),
            P("Prep island", "table", "C", (3.2, 1.5, 1.0), "workstation"),
            P("Ingredient pantry", "food_shelf", "D", (4.5, 0.8, 2.3), "stock_storage"),
            P("Spice and dry goods shelf", "food_shelf", "E", (0.7, 3.5, 2.1), "stock_storage"),
            P("Dish wash station", "wash_table", "F", (0.9, 2.8, 1.2), "workstation"),
            P("Wall dining bench", "bench", "G", (0.75, 3.0, 1.0), "seating"),
            P("Cold prep table", "cold_table", "H", (2.8, 1.3, 1.0), "workstation"),
            P("Menu and sanitation board", "board", "J", (4.0, 0.25, 1.8), "dashboard", False),
            P("Two seat dining cluster", "dining", "K", (3.8, 2.4, 1.0), "seating"),
        ), expanded=True,
    ),
    Business(
        "stampspur_courier_office", "Stampspur Courier Office", "courier",
        (28, 22), (737, 46, -562), (751.5, 47, -545.5),
        ((0.30, 0.17, 0.07), (0.13, 0.49, 0.27), (0.78, 0.63, 0.26)),
        (
            P("Parcel scale desk", "counter", "A", (7.0, 1.2, 1.05), "service_counter"),
            P("Parcel sorting table", "sorting_table", "B", (3.2, 1.6, 1.0), "primary_station"),
            P("Lockbox inspection table", "table", "C", (2.6, 1.3, 1.0), "workstation"),
            P("Parcel shelving", "parcel_shelf", "D", (5.0, 0.8, 2.2), "stock_storage"),
            P("Route and proof wall", "map_board", "E", (0.3, 4.0, 2.1), "dashboard", False),
            P("Outgoing bin rack", "parcel_shelf", "F", (0.8, 4.0, 2.1), "stock_storage"),
            P("Dispatch waiting bench", "bench", "G", (0.75, 3.0, 0.95), "seating"),
            P("Incoming parcel cage", "cage", "H", (3.0, 1.3, 2.0), "stock_storage"),
            P("Trust and medicine timer", "board", "J", (4.0, 0.25, 1.8), "dashboard", False),
            P("Satchel rack", "rack", "K", (1.4, 0.8, 1.8), "stock_storage"),
        ), expanded=True,
    ),
    Business(
        "lanternrest_road_inn", "Lanternrest Road Inn", "hospitality_inn_hotel_shelter",
        (28, 22), (592, 47, -495), (606.5, 48, -478.5),
        ((0.40, 0.20, 0.07), (0.70, 0.39, 0.08), (0.86, 0.63, 0.16)),
        (
            P("Reception desk", "counter", "A", (7.0, 1.2, 1.1), "service_counter"),
            P("Kitchen service sideboard", "food_shelf", "B", (3.0, 1.4, 1.0), "primary_station"),
            P("Hearth and bard nook", "hearth", "C", (2.8, 1.6, 2.0), "decor"),
            P("Linen cabinet", "cabinet", "D", (4.0, 0.7, 2.2), "stock_storage"),
            P("Luggage rack", "rack", "E", (0.7, 3.5, 2.0), "stock_storage"),
            P("Key and guest cubby wall", "key_cubby", "F", (0.7, 3.5, 2.2), "stock_storage"),
            P("Common bench", "bench", "G", (0.75, 3.0, 1.0), "seating"),
            P("Common table", "dining", "H", (3.0, 1.5, 0.95), "seating"),
            P("Room board", "board", "J", (4.0, 0.25, 1.8), "dashboard", False),
            P("Hearth lounge cluster", "lounge", "K", (3.0, 2.5, 1.0), "seating"),
            L("Guest bed northwest", "bed", (8.5, 6.5, 4.0), (1.2, 2.2, 0.75), "seating"),
            L("Guest nightstand northwest", "nightstand", (10.0, 6.5, 4.0), (0.65, 0.55, 0.75), "decor"),
            L("Guest wardrobe northwest", "cabinet", (1.5, 6.5, 4.0), (1.2, 0.6, 2.0), "stock_storage"),
            L("Guest bed northeast", "bed", (20.5, 6.5, 4.0), (1.2, 2.2, 0.75), "seating"),
            L("Guest nightstand northeast", "nightstand", (22.0, 6.5, 4.0), (0.65, 0.55, 0.75), "decor"),
            L("Guest wardrobe northeast", "cabinet", (26.5, 6.5, 4.0), (1.2, 0.6, 2.0), "stock_storage"),
            L("Guest bed southwest", "bed", (9.5, 15.0, 4.0), (1.2, 2.2, 0.75), "seating"),
            L("Guest nightstand southwest", "nightstand", (11.0, 15.0, 4.0), (0.65, 0.55, 0.75), "decor"),
            L("Guest wardrobe southwest", "cabinet", (8.5, 20.2, 4.0), (1.2, 0.6, 2.0), "stock_storage"),
            L("Guest bed southeast", "bed", (20.5, 15.0, 4.0), (1.2, 2.2, 0.75), "seating"),
            L("Guest nightstand southeast", "nightstand", (22.0, 15.0, 4.0), (0.65, 0.55, 0.75), "decor"),
            L("Guest wardrobe southeast", "cabinet", (20.5, 20.2, 4.0), (1.2, 0.6, 2.0), "stock_storage"),
            L("Corridor linen cart", "cart", (14.5, 11.5, 4.0), (1.2, 0.8, 1.0), "stock_storage"),
        ), floors=2,
    ),
)


@dataclass
class BuildContext:
    business: Business
    collection: bpy.types.Collection
    root: bpy.types.Object
    materials: dict[str, bpy.types.Material]
    lod: int
    created: list[bpy.types.Object] = field(default_factory=list)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)


def make_material(name: str, color, metallic=0.0, roughness=0.72, emission=None):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission is not None:
        emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        if emission_input:
            emission_input.default_value = (*emission, 1.0)
        strength = bsdf.inputs.get("Emission Strength")
        if strength:
            strength.default_value = 2.0
    return mat


def business_materials(business: Business) -> dict[str, bpy.types.Material]:
    wood, accent, stock = business.palette
    return {
        "wood": make_material(f"{business.slug}_wood", wood, roughness=0.78),
        "wood_light": make_material(f"{business.slug}_wood_light", tint(wood, 0.28), roughness=0.72),
        "wood_dark": make_material(f"{business.slug}_wood_dark", tint(wood, -0.35), roughness=0.82),
        "metal": make_material(f"{business.slug}_metal", (0.18, 0.21, 0.24), metallic=0.78, roughness=0.36),
        "accent": make_material(f"{business.slug}_accent", accent, metallic=0.12, roughness=0.52),
        "stock": make_material(f"{business.slug}_stock", stock, roughness=0.68),
        "light": make_material(f"{business.slug}_light", tint(accent, 0.42), metallic=0.05, roughness=0.28, emission=tint(accent, 0.48)),
        "neutral": make_material(f"{business.slug}_neutral", (0.66, 0.61, 0.49), roughness=0.88),
        "dark": make_material(f"{business.slug}_dark", (0.035, 0.045, 0.055), metallic=0.25, roughness=0.5),
    }


def move_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    for linked in list(obj.users_collection):
        linked.objects.unlink(obj)
    collection.objects.link(obj)


def blender_safe_name(name: str) -> str:
    """Avoid Blender 5.2's numeric suffix parser seeing long float fragments."""
    sanitized = re.sub(r"[^A-Za-z0-9_-]+", "_", name).strip("_")
    return (sanitized or "HarthmereObject")[:58]


def finish_object(ctx: BuildContext, obj: bpy.types.Object, material_key: str, bevel=0.035):
    move_to_collection(obj, ctx.collection)
    obj.parent = ctx.root
    obj.data.materials.append(ctx.materials[material_key])
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        modifier = obj.modifiers.new("Voxel edge bevel", "BEVEL")
        modifier.width = bevel if ctx.lod == 0 else min(bevel, 0.018)
        modifier.segments = 1
        modifier.limit_method = "ANGLE"
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)
    ctx.created.append(obj)
    return obj


def box(ctx, name, dimensions, location, material="wood", rotation=(0.0, 0.0, 0.0), bevel=0.035):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = blender_safe_name(name)
    obj.dimensions = dimensions
    return finish_object(ctx, obj, material, bevel)


def cylinder(ctx, name, radius, depth, location, material="metal", rotation=(0.0, 0.0, 0.0), vertices=None, bevel=0.02):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices or (12 if ctx.lod == 0 else 8),
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = blender_safe_name(name)
    return finish_object(ctx, obj, material, bevel)


def torus(ctx, name, major_radius, minor_radius, location, material="accent", rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=12 if ctx.lod == 0 else 8,
        minor_segments=6 if ctx.lod == 0 else 4,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = blender_safe_name(name)
    return finish_object(ctx, obj, material, 0.0)


def piece_location(business: Business, piece: Piece) -> tuple[float, float, float]:
    if piece.location is not None:
        return piece.location
    zones = LARGE_ZONES if business.footprint == (28, 22) else SMALL_ZONES
    return zones[piece.zone]


def rotated_location(base, dx, dy, dz, angle):
    c, s = math.cos(angle), math.sin(angle)
    return (base[0] + dx * c - dy * s, base[1] + dx * s + dy * c, base[2] + dz)


def build_counter(ctx: BuildContext, piece: Piece, loc, angle):
    w, d, h = piece.dimensions
    top = 0.13
    box(ctx, f"{piece.label}_body", (w - 0.18, d - 0.12, h - top - 0.1), rotated_location(loc, 0, 0, (h - top - 0.1) / 2 + 0.08, angle), "wood", (0, 0, angle), 0.06)
    box(ctx, f"{piece.label}_countertop", (w + 0.18, d + 0.12, top), rotated_location(loc, 0, 0, h - top / 2, angle), "wood_light", (0, 0, angle), 0.055)
    box(ctx, f"{piece.label}_toe_kick", (w - 0.4, 0.12, 0.18), rotated_location(loc, 0, -d / 2 + 0.08, 0.09, angle), "wood_dark", (0, 0, angle), 0.018)
    panel_count = max(3, int(w / 1.5))
    panel_w = (w - 0.55) / panel_count
    for index in range(panel_count):
        x = -w / 2 + 0.28 + panel_w * (index + 0.5)
        box(ctx, f"{piece.label}_front_panel_{index}", (panel_w - 0.12, 0.055, h * 0.56), rotated_location(loc, x, -d / 2 - 0.004, h * 0.47, angle), "wood_light" if index % 2 == 0 else "accent", (0, 0, angle), 0.025)
    for x in (-w / 2 + 0.16, w / 2 - 0.16):
        box(ctx, f"{piece.label}_pillar_{x}", (0.18, 0.16, h - 0.14), rotated_location(loc, x, -d / 2 + 0.02, (h - 0.14) / 2, angle), "metal", (0, 0, angle), 0.02)
    # Employee-side drawers, open shelf, writing pad, and readable terminal.
    box(ctx, f"{piece.label}_employee_shelf", (w * 0.44, 0.30, 0.08), rotated_location(loc, -w * 0.20, d / 2 - 0.08, 0.48, angle), "wood_light", (0, 0, angle), 0.02)
    box(ctx, f"{piece.label}_drawer_bank", (w * 0.22, 0.16, 0.50), rotated_location(loc, w * 0.30, d / 2 + 0.005, 0.45, angle), "wood_dark", (0, 0, angle), 0.025)
    if ctx.lod == 0:
        for index in range(2):
            box(ctx, f"{piece.label}_drawer_{index}", (w * 0.19, 0.045, 0.18), rotated_location(loc, w * 0.30, d / 2 + 0.095, 0.30 + index * 0.22, angle), "wood_light", (0, 0, angle), 0.012)
            cylinder(ctx, f"{piece.label}_drawer_handle_{index}", 0.025, w * 0.075, rotated_location(loc, w * 0.30, d / 2 + 0.135, 0.30 + index * 0.22, angle), "metal", (0, math.pi / 2, angle), 8, 0.008)
        # Terminal and ledger are deliberately part of the counter mesh, not extra draw calls.
        box(ctx, f"{piece.label}_terminal_base", (0.48, 0.34, 0.08), rotated_location(loc, w * 0.23, 0.04, h + 0.04, angle), "metal", (0, 0, angle), 0.02)
        box(ctx, f"{piece.label}_terminal_screen", (0.54, 0.11, 0.40), rotated_location(loc, w * 0.23, 0.10, h + 0.28, angle), "dark", (math.radians(-10), 0, angle), 0.025)
        box(ctx, f"{piece.label}_terminal_glow", (0.40, 0.02, 0.27), rotated_location(loc, w * 0.23, 0.045, h + 0.29, angle), "light", (math.radians(-10), 0, angle), 0.01)
        box(ctx, f"{piece.label}_ledger", (0.55, 0.38, 0.045), rotated_location(loc, -w * 0.18, 0.0, h + 0.025, angle), "neutral", (0, 0, angle + 0.08), 0.012)
        cylinder(ctx, f"{piece.label}_service_bell", 0.09, 0.10, rotated_location(loc, 0.0, -0.08, h + 0.05, angle), "metal", vertices=12)
        add_counter_identity(ctx, piece, loc, angle)


def add_counter_identity(ctx, piece, loc, angle):
    w, d, h = piece.dimensions
    slug = ctx.business.slug
    front = -d / 2 - 0.07
    center_z = h * 0.57
    if any(token in slug for token in ("portal", "returnstone", "moonstall")):
        torus(ctx, f"{piece.label}_logo_ring", 0.25, 0.055, rotated_location(loc, 0, front, center_z, angle), "light", (math.pi / 2, 0, angle))
        box(ctx, f"{piece.label}_logo_crystal", (0.12, 0.08, 0.44), rotated_location(loc, 0, front - 0.01, center_z, angle), "accent", (0, 0, angle + math.pi / 4), 0.015)
    elif "greenlamp" in slug:
        box(ctx, f"{piece.label}_logo_cross_v", (0.14, 0.07, 0.52), rotated_location(loc, 0, front, center_z, angle), "accent", (0, 0, angle), 0.02)
        box(ctx, f"{piece.label}_logo_cross_h", (0.46, 0.07, 0.14), rotated_location(loc, 0, front - 0.005, center_z, angle), "accent", (0, 0, angle), 0.02)
    elif any(token in slug for token in ("cinderlane", "hingehall", "north_anchor")):
        box(ctx, f"{piece.label}_logo_tool_handle", (0.12, 0.07, 0.50), rotated_location(loc, 0, front, center_z, angle), "metal", (0, 0, angle + 0.5), 0.018)
        box(ctx, f"{piece.label}_logo_tool_head", (0.40, 0.08, 0.14), rotated_location(loc, 0.12, front, center_z + 0.16, angle), "accent", (0, 0, angle + 0.5), 0.018)
    elif "redpot" in slug:
        cylinder(ctx, f"{piece.label}_logo_plate", 0.24, 0.05, rotated_location(loc, 0, front, center_z, angle), "neutral", (math.pi / 2, 0, angle), 12, 0.0)
        box(ctx, f"{piece.label}_logo_spoon", (0.08, 0.05, 0.52), rotated_location(loc, 0.33, front, center_z, angle), "metal", (0, 0, angle), 0.012)
    elif "lanternrest" in slug:
        torus(ctx, f"{piece.label}_logo_key_ring", 0.16, 0.045, rotated_location(loc, -0.12, front, center_z + 0.1, angle), "accent", (math.pi / 2, 0, angle))
        box(ctx, f"{piece.label}_logo_key_stem", (0.10, 0.06, 0.45), rotated_location(loc, 0.04, front, center_z - 0.08, angle), "accent", (0, 0, angle - 0.55), 0.012)
    elif "stampspur" in slug:
        box(ctx, f"{piece.label}_logo_envelope", (0.52, 0.07, 0.34), rotated_location(loc, 0, front, center_z, angle), "neutral", (0, 0, angle), 0.02)
        box(ctx, f"{piece.label}_logo_route", (0.42, 0.035, 0.06), rotated_location(loc, 0, front - 0.04, center_z, angle), "accent", (0, 0, angle + 0.55), 0.008)
    else:
        box(ctx, f"{piece.label}_logo_panel", (0.62, 0.07, 0.42), rotated_location(loc, 0, front, center_z, angle), "accent", (0, 0, angle), 0.04)
        for x in (-0.18, 0.0, 0.18):
            box(ctx, f"{piece.label}_logo_mark_{x}", (0.07, 0.035, 0.24 + abs(x)), rotated_location(loc, x, front - 0.04, center_z, angle), "light", (0, 0, angle), 0.008)


def build_table(ctx, piece, loc, angle, workbench=False):
    w, d, h = piece.dimensions
    top_h = 0.13 if not workbench else 0.18
    box(ctx, f"{piece.label}_top", (w, d, top_h), rotated_location(loc, 0, 0, h - top_h / 2, angle), "wood_light" if not workbench else "metal", (0, 0, angle), 0.045)
    leg = 0.12 if not workbench else 0.16
    for x in (-w / 2 + 0.15, w / 2 - 0.15):
        for y in (-d / 2 + 0.15, d / 2 - 0.15):
            box(ctx, f"{piece.label}_leg_{x}_{y}", (leg, leg, h - top_h), rotated_location(loc, x, y, (h - top_h) / 2, angle), "wood_dark", (0, 0, angle), 0.02)
    box(ctx, f"{piece.label}_lower_shelf", (w - 0.25, d - 0.25, 0.08), rotated_location(loc, 0, 0, h * 0.36, angle), "wood", (0, 0, angle), 0.02)
    if ctx.lod == 0:
        for index in range(3):
            x = -w * 0.24 + index * w * 0.24
            box(ctx, f"{piece.label}_surface_item_{index}", (0.28, 0.22, 0.08 + index * 0.035), rotated_location(loc, x, -0.08 + index * 0.08, h + 0.04 + index * 0.017, angle), "stock" if index != 1 else "accent", (0, 0, angle + 0.12 * index), 0.015)
        if workbench:
            box(ctx, f"{piece.label}_vise_base", (0.34, 0.28, 0.18), rotated_location(loc, w * 0.30, 0, h + 0.09, angle), "metal", (0, 0, angle), 0.025)
            box(ctx, f"{piece.label}_vise_jaw", (0.28, 0.12, 0.28), rotated_location(loc, w * 0.30, 0, h + 0.25, angle), "metal", (0, 0, angle), 0.02)


def build_shelf(ctx, piece, loc, angle, contents="stock"):
    w, d, h = piece.dimensions
    long_x = w >= d
    length = w if long_x else d
    depth = d if long_x else w
    post = 0.10
    for end in (-length / 2 + post, length / 2 - post):
        dimensions = (post, depth, h) if long_x else (depth, post, h)
        offset = (end, 0) if long_x else (0, end)
        box(ctx, f"{piece.label}_post_{end}", dimensions, rotated_location(loc, offset[0], offset[1], h / 2, angle), "wood_dark", (0, 0, angle), 0.018)
    levels = 4 if ctx.lod == 0 else 3
    for level in range(levels):
        z = 0.12 + level * (h - 0.18) / max(1, levels - 1)
        dimensions = (length, depth, 0.09) if long_x else (depth, length, 0.09)
        box(ctx, f"{piece.label}_shelf_{level}", dimensions, rotated_location(loc, 0, 0, z, angle), "wood_light", (0, 0, angle), 0.018)
        if level == levels - 1:
            continue
        item_count = max(2, min(6, int(length / 0.55))) if ctx.lod == 0 else max(2, min(4, int(length / 0.8)))
        for index in range(item_count):
            along = -length / 2 + 0.24 + (index + 0.5) * (length - 0.48) / item_count
            x, y = (along, 0) if long_x else (0, along)
            item_h = min(0.34, (h / levels) * 0.55) * (0.75 + (index % 3) * 0.12)
            if contents in ("potion", "food") and index % 2 == 0:
                cylinder(ctx, f"{piece.label}_jar_{level}_{index}", 0.09, item_h, rotated_location(loc, x, y, z + 0.045 + item_h / 2, angle), "accent" if contents == "potion" else "stock", vertices=8, bevel=0.008)
            else:
                size = 0.22 if contents != "parcel" else 0.30
                dims = (size, min(depth * 0.65, 0.30), item_h) if long_x else (min(depth * 0.65, 0.30), size, item_h)
                box(ctx, f"{piece.label}_stock_{level}_{index}", dims, rotated_location(loc, x, y, z + 0.045 + item_h / 2, angle), "stock" if index % 3 else "accent", (0, 0, angle), 0.012)


def build_cabinet(ctx, piece, loc, angle, locker=False):
    w, d, h = piece.dimensions
    box(ctx, f"{piece.label}_body", (w, d, h), rotated_location(loc, 0, 0, h / 2, angle), "wood" if not locker else "metal", (0, 0, angle), 0.045)
    face_y = -d / 2 - 0.012
    doors = max(1, int((w if w >= d else d) / 0.8))
    long_x = w >= d
    length = w if long_x else d
    for index in range(doors):
        along = -length / 2 + (index + 0.5) * length / doors
        panel_w = length / doors - 0.08
        dims = (panel_w, 0.045, h - 0.22) if long_x else (0.045, panel_w, h - 0.22)
        offset = (along, face_y) if long_x else (-w / 2 - 0.012, along)
        box(ctx, f"{piece.label}_door_{index}", dims, rotated_location(loc, offset[0], offset[1], h / 2, angle), "wood_light" if not locker else "accent", (0, 0, angle), 0.018)
        if ctx.lod == 0:
            handle_offset = (along + panel_w * 0.34, face_y - 0.04) if long_x else (-w / 2 - 0.05, along + panel_w * 0.34)
            cylinder(ctx, f"{piece.label}_handle_{index}", 0.025, 0.14, rotated_location(loc, handle_offset[0], handle_offset[1], h * 0.55, angle), "metal", (0, math.pi / 2, angle), 8, 0.006)
    box(ctx, f"{piece.label}_top_trim", (w + 0.08, d + 0.08, 0.10), rotated_location(loc, 0, 0, h + 0.05, angle), "wood_light" if not locker else "metal", (0, 0, angle), 0.02)


def build_bench(ctx, piece, loc, angle):
    w, d, h = piece.dimensions
    long_x = w >= d
    length = w if long_x else d
    depth = d if long_x else w
    seat_dims = (length, depth, 0.14) if long_x else (depth, length, 0.14)
    box(ctx, f"{piece.label}_seat", seat_dims, rotated_location(loc, 0, 0, h * 0.50, angle), "wood_light", (0, 0, angle), 0.045)
    for end in (-length / 2 + 0.18, length / 2 - 0.18):
        dims = (0.14, depth * 0.72, h * 0.5) if long_x else (depth * 0.72, 0.14, h * 0.5)
        offset = (end, 0) if long_x else (0, end)
        box(ctx, f"{piece.label}_leg_{end}", dims, rotated_location(loc, offset[0], offset[1], h * 0.25, angle), "wood_dark", (0, 0, angle), 0.02)
    back_dims = (length, 0.12, h * 0.46) if long_x else (0.12, length, h * 0.46)
    back_offset = (0, depth / 2 - 0.05) if long_x else (depth / 2 - 0.05, 0)
    box(ctx, f"{piece.label}_back", back_dims, rotated_location(loc, back_offset[0], back_offset[1], h * 0.76, angle), "wood", (0, 0, angle), 0.035)


def build_chair(ctx, piece, loc, angle, padded=False):
    w, d, h = piece.dimensions
    seat_z = h * 0.46
    box(ctx, f"{piece.label}_seat", (w * 0.88, d * 0.82, 0.14), rotated_location(loc, 0, 0, seat_z, angle), "accent" if padded else "wood_light", (0, 0, angle), 0.045)
    for x_index, x in enumerate((-w * 0.34, w * 0.34)):
        for y_index, y in enumerate((-d * 0.30, d * 0.30)):
            box(ctx, f"{piece.label}_leg_{x_index}_{y_index}", (0.10, 0.10, seat_z), rotated_location(loc, x, y, seat_z / 2, angle), "wood_dark", (0, 0, angle), 0.018)
    back_h = h * 0.50
    box(ctx, f"{piece.label}_back", (w * 0.88, 0.12, back_h), rotated_location(loc, 0, d * 0.35, seat_z + back_h * 0.43, angle), "accent" if padded else "wood", (0, 0, angle), 0.04)
    if ctx.lod == 0 and padded:
        box(ctx, f"{piece.label}_seat_cushion", (w * 0.74, d * 0.66, 0.08), rotated_location(loc, 0, -d * 0.02, seat_z + 0.10, angle), "neutral", (0, 0, angle), 0.04)


def build_t_table(ctx, piece, loc, angle):
    w, d, h = piece.dimensions
    top_h = 0.15
    box(ctx, f"{piece.label}_cross_top", (w, d * 0.42, top_h), rotated_location(loc, 0, d * 0.27, h - top_h / 2, angle), "wood_light", (0, 0, angle), 0.045)
    box(ctx, f"{piece.label}_stem_top", (w * 0.42, d, top_h), rotated_location(loc, 0, -d * 0.04, h - top_h / 2, angle), "wood_light", (0, 0, angle), 0.045)
    for x_index, x in enumerate((-w * 0.35, w * 0.35)):
        box(ctx, f"{piece.label}_cross_leg_{x_index}", (0.13, 0.13, h - top_h), rotated_location(loc, x, d * 0.28, (h - top_h) / 2, angle), "wood_dark", (0, 0, angle), 0.02)
    for y_index, y in enumerate((-d * 0.34, d * 0.08)):
        box(ctx, f"{piece.label}_stem_leg_{y_index}", (0.13, 0.13, h - top_h), rotated_location(loc, 0, y, (h - top_h) / 2, angle), "wood_dark", (0, 0, angle), 0.02)
    if ctx.lod == 0:
        box(ctx, f"{piece.label}_center_runner", (w * 0.32, d * 0.72, 0.08), rotated_location(loc, 0, -d * 0.04, h * 0.34, angle), "wood", (0, 0, angle), 0.018)


def build_storage_container(ctx, piece, loc, angle, chest=False, lockbox=False, cargo=False):
    w, d, h = piece.dimensions
    body_material = "metal" if lockbox else "wood"
    box(ctx, f"{piece.label}_body", (w, d, h * 0.68), rotated_location(loc, 0, 0, h * 0.34, angle), body_material, (0, 0, angle), 0.045)
    box(ctx, f"{piece.label}_lid", (w + 0.04, d + 0.04, h * 0.18), rotated_location(loc, 0, 0, h * 0.77, angle), "metal" if lockbox else "wood_light", (0, 0, angle), 0.04)
    band_count = 2 if ctx.lod == 0 else 1
    for index in range(band_count):
        x = 0 if band_count == 1 else (-w * 0.28 if index == 0 else w * 0.28)
        box(ctx, f"{piece.label}_band_{index}", (0.09, d + 0.07, h * 0.86), rotated_location(loc, x, 0, h * 0.43, angle), "accent" if chest else "metal", (0, 0, angle), 0.015)
    box(ctx, f"{piece.label}_latch", (w * 0.18, 0.08, h * 0.22), rotated_location(loc, 0, -d * 0.53, h * 0.58, angle), "accent" if chest else "metal", (0, 0, angle), 0.018)
    if ctx.lod == 0 and cargo:
        for direction in (-1, 1):
            box(ctx, f"{piece.label}_cargo_brace_{direction}", (w * 0.06, d + 0.09, h * 0.82), rotated_location(loc, direction * w * 0.22, 0, h * 0.41, angle + direction * 0.34), "wood_dark", (0, 0, angle + direction * 0.34), 0.012)


def build_wall_lantern(ctx, piece, loc, angle):
    w, d, h = piece.dimensions
    box(ctx, f"{piece.label}_backplate", (w * 0.68, 0.10, h * 0.72), rotated_location(loc, 0, d * 0.30, h * 0.50, angle), "metal", (0, 0, angle), 0.025)
    box(ctx, f"{piece.label}_bracket", (0.10, d * 0.72, 0.10), rotated_location(loc, 0, 0, h * 0.68, angle), "metal", (0, 0, angle), 0.018)
    box(ctx, f"{piece.label}_light", (w * 0.58, d * 0.58, h * 0.42), rotated_location(loc, 0, -d * 0.18, h * 0.42, angle), "light", (0, 0, angle), 0.045)
    box(ctx, f"{piece.label}_cap", (w * 0.72, d * 0.72, 0.10), rotated_location(loc, 0, -d * 0.18, h * 0.68, angle), "metal", (0, 0, angle), 0.025)


def build_board(ctx, piece, loc, angle, swatches=False, tools=False, map_style=False):
    w, d, h = piece.dimensions
    box(ctx, f"{piece.label}_board", (w, d, h), rotated_location(loc, 0, 0, h / 2, angle), "dark" if not swatches else "neutral", (0, 0, angle), 0.025)
    long_x = w >= d
    length = w if long_x else d
    frame = 0.10
    for end in (-length / 2 + frame / 2, length / 2 - frame / 2):
        dims = (frame, d + 0.05, h + 0.12) if long_x else (w + 0.05, frame, h + 0.12)
        offset = (end, 0) if long_x else (0, end)
        box(ctx, f"{piece.label}_frame_side_{end}", dims, rotated_location(loc, offset[0], offset[1], h / 2, angle), "wood_light", (0, 0, angle), 0.015)
    if ctx.lod == 0:
        count = 8 if swatches else 6
        for index in range(count):
            along = -length * 0.36 + (index % 4) * length * 0.24
            z = h * (0.28 + (index // 4) * 0.36)
            dims = (length * 0.15, d * 0.20 + 0.025, h * 0.16) if long_x else (w * 0.20 + 0.025, length * 0.15, h * 0.16)
            offset = (along, -d / 2 - 0.02) if long_x else (-w / 2 - 0.02, along)
            material = "accent" if swatches or map_style else ("metal" if tools else "neutral")
            box(ctx, f"{piece.label}_card_{index}", dims, rotated_location(loc, offset[0], offset[1], z, angle), material if index % 3 else "stock", (0, 0, angle + (0.03 if index % 2 else -0.03)), 0.008)


def build_machine(ctx, piece, loc, angle, crystal=False, reactor=False, dye=False, portal=False, composter=False, wash=False):
    w, d, h = piece.dimensions
    box(ctx, f"{piece.label}_base", (w, d, 0.20), rotated_location(loc, 0, 0, 0.10, angle), "metal", (0, 0, angle), 0.04)
    box(ctx, f"{piece.label}_body", (w * 0.78, d * 0.78, h * 0.64), rotated_location(loc, 0, 0, h * 0.39, angle), "accent" if dye else "wood_dark", (0, 0, angle), 0.06)
    box(ctx, f"{piece.label}_control", (w * 0.55, 0.12, h * 0.28), rotated_location(loc, 0, -d * 0.40, h * 0.66, angle), "dark", (math.radians(-8), 0, angle), 0.025)
    box(ctx, f"{piece.label}_screen", (w * 0.40, 0.035, h * 0.16), rotated_location(loc, 0, -d * 0.47, h * 0.68, angle), "light", (math.radians(-8), 0, angle), 0.012)
    if crystal:
        box(ctx, f"{piece.label}_crystal", (w * 0.30, d * 0.30, h * 0.56), rotated_location(loc, 0, 0, h * 0.72, angle), "light", (0, 0, angle + math.pi / 4), 0.055)
    elif portal:
        torus(ctx, f"{piece.label}_portal_ring", min(w, h) * 0.27, 0.08, rotated_location(loc, 0, 0, h * 0.70, angle), "light", (math.pi / 2, 0, angle))
    else:
        tank_count = 3 if ctx.lod == 0 else 2
        for index in range(tank_count):
            x = (-0.28 + index * 0.28) * w
            cylinder(ctx, f"{piece.label}_tank_{index}", min(w, d) * 0.12, h * 0.44, rotated_location(loc, x, d * 0.18, h * 0.68, angle), "light" if reactor else ("stock" if composter else "metal"), vertices=10)
    if ctx.lod == 0:
        for side in (-1, 1):
            cylinder(ctx, f"{piece.label}_pipe_{side}", 0.055, h * 0.48, rotated_location(loc, side * w * 0.42, 0, h * 0.46, angle), "metal", vertices=8)
        for index in range(3):
            cylinder(ctx, f"{piece.label}_indicator_{index}", 0.045, 0.04, rotated_location(loc, -w * 0.16 + index * w * 0.16, -d * 0.47, h * 0.55, angle), "light" if index == 1 else "stock", (math.pi / 2, 0, angle), 8, 0.0)


def build_tank(ctx, piece, loc, angle):
    w, d, h = piece.dimensions
    long_x = w >= d
    length = w if long_x else d
    count = max(2, min(5, int(length / 0.7)))
    for index in range(count):
        along = -length / 2 + (index + 0.5) * length / count
        x, y = (along, 0) if long_x else (0, along)
        radius = min((length / count) * 0.34, min(w, d) * 0.36)
        cylinder(ctx, f"{piece.label}_tank_{index}", radius, h * 0.72, rotated_location(loc, x, y, h * 0.38, angle), "accent" if index % 2 else "metal", vertices=12)
        if ctx.lod == 0:
            torus(ctx, f"{piece.label}_band_{index}", radius * 0.92, 0.025, rotated_location(loc, x, y, h * 0.48, angle), "metal", (0, 0, angle))
    box(ctx, f"{piece.label}_rack_base", (w, d, 0.12), rotated_location(loc, 0, 0, 0.06, angle), "wood_dark", (0, 0, angle), 0.02)


def build_cage(ctx, piece, loc, angle):
    w, d, h = piece.dimensions
    for x in (-w / 2, w / 2):
        for y in (-d / 2, d / 2):
            box(ctx, f"{piece.label}_post_{x}_{y}", (0.10, 0.10, h), rotated_location(loc, x, y, h / 2, angle), "metal", (0, 0, angle), 0.015)
    rail_levels = 3 if ctx.lod == 0 else 2
    for level in range(rail_levels):
        z = 0.25 + level * (h - 0.5) / max(1, rail_levels - 1)
        for y in (-d / 2, d / 2):
            box(ctx, f"{piece.label}_rail_x_{level}_{y}", (w, 0.07, 0.07), rotated_location(loc, 0, y, z, angle), "metal", (0, 0, angle), 0.01)
        for x in (-w / 2, w / 2):
            box(ctx, f"{piece.label}_rail_y_{level}_{x}", (0.07, d, 0.07), rotated_location(loc, x, 0, z, angle), "metal", (0, 0, angle), 0.01)
    box(ctx, f"{piece.label}_stock_floor", (w - 0.18, d - 0.18, 0.10), rotated_location(loc, 0, 0, 0.08, angle), "wood_dark", (0, 0, angle), 0.018)
    if ctx.lod == 0:
        for index in range(4):
            box(ctx, f"{piece.label}_contained_stock_{index}", (0.44, 0.34, 0.30 + 0.1 * (index % 2)), rotated_location(loc, (-0.6 + index * 0.4) * min(1, w / 3), 0, 0.22, angle), "stock" if index % 2 else "accent", (0, 0, angle), 0.018)


def build_hearth(ctx, piece, loc, angle, kitchen=False):
    w, d, h = piece.dimensions
    box(ctx, f"{piece.label}_stone_base", (w, d, h * 0.45), rotated_location(loc, 0, 0, h * 0.225, angle), "metal", (0, 0, angle), 0.055)
    box(ctx, f"{piece.label}_fire_box", (w * 0.55, d * 0.65, h * 0.34), rotated_location(loc, 0, -d * 0.18, h * 0.42, angle), "dark", (0, 0, angle), 0.045)
    box(ctx, f"{piece.label}_ember", (w * 0.38, d * 0.40, 0.15), rotated_location(loc, 0, -d * 0.20, h * 0.36, angle), "light", (0, 0, angle), 0.035)
    box(ctx, f"{piece.label}_hood", (w * 0.82, d * 0.72, h * 0.38), rotated_location(loc, 0, 0, h * 0.76, angle), "wood_dark" if not kitchen else "metal", (0, 0, angle), 0.05)
    if ctx.lod == 0:
        for x in (-w * 0.25, 0, w * 0.25):
            box(ctx, f"{piece.label}_tool_{x}", (0.06, 0.06, h * 0.42), rotated_location(loc, x, d * 0.47, h * 0.56, angle), "metal", (0, 0, angle + 0.08 * x), 0.008)
        if kitchen:
            cylinder(ctx, f"{piece.label}_pot", min(w, d) * 0.16, 0.30, rotated_location(loc, 0, 0, h * 0.55, angle), "accent", vertices=12)


def build_anvil(ctx, piece, loc, angle):
    w, d, h = piece.dimensions
    box(ctx, f"{piece.label}_stump", (w * 0.52, d * 0.62, h * 0.58), rotated_location(loc, 0, 0, h * 0.29, angle), "wood_dark", (0, 0, angle), 0.045)
    box(ctx, f"{piece.label}_anvil_base", (w * 0.62, d * 0.56, h * 0.14), rotated_location(loc, 0, 0, h * 0.63, angle), "metal", (0, 0, angle), 0.025)
    box(ctx, f"{piece.label}_anvil_top", (w * 0.92, d * 0.42, h * 0.18), rotated_location(loc, 0, 0, h * 0.78, angle), "metal", (0, 0, angle), 0.035)
    box(ctx, f"{piece.label}_horn", (w * 0.30, d * 0.24, h * 0.15), rotated_location(loc, w * 0.50, 0, h * 0.80, angle), "metal", (0, math.radians(16), angle), 0.025)


def build_trough(ctx, piece, loc, angle, ice=False):
    w, d, h = piece.dimensions
    box(ctx, f"{piece.label}_base", (w, d, 0.16), rotated_location(loc, 0, 0, 0.08, angle), "metal", (0, 0, angle), 0.03)
    for x in (-w / 2 + 0.08, w / 2 - 0.08):
        box(ctx, f"{piece.label}_side_x_{x}", (0.16, d, h), rotated_location(loc, x, 0, h / 2, angle), "wood_dark", (0, 0, angle), 0.025)
    for y in (-d / 2 + 0.08, d / 2 - 0.08):
        box(ctx, f"{piece.label}_side_y_{y}", (w - 0.24, 0.16, h), rotated_location(loc, 0, y, h / 2, angle), "wood_dark", (0, 0, angle), 0.025)
    box(ctx, f"{piece.label}_contents", (w - 0.34, d - 0.34, 0.14), rotated_location(loc, 0, 0, h * 0.60, angle), "light" if ice else "accent", (0, 0, angle), 0.025)


def build_bed(ctx, piece, loc, angle, privacy=False):
    w, d, h = piece.dimensions
    box(ctx, f"{piece.label}_frame", (w, d, 0.18), rotated_location(loc, 0, 0, 0.28, angle), "wood_dark", (0, 0, angle), 0.035)
    box(ctx, f"{piece.label}_mattress", (w - 0.12, d - 0.12, h * 0.52), rotated_location(loc, 0, 0, 0.48, angle), "neutral", (0, 0, angle), 0.055)
    box(ctx, f"{piece.label}_blanket", (w - 0.16, d * 0.55, 0.08), rotated_location(loc, 0, d * 0.18, h * 0.76, angle), "accent", (0, 0, angle), 0.025)
    if ctx.lod == 0:
        box(ctx, f"{piece.label}_pillow", (w * 0.72, d * 0.25, 0.16), rotated_location(loc, 0, -d * 0.32, h * 0.79, angle), "stock", (0, 0, angle), 0.055)
    if privacy:
        screen_h = 2.0
        box(ctx, f"{piece.label}_privacy_screen", (0.08, d + 0.6, screen_h), rotated_location(loc, -w * 0.85, 0, screen_h / 2, angle), "accent", (0, 0, angle), 0.025)


def build_arch(ctx, piece, loc, angle):
    w, d, h = piece.dimensions
    for x in (-w / 2 + 0.12, w / 2 - 0.12):
        box(ctx, f"{piece.label}_post_{x}", (0.22, d, h * 0.78), rotated_location(loc, x, 0, h * 0.39, angle), "wood_dark", (0, 0, angle), 0.035)
    box(ctx, f"{piece.label}_lintel", (w, d, 0.24), rotated_location(loc, 0, 0, h * 0.82, angle), "metal", (0, 0, angle), 0.04)
    torus(ctx, f"{piece.label}_energy_ring", w * 0.30, 0.07, rotated_location(loc, 0, 0, h * 0.50, angle), "light", (math.pi / 2, 0, angle))


def build_planter(ctx, piece, loc, angle):
    w, d, h = piece.dimensions
    box(ctx, f"{piece.label}_box", (w, d, h * 0.50), rotated_location(loc, 0, 0, h * 0.25, angle), "wood", (0, 0, angle), 0.035)
    count = 5 if ctx.lod == 0 else 3
    for index in range(count):
        x = -w * 0.35 + index * w * 0.70 / max(1, count - 1)
        cylinder(ctx, f"{piece.label}_plant_{index}", 0.08, h * 0.55, rotated_location(loc, x, 0, h * 0.65, angle), "accent", vertices=8)


def build_lantern(ctx, piece, loc, angle):
    _, _, h = piece.dimensions
    box(ctx, f"{piece.label}_post", (0.10, 0.10, h * 0.72), rotated_location(loc, 0, 0, h * 0.36, angle), "metal", (0, 0, angle), 0.015)
    box(ctx, f"{piece.label}_light", (0.36, 0.36, h * 0.24), rotated_location(loc, 0, 0, h * 0.77, angle), "light", (0, 0, angle), 0.045)
    box(ctx, f"{piece.label}_cap", (0.46, 0.46, 0.10), rotated_location(loc, 0, 0, h * 0.92, angle), "metal", (0, 0, angle), 0.025)


def build_plinth(ctx, piece, loc, angle, ward=False, model_home=False):
    w, d, h = piece.dimensions
    box(ctx, f"{piece.label}_base", (w, d, max(0.12, h * 0.35)), rotated_location(loc, 0, 0, max(0.12, h * 0.35) / 2, angle), "wood_dark", (0, 0, angle), 0.045)
    if ward:
        torus(ctx, f"{piece.label}_ward_ring", min(w, d) * 0.36, 0.05, rotated_location(loc, 0, 0, h + 0.05, angle), "light", (0, 0, angle))
        for index in range(4):
            a = index * math.pi / 2
            box(ctx, f"{piece.label}_rune_{index}", (0.14, 0.14, 0.08), rotated_location(loc, math.cos(a) * w * 0.32, math.sin(a) * d * 0.32, h + 0.04, angle), "accent", (0, 0, angle + a), 0.012)
    elif model_home:
        box(ctx, f"{piece.label}_model_body", (w * 0.55, d * 0.55, h * 0.42), rotated_location(loc, 0, 0, h * 0.62, angle), "neutral", (0, 0, angle), 0.035)
        box(ctx, f"{piece.label}_model_roof", (w * 0.68, d * 0.68, h * 0.18), rotated_location(loc, 0, 0, h * 0.88, angle), "accent", (0, math.radians(18), angle), 0.03)
    else:
        box(ctx, f"{piece.label}_display", (w * 0.42, d * 0.42, h * 0.46), rotated_location(loc, 0, 0, h * 0.68, angle), "accent", (0, 0, angle + math.pi / 4), 0.045)


def build_camera(ctx, piece, loc, angle):
    w, d, h = piece.dimensions
    for index, (x, y) in enumerate(((-0.35, -0.22), (0.35, -0.22), (0.0, 0.36))):
        box(ctx, f"{piece.label}_tripod_leg_{index}", (0.07, 0.07, h * 0.72), rotated_location(loc, x * w * 0.45, y * d * 0.45, h * 0.36, angle), "metal", (0.08 * y, 0.08 * x, angle), 0.01)
    box(ctx, f"{piece.label}_camera_body", (w * 0.42, d * 0.48, h * 0.28), rotated_location(loc, 0, 0, h * 0.76, angle), "wood_dark", (0, 0, angle), 0.045)
    cylinder(ctx, f"{piece.label}_lens", min(w, d) * 0.14, d * 0.22, rotated_location(loc, 0, -d * 0.34, h * 0.77, angle), "light", (math.pi / 2, 0, angle), 12)


def build_scale(ctx, piece, loc, angle):
    build_table(ctx, piece, loc, angle)
    w, _, h = piece.dimensions
    box(ctx, f"{piece.label}_scale_column", (0.10, 0.10, 0.55), rotated_location(loc, 0, 0, h + 0.28, angle), "metal", (0, 0, angle), 0.015)
    box(ctx, f"{piece.label}_scale_beam", (w * 0.52, 0.08, 0.08), rotated_location(loc, 0, 0, h + 0.52, angle), "metal", (0, 0, angle), 0.015)
    for side in (-1, 1):
        cylinder(ctx, f"{piece.label}_scale_pan_{side}", w * 0.12, 0.06, rotated_location(loc, side * w * 0.25, 0, h + 0.36, angle), "accent", vertices=12)


def build_dining(ctx, piece, loc, angle, lounge=False):
    w, d, h = piece.dimensions
    table_piece = Piece(piece.label + " table", "table", None, (w * 0.58, d * 0.58, h * 0.82), loc, piece.role, True)
    build_table(ctx, table_piece, loc, angle)
    bench_dims = (w * 0.24, d * 0.80, h) if w >= d else (w * 0.80, d * 0.24, h)
    for side in (-1, 1):
        offset = (side * w * 0.40, 0) if w >= d else (0, side * d * 0.40)
        bench_piece = Piece(f"{piece.label} seat {side}", "bench", None, bench_dims, None, "seating", True)
        build_bench(ctx, bench_piece, rotated_location(loc, offset[0], offset[1], 0, angle), angle)


def build_piece(ctx: BuildContext, piece: Piece):
    loc = piece_location(ctx.business, piece)
    angle = math.radians(piece.rotation_degrees)
    kind = piece.kind
    if kind == "counter": build_counter(ctx, piece, loc, angle)
    elif kind in ("table", "desk", "drafting", "cold_table", "sorting_table", "wash_table"): build_table(ctx, piece, loc, angle, workbench=kind in ("drafting", "cold_table", "sorting_table", "wash_table"))
    elif kind == "t_table": build_t_table(ctx, piece, loc, angle)
    elif kind in ("wooden_chair", "padded_chair"): build_chair(ctx, piece, loc, angle, padded=kind == "padded_chair")
    elif kind == "workbench": build_table(ctx, piece, loc, angle, workbench=True)
    elif kind in ("shelf", "food_shelf", "potion_shelf", "parcel_shelf", "meat_shelf", "cold_larder"):
        contents = "food" if kind in ("food_shelf", "meat_shelf", "cold_larder") else "potion" if kind == "potion_shelf" else "parcel" if kind == "parcel_shelf" else "stock"
        build_shelf(ctx, piece, loc, angle, contents)
    elif kind in ("cabinet", "locker", "armory", "key_cubby"): build_cabinet(ctx, piece, loc, angle, locker=kind in ("locker", "armory"))
    elif kind == "locker_bench":
        locker_piece = Piece(piece.label + " lockers", "locker", None, (piece.dimensions[0], piece.dimensions[1] * 0.55, piece.dimensions[2]), None, piece.role, True)
        build_cabinet(ctx, locker_piece, loc, angle, locker=True)
        bench_piece = Piece(piece.label + " bench", "bench", None, (piece.dimensions[0], piece.dimensions[1] * 0.38, piece.dimensions[2] * 0.52), None, "seating", True)
        build_bench(ctx, bench_piece, rotated_location(loc, 0, -piece.dimensions[1] * 0.48, 0, angle), angle)
    elif kind == "bench": build_bench(ctx, piece, loc, angle)
    elif kind in ("board", "map_board", "swatch_board", "tool_board"):
        build_board(ctx, piece, loc, angle, swatches=kind == "swatch_board", tools=kind == "tool_board", map_style=kind == "map_board")
    elif kind in ("machine", "reactor", "dye_machine", "portal_console", "crystal_machine", "composter", "wash_machine", "seed_mill"):
        build_machine(ctx, piece, loc, angle, crystal=kind == "crystal_machine", reactor=kind == "reactor", dye=kind == "dye_machine", portal=kind == "portal_console", composter=kind in ("composter", "seed_mill"), wash=kind == "wash_machine")
    elif kind == "tank": build_tank(ctx, piece, loc, angle)
    elif kind == "cage": build_cage(ctx, piece, loc, angle)
    elif kind in ("hearth", "kitchen_range"): build_hearth(ctx, piece, loc, angle, kitchen=kind == "kitchen_range")
    elif kind == "anvil": build_anvil(ctx, piece, loc, angle)
    elif kind in ("trough", "ice_trough"): build_trough(ctx, piece, loc, angle, ice=kind == "ice_trough")
    elif kind in ("bed", "bed_screen"): build_bed(ctx, piece, loc, angle, privacy=kind == "bed_screen")
    elif kind == "arch": build_arch(ctx, piece, loc, angle)
    elif kind == "planter": build_planter(ctx, piece, loc, angle)
    elif kind == "lantern": build_lantern(ctx, piece, loc, angle)
    elif kind == "wall_lantern": build_wall_lantern(ctx, piece, loc, angle)
    elif kind in ("plinth", "ward_plinth", "model_home", "armor_stand"):
        build_plinth(ctx, piece, loc, angle, ward=kind == "ward_plinth", model_home=kind == "model_home")
    elif kind == "camera_tripod": build_camera(ctx, piece, loc, angle)
    elif kind == "scale_table": build_scale(ctx, piece, loc, angle)
    elif kind in ("dining", "lounge"): build_dining(ctx, piece, loc, angle, lounge=kind == "lounge")
    elif kind == "cauldron":
        cylinder(ctx, f"{piece.label}_bowl", min(piece.dimensions[0], piece.dimensions[1]) * 0.34, piece.dimensions[2] * 0.46, rotated_location(loc, 0, 0, piece.dimensions[2] * 0.42, angle), "accent", vertices=12)
        torus(ctx, f"{piece.label}_rim", min(piece.dimensions[0], piece.dimensions[1]) * 0.34, 0.055, rotated_location(loc, 0, 0, piece.dimensions[2] * 0.66, angle), "metal")
        box(ctx, f"{piece.label}_glow", (piece.dimensions[0] * 0.34, piece.dimensions[1] * 0.34, 0.10), rotated_location(loc, 0, 0, piece.dimensions[2] * 0.66, angle), "light", (0, 0, angle), 0.03)
    elif kind == "conveyor":
        build_table(ctx, piece, loc, angle, workbench=True)
        for index in range(5 if ctx.lod == 0 else 3):
            cylinder(ctx, f"{piece.label}_roller_{index}", piece.dimensions[1] * 0.12, piece.dimensions[1] * 0.72, rotated_location(loc, -piece.dimensions[0] * 0.38 + index * piece.dimensions[0] * 0.19, 0, piece.dimensions[2] + 0.05, angle), "metal", (math.pi / 2, 0, angle), 8)
    elif kind in ("rack", "meat_rack"):
        build_shelf(ctx, piece, loc, angle, "food" if kind == "meat_rack" else "stock")
    elif kind == "produce_bins":
        build_shelf(ctx, piece, loc, angle, "food")
    elif kind in ("wood_container", "treasure_chest", "cargo_crate", "lockbox"):
        build_storage_container(ctx, piece, loc, angle, chest=kind == "treasure_chest", lockbox=kind == "lockbox", cargo=kind == "cargo_crate")
    elif kind in ("crate", "crate_cluster", "cart"):
        w, d, h = piece.dimensions
        count = 1 if kind == "crate" else 3
        for index in range(count):
            dx = (-0.24 + index * 0.24) * w if count > 1 else 0
            box(ctx, f"{piece.label}_crate_{index}", (w / max(1, count) * 0.82, d * (0.72 if index else 0.9), h * (0.62 + 0.10 * (index % 2))), rotated_location(loc, dx, 0, h * 0.34, angle), "wood" if index % 2 else "stock", (0, 0, angle + 0.06 * index), 0.035)
        if kind == "cart":
            for side in (-1, 1):
                cylinder(ctx, f"{piece.label}_wheel_{side}", min(w, d) * 0.22, 0.08, rotated_location(loc, side * w * 0.32, d * 0.42, min(w, d) * 0.22, angle), "metal", (math.pi / 2, 0, angle), 10)
    elif kind == "nightstand": build_cabinet(ctx, piece, loc, angle)
    else: build_table(ctx, piece, loc, angle)


def create_context(business: Business, lod: int) -> BuildContext:
    collection = bpy.data.collections.new(f"{business.slug}_lod{lod}")
    bpy.context.scene.collection.children.link(collection)
    root = bpy.data.objects.new(f"{business.slug}_root", None)
    root["harthmereAssetVersion"] = ASSET_VERSION
    root["businessType"] = business.business_type
    root["lod"] = lod
    collection.objects.link(root)
    return BuildContext(business, collection, root, business_materials(business), lod)


def join_by_material(ctx: BuildContext) -> None:
    groups: dict[str, list[bpy.types.Object]] = {}
    for obj in list(ctx.created):
        if obj.type != "MESH" or not obj.data.materials:
            continue
        groups.setdefault(obj.data.materials[0].name, []).append(obj)
    ctx.created.clear()
    for material_name, objects in groups.items():
        if len(objects) == 1:
            joined = objects[0]
            joined.name = f"{ctx.business.slug}_{material_name.rsplit('_', 1)[-1]}_lod{ctx.lod}"
            joined.parent = ctx.root
            ctx.created.append(joined)
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        joined = bpy.context.object
        joined.name = f"{ctx.business.slug}_{material_name.rsplit('_', 1)[-1]}_lod{ctx.lod}"
        joined.parent = ctx.root
        ctx.created.append(joined)
        joined.select_set(False)


def delete_context(ctx: BuildContext) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in list(ctx.collection.objects):
        obj.select_set(True)
    bpy.ops.object.delete(use_global=False)
    bpy.data.collections.remove(ctx.collection)


def export_context(ctx: BuildContext, path: Path) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    ctx.root.select_set(True)
    for obj in ctx.created:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = ctx.root
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
    )


def look_at(obj: bpy.types.Object, target) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_preview(ctx: BuildContext, output: Path) -> None:
    business = ctx.business
    width, depth = business.footprint
    preview_collection = bpy.data.collections.new(f"{business.slug}_preview")
    bpy.context.scene.collection.children.link(preview_collection)
    ground_material = make_material(f"{business.slug}_preview_ground", tint(business.palette[0], -0.55), roughness=0.92)
    preview_ctx = BuildContext(business, preview_collection, ctx.root, {"ground": ground_material}, 1)
    bpy.ops.mesh.primitive_cube_add(location=(width / 2, depth / 2, -0.08))
    ground = bpy.context.object
    ground.name = "Preview ground"
    ground.dimensions = (width, depth, 0.12)
    move_to_collection(ground, preview_collection)
    ground.data.materials.append(ground_material)
    bpy.context.view_layer.objects.active = ground
    ground.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ground.select_set(False)

    lights = []
    for location, energy, size in (
        ((width * 0.85, -depth * 0.20, 12.0), 1800, 7.0),
        ((-width * 0.15, depth * 0.35, 8.0), 1100, 5.0),
        ((width * 0.50, depth * 1.15, 10.0), 1500, 5.0),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        move_to_collection(light, preview_collection)
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        look_at(light, (width / 2, depth / 2, 0.7))
        lights.append(light)

    bpy.ops.object.camera_add(location=(width * 1.06, -depth * 0.72, 17.5))
    camera = bpy.context.object
    move_to_collection(camera, preview_collection)
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = max(width, depth) * 1.22
    look_at(camera, (width / 2, depth / 2, 1.0))
    scene = bpy.context.scene
    scene.camera = camera
    supported_engines = {item.identifier for item in scene.bl_rna.properties["render"].fixed_type.properties["engine"].enum_items}
    scene.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in supported_engines else "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 760
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.filepath = str(output)
    scene.world.color = (0.018, 0.024, 0.034)
    scene.view_settings.look = "AgX - Medium High Contrast"
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)

    for obj in list(preview_collection.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(preview_collection)


def gltfpack_path(repo_root: Path) -> Path:
    candidate = repo_root / "node_modules" / ".bin" / "gltfpack"
    if candidate.exists():
        return candidate
    found = shutil.which("gltfpack")
    if found:
        return Path(found)
    raise RuntimeError("gltfpack 1.2 is required; run npm run assets:install-gltfpack")


def compress_glb(gltfpack: Path, source: Path, output: Path, report: Path) -> None:
    subprocess.run(
        [str(gltfpack), "-i", str(source), "-o", str(output), "-cc", "-ke", "-r", str(report)],
        check=True,
    )
    source.unlink()


def collision_box(piece: Piece, loc) -> dict[str, Any]:
    return {
        "label": piece.label,
        "role": piece.role,
        "center": [round(loc[0], 3), round(loc[1], 3), round(loc[2] + piece.dimensions[2] / 2, 3)],
        "size": [round(value, 3) for value in piece.dimensions],
        "rotationDegrees": piece.rotation_degrees,
    }


def manifest_entry(business: Business, lod0_path: Path, lod1_path: Path, repo_root: Path) -> dict[str, Any]:
    customer_point = (14.5, 15.1, 0.0) if business.footprint == (28, 22) else (12.5, 13.1, 0.0)
    staff_point = (14.5, 18.0, 0.0) if business.footprint == (28, 22) else (12.5, 16.1, 0.0)
    queue_point = (business.footprint[0] / 2 + 0.5, 3.5, 0.0)
    pieces = []
    collisions = []
    for piece in business.pieces:
        loc = piece_location(business, piece)
        pieces.append({
            "label": piece.label,
            "kind": piece.kind,
            "role": piece.role,
            "location": [round(value, 3) for value in loc],
            "size": [round(value, 3) for value in piece.dimensions],
            "rotationDegrees": piece.rotation_degrees,
            "collidable": piece.collidable,
        })
        if piece.collidable:
            collisions.append(collision_box(piece, loc))
    anchor = [business.origin[0], business.origin[1] + 1, business.origin[2]]
    return {
        "slug": business.slug,
        "outpostId": OUTPOST_ID_BY_BUSINESS_TYPE[business.business_type],
        "displayName": business.name,
        "businessType": business.business_type,
        "footprint": {"width": business.footprint[0], "depth": business.footprint[1], "floors": business.floors},
        "expandedFromCurrent": business.expanded,
        "shellOrigin": list(business.origin),
        "assetWorldAnchor": anchor,
        "deskWorldPivot": list(business.desk_world),
        "assets": {
            "lod0": "/" + str(lod0_path.relative_to(repo_root / "public")),
            "lod1": "/" + str(lod1_path.relative_to(repo_root / "public")),
        },
        "lodPolicy": {"lod0MaxDistanceMeters": 16, "lod1MaxDistanceMeters": 28, "hiddenBeyondMeters": 28},
        "interactionPoints": {
            "customer": list(customer_point),
            "staff": list(staff_point),
            "queueStart": list(queue_point),
            "entrance": [business.footprint[0] / 2 + 0.5, -0.5, 0.0],
        },
        "protectedAisle": {
            "xMin": customer_point[0] - 2.0,
            "xMax": customer_point[0] + 2.0,
            "yMin": -0.5,
            "yMax": customer_point[1] - 0.7,
        },
        "stairKeepClear": {"xMin": 2.0, "xMax": 5.5, "yMin": 12.0, "yMax": 19.0} if business.floors > 1 else None,
        "collisionBoxes": collisions,
        "fixtures": pieces,
    }


def main() -> None:
    args = parse_args()
    repo_root = args.repo_root.resolve()
    output_root = repo_root / "public" / "assets" / "harthmere" / "glb" / "business_interiors"
    preview_root = repo_root / "output" / "harthmere-business-interiors" / "previews"
    report_root = repo_root / "output" / "harthmere-business-interiors" / "gltfpack-reports"
    manifest_path = repo_root / "public" / "assets" / "harthmere" / "manifest" / "business-interiors.json"
    output_root.mkdir(parents=True, exist_ok=True)
    report_root.mkdir(parents=True, exist_ok=True)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    packer = gltfpack_path(repo_root)
    clear_scene()
    selected = set(args.only)
    known_slugs = {business.slug for business in BUSINESSES}
    unknown_slugs = selected - known_slugs
    if unknown_slugs:
        raise ValueError(f"Unknown business slug(s): {', '.join(sorted(unknown_slugs))}")
    businesses = [business for business in BUSINESSES if not selected or business.slug in selected]
    rebuilt_entries = {}

    for index, business in enumerate(businesses):
        print(f"[business-interiors] building {business.slug} ({index + 1}/{len(businesses)})", flush=True)
        business_dir = output_root / business.slug
        business_dir.mkdir(parents=True, exist_ok=True)

        lod0 = create_context(business, 0)
        for piece in business.pieces:
            build_piece(lod0, piece)
        join_by_material(lod0)
        raw_lod0 = business_dir / f"{business.slug}.raw.glb"
        final_lod0 = business_dir / f"{business.slug}.glb"
        export_context(lod0, raw_lod0)
        compress_glb(packer, raw_lod0, final_lod0, report_root / f"{business.slug}-lod0.json")
        if args.render_previews:
            render_preview(lod0, preview_root / f"{business.slug}.png")
        delete_context(lod0)

        lod1 = create_context(business, 1)
        for piece in business.pieces:
            build_piece(lod1, piece)
        join_by_material(lod1)
        raw_lod1 = business_dir / f"{business.slug}.lod1.raw.glb"
        final_lod1 = business_dir / f"{business.slug}.lod1.glb"
        export_context(lod1, raw_lod1)
        compress_glb(packer, raw_lod1, final_lod1, report_root / f"{business.slug}-lod1.json")
        delete_context(lod1)
        rebuilt_entries[business.slug] = manifest_entry(business, final_lod0, final_lod1, repo_root)

    if selected and manifest_path.exists():
        existing_manifest = json.loads(manifest_path.read_text())
        entries_by_slug = {
            entry["slug"]: entry for entry in existing_manifest.get("businesses", [])
        }
        entries_by_slug.update(rebuilt_entries)
        entries = [
            entries_by_slug[business.slug]
            for business in BUSINESSES
            if business.slug in entries_by_slug
        ]
    else:
        entries = [rebuilt_entries[business.slug] for business in BUSINESSES]

    manifest = {
        "version": ASSET_VERSION,
        "generatorVersion": GENERATOR_VERSION,
        "generatedWith": bpy.app.version_string,
        "coordinateConvention": {
            "units": "meters",
            "origin": "first-floor southwest floor origin",
            "blenderX": "world X",
            "blenderY": "world Z from entrance toward back wall",
            "blenderZ": "world height",
            "worldConversion": "world=(originX+localX, originY+1+localZ, originZ+localY)",
        },
        "performanceContract": {
            "textures": "none; compact PBR material colors only",
            "geometryCompression": "EXT_meshopt_compression via gltfpack 1.2 -cc",
            "maximumMaterialBatchesPerInterior": 9,
            "nearInteriorDistanceMeters": 16,
            "lod1DistanceMeters": 28,
            "hiddenBeyondMeters": 28,
            "collision": "manifest box proxies; render meshes are not collision meshes",
            "smallClutter": "merged into parent material batches",
        },
        "businesses": entries,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"[business-interiors] wrote {manifest_path}")


if __name__ == "__main__":
    main()
