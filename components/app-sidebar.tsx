'use client'

import * as React from 'react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { NavMain } from '@/components/nav-main'
import { NavSecondary } from '@/components/nav-secondary'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar'
import {
  LayoutDashboardIcon,
  WalletIcon,
  ArrowLeftRightIcon,
  ReceiptIcon,
  PieChartIcon,
  FileTextIcon,
  HistoryIcon,
  Settings2Icon,
  LogOutIcon,
  LandmarkIcon
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter()
  const [user, setUser] = useState({ name: '', email: '' })

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          const p = json.data?.profile ?? json.profile
          setUser({
            name: p?.full_name || 'User',
            email: p?.email || ''
          })
        }
      })
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const navMain = [
    { title: 'Dashboard', url: '/dashboard', icon: <LayoutDashboardIcon /> },
    { title: 'Accounts', url: '/bank-accounts', icon: <WalletIcon /> },
    {
      title: 'Bank Transfer',
      url: '/bank-transfer',
      icon: <ArrowLeftRightIcon />
    },
    { title: 'Pay Bills', url: '/pay-bills', icon: <ReceiptIcon /> },
    { title: 'Transactions', url: '/transactions', icon: <HistoryIcon /> },
    { title: 'Smart Spend', url: '/smart-spend', icon: <PieChartIcon /> },
    { title: 'E-Statement', url: '/e-statement', icon: <FileTextIcon /> }
  ]

  const navSecondary = [
    { title: 'Settings', url: '#', icon: <Settings2Icon /> },
    { title: 'Log out', url: '#', icon: <LogOutIcon />, onClick: handleLogout }
  ]

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="/dashboard">
                <LandmarkIcon className="size-5!" />
                <span className="text-base font-semibold">Nova Bank</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavSecondary items={navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-3 px-2 py-1.5">
          <Avatar className="h-8 w-8 rounded-lg">
            <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{user.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
