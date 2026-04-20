let proModeEnabled = (process.env.PRO_MODE_ENABLED ?? 'true').toLowerCase() === 'true';

export function getProModeEnabled(): boolean {
  return proModeEnabled;
}

export function setProModeEnabled(enabled: boolean): void {
  proModeEnabled = enabled;
}

