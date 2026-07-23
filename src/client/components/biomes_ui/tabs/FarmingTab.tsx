import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import type {
  NativeFarmingInterfaceModel,
  NativeFarmingPlantView,
} from "../adapters/nativeFarmingInterfaceAdapter";

export interface FarmingTabAdapter {
  getModel?: () => NativeFarmingInterfaceModel;
}

const EMPTY_MODEL: NativeFarmingInterfaceModel = {
  supplies: [],
  plants: [],
  seedCount: 0,
  hasHoe: false,
  hasWateringCan: false,
};

function timeUntil(timestamp: number | undefined, now: number) {
  if (!timestamp) return undefined;
  const seconds = Math.max(0, Math.ceil(timestamp - now));
  if (seconds < 60) return "less than a minute";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
}

function cropMessage(plant: NativeFarmingPlantView, now: number) {
  if (plant.status === "fully_grown") return "Ready — face it and press F";
  if (plant.status === "dead") return "Withered — clear and replant";
  if (plant.status === "halted_water") return "Dry — water it to resume growth";
  if (plant.status === "halted_sun") return "Growth stopped — needs sunlight";
  if (plant.status === "halted_shade") return "Growth stopped — needs shade";
  const remaining = timeUntil(plant.fullyGrownAt, now);
  return remaining ? `Growing · ready in ${remaining}` : "Establishing roots";
}

function meterColor(value: number, danger = false) {
  if (danger) return "linear-gradient(90deg,#7a3420,#ff8053)";
  if (value < 0.25) return "linear-gradient(90deg,#6e331f,#ff9b4a)";
  return "linear-gradient(90deg,#287fb8,#67d9ff)";
}

const Meter: React.FunctionComponent<{
  value: number;
  label: string;
  danger?: boolean;
}> = ({ value, label, danger }) => (
  <div style={{ display: "grid", gap: 4 }}>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        color: "var(--biomes-fg-muted)",
        fontSize: 10,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      <span>{label}</span>
      <span>{Math.round(value * 100)}%</span>
    </div>
    <div
      style={{
        height: 7,
        overflow: "hidden",
        border: "1px solid rgba(184,226,242,0.2)",
        borderRadius: 6,
        background: "rgba(3,10,16,0.72)",
      }}
    >
      <span
        style={{
          display: "block",
          width: `${Math.max(0, Math.min(100, value * 100))}%`,
          height: "100%",
          background: meterColor(value, danger),
        }}
      />
    </div>
  </div>
);

