import { create } from "zustand";

export type ViewMode = "tree" | "timeline" | "list";

export type PersonEvent = {
  id: string;
  type: string;
  title?: string | null;
  place?: string | null;
  date?: { display: string; sortValue?: number | null } | null;
};

export type Person = {
  id: string;
  givenNames: string;
  surnames?: string | null;
  preferredName?: string | null;
  sex: string;
  isLiving: boolean;
  events: PersonEvent[];
  media: Array<{ id: string; path: string; isPrimary: boolean }>;
  parentLinks: Array<{ parentId: string; childId: string; type: string }>;
  childLinks: Array<{ parentId: string; childId: string; type: string }>;
};

export type FamilyTree = {
  id: string | null;
  name: string;
  people: Person[];
  partnerships: Array<{
    id: string;
    partnerAId: string;
    partnerBId: string;
    type: string;
  }>;
};

type TreeState = {
  tree: FamilyTree | null;
  loading: boolean;
  error: string | null;
  view: ViewMode;
  query: string;
  selectedPersonId: string | null;
  loadTree: () => Promise<void>;
  setView: (view: ViewMode) => void;
  setQuery: (query: string) => void;
  selectPerson: (id: string | null) => void;
};

export const useTreeStore = create<TreeState>((set) => ({
  tree: null,
  loading: false,
  error: null,
  view: "tree",
  query: "",
  selectedPersonId: null,
  loadTree: async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch("/api/tree");
      if (!response.ok) throw new Error("No se pudo cargar el árbol");
      set({ tree: await response.json(), loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : "Error inesperado",
      });
    }
  },
  setView: (view) => set({ view }),
  setQuery: (query) => set({ query }),
  selectPerson: (selectedPersonId) => set({ selectedPersonId }),
}));
