export const process = {
  env: {} as Record<string, string | undefined>,
  pid: 0,
  noDeprecation: true,
  throwDeprecation: false,
  traceDeprecation: false,
  stderr: undefined,
  nextTick(callback: (...args: unknown[]) => void, ...args: unknown[]) {
    queueMicrotask(() => callback(...args));
  },
  emitWarning(message: unknown) {
    console.warn(message);
  },
};

// Generated shader wrappers use webpack's `module.hot` guard. The standalone
// esbuild smoke has no webpack module object, so provide the disabled shape
// without changing production hot-reload behavior.
export const module = { hot: undefined };
