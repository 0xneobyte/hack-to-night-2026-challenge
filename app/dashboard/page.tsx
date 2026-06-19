'use client'

import { useEffect, useState } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { RecentTransactions } from '@/components/recent-transactions'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  TrendingUpIcon,
  WalletIcon,
  ArrowLeftRightIcon,
  CreditCardIcon
} from 'lucide-react'
import type { ProfileWithEmail } from '@/lib/types'

interface AccountRow {
  id: number
  account_number: string
  account_name: string
  balance: number
}

interface TransactionRow {
  id: number
  from_account: string
  to_account: string
  amount: number
  description: string | null
  status: string
  created_at: string
}

function formatCurrency(n: number) {
  return `Rs. ${n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<ProfileWithEmail | null>(null)
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      const [profileRes, accountsRes, txRes] = await Promise.all([
        fetch('/api/profile'),
        fetch('/api/accounts'),
        fetch('/api/transactions?limit=5')
      ])

      if (profileRes.ok) {
        const json = await profileRes.json()
        if (json.ok) setProfile(json.data?.profile ?? json.profile)
      }
      if (accountsRes.ok) {
        const json = await accountsRes.json()
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

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0)
  const accountCount = accounts.length
  const txCount = transactions.length
  const userAccountNumbers = accounts.map((a) => a.account_number)

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
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              {loading ? (
                <div className="flex items-center justify-center py-20 text-muted-foreground">
                  Loading your data...
                </div>
              ) : (
                <>
                  <div className="px-4 lg:px-6">
                    <h1 className="text-2xl font-bold mb-1">
                      Welcome back,{' '}
                      {profile?.full_name?.split(' ')[0] ?? 'there'}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      Here&apos;s an overview of your Nova Bank accounts.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
                    <Card className="@container/card">
                      <CardHeader>
                        <CardDescription>Total Balance</CardDescription>
                        <CardTitle className="text-2xl font-semibold font-playfair tabular-nums @[250px]/card:text-3xl">
                          {formatCurrency(totalBalance)}
                        </CardTitle>
                        <CardAction>
                          <Badge variant="outline">
                            <WalletIcon className="size-3" />
                            {accountCount}{' '}
                            {accountCount === 1 ? 'account' : 'accounts'}
                          </Badge>
                        </CardAction>
                      </CardHeader>
                      <CardFooter className="flex-col items-start gap-1.5 text-sm">
                        <div className="line-clamp-1 flex gap-2 font-medium">
                          Across all accounts
                        </div>
                      </CardFooter>
                    </Card>

                    {accounts.slice(0, 2).map((acc) => (
                      <Card key={acc.id} className="@container/card">
                        <CardHeader>
                          <CardDescription>{acc.account_name}</CardDescription>
                          <CardTitle className="text-2xl font-semibold font-playfair tabular-nums @[250px]/card:text-3xl">
                            {formatCurrency(acc.balance)}
                          </CardTitle>
                          <CardAction>
                            <Badge variant="outline">
                              <CreditCardIcon className="size-3" />
                              ......{acc.account_number.slice(-4)}
                            </Badge>
                          </CardAction>
                        </CardHeader>
                        <CardFooter className="flex-col items-start gap-1.5 text-sm">
                          <div className="text-muted-foreground">
                            Account {acc.account_number}
                          </div>
                        </CardFooter>
                      </Card>
                    ))}

                    <Card className="@container/card">
                      <CardHeader>
                        <CardDescription>Transactions</CardDescription>
                        <CardTitle className="text-2xl font-semibold font-playfair tabular-nums @[250px]/card:text-3xl">
                          {txCount}
                        </CardTitle>
                        <CardAction>
                          <Badge variant="outline">
                            <ArrowLeftRightIcon className="size-3" />
                            Recent
                          </Badge>
                        </CardAction>
                      </CardHeader>
                      <CardFooter className="flex-col items-start gap-1.5 text-sm">
                        <div className="line-clamp-1 flex gap-2 font-medium">
                          Latest activity <TrendingUpIcon className="size-4" />
                        </div>
                      </CardFooter>
                    </Card>
                  </div>

                  <div className="px-4 lg:px-6">
                    <RecentTransactions
                      transactions={transactions}
                      userAccounts={userAccountNumbers}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
