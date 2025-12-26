/**
 * AI Panel Store
 * Manages state for AI assistant panel
 */

import { create } from 'zustand';
import type { ConsultantRole } from '@erp-saas/shared';

export interface AIPanelState {
  // Panel state
  isOpen: boolean;
  isExpanded: boolean;

  // Current conversation
  currentConversationId: string | null;
  consultantRole: ConsultantRole;

  // UI state
  isStreaming: boolean;
  streamingMessageId: string | null;

  // Actions
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  expandPanel: () => void;
  collapsePanel: () => void;
  toggleExpand: () => void;

  setCurrentConversation: (id: string | null) => void;
  setConsultantRole: (role: ConsultantRole) => void;

  setStreaming: (isStreaming: boolean, messageId?: string) => void;

  reset: () => void;
}

const initialState = {
  isOpen: false,
  isExpanded: false,
  currentConversationId: null,
  consultantRole: 'general' as ConsultantRole,
  isStreaming: false,
  streamingMessageId: null,
};

export const useAIPanelStore = create<AIPanelState>((set) => ({
  ...initialState,

  // Panel actions
  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),
  togglePanel: () => set((state) => ({ isOpen: !state.isOpen })),

  expandPanel: () => set({ isExpanded: true }),
  collapsePanel: () => set({ isExpanded: false }),
  toggleExpand: () => set((state) => ({ isExpanded: !state.isExpanded })),

  // Conversation actions
  setCurrentConversation: (id) => set({ currentConversationId: id }),
  setConsultantRole: (role) => set({ consultantRole: role }),

  // Streaming actions
  setStreaming: (isStreaming, messageId) =>
    set({ isStreaming, streamingMessageId: messageId || null }),

  // Reset
  reset: () => set(initialState),
}));