export const FarmingTab: React.FunctionComponent<{
  adapter?: FarmingTabAdapter;
}> = ({ adapter }) => {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const model = adapter?.getModel?.() ?? EMPTY_MODEL;
  const ownedPlants = useMemo(
    () => model.plants.filter((plant) => plant.ownedByPlayer),
    [model.plants]
  );
  const visiblePlants = ownedPlants.length ? ownedPlants : model.plants;

  const steps = [
    [
      "1",
      "Prepare",
      "Put a Hoe in your hotbar. Face a dirt or grass voxel and hold primary action until it becomes ridged farmland.",
    ],
    [
      "2",
      "Plant",
      "Select a seed, aim at the tilled voxel, and use primary action. One real native ECS plant is created in that block.",
    ],
    [
      "3",
      "Water",
      "Fill a Watering Can from a water voxel, then use it on the crop. Keep the blue moisture meter above empty.",
    ],
    [
      "4",
      "Grow",
      "Gaia advances stages, consumes moisture, checks sun or shade, and changes the crop blocks in the world.",
    ],
    [
      "5",
      "Harvest",
      "When the crop says Ready, stand close, face it, and press F. Gaia removes the plant and creates the harvest drop.",
    ],
  ] as const;

  return (
    <div
      aria-label="Native voxel farming journal"
      style={{ display: "grid", gap: 14 }}
    >
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1.5fr) minmax(260px,0.8fr)",
          gap: 12,
        }}
      >
        <div
          style={{
            minHeight: 190,
            padding: 18,
            border: "1px solid rgba(142,216,151,0.34)",
            borderRadius: 12,
            background:
              "radial-gradient(circle at 78% 22%,rgba(112,190,101,0.2),transparent 36%),linear-gradient(145deg,rgba(34,64,42,0.92),rgba(10,25,23,0.96))",
            boxShadow: "inset 0 0 32px rgba(0,0,0,0.28)",
          }}
        >
          <div
            style={{
              color: "#d8f3b4",
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            Field journal
          </div>
          <h3 style={{ margin: "7px 0 8px", fontSize: 26, color: "#f4f3d0" }}>
            Work the land. Tend the crop. Gather the yield.
          </h3>
          <p
            style={{
              margin: 0,
              maxWidth: 650,
              color: "rgba(232,245,220,0.76)",
              lineHeight: 1.55,
              fontSize: 13,
            }}
          >
            Farming happens in the world, one voxel at a time. This journal
            shows your synchronized crops and supplies; it never plants or
            waters remotely.
          </p>
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}
          >
            {[
              [model.hasHoe, "Hoe", "⛏"],
              [model.seedCount > 0, `${model.seedCount} Seeds`, "🌱"],
              [model.hasWateringCan, "Watering Can", "💧"],
            ].map(([ready, label, icon]) => (
              <span
                key={String(label)}
                style={{
                  padding: "7px 10px",
                  borderRadius: 7,
                  border: `1px solid ${
                    ready ? "rgba(155,222,131,0.45)" : "rgba(255,139,91,0.45)"
                  }`,
                  background: ready
                    ? "rgba(85,132,68,0.28)"
                    : "rgba(122,56,39,0.3)",
                  color: ready ? "#dff6c5" : "#ffc0a1",
                  fontSize: 12,
                }}
              >
                {icon} {label} · {ready ? "Ready" : "Needed"}
              </span>
            ))}
          </div>
        </div>
        <div
          style={{
            padding: 14,
            border: "1px solid rgba(230,197,117,0.3)",
            borderRadius: 12,
            background:
              "linear-gradient(160deg,rgba(67,48,25,0.88),rgba(24,20,17,0.95))",
          }}
        >
          <h3
            style={{
              margin: "0 0 10px",
              color: "#f5dda0",
              fontSize: 14,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Seed pouch & tools
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,minmax(0,1fr))",
              gap: 7,
            }}
          >
            {model.supplies.length ? (
              model.supplies.map((supply) => (
                <div
                  key={supply.itemId}
                  style={{
                    minHeight: 66,
                    padding: 8,
                    border: "1px solid rgba(242,213,144,0.22)",
                    borderRadius: 8,
                    background: "rgba(21,16,10,0.58)",
                    display: "grid",
                    alignContent: "space-between",
                    gap: 5,
                  }}
                >
                  <span style={{ fontSize: 20 }} aria-hidden>
                    {supply.kind === "seed"
                      ? "🌱"
                      : supply.kind === "hoe"
                      ? "⛏"
                      : "💧"}
                  </span>
                  <span
                    style={{
                      color: "#f6ebcd",
                      fontSize: 11,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {supply.name}
                  </span>
                  <strong style={{ color: "#d7b96d", fontSize: 11 }}>
                    × {supply.count}
                  </strong>
                </div>
              ))
            ) : (
              <p
                style={{
                  gridColumn: "1 / -1",
                  color: "rgba(245,231,198,0.58)",
                  fontSize: 12,
                }}
              >
                No farming supplies found. Visit the Orchard Produce Stand or
                craft tools at a Workbench.
              </p>
            )}
          </div>
        </div>
      </section>

      <section style={{ display: "grid", gap: 9 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <h3
            style={{
              margin: 0,
              color: "var(--biomes-fg)",
              fontSize: 14,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Your field
          </h3>
          <span style={{ color: "var(--biomes-fg-muted)", fontSize: 11 }}>
            {visiblePlants.length} synchronized crop
            {visiblePlants.length === 1 ? "" : "s"}
          </span>
        </div>
        {visiblePlants.length ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
              gap: 9,
            }}
          >
            {visiblePlants.map((plant) => (
              <article
                key={String(plant.id)}
                data-native-plant-id={String(plant.id)}
                style={{
                  padding: 12,
                  border: `1px solid ${
                    plant.status === "fully_grown"
                      ? "rgba(174,238,105,0.55)"
                      : "rgba(106,184,145,0.3)"
                  }`,
                  borderRadius: 10,
                  background:
                    plant.status === "fully_grown"
                      ? "linear-gradient(150deg,rgba(69,103,39,0.74),rgba(16,31,22,0.95))"
                      : "linear-gradient(150deg,rgba(27,59,45,0.82),rgba(12,25,24,0.96))",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ color: "#eff5d5", fontWeight: 800 }}>
                      {plant.name}
                    </div>
                    <div
                      style={{
                        marginTop: 3,
                        color: "rgba(215,235,208,0.64)",
                        fontSize: 10,
                      }}
                    >
                      Stage {plant.stage + 1} ·{" "}
                      {Number.isFinite(plant.distance)
                        ? `${Math.round(plant.distance)}m away`
                        : "in your field"}
                    </div>
                  </div>
                  <span style={{ fontSize: 25 }} aria-hidden>
                    {plant.status === "fully_grown"
                      ? "🥕"
                      : plant.status === "dead"
                      ? "🥀"
                      : "🌿"}
                  </span>
                </div>
                <p
                  style={{
                    margin: "9px 0",
                    minHeight: 30,
                    color:
                      plant.status === "fully_grown"
                        ? "#dfff9d"
                        : "rgba(224,240,215,0.78)",
                    fontSize: 12,
                  }}
                >
                  {cropMessage(plant, now)}
                </p>
                <div style={{ display: "grid", gap: 7 }}>
                  <Meter
                    label="Growth"
                    value={
                      plant.status === "fully_grown" ? 1 : plant.stageProgress
                    }
                  />
                  <Meter label="Moisture" value={plant.waterLevel} />
                  {plant.wilt > 0 && (
                    <Meter label="Wilt" value={plant.wilt} danger />
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div
            style={{
              padding: 24,
              textAlign: "center",
              border: "1px dashed rgba(127,190,145,0.32)",
              borderRadius: 10,
              background: "rgba(13,31,25,0.48)",
              color: "rgba(221,239,215,0.68)",
            }}
          >
            <div style={{ fontSize: 34, marginBottom: 7 }} aria-hidden>
              🌾
            </div>
            No native crops are synchronized yet. Till a soil voxel and plant
            your first seed.
          </div>
        )}
      </section>

      <section
        style={{
          padding: 14,
          border: "1px solid rgba(134,181,218,0.25)",
          borderRadius: 12,
          background: "rgba(10,22,35,0.72)",
        }}
      >
        <h3
          style={{
            margin: "0 0 12px",
            color: "#cfe9ff",
            fontSize: 14,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          How to farm
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(175px,1fr))",
            gap: 8,
          }}
        >
          {steps.map(([number, title, detail]) => (
            <div
              key={number}
              style={{
                padding: 11,
                border: "1px solid rgba(138,187,220,0.18)",
                borderRadius: 9,
                background: "rgba(4,13,22,0.48)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  color: "#dff2ff",
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: "#397fa3",
                    color: "white",
                  }}
                >
                  {number}
                </span>
                {title}
              </div>
              <p
                style={{
                  margin: "8px 0 0",
                  color: "rgba(208,229,241,0.7)",
                  fontSize: 11,
                  lineHeight: 1.45,
                }}
              >
                {detail}
              </p>
            </div>
          ))}
        </div>
        <p
          style={{
            margin: "11px 0 0",
            color: "rgba(170,213,240,0.68)",
            fontSize: 10,
          }}
        >
          Native path: JavaScript interaction → logic event validation → ECS
          plant action/state → Gaia growth simulation → synchronized ECS update
          back to JavaScript.
        </p>
      </section>
    </div>
  );
};
