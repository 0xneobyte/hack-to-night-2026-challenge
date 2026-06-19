'use client'

import { useMemo } from 'react'
import { Pie, PieChart, Cell } from 'recharts'
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
  ChartLegend,
  ChartLegendContent,
  type ChartConfig
} from '@/components/ui/chart'
import { TrendingUpIcon, TrendingDownIcon } from 'lucide-react'

interface Transaction {
  id: number
  from_account: string
  to_account: string
  amount: number
  status: string
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

export function ChartIncomeExpenseDonut({ transactions, userAccounts }: Props) {
  const { income, expenses, netFlow } = useMemo(() => {
    const completed = transactions.filter((t) => t.status !== 'failed')
    const income = completed
      .filter(
        (t) =>
          userAccounts.includes(t.to_account) &&
          !userAccounts.includes(t.from_account)
      )
      .reduce((s, t) => s + Number(t.amount), 0)
    const expenses = completed
      .filter(
        (t) =>
          userAccounts.includes(t.from_account) &&
          !userAccounts.includes(t.to_account)
      )
      .reduce((s, t) => s + Number(t.amount), 0)
    return { income, expenses, netFlow: income - expenses }
  }, [transactions, userAccounts])

  const total = income + expenses
  const hasData = total > 0

  const data = [
    { name: 'income', value: hasData ? income : 0, label: 'Income' },
    { name: 'expenses', value: hasData ? expenses : 1, label: 'Expenses' }
  ]

  const formatCurrency = (n: number) =>
    `Rs. ${n.toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-0">
        <CardTitle className="text-base font-semibold">
          Income vs Expenses
        </CardTitle>
        <CardDescription>All-time breakdown</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[220px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, name) => (
                    <span className="font-medium">
                      {formatCurrency(Number(value))}
                    </span>
                  )}
                />
              }
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={88}
              strokeWidth={2}
              stroke="var(--background)"
            >
              <Cell fill="oklch(0.40 0.18 320)" />
              <Cell fill="oklch(0.78 0.08 340)" />
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="name" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex flex-col gap-1 pt-2">
        <div className="flex w-full justify-between text-sm">
          <span className="text-muted-foreground">Net flow</span>
          <span
            className={`font-semibold tabular-nums font-playfair ${netFlow >= 0 ? 'text-emerald-600' : 'text-destructive'}`}
          >
            {netFlow >= 0 ? '+' : '-'}
            {formatCurrency(Math.abs(netFlow))}
          </span>
        </div>
        <div className="flex w-full items-center gap-1 text-xs text-muted-foreground">
          {netFlow >= 0 ? (
            <TrendingUpIcon className="size-3 text-emerald-600" />
          ) : (
            <TrendingDownIcon className="size-3 text-destructive" />
          )}
          {netFlow >= 0 ? 'Positive balance flow' : 'Spending exceeds income'}
        </div>
      </CardFooter>
    </Card>
  )
}
