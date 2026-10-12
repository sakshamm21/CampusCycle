import React from 'react';
import { Headline } from '@/components/common/Headline';

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <Headline text="fleet *live*" size="l" />
      <p className="text-muted text-sm">Welcome to CampusCycle Admin Dashboard.</p>
    </div>
  );
}
