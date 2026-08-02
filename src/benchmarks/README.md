# V8 Profiler Benchmarks

The suite of tests defined by the `.ts` files in this directory will all be run with the V8 Profiler enabled, and upon their completion the detailed output will be placed in `${workspaceFolder}/v8_profiler_benchmarks_results/*.cpuprofile`.

## How to run

To run, enter:

```bash
npm run v8_profiler_benchmarks
```

and when complete, the output should appear in `${workspaceFolder}/v8_profiler_benchmarks_results/*.cpuprofile`, and you will get a top-level "this is how long each benchmark took to run" summary duration in stdout.

## Analyzing/visualizing the output

The output can be opened in either VS Code, or Chrome.

### Viewing output in VS Code

If you open any `.cpuprofile` file in VS Code, it will automatically interpret it as profile results and visualize it as such. You can even click a button in the top right to view it as a flamegraph within VS Code.

### Viewing output in Chrome

1. Open Chrome.
2. Open devtools (e.g. `CTRL + SHIFT + j`).
3. Open the "JavaScript Profiler" tab (this is, unfortunately, different than the "Performance" tab).
4. Click on the "Load" button.
5. Select the `.cpuprofile` file.
6. Profit.

## Implementation

The ([Mocha](https://mochajs.org/)) tests are customized to be run under a profiler by setting up some [root hook plugins](https://mochajs.org/#root-hook-plugins), which can be found in the [root_hooks.ts] file.

CPU profiles are captured through Node's built-in `node:inspector` Profiler
domain. This produces Chrome DevTools / VS Code compatible `.cpuprofile` files
without a native addon, so benchmark installs follow the same Node version as
the rest of the fork.
