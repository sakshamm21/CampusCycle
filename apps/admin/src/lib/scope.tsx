'use client';

import React, { createContext, useContext, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { MyContext } from '@campuscycle/shared';

export interface CollegeLite {
  id: string;
  name: string;
  short_code: string;
  active: boolean;
}

export interface CollegeContextValue {
  collegeId: string;
  college: CollegeLite;
  colleges: CollegeLite[];
  setCollege: (id: string) => void;
}

const CollegeContext = createContext<CollegeContextValue | null>(null);

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setCookie(name: string, value: string, days = 365) {
  if (typeof document === 'undefined') return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function resolveDefaultCollege(colleges: CollegeLite[], preferredId?: string | null): CollegeLite {
  if (!colleges || colleges.length === 0) {
    return { id: '', name: 'No College', short_code: '—', active: false };
  }
  if (preferredId) {
    const found = colleges.find((c) => c.id === preferredId);
    if (found) return found;
  }
  const iitk = colleges.find((c) => c.short_code === 'IITK');
  if (iitk) return iitk;
  return colleges[0];
}

export interface CollegeProviderProps {
  children: React.ReactNode;
  ctx: MyContext;
  initialColleges?: CollegeLite[];
  initialCollegeId?: string;
}

export function CollegeProvider({
  children,
  ctx,
  initialColleges = [],
  initialCollegeId,
}: CollegeProviderProps) {
  const queryClient = useQueryClient();
  const isSuperAdmin = ctx.profile.role === 'super_admin' || ctx.profile.is_owner;

  const collegeAdminCollege: CollegeLite = useMemo(
    () => ({
      id: ctx.college?.id ?? '',
      name: ctx.college?.name ?? 'College',
      short_code: ctx.college?.short_code ?? '',
      active: true,
    }),
    [ctx.college],
  );

  const [selectedId, setSelectedId] = useState<string>(() => {
    if (!isSuperAdmin) {
      return collegeAdminCollege.id;
    }
    const cookieVal = typeof window !== 'undefined' ? getCookie('cc-college') : initialCollegeId;
    const resolved = resolveDefaultCollege(initialColleges, cookieVal || initialCollegeId);
    return resolved.id;
  });

  const colleges = useMemo(
    () => (isSuperAdmin ? initialColleges : [collegeAdminCollege]),
    [isSuperAdmin, initialColleges, collegeAdminCollege],
  );

  const college = useMemo(() => {
    if (!isSuperAdmin) return collegeAdminCollege;
    return colleges.find((c) => c.id === selectedId) || resolveDefaultCollege(colleges);
  }, [isSuperAdmin, collegeAdminCollege, colleges, selectedId]);

  const setCollege = React.useCallback(
    (newId: string) => {
      if (!isSuperAdmin) return;
      setSelectedId(newId);
      setCookie('cc-college', newId);
      queryClient.invalidateQueries();
    },
    [isSuperAdmin, queryClient],
  );

  const value = useMemo(
    () => ({
      collegeId: isSuperAdmin ? college.id : collegeAdminCollege.id,
      college,
      colleges,
      setCollege,
    }),
    [isSuperAdmin, college, collegeAdminCollege.id, colleges, setCollege],
  );

  return <CollegeContext.Provider value={value}>{children}</CollegeContext.Provider>;
}

export function useCollege(): CollegeContextValue {
  const context = useContext(CollegeContext);
  if (!context) {
    throw new Error('useCollege must be used within a CollegeProvider');
  }
  return context;
}
