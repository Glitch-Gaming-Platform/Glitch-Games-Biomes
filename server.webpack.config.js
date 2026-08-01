"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const webpack_1 = __importDefault(require("webpack"));
const webpack_node_externals_1 = __importDefault(require("webpack-node-externals"));
const __filename = (0, url_1.fileURLToPath)(import.meta.url);
const __dirname = path_1.default.dirname(__filename);
const SERVERS = [
    "shim",
    "bikkie",
    "anima",
    "ask",
    "backup",
    "bob",
    "chat",
    ["gaia", "server/gaia/main.ts"],
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
    "notify",
    "web",
];
function sourcePath(...parts) {
    return path_1.default.resolve(__dirname, "src", ...parts);
}
function createEntryPoints() {
    const entryPoints = {};
    for (const config of SERVERS) {
        const [name, entrypointPath] = typeof config === "string"
            ? [config, `server/${config}/main.ts`]
            : config;
        entryPoints[name] = sourcePath(entrypointPath);
    }
    entryPoints["bootstrap-redis"] = path_1.default.resolve(__dirname, "scripts/node/bootstrap_redis.ts");
    return entryPoints;
}
async function attemptBuildFromFile(...relativePath) {
    try {
        const buildId = (await promises_1.default.readFile(path_1.default.join(__dirname, ...relativePath))).toString();
        if (buildId !== "local") {
            return buildId;
        }
    }
    catch (error) {
        // Pass through
    }
}
async function getBuildId() {
    return ((await attemptBuildFromFile(".next", "BUILD_ID")) ??
        (await attemptBuildFromFile("BUILD_ID")) ??
        "unknown");
}
async function createWebpackConfig() {
    return {
        mode: "production",
        // Configure NodeJS environment settings.
        externalsPresets: { node: true },
        node: {
            global: false,
            __filename: true,
            __dirname: true,
        },
        target: "node",
        // Don't include node_modules, it'll be part of the dist.
        externals: [(0, webpack_node_externals_1.default)()],
        entry: createEntryPoints(),
        devtool: "inline-source-map",
        context: __dirname,
        cache: {
            type: "filesystem",
        },
        optimization: {
            // We don't need minimization on the server, if anything it just makes
            // source maps more confusing.
            minimize: false,
        },
        // Configure some expected defines.
        plugins: [
            new webpack_1.default.DefinePlugin({
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
                "@/wasm/cayley": path_1.default.resolve(__dirname, "src/gen/cayley/impl/wasm_bundler"),
                "@": sourcePath(),
            },
        },
        output: {
            filename: "[name].js",
            path: path_1.default.resolve(__dirname, "dist"),
        },
        experiments: {
            futureDefaults: true,
        },
        // Skip all Webpack warnings around entrypoint size.
        performance: {
            hints: false,
            maxEntrypointSize: 512000,
            maxAssetSize: 512000,
        },
    };
}
exports.default = createWebpackConfig();
//# sourceMappingURL=server.webpack.config.js.map