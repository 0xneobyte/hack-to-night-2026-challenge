'use client'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { ArrowUpRightIcon, ArrowDownLeftIcon } from 'lucide-react'
import Link from 'next/link'

interface Transaction {
  id: number
  from_account: string
  to_account: string
  amount: number
  description: string | null
  status: string
  created_at: string
}

function formatCurrency(n: number) {
  return `Rs. ${n.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}

export function RecentTransactions({
  transactions,
  userAccounts
}: {
  transactions: Transaction[]
  userAccounts: string[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <CardDescription>Your latest account activity.</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" asChild>
            <Link href="/transactions">View All</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No transactions yet
          </p>
        ) : (
          <Table>
            <TableBody>
              {transactions.map((t) => {
                const isSent = userAccounts.includes(t.from_account)
                return (
                  <TableRow key={t.id}>
                    <TableCell className="w-10">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                        {isSent ? (
                          <ArrowUpRightIcon className="size-4 text-destructive" />
                        ) : (
                          <ArrowDownLeftIcon className="size-4 text-emerald-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {t.description ||
                            (isSent ? 'Transfer Out' : 'Transfer In')}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {isSent
                            ? `To ......${t.to_account.slice(-4)}`
                            : `From ......${t.from_account.slice(-4)}`}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(t.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`text-sm font-semibold font-playfair tabular-nums ${
                          isSent ? '' : 'text-emerald-500'
                        }`}
                      >
                        {isSent ? '-' : '+'}
                        {formatCurrency(t.amount)}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
