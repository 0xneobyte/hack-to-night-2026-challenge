'use client'

import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card'
import { PieChartIcon } from 'lucide-react'

export default function SmartSpendPage() {
  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)'
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col p-4 md:p-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold">Smart Spend</h1>
            <p className="text-sm text-muted-foreground">
              Spending analytics and budget tracking
            </p>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <Card className="w-full max-w-md">
              <CardContent className="flex flex-col items-center gap-4 py-10">
                <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                  <PieChartIcon className="size-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Coming soon</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
