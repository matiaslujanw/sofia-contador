const memory = new Map<string, string>();

export function readDemoStorage(key: string) {
  if (window.location.protocol === "file:") return memory.get(key) ?? null;
  try { return localStorage.getItem(key); }
  catch { return memory.get(key) ?? null; }
}

export function writeDemoStorage(key: string, value: string) {
  if (window.location.protocol !== "file:") {
    try {
      localStorage.setItem(key, value);
      return;
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== "SecurityError") throw error;
    }
  }
  memory.set(key, value);
}
