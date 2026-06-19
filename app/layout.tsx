import type { Metadata } from 'next'
import { Geist, Geist_Mono, Bai_Jamjuree, Inter } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin']
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin']
})

const bai = Bai_Jamjuree({
  variable: '--font-bai',
  weight: ['200', '300', '400', '500', '600', '700'],
  subsets: ['latin']
})

export const metadata: Metadata = {
  title: 'Smart Spend - Banking Solutions',
  description: 'Manage your finances with Smart Spend'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={cn(
        'h-full',
        'antialiased',
        geistSans.variable,
        geistMono.variable,
        bai.variable,
        'font-sans',
        inter.variable
      )}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
