"use client";

import { createContext, useContext } from "react";
import { ADMIN_PATHS, type HiringPaths } from "@/lib/hiring/paths";

const Ctx = createContext<HiringPaths>(ADMIN_PATHS);

export function HiringPathsProvider({ value, children }: { value: HiringPaths; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** API and page roots for whoever owns the screen: Admin's library or a workspace. */
export const useHiringPaths = () => useContext(Ctx);
