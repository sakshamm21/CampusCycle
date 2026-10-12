import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReturnResult } from '@campuscycle/shared';

export interface BikeScan {
  code: string;
  sig: string;
}

interface ReturnFlowValue {
  scan: BikeScan | null;
  demoStandId: string | null;
  result: ReturnResult | null;
  setScan(scan: BikeScan | null): void;
  setDemoStandId(id: string | null): void;
  setResult(result: ReturnResult | null): void;
  clear(): void;
}

const ReturnFlowContext = createContext<ReturnFlowValue | null>(null);

// Carries the scan from R11 back to R14 and the result from R14 on to R15 (04 §1.10).
export function ReturnFlowProvider({ children }: { children: React.ReactNode }) {
  const [scan, setScan] = useState<BikeScan | null>(null);
  const [demoStandId, setDemoStandId] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnResult | null>(null);

  const clear = useCallback(() => {
    setScan(null);
    setDemoStandId(null);
    setResult(null);
  }, []);

  const value = useMemo(
    () => ({ scan, demoStandId, result, setScan, setDemoStandId, setResult, clear }),
    [scan, demoStandId, result, clear],
  );

  return <ReturnFlowContext.Provider value={value}>{children}</ReturnFlowContext.Provider>;
}

export function useReturnFlow(): ReturnFlowValue {
  const value = useContext(ReturnFlowContext);
  if (!value) throw new Error('useReturnFlow must be used inside ReturnFlowProvider');
  return value;
}
