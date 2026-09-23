import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { localGet, localSet } from "@/lib/safe-storage";

export type ViewMode = "buyer" | "seller";

type Ctx = {
  view: ViewMode;
  setView: (v: ViewMode) => void;
  toggleView: () => void;
};

const ViewModeContext = createContext<Ctx>({
  view: "buyer",
  setView: () => {},
  toggleView: () => {},
});

const STORAGE_KEY = "munjaz-view-mode";

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<ViewMode>("buyer");

  useEffect(() => {
    const stored = localGet(STORAGE_KEY);
    if (stored === "buyer" || stored === "seller") setView(stored);
  }, []);

  useEffect(() => {
    localSet(STORAGE_KEY, view);
  }, [view]);

  return (
    <ViewModeContext.Provider
      value={{
        view,
        setView,
        toggleView: () => setView((v) => (v === "buyer" ? "seller" : "buyer")),
      }}
    >
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  return useContext(ViewModeContext);
}
