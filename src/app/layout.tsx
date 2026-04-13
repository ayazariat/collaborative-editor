import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ErrorBoundary from '@/components/ErrorBoundary'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Collaborative Editor - Real-time Document Editing',
  description: 'A production-grade real-time collaborative editor inspired by Google Docs, built with CRDT (Yjs), TipTap, and Supabase.',
  keywords: ['collaborative editing', 'real-time', 'CRDT', 'Yjs', 'TipTap', 'Supabase'],
  authors: [{ name: 'Collaborative Editor Team' }],
  viewport: 'width=device-width, initial-scale=1',
  robots: 'index, follow',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  )
}
