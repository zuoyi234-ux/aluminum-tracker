import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aluminum Tracker — 铝业周报',
  description: '中孚实业 · 神火股份 · 云铝股份 2026 年业绩自动追踪',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
