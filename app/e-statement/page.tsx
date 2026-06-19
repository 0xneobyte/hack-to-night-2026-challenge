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

export default function EStatementPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [fetched, setFetched] = useState(false)
  const [loading, setLoading] = useState(false)

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

  const account = accounts.find((a) => a.account_number === selectedAccount)

  async function handleFetch() {
    if (!selectedAccount) return
    setLoading(true)
    const res = await fetch(`/api/transactions?account=${selectedAccount}`)
    const json = await res.json()
    if (json.ok)
      setTransactions(json.data?.transactions ?? json.transactions ?? [])
    setFetched(true)
    setLoading(false)
  }

  const totalDebits = transactions
    .filter((t) => t.from_account === selectedAccount)
    .reduce((s, t) => s + Number(t.amount), 0)
  const totalCredits = transactions
    .filter((t) => t.to_account === selectedAccount)
    .reduce((s, t) => s + Number(t.amount), 0)
  const closingBalance = account?.balance ?? 0
  const openingBalance = closingBalance + totalDebits - totalCredits

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
            <h1 className="text-2xl font-bold">E-Statement</h1>
            <p className="text-sm text-muted-foreground">
              View and download your account statements
            </p>
          </div>
          <Card>
            <CardContent>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex flex-col gap-2 flex-1">
                  <Label>Select Account</Label>
                  <Select
                    value={selectedAccount}
                    onValueChange={setSelectedAccount}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem
                          key={a.account_number}
                          value={a.account_number}
                        >
                          {a.account_name} ({a.account_number})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleFetch} disabled={loading}>
                  {loading ? 'Loading...' : 'View Statement'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {fetched && account && (
            <>
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

              <Card>
                <CardHeader>
                  <CardTitle>Transaction Details</CardTitle>
                  <CardDescription>
                    {account.account_name} — {account.account_number}
                  </CardDescription>
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
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
