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
import { Badge } from '@/components/ui/badge'
import { CreditCardIcon, PencilIcon, ArrowLeftIcon } from 'lucide-react'

interface Account {
  id: number
  account_number: string
  account_name: string
  balance: number
  created_at: string
}
type Screen = 'list' | 'edit'

function formatCurrency(n: number) {
  return `Rs. ${n.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
}

export default function AccountsPage() {
  const [screen, setScreen] = useState<Screen>('list')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [nickname, setNickname] = useState('')

  useEffect(() => {
    fetch('/api/accounts')
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) setAccounts(json.data?.accounts ?? json.accounts ?? [])
        setLoading(false)
      })
  }, [])

  function goToEdit(acc: Account) {
    setEditingAccount(acc)
    setNickname(acc.account_name)
    setScreen('edit')
  }

  function handleEditNickname(e: React.FormEvent) {
    e.preventDefault()
    if (!nickname.trim() || nickname.trim().length < 2) return
    alert(`Nickname updated to: ${nickname}`)
    setScreen('list')
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
          {screen === 'list' && (
            <>
              <div>
                <h1 className="text-2xl font-bold">Accounts</h1>
                <p className="text-sm text-muted-foreground">
                  Manage your bank accounts
                </p>
              </div>
              {loading ? (
                <p className="text-muted-foreground py-8 text-center">
                  Loading accounts...
                </p>
              ) : accounts.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center gap-3 py-10">
                    <CreditCardIcon className="size-10 text-muted-foreground" />
                    <p className="text-muted-foreground">No accounts found</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {accounts.map((acc) => (
                    <Card key={acc.id}>
                      <CardHeader className="flex flex-row items-start justify-between">
                        <div>
                          <CardTitle>{acc.account_name}</CardTitle>
                          <CardDescription>
                            ......{acc.account_number.slice(-4)}
                          </CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => goToEdit(acc)}
                        >
                          <PencilIcon className="size-4" />
                        </Button>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-semibold tabular-nums">
                          {formatCurrency(acc.balance)}
                        </p>
                        <Badge variant="outline" className="mt-2">
                          <CreditCardIcon className="size-3" />{' '}
                          {acc.account_number}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

          {screen === 'edit' && editingAccount && (
            <div className="max-w-md mx-auto w-full">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setScreen('list')}
                    >
                      <ArrowLeftIcon className="size-4" />
                    </Button>
                    <CardTitle>Edit Account Nickname</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={handleEditNickname}
                    className="flex flex-col gap-4"
                  >
                    <div className="flex flex-col gap-2">
                      <Label>Account Number</Label>
                      <Input value={editingAccount.account_number} disabled />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Balance</Label>
                      <Input
                        value={formatCurrency(editingAccount.balance)}
                        disabled
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Nickname</Label>
                      <Input
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        placeholder="Enter new nickname"
                        required
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => setScreen('list')}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button type="submit" className="flex-1">
                        Update
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
