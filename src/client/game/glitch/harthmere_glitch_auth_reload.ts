export function shouldReloadHarthmereGlitchAuth(input: {
  isAfterReload: boolean;
  serverGateWaiting: boolean;
}) {
  return !input.isAfterReload || input.serverGateWaiting;
}
