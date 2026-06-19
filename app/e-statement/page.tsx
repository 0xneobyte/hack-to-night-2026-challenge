'use client'

import { useEffect, useState, useMemo } from 'react'
import { Download } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ChartStatementRadial } from '@/components/chart-statement-radial'
import { ChartCashflowArea } from '@/components/chart-cashflow-area'
import { generateStatementPDF } from '@/lib/generate-statement-pdf'

interface Account {
  id: number
  account_number: string
  account_name: string
  balance: number
}
interface Transaction {
  id: number
  from_account: string
  to_account: string
  amount: number
  description: string | null
  status: string
  created_at: string
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

function formatCurrency(n: number) {
  return `Rs. ${n.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export default function EStatementPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([])
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetch('/api/accounts')
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          const accs = json.data?.accounts ?? json.accounts ?? []
          setAccounts(accs)
          if (accs.length > 0) setSelectedAccount(accs[0].account_number)
        }
      })
  }, [])

  useEffect(() => {
    if (!selectedAccount) return
    setLoading(true)
    setSelectedMonth('all')
    fetch(`/api/transactions?account=${selectedAccount}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.ok)
          setAllTransactions(json.data?.transactions ?? json.transactions ?? [])
        setLoading(false)
      })
  }, [selectedAccount])

  const account = accounts.find((a) => a.account_number === selectedAccount)

  const availableMonths = useMemo(() => {
    const seen = new Set<string>()
    const months: { key: string; label: string }[] = []
    for (const t of allTransactions) {
      const d = new Date(t.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!seen.has(key)) {
        seen.add(key)
        months.push({
          key,
          label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
        })
      }
    }
    return months.sort((a, b) => b.key.localeCompare(a.key))
  }, [allTransactions])

  const transactions = useMemo(() => {
    if (selectedMonth === 'all') return allTransactions
    return allTransactions.filter((t) => {
      const d = new Date(t.created_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      return key === selectedMonth
    })
  }, [allTransactions, selectedMonth])

  const totalDebits = transactions
    .filter((t) => t.from_account === selectedAccount)
    .reduce((s, t) => s + Number(t.amount), 0)
  const totalCredits = transactions
    .filter((t) => t.to_account === selectedAccount)
    .reduce((s, t) => s + Number(t.amount), 0)
  const closingBalance = account?.balance ?? 0
  const openingBalance = closingBalance + totalDebits - totalCredits

  async function handleExport() {
    if (!account) return
    setExporting(true)
    try {
      await generateStatementPDF({
        account,
        transactions,
        openingBalance,
        totalCredits,
        totalDebits
      })
    } finally {
      setExporting(false)
    }
  }

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
        <div className="flex flex-1 flex-col p-4 md:p-6 gap-6">
          <div>
            <h1 className="text-2xl font-bold">E-Statement</h1>
            <p className="text-sm text-muted-foreground">
              View your account statement by month
            </p>
          </div>

          {/* Filters row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[280px] sm:max-w-md">
              <Label>Account</Label>
              <Select
                value={selectedAccount}
                onValueChange={setSelectedAccount}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.account_number} value={a.account_number}>
                      {a.account_name} ({a.account_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[160px]">
              <Label>Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  {availableMonths.map((m) => (
                    <SelectItem key={m.key} value={m.key}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
              Loading statement...
            </div>
          ) : account ? (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">
                      Opening Balance
                    </p>
                    <p className="text-lg font-semibold font-playfair tabular-nums">
                      {formatCurrency(openingBalance)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">
                      Total Credits
                    </p>
                    <p className="text-lg font-semibold font-playfair tabular-nums text-emerald-600">
                      {formatCurrency(totalCredits)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">
                      Total Debits
                    </p>
                    <p className="text-lg font-semibold font-playfair tabular-nums text-destructive">
                      {formatCurrency(totalDebits)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">
                      Closing Balance
                    </p>
                    <p className="text-lg font-semibold font-playfair tabular-nums">
                      {formatCurrency(closingBalance)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3 items-stretch">
                <div className="flex flex-col">
                  <ChartStatementRadial
                    totalCredits={totalCredits}
                    totalDebits={totalDebits}
                    accountName={`${account.account_name} — ${account.account_number}`}
                  />
                </div>
                <div className="md:col-span-2 flex flex-col">
                  <ChartCashflowArea
                    transactions={allTransactions}
                    userAccounts={[selectedAccount]}
                  />
                </div>
              </div>

              {/* Transactions table */}
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle>Transaction Details</CardTitle>
                    <CardDescription>
                      {account.account_name} — {account.account_number}
                      {selectedMonth !== 'all' && (
                        <>
                          {' '}
                          &mdash;{' '}
                          {
                            availableMonths.find((m) => m.key === selectedMonth)
                              ?.label
                          }
                        </>
                      )}
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    disabled={exporting}
                    className="shrink-0"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {exporting ? 'Generating…' : 'Download PDF'}
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Ref</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center text-muted-foreground py-8"
                          >
                            No transactions found
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions.map((t) => {
                          const isDebit = t.from_account === selectedAccount
                          return (
                            <TableRow key={t.id}>
                              <TableCell className="text-sm">
                                {formatDate(t.created_at)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {t.description || '-'}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                TXN-{t.id}
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium text-destructive">
                                {isDebit ? formatCurrency(t.amount) : '-'}
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium text-emerald-600">
                                {!isDebit ? formatCurrency(t.amount) : '-'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{t.status}</Badge>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
