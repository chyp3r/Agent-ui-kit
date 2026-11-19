/** Preferences about one screen live in this browser's storage and nowhere else. */

export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(`agent-kit:${key}`);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(`agent-kit:${key}`);
    else localStorage.setItem(`agent-kit:${key}`, value);
  } catch {
    // a private window or blocked storage: the preference simply does not persist
  }
}
