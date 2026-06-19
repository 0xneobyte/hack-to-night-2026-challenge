'use client'

import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { MoonIcon, SunIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/bank-accounts': 'Accounts',
  '/bank-transfer': 'Bank Transfer',
  '/pay-bills': 'Pay Bills',
  '/transactions': 'Transactions',
  '/smart-spend': 'Smart Spend',
  '/e-statement': 'E-Statement',
  '/settings': 'Settings'
}

export function SiteHeader() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  const title = pageTitles[pathname] ?? 'Nova Bank'

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <h1 className="text-base font-medium ml-2">{title}</h1>
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <SunIcon className="size-4 scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
            <MoonIcon className="absolute size-4 scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
