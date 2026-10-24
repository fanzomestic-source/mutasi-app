import * as SecureStore from 'expo-secure-store';

let cfg = { url: '', password: '' };
export const loadConfig = async () => {
  cfg = {
    url: (await SecureStore.getItemAsync('url')) || '',
    password: (await SecureStore.getItemAsync('password')) || '',
  };
  return cfg;
};
export const saveConfig = async (url, password) => {
  url = url.trim().replace(/\/+$/, '');
  await SecureStore.setItemAsync('url', url);
  await SecureStore.setItemAsync('password', password);
  cfg = { url, password };
};
export const clearConfig = async () => {
  await SecureStore.deleteItemAsync('password');
  cfg.password = '';
};

export async function api(path, { method = 'GET', params } = {}) {
  const qs = params
    ? '?' + Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
    : '';
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch(`${cfg.url}/api${path}${qs}`, {
      method, signal: ctrl.signal,
      headers: { Authorization: `Bearer ${cfg.password}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || `Error ${res.status}`);
    return json;
  } finally { clearTimeout(t); }
}
