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
import { CheckCircle2Icon, AlertTriangleIcon } from 'lucide-react'

interface Account {
  id: number
  account_number: string
  account_name: string
  balance: number
}

type Step = 'form' | 'confirm' | 'success' | 'failure'

function formatCurrency(n: number) {
  return `Rs. ${n.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
}

export default function BankTransferPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [fromAccount, setFromAccount] = useState('')
  const [amount, setAmount] = useState('')
  const [toAccount, setToAccount] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [txId, setTxId] = useState<string | null>(null)
  const [failMessage, setFailMessage] = useState('')
  const [failBalance, setFailBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/accounts')
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          const accs = json.data?.accounts ?? json.accounts ?? []
          setAccounts(accs)
          if (accs.length > 0) setFromAccount(accs[0].account_number)
        }
      })
  }, [])

  const selected = accounts.find((a) => a.account_number === fromAccount)

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    if (!fromAccount || !toAccount || !amount || Number(amount) <= 0) {
      setError('Please fill all required fields with valid values')
      return
    }
    setError('')
    setStep('confirm')
  }

  async function handleTransfer() {
    setLoading(true)
    const res = await fetch('/api/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAccount,
        toAccount,
        amount: Number(amount),
        description
      })
    })
    const json = await res.json()
    setLoading(false)

    if (json.ok) {
      setTxId(String(json.data?.transaction_id ?? json.transaction_id))
      setStep('success')
    } else {
      setFailMessage(json.data?.message ?? json.message ?? 'Transfer failed')
      setFailBalance(json.data?.balance ?? selected?.balance ?? null)
      setStep('failure')
    }
  }

  function reset() {
    setAmount('')
    setToAccount('')
    setDescription('')
    setError('')
    setTxId(null)
    setStep('form')
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
        <div className="flex flex-1 flex-col items-center p-4 md:p-6">
          <div className="w-full max-w-xl">
            {step === 'form' && (
              <Card>
                <CardHeader>
                  <CardTitle>Bank Transfer</CardTitle>
                  <CardDescription>
                    Send money to another account
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleNext} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label>From Account</Label>
                      <Select
                        value={fromAccount}
                        onValueChange={setFromAccount}
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
                              {a.account_name} — {formatCurrency(a.balance)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>To Account Number</Label>
                      <Input
                        value={toAccount}
                        onChange={(e) => setToAccount(e.target.value)}
                        placeholder="Recipient account number"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Description (optional)</Label>
                      <Input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What's this for?"
                      />
                    </div>
                    {error && (
                      <p className="text-sm text-destructive">{error}</p>
                    )}
                    <Button type="submit" className="mt-2">
                      Next
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {step === 'confirm' && (
              <Card>
                <CardHeader>
                  <CardTitle>Confirm Transfer</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="rounded-lg border p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">From</span>
                      <span className="font-medium">
                        {selected?.account_name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">To</span>
                      <span className="font-medium">{toAccount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-semibold">
                        {formatCurrency(Number(amount))}
                      </span>
                    </div>
                    {description && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Note</span>
                        <span>{description}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setStep('form')}
                      className="flex-1"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleTransfer}
                      disabled={loading}
                      className="flex-1"
                    >
                      {loading ? 'Processing...' : 'Transfer'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 'success' && (
              <Card>
                <CardContent className="flex flex-col items-center gap-4 py-10">
                  <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2Icon className="size-8 text-emerald-600" />
                  </div>
                  <h2 className="text-xl font-semibold">
                    Transfer Successful!
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Transaction ID: {txId}
                  </p>
                  <Button onClick={reset}>Back to Transfers</Button>
                </CardContent>
              </Card>
            )}

            {step === 'failure' && (
              <Card>
                <CardContent className="flex flex-col items-center gap-4 py-10">
                  <div className="flex size-16 items-center justify-center rounded-full bg-red-100">
                    <AlertTriangleIcon className="size-8 text-destructive" />
                  </div>
                  <h2 className="text-xl font-semibold">Transfer Failed</h2>
                  <p className="text-sm text-muted-foreground">{failMessage}</p>
                  {failBalance != null && (
                    <p className="text-sm text-muted-foreground">
                      Current Balance: {formatCurrency(failBalance)}
                    </p>
                  )}
                  <Button onClick={reset}>Try Again</Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
