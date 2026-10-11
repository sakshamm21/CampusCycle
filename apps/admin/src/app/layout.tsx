import type { Metadata } from 'next';
import { Archivo, Fraunces, Figtree, Martian_Mono, Geist } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-archivo',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['italic'],
  weight: ['400'],
  variable: '--font-fraunces',
  display: 'swap',
});

const figtree = Figtree({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-figtree',
  display: 'swap',
});

const martian = Martian_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-martian',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CampusCycle · Admin',
  description: 'CampusCycle bicycle sharing admin portal',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        archivo.variable,
        fraunces.variable,
        figtree.variable,
        martian.variable,
        'font-sans',
        geist.variable,
      )}
    >
      <body>{children}</body>
    </html>
  );
}
