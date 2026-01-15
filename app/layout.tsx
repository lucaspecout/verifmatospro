import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'VerifMatos Pro',
  description: 'Gestion de stock et vérification temps réel.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
              <Link href="/" className="text-lg font-bold text-brand-700">
                VerifMatos Pro
              </Link>
              <nav className="flex items-center gap-3 text-sm text-slate-600">
                <Link href="/login" className="hover:text-brand-600">
                  Connexion
                </Link>
                <Link href="/dashboard" className="hover:text-brand-600">
                  Tableau de bord
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
