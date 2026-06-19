'use client'

import { useEffect, useState } from 'react'
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
import { Input } from '@/components/ui/input'
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
import {
  ArrowUpRightIcon,
  ArrowDownLeftIcon,
  SearchIcon,
  XIcon
} from 'lucide-react'

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

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function TransactionsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [selectedAccount, setSelectedAccount] = useState('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'sent' | 'received'>(
    'all'
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')

  const userAccountNumbers = accounts.map((a) => a.account_number)

  useEffect(() => {
    async function loadData() {
      const [accRes, txRes] = await Promise.all([
        fetch('/api/accounts'),
        fetch('/api/transactions?limit=100')
      ])

      if (accRes.ok) {
        const json = await accRes.json()
        if (json.ok) setAccounts(json.data?.accounts ?? json.accounts ?? [])
      }
      if (txRes.ok) {
        const json = await txRes.json()
        if (json.ok)
          setTransactions(json.data?.transactions ?? json.transactions ?? [])
      }
      setLoading(false)
    }
    loadData()
  }, [])

  const filtered = transactions.filter((t) => {
    if (
      selectedAccount !== 'all' &&
      t.from_account !== selectedAccount &&
      t.to_account !== selectedAccount
    )
      return false

    const isSent = userAccountNumbers.includes(t.from_account)
    if (typeFilter === 'sent' && !isSent) return false
    if (typeFilter === 'received' && isSent) return false

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchDesc = t.description?.toLowerCase().includes(q)
      const matchFrom = t.from_account.includes(q)
      const matchTo = t.to_account.includes(q)
      const matchId = String(t.id).includes(q)
      if (!matchDesc && !matchFrom && !matchTo && !matchId) return false
    }

    if (dateFrom) {
      const txDate = new Date(t.created_at)
      const fromDate = new Date(dateFrom)
      if (txDate < fromDate) return false
    }
    if (dateTo) {
      const txDate = new Date(t.created_at)
      const toDate = new Date(dateTo + 'T23:59:59')
      if (txDate > toDate) return false
    }

    const amt = Number(t.amount)
    if (minAmount && amt < Number(minAmount)) return false
    if (maxAmount && amt > Number(maxAmount)) return false

    return true
  })

  const totalSent = filtered
    .filter((t) => userAccountNumbers.includes(t.from_account))
    .reduce((s, t) => s + Number(t.amount), 0)
  const totalReceived = filtered
    .filter((t) => userAccountNumbers.includes(t.to_account))
    .reduce((s, t) => s + Number(t.amount), 0)

  const hasFilters =
    selectedAccount !== 'all' ||
    typeFilter !== 'all' ||
    searchQuery ||
    dateFrom ||
    dateTo ||
    minAmount ||
    maxAmount

  function clearFilters() {
    setSelectedAccount('all')
    setTypeFilter('all')
    setSearchQuery('')
    setDateFrom('')
    setDateTo('')
    setMinAmount('')
    setMaxAmount('')
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
        <div className="flex flex-1 flex-col p-4 md:p-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold">Transaction History</h1>
            <p className="text-sm text-muted-foreground">
              View and filter all your transactions
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Sent</p>
                <p className="text-xl font-semibold font-playfair tabular-nums text-destructive">
                  {formatCurrency(totalSent)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Received</p>
                <p className="text-xl font-semibold font-playfair tabular-nums text-emerald-600">
                  {formatCurrency(totalReceived)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Transactions</p>
                <p className="text-xl font-semibold font-playfair tabular-nums">
                  {filtered.length}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Filters</CardTitle>
                  <CardDescription>
                    Narrow down your transactions
                  </CardDescription>
                </div>
                {hasFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-muted-foreground"
                  >
                    <XIcon className="size-4 mr-1" /> Clear
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col gap-2">
                  <Label>Search</Label>
                  <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Description, account, ID..."
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Account</Label>
                  <Select
                    value={selectedAccount}
                    onValueChange={setSelectedAccount}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Accounts</SelectItem>
                      {accounts.map((a) => (
                        <SelectItem
                          key={a.account_number}
                          value={a.account_number}
                        >
                          {a.account_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Type</Label>
                  <Select
                    value={typeFilter}
                    onValueChange={(v) =>
                      setTypeFilter(v as 'all' | 'sent' | 'received')
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="received">Received</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Amount Range</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value)}
                      placeholder="Min"
                    />
                    <Input
                      type="number"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                      placeholder="Max"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>From Date</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label>To Date</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transaction Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <p className="py-10 text-center text-muted-foreground">
                  Loading transactions...
                </p>
              ) : filtered.length === 0 ? (
                <p className="py-10 text-center text-muted-foreground">
                  {hasFilters
                    ? 'No transactions match your filters'
                    : 'No transactions yet'}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Description</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Ref</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((t) => {
                      const isSent = userAccountNumbers.includes(t.from_account)
                      return (
                        <TableRow key={t.id}>
                          <TableCell>
                            <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                              {isSent ? (
                                <ArrowUpRightIcon className="size-4 text-destructive" />
                              ) : (
                                <ArrowDownLeftIcon className="size-4 text-emerald-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">
                                {t.description ||
                                  (isSent ? 'Transfer Out' : 'Transfer In')}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {isSent
                                  ? `To ......${t.to_account.slice(-4)}`
                                  : `From ......${t.from_account.slice(-4)}`}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm">
                                {formatDate(t.created_at)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatTime(t.created_at)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            TXN-{t.id}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`text-sm font-semibold font-playfair tabular-nums ${
                                isSent ? 'text-destructive' : 'text-emerald-600'
                              }`}
                            >
                              {isSent ? '-' : '+'}
                              {formatCurrency(t.amount)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{t.status}</Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
