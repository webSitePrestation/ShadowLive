import { createBrowserClient } from '@supabase/ssr';

function createSafeStorage(): Storage {
  const memory = new Map<string, string>();

  const readLocalStorage = () => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  };

  return {
    get length() {
      const ls = readLocalStorage();
      return ls ? ls.length : memory.size;
    },
    clear() {
      const ls = readLocalStorage();
      if (ls) {
        ls.clear();
        return;
      }
      memory.clear();
    },
    getItem(key: string) {
      const ls = readLocalStorage();
      if (ls) return ls.getItem(key);
      return memory.get(key) ?? null;
    },
    key(index: number) {
      const ls = readLocalStorage();
      if (ls) return ls.key(index);
      return [...memory.keys()][index] ?? null;
    },
    removeItem(key: string) {
      const ls = readLocalStorage();
      if (ls) {
        ls.removeItem(key);
        return;
      }
      memory.delete(key);
    },
    setItem(key: string, value: string) {
      const ls = readLocalStorage();
      if (ls) {
        ls.setItem(key, value);
        return;
      }
      memory.set(key, value);
    },
  };
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        storage: createSafeStorage(),
      },
    }
  );
}
