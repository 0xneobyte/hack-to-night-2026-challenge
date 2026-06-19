'use client'

import {
  CalendarClockIcon,
  DatabaseIcon,
  LightbulbIcon,
  MinusIcon,
  TrendingDownIcon,
  TrendingUpIcon
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
import type { PredictorResult, PriceDirection } from '@/lib/ai/types'

function directionUi(direction: PriceDirection, pct: number) {
  if (direction === 'up') {
    return {
      icon: <TrendingUpIcon className="size-5 text-destructive" />,
      color: 'text-destructive',
      label: `+${Math.abs(pct)}%`
    }
  }
  if (direction === 'down') {
    return {
      icon: <TrendingDownIcon className="size-5 text-primary" />,
      color: 'text-primary',
      label: `-${Math.abs(pct)}%`
    }
  }
  return {
    icon: <MinusIcon className="size-5 text-muted-foreground" />,
    color: 'text-muted-foreground',
    label: 'Stable'
  }
}

export default function UtilityPredictorPage() {
  const [data, setData] = useState<PredictorResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/utility-predictor')
      const json = await res.json()
      if (json.ok) {
        setData(json.data as PredictorResult)
      } else {
        setError(json.message || 'Could not load predictions')
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
              <h1 className="text-2xl font-bold">Utility Price Predictor</h1>
              <p className="text-sm text-muted-foreground">
                AI forecasts for electricity, fuel & water bills
              </p>
            </div>
            <Button onClick={load} disabled={loading} variant="outline">
              {loading ? 'Predicting…' : 'Refresh'}
            </Button>
          </div>

          {error && (
            <Card className="border-destructive">
              <CardContent className="py-4 text-sm text-destructive">
                {error}
              </CardContent>
            </Card>
          )}

          {loading && !data && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          )}

          {data && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.predictions.map((p) => {
                  const ui = directionUi(p.direction, p.predicted_change_pct)
                  return (
                    <Card key={p.utility}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">
                            {p.utility}
                          </CardTitle>
                          {ui.icon}
                        </div>
                        <CardDescription>{p.current_estimate}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-2">
                        <div className="flex items-baseline gap-2">
                          <span className={`text-2xl font-bold ${ui.color}`}>
                            {ui.label}
                          </span>
                          <Badge variant="secondary">
                            {p.confidence} confidence
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {p.reasoning}
                        </p>
                        {!p.source_available && (
                          <p className="text-xs text-muted-foreground">
                            Live source unavailable — estimate from model
                            knowledge.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <LightbulbIcon className="size-4 text-amber-500" />
                    Budget plan
                  </CardTitle>
                  <CardDescription>{data.budget_plan.summary}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <ul className="flex flex-col gap-2 text-sm">
                    {data.budget_plan.monthly_actions.map((a, i) => (
                      <li key={i} className="flex gap-2">
                        <Badge variant="secondary" className="shrink-0">
                          {i + 1}
                        </Badge>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    <span className="font-medium">Estimated impact: </span>
                    {data.budget_plan.estimated_monthly_impact}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <DatabaseIcon className="size-4 text-muted-foreground" />
                    Data sources
                  </CardTitle>
                  <CardDescription>
                    Public endpoints queried for this forecast.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {data.sources.map((s) => (
                    <div
                      key={s.url}
                      className="flex items-center justify-between gap-3 rounded-lg border p-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{s.label}</p>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate font-mono text-xs text-muted-foreground hover:underline"
                        >
                          {s.url}
                        </a>
                      </div>
                      <Badge variant={s.available ? 'secondary' : 'outline'}>
                        {s.available ? 'Live' : 'Unavailable'}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <CalendarClockIcon className="size-3.5" />
                <span>
                  Generated {new Date(data.generated_at).toLocaleString()}
                </span>
                <span>
                  · AI forecast from public sources — indicative only, not
                  financial advice.
                </span>
              </div>
            </>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
