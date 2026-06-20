// Pure helpers for the Land tab's Homes / Business split. Kept React-free so the
// categorization and plot-center math are unit-testable.

import type { BuildingSystemPlotDefinition } from "@/shared/harthmere/building_system";

export type LandTabPlotCategory = "homes" | "business";

// Residential plots are Homes; every other plot type (commercial, guild,
// crafting, farm, public) is a Business venture.
export function landTabPlotCategory(
  plotType: BuildingSystemPlotDefinition["plotType"]
): LandTabPlotCategory {
  return plotType === "residential" ? "homes" : "business";
}

// Center of the plot's authored bounds, used for "Locate on map" and the world
// hint beam. Mirrors centerPositionForPlot in propertyMapMarkers.
export function landTabPlotCenter(
  plot: BuildingSystemPlotDefinition
): [number, number, number] {
  return [
    Math.floor((plot.bounds.xMin + plot.bounds.xMax) / 2),
    plot.groundY + 2,
    Math.floor((plot.bounds.zMin + plot.bounds.zMax) / 2),
  ];
}
