// Load a UMD script from jsDelivr once and resolve with the global it defines.
// Used for the optional romanizers, so their code (and Japanese's 17 MB
// dictionary) only downloads when the user turns them on.

const loading = new Map<string, Promise<unknown>>();

export function loadGlobal<T>(url: string, globalName: string): Promise<T> {
  let pending = loading.get(url);
  if (!pending) {
    pending = new Promise((resolve, reject) => {
      const existing = (window as any)[globalName];
      if (existing) return resolve(existing);
      const script = document.createElement("script");
      script.src = url;
      script.async = true;
      script.onload = () => {
        const value = (window as any)[globalName];
        value ? resolve(value) : reject(new Error(`${url} didn't define ${globalName}`));
      };
      script.onerror = () => reject(new Error(`failed to load ${url}`));
      document.head.append(script);
    });
    // Allow a retry later if it failed (offline etc.).
    pending.catch(() => loading.delete(url));
    loading.set(url, pending);
  }
  return pending as Promise<T>;
}
