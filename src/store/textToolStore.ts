import { create } from 'zustand';
import type { TextDecoration } from '../types/model';

interface TextToolStore {
  selectedId: string | null;
  draft: TextDecoration | null;
  preview: TextDecoration | null;
  valid: boolean;
  select: (id: string | null) => void;
  begin: (text: TextDecoration) => void;
  showPreview: (text: TextDecoration | null, valid: boolean) => void;
  cancel: () => void;
}

export const useTextToolStore = create<TextToolStore>((set) => ({
  selectedId: null, draft: null, preview: null, valid: false,
  select: (selectedId) => set({ selectedId }),
  begin: (draft) => set({ draft, preview: null, valid: false, selectedId: null }),
  showPreview: (preview, valid) => set({ preview, valid }),
  cancel: () => set((state) => ({
    selectedId: state.draft?.hostBrickId ? state.draft.id : state.selectedId,
    draft: null, preview: null, valid: false,
  })),
}));
