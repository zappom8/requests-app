// This browser's identity for live control, kept in localStorage so it
// survives reloads. The id itself is issued by the server
// (registerDevice in src/actions/devices.ts). Every access is wrapped:
// private browsing or blocked storage just means "not registered yet".

const DEVICE_KEY = "liveControl.device";

export type LocalDevice = { deviceId: string; deviceName: string; deviceRole: string };

export function getLocalDevice(): LocalDevice | null {
  try {
    const raw = localStorage.getItem(DEVICE_KEY);
    return raw ? (JSON.parse(raw) as LocalDevice) : null;
  } catch {
    return null;
  }
}

export function setLocalDevice(device: LocalDevice) {
  try {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(device));
  } catch {}
}
