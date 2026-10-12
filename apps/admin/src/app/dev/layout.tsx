import { notFound } from 'next/navigation';

// The component gallery is a development tool only (08 P2-T02)
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <>{children}</>;
}
