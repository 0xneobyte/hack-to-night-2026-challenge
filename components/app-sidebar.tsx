'use client'

import * as React from 'react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { NavMain } from '@/components/nav-main'
import { NavSecondary } from '@/components/nav-secondary'
import { NavUser } from '@/components/nav-user'
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
  Settings2Icon,
  CircleHelpIcon,
  LogOutIcon,
  LandmarkIcon
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter()
  const [user, setUser] = useState({ name: '', email: '', avatar: '' })

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          const p = json.data?.profile ?? json.profile
          setUser({
            name: p?.full_name || 'User',
            email: p?.email || '',
            avatar: ''
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

  const navMain = [
    { title: 'Dashboard', url: '/dashboard', icon: <LayoutDashboardIcon /> },
    { title: 'Accounts', url: '/bank-accounts', icon: <WalletIcon /> },
    {
      title: 'Bank Transfer',
      url: '/bank-transfer',
      icon: <ArrowLeftRightIcon />
    },
    { title: 'Pay Bills', url: '/pay-bills', icon: <ReceiptIcon /> },
    { title: 'Smart Spend', url: '/smart-spend', icon: <PieChartIcon /> },
    { title: 'E-Statement', url: '/e-statement', icon: <FileTextIcon /> }
  ]

  const navSecondary = [
    { title: 'Settings', url: '#', icon: <Settings2Icon /> },
    { title: 'Help', url: '#', icon: <CircleHelpIcon /> },
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
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
