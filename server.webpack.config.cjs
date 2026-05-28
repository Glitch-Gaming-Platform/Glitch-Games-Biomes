const fs = require("fs/promises");
const path = require("path");
const webpack = require("webpack");
const nodeExternals = require("webpack-node-externals");

const SERVERS = [
  "shim",
  "bikkie",
  "anima",
  "ask",
  "backup",
  "bob",
  "chat",
  ["gaia-v2", "server/gaia_v2/main.ts"],
  "gizmo",
  "logic",
  "map",
  "newton",
  "oob",
  "sidefx",
  "sink",
  "spawn",
  "sync",
  "task",
  "trigger",
  "web",
];

function sourcePath(...parts) {
  return path.resolve(__dirname, "src", ...parts);
}

function createEntryPoints() {
  const entryPoints = {};
  for (const config of SERVERS) {
    const [name, entrypointPath] =
      typeof config === "string"
        ? [config, `server/${config}/main.ts`]
        : config;
    entryPoints[name] = sourcePath(entrypointPath);
  }
  return entryPoints;
}

async function attemptBuildFromFile(...relativePath) {
  try {
    const buildId = (
      await fs.readFile(path.join(__dirname, ...relativePath))
    ).toString();
    if (buildId !== "local") {
      return buildId;
    }
  } catch (error) {
    // Pass through.
  }
}

async function getBuildId() {
  return (
    (await attemptBuildFromFile(".next", "BUILD_ID")) ??
    (await attemptBuildFromFile("BUILD_ID")) ??
    "unknown"
  );
}

async function createWebpackConfig() {
  return {
    mode: "production",
    externalsPresets: { node: true },
    node: {
      global: false,
      __filename: true,
      __dirname: true,
    },
    target: "node",
    externals: [nodeExternals()],
    entry: createEntryPoints(),
    devtool: "inline-source-map",
    context: __dirname,
    cache: {
      type: "filesystem",
    },
    optimization: {
      minimize: false,
    },
    plugins: [
      new webpack.DefinePlugin({
        "process.env.IS_SERVER": JSON.stringify(true),
        "process.env.BUILD_ID": JSON.stringify(await getBuildId()),
        "process.env.BUILD_TIMESTAMP": JSON.stringify(Date.now()),
      }),
    ],
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: [
            "thread-loader",
            {
              loader: "ts-loader",
              options: {
                configFile: "tsconfig.server.json",
                transpileOnly: true,
                happyPackMode: true,
              },
            },
          ],
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: [".ts", "..."],
      alias: {
        "@/galois": sourcePath("galois/js/"),
        "@/wasm/cayley": path.resolve(
          __dirname,
          "src/gen/cayley/impl/wasm_bundler"
        ),
        "@": sourcePath(),
      },
    },
    output: {
      filename: "[name].js",
      path: path.resolve(__dirname, "dist"),
    },
    experiments: {
      futureDefaults: true,
    },
    performance: {
      hints: false,
      maxEntrypointSize: 512000,
      maxAssetSize: 512000,
    },
  };
}

module.exports = createWebpackConfig();
