'use client'

import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@/components/ui/chart'

interface Transaction {
  id: number
  from_account: string
  to_account: string
  amount: number
  status: string
  created_at: string
}

interface Props {
  transactions: Transaction[]
  userAccounts: string[]
}

const chartConfig = {
  income: {
    label: 'Income',
    color: 'oklch(0.40 0.18 320)'
  },
  expenses: {
    label: 'Expenses',
    color: 'oklch(0.72 0.10 340)'
  }
} satisfies ChartConfig

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
]

export function ChartCashflowArea({ transactions, userAccounts }: Props) {
  const chartData = useMemo(() => {
    const now = new Date()
    const months: {
      key: string
      label: string
      income: number
      expenses: number
    }[] = []

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label:
          `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear() !== now.getFullYear() ? d.getFullYear() : ''}`.trim(),
        income: 0,
        expenses: 0
      })
    }

    const completed = transactions.filter((t) => t.status !== 'failed')

    for (const t of completed) {
      const d = new Date(t.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const month = months.find((m) => m.key === key)
      if (!month) continue

      const isIncome =
        userAccounts.includes(t.to_account) &&
        !userAccounts.includes(t.from_account)
      const isExpense =
        userAccounts.includes(t.from_account) &&
        !userAccounts.includes(t.to_account)

      if (isIncome) month.income += Number(t.amount)
      if (isExpense) month.expenses += Number(t.amount)
    }

    return months
  }, [transactions, userAccounts])

  const formatShort = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n)

  return (
    <Card className="@container/card h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Cash Flow</CardTitle>
        <CardDescription>Income vs Expenses — last 6 months</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-2 sm:px-4 flex-1">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[180px] w-full"
        >
          <AreaChart data={chartData} margin={{ left: 4, right: 4 }}>
            <defs>
              <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="oklch(0.40 0.18 320)"
                  stopOpacity={0.35}
                />
                <stop
                  offset="95%"
                  stopColor="oklch(0.40 0.18 320)"
                  stopOpacity={0.02}
                />
              </linearGradient>
              <linearGradient id="fillExpenses" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="oklch(0.72 0.10 340)"
                  stopOpacity={0.28}
                />
                <stop
                  offset="95%"
                  stopColor="oklch(0.72 0.10 340)"
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              stroke="var(--border)"
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              tickFormatter={formatShort}
              width={36}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  formatter={(value, name) => (
                    <span className="font-medium tabular-nums">
                      Rs.{' '}
                      {Number(value).toLocaleString('en-LK', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      })}
                    </span>
                  )}
                />
              }
            />
            <Area
              dataKey="income"
              type="monotone"
              fill="url(#fillIncome)"
              stroke="oklch(0.40 0.18 320)"
              strokeWidth={2}
            />
            <Area
              dataKey="expenses"
              type="monotone"
              fill="url(#fillExpenses)"
              stroke="oklch(0.72 0.10 340)"
              strokeWidth={2}
              strokeDasharray="4 2"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex gap-4 text-xs text-muted-foreground pt-0">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-full"
            style={{ background: 'oklch(0.40 0.18 320)' }}
          />
          Income
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 rounded-full"
            style={{ background: 'oklch(0.72 0.10 340)' }}
          />
          Expenses
        </span>
      </CardFooter>
    </Card>
  )
}
