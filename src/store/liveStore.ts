import { create } from 'zustand';

export const useLiveStore = create<{ joined: boolean }>(() => ({ joined: false }));
