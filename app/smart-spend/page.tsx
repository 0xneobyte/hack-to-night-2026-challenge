'use client'

import {
  AlertTriangleIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  InfoIcon,
  LightbulbIcon,
  OctagonAlertIcon,
  WalletIcon
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import type { AlertSeverity, InsightsResult } from '@/lib/ai/types'

function formatCurrency(n: number) {
  return `Rs. ${Number(n || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2
  })}`
}

const severityStyles: Record<
  AlertSeverity,
  { border: string; icon: React.ReactNode; badge: string; label: string }
> = {
  info: {
    border: 'border-l-border',
    icon: <InfoIcon className="size-4 text-muted-foreground" />,
    badge: 'secondary',
    label: 'Info'
  },
  warning: {
    border: 'border-l-primary',
    icon: <AlertTriangleIcon className="size-4 text-primary" />,
    badge: 'secondary',
    label: 'Watch'
  },
  critical: {
    border: 'border-l-destructive',
    icon: <OctagonAlertIcon className="size-4 text-destructive" />,
    badge: 'destructive',
    label: 'Critical'
  }
}

export default function SmartSpendPage() {
  const [data, setData] = useState<InsightsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/insights')
      const json = await res.json()
      if (json.ok) {
        setData(json.data as InsightsResult)
      } else {
        setError(json.message || 'Could not load insights')
      }
    } catch {
      setError('Could not reach the server')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

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
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Smart Spend</h1>
              <p className="text-sm text-muted-foreground">
                AI spending monitoring, insights & alerts
              </p>
            </div>
            <Button onClick={load} disabled={loading} variant="outline">
              {loading ? 'Analyzing…' : 'Re-analyze'}
            </Button>
          </div>

          {error && (
            <Card className="border-destructive">
              <CardContent className="py-4 text-sm text-destructive">
                {error}
              </CardContent>
            </Card>
          )}

          {loading && !data && <LoadingSkeleton />}

          {data && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{data.headline}</CardTitle>
                  <CardDescription>{data.summary}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  <Stat
                    label="Money in"
                    value={formatCurrency(data.totals.inflow)}
                    icon={
                      <ArrowDownLeftIcon className="size-4 text-muted-foreground" />
                    }
                  />
                  <Stat
                    label="Money out"
                    value={formatCurrency(data.totals.outflow)}
                    icon={
                      <ArrowUpRightIcon className="size-4 text-muted-foreground" />
                    }
                  />
                  <Stat
                    label="Net"
                    value={formatCurrency(data.totals.net)}
                    icon={
                      <WalletIcon className="size-4 text-muted-foreground" />
                    }
                  />
                </CardContent>
              </Card>

              {data.alerts.length > 0 && (
                <div className="flex flex-col gap-2">
                  {data.alerts.map((a, i) => (
                    <Card
                      key={i}
                      className={`border-l-4 ${severityStyles[a.severity].border}`}
                    >
                      <CardContent className="flex items-start gap-3 py-3">
                        <div className="mt-0.5">
                          {severityStyles[a.severity].icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">{a.title}</p>
                            <Badge
                              variant={
                                a.severity === 'critical'
                                  ? 'destructive'
                                  : 'secondary'
                              }
                            >
                              {severityStyles[a.severity].label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {a.message}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                {data.categories.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Where your money goes
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      {data.categories.map((c) => (
                        <div key={c.name} className="flex flex-col gap-1">
                          <div className="flex justify-between text-sm">
                            <span>{c.name}</span>
                            <span className="text-muted-foreground">
                              {formatCurrency(c.amount)} · {c.percentage}%
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{
                                width: `${Math.min(100, Math.max(0, c.percentage))}%`
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Insights</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="flex flex-col gap-2 text-sm">
                      {data.insights.map((t, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-primary">•</span>
                          <span>{t}</span>
                        </li>
                      ))}
                      {data.insights.length === 0 && (
                        <li className="text-muted-foreground">
                          No insights yet.
                        </li>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {data.budget_tips.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <LightbulbIcon className="size-4 text-amber-500" />
                      Budget plan
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="flex flex-col gap-2 text-sm">
                      {data.budget_tips.map((t, i) => (
                        <li key={i} className="flex gap-2">
                          <Badge variant="secondary" className="shrink-0">
                            {i + 1}
                          </Badge>
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">Data points</p>
                <p>
                  Analyzed {data.analyzed.transactions} transactions across{' '}
                  {data.analyzed.accounts} account
                  {data.analyzed.accounts === 1 ? '' : 's'}.
                </p>
                <p className="mt-1 font-mono">{data.analyzed.endpoint}</p>
                <p className="mt-2">
                  Generated by AI — guidance only, not financial advice.
                </p>
              </div>
            </>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function Stat({
  label,
  value,
  icon
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </CardContent>
      </Card>
      <Skeleton className="h-24" />
      <Skeleton className="h-40" />
    </div>
  )
}
