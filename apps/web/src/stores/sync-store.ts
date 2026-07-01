/**
 * Sync UI store
 *
 * Small reactive store for the sync *activity* state, so the UI can tell the
 * difference between "a drain is actively running" and "there are unsynced
 * items just sitting there" (e.g. after a failure). Updated by the sync engine
 * (lib/offline/sync.ts), read by the status badge.
 */

import { create } from 'zustand';

interface SyncUiState {
  /** True only while runSync() is actively draining the outbox. */
  isSyncing: boolean;
  /** Message from the most recent failed replay (cleared on a clean run). */
  lastError: string | null;
  /** Items pushed in the last completed run. */
  lastPushed: number;
}

export const useSyncStore = create<SyncUiState>(() => ({
  isSyncing: false,
  lastError: null,
  lastPushed: 0,
}));
