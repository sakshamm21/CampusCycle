'use client';

import React from 'react';
import { useCollege } from '@/lib/scope';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function CollegeSwitcher({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const { collegeId, college, colleges, setCollege } = useCollege();

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface2/60 border border-border">
        <span className="font-mono text-xs uppercase font-bold text-fg tracking-wider">
          {college?.short_code || 'CAMPUS'}
        </span>
        <span className="text-xs text-muted truncate">{college?.name}</span>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Select
        value={collegeId}
        onValueChange={(val) => {
          if (val) setCollege(val);
        }}
      >
        <SelectTrigger className="w-full bg-surface2/60 border-border text-fg font-medium text-xs h-9 justify-between">
          <SelectValue placeholder="Select campus">
            <span className="flex items-center gap-2 truncate">
              <span className="font-mono font-bold text-primary">{college?.short_code}</span>
              <span className="truncate text-muted">{college?.name}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-surface border-border">
          <SelectGroup>
            {colleges.map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-xs">
                <span className="flex items-center gap-2">
                  <span className="font-mono font-bold text-fg">{c.short_code}</span>
                  <span className="text-muted">{c.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
