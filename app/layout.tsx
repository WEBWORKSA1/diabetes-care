import type { Metadata } from 'next';
import { Inter_Tight, Fraunces, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter_Tight({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'diabetes.care', template: '%s · diabetes.care' },
  description: 'The diabetes co-pilot for endocrinology practices.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  );
}
