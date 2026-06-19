'use client'

import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from '@/components/ui/chart'

interface Props {
  totalCredits: number
  totalDebits: number
  accountName: string
}

const chartConfig = {
  credits: {
    label: 'Credits',
    color: 'oklch(0.40 0.18 320)'
  },
  debits: {
    label: 'Debits',
    color: 'oklch(0.72 0.10 340)'
  }
} satisfies ChartConfig

export function ChartStatementRadial({
  totalCredits,
  totalDebits,
  accountName
}: Props) {
  const max = Math.max(totalCredits, totalDebits, 1)

  const data = [
    {
      name: 'debits',
      value: Math.round((totalDebits / max) * 100),
      raw: totalDebits,
      fill: 'oklch(0.78 0.08 340)'
    },
    {
      name: 'credits',
      value: Math.round((totalCredits / max) * 100),
      raw: totalCredits,
      fill: 'oklch(0.40 0.18 320)'
    }
  ]

  const formatCurrency = (n: number) =>
    `Rs. ${n.toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  const creditPct =
    max > 0
      ? Math.round((totalCredits / (totalCredits + totalDebits)) * 100)
      : 0

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base font-semibold">
          Credits vs Debits
        </CardTitle>
        <CardDescription>{accountName}</CardDescription>
      </CardHeader>
      <CardContent className="pb-2">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[200px]"
        >
          <RadialBarChart
            data={data}
            startAngle={90}
            endAngle={-270}
            innerRadius={40}
            outerRadius={88}
            barSize={18}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              angleAxisId={0}
              tick={false}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, name, props) => (
                    <span className="font-medium tabular-nums">
                      {formatCurrency(props.payload?.raw ?? 0)}
                    </span>
                  )}
                />
              }
            />
            <RadialBar
              dataKey="value"
              background={{ fill: 'var(--muted)' }}
              cornerRadius={6}
            />
          </RadialBarChart>
        </ChartContainer>

        <div className="flex flex-col gap-2 mt-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ background: 'oklch(0.40 0.18 320)' }}
              />
              <span className="text-muted-foreground">Credits</span>
            </span>
            <span className="font-semibold font-playfair tabular-nums text-emerald-600">
              {formatCurrency(totalCredits)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span
                className="inline-block size-2.5 rounded-full"
                style={{ background: 'oklch(0.78 0.08 340)' }}
              />
              <span className="text-muted-foreground">Debits</span>
            </span>
            <span className="font-semibold font-playfair tabular-nums text-destructive">
              {formatCurrency(totalDebits)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2 mt-1">
            <span>Credit ratio</span>
            <span className="font-medium">{creditPct}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
