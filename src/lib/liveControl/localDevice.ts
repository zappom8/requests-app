// This browser's identity for live control, kept in localStorage so it
// survives reloads. The id itself is issued by the server
// (registerDevice in src/actions/devices.ts). Every access is wrapped:
// private browsing or blocked storage just means "not registered yet".

const DEVICE_KEY = "liveControl.device";
const RECEIVER_KEY = "liveControl.selectedReceiverId";
const CHANGE_EVENT = "liveControl.deviceChanged";

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
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// For useSyncExternalStore: the raw stored string (stable between calls).
export function getLocalDeviceSnapshot(): string | null {
  try {
    return localStorage.getItem(DEVICE_KEY);
  } catch {
    return null;
  }
}

export function subscribeLocalDevice(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function getSelectedReceiverId(): string | null {
  try {
    return localStorage.getItem(RECEIVER_KEY);
  } catch {
    return null;
  }
}

export function setSelectedReceiverId(id: string | null) {
  try {
    if (id) localStorage.setItem(RECEIVER_KEY, id);
    else localStorage.removeItem(RECEIVER_KEY);
  } catch {}
}
