"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface PageTitleState {
  title: string;
  description?: string;
}

interface PageTitleContextValue {
  state: PageTitleState;
  set: (s: PageTitleState) => void;
}

const PageTitleContext = createContext<PageTitleContextValue>({
  state: { title: "" },
  set: () => {},
});

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PageTitleState>({ title: "" });
  const set = useCallback((s: PageTitleState) => setState(s), []);
  return (
    <PageTitleContext.Provider value={{ state, set }}>
      {children}
    </PageTitleContext.Provider>
  );
}

export function usePageTitle() {
  return useContext(PageTitleContext);
}
