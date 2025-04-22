import { get, type Updater, writable } from 'svelte/store'

export function storable<T>(key: string, data: T) {
    const store = writable(data);
    const { subscribe, set } = store;
    const isBrowser = typeof window !== 'undefined';

    const storedData = isBrowser && localStorage.getItem(key);
    if (isBrowser && storedData) {
        set(JSON.parse(storedData));
    }

    return {
        subscribe,
        set: (n: T) => {
            if (isBrowser) {
                localStorage.setItem(key, JSON.stringify(n));
                set(n);
            }
        },
        update: (updater: Updater<T>) => {
            const updatedStore = updater(get(store));
            if (isBrowser) {
                localStorage.setItem(key, JSON.stringify(updatedStore));
                set(updatedStore);
            }

        }
    };
}