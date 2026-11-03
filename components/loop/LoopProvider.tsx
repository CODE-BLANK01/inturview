"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { LoopQuotas, LoopRepository } from "@/lib/loop";
import { createMockLoopRepository } from "@/lib/loopMock";
const Context = createContext<{
  repository: LoopRepository;
  quotas: LoopQuotas;
} | null>(null);
export function LoopProvider({
  ownerId,
  quotas,
  children,
}: {
  ownerId: string;
  quotas: LoopQuotas;
  children: ReactNode;
}) {
  const repository = useMemo(
    () => createMockLoopRepository(ownerId),
    [ownerId],
  );
  return (
    <Context.Provider value={{ repository, quotas }}>
      <div className="loop-workspace">
        <div className="loop-preview-note">
          <strong>The Loop · Interactive prototype</strong>
          <span>
            Template rounds and sample scoring. Drafts stay in this tab. No AI
            calls, payments, or session usage.
          </span>
        </div>
        {children}
      </div>
    </Context.Provider>
  );
}
export function useLoopRepository() {
  const context = useContext(Context);
  if (!context) throw new Error("LoopProvider is missing");
  return context;
}
