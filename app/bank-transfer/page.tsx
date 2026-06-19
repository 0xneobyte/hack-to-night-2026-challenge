'use client'

import { useEffect, useRef, useState } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  AtSignIcon,
  LandmarkIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  ArrowLeftIcon,
  SearchIcon,
  LoaderCircleIcon
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Account {
  id: number
  account_number: string
  account_name: string
  balance: number
}

interface ResolvedUser {
  full_name: string
  username: string
  account_number: string
}

type SendMode = 'username' | 'bank'
type Step =
  | 'select'
  | 'username-lookup'
  | 'username-form'
  | 'bank-form'
  | 'confirm'
  | 'success'
  | 'failure'

function formatCurrency(n: number) {
  return `Rs. ${n.toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function SendPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [step, setStep] = useState<Step>('select')
  const [sendMode, setSendMode] = useState<SendMode>('username')

  // username flow
  const [usernameInput, setUsernameInput] = useState('')
  const [resolvedUser, setResolvedUser] = useState<ResolvedUser | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const usernameRef = useRef<HTMLInputElement>(null)

  // bank flow
  const [toAccountInput, setToAccountInput] = useState('')

  // shared form fields
  const [fromAccount, setFromAccount] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState('')

  // result
  const [transferLoading, setTransferLoading] = useState(false)
  const [txId, setTxId] = useState<string | null>(null)
  const [failMessage, setFailMessage] = useState('')
  const [failBalance, setFailBalance] = useState<number | null>(null)

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

  const selectedAccount = accounts.find((a) => a.account_number === fromAccount)

  async function handleUsernameLookup(e: React.FormEvent) {
    e.preventDefault()
    const u = usernameInput.trim().replace(/^@/, '').toLowerCase()
    if (!u) return
    setLookupError('')
    setLookupLoading(true)
    try {
      const res = await fetch(
        `/api/lookup-user?username=${encodeURIComponent(u)}`
      )
      const json = await res.json()
      if (!json.ok) {
        setLookupError(json.message || 'User not found')
        setResolvedUser(null)
      } else {
        setResolvedUser(json.data)
        setLookupError('')
      }
    } catch {
      setLookupError('Something went wrong. Try again.')
    } finally {
      setLookupLoading(false)
    }
  }

  function handleModeSelect(mode: SendMode) {
    setSendMode(mode)
    setResolvedUser(null)
    setLookupError('')
    setUsernameInput('')
    setToAccountInput('')
    setAmount('')
    setDescription('')
    setFormError('')
    setStep(mode === 'username' ? 'username-lookup' : 'bank-form')
  }

  function handleProceedWithUser() {
    setStep('username-form')
  }

  function handleReviewUsername(e: React.FormEvent) {
    e.preventDefault()
    if (!fromAccount || !amount || Number(amount) <= 0) {
      setFormError('Please fill all required fields with valid values')
      return
    }
    setFormError('')
    setStep('confirm')
  }

  function handleReviewBank(e: React.FormEvent) {
    e.preventDefault()
    if (
      !toAccountInput.trim() ||
      !fromAccount ||
      !amount ||
      Number(amount) <= 0
    ) {
      setFormError('Please fill all required fields with valid values')
      return
    }
    setFormError('')
    setStep('confirm')
  }

  async function handleTransfer() {
    const destination =
      sendMode === 'username'
        ? (resolvedUser?.account_number ?? '')
        : toAccountInput.trim()

    setTransferLoading(true)
    try {
      const res = await fetch('/api/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAccount,
          toAccount: destination,
          amount: Number(amount),
          description
        })
      })
      const json = await res.json()

      if (json.ok) {
        setTxId(String(json.data?.transaction_id ?? json.transaction_id))
        setStep('success')
      } else {
        setFailMessage(json.data?.message ?? json.message ?? 'Transfer failed')
        setFailBalance(json.data?.balance ?? selectedAccount?.balance ?? null)
        setStep('failure')
      }
    } catch {
      setFailMessage('Something went wrong. Please try again.')
      setStep('failure')
    } finally {
      setTransferLoading(false)
    }
  }

  function reset() {
    setStep('select')
    setSendMode('username')
    setUsernameInput('')
    setResolvedUser(null)
    setLookupError('')
    setToAccountInput('')
    setAmount('')
    setDescription('')
    setFormError('')
    setTxId(null)
    setFailMessage('')
    setFailBalance(null)
  }

  const recipientLabel =
    sendMode === 'username'
      ? resolvedUser
        ? resolvedUser.full_name
        : ''
      : toAccountInput

  const recipientSub =
    sendMode === 'username'
      ? resolvedUser
        ? `@${resolvedUser.username}`
        : ''
      : ''

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
          <div className="w-full max-w-xl space-y-4">
            {/* ── STEP: SELECT MODE ── */}
            {step === 'select' && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">
                    Send Money
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose how you want to send
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => handleModeSelect('username')}
                    className={cn(
                      'group flex flex-col items-center gap-4 rounded-2xl border-2 p-8 text-center',
                      'transition-all duration-200 hover:border-primary hover:bg-primary/5 hover:shadow-md',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
                    )}
                  >
                    <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                      <AtSignIcon className="size-8" />
                    </div>
                    <div>
                      <p className="text-base font-semibold">Username</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Send to a Nova Bank user by @username
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleModeSelect('bank')}
                    className={cn(
                      'group flex flex-col items-center gap-4 rounded-2xl border-2 p-8 text-center',
                      'transition-all duration-200 hover:border-primary hover:bg-primary/5 hover:shadow-md',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
                    )}
                  >
                    <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                      <LandmarkIcon className="size-8" />
                    </div>
                    <div>
                      <p className="text-base font-semibold">Bank Account</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Send via account number
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP: USERNAME LOOKUP ── */}
            {step === 'username-lookup' && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setStep('select')}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowLeftIcon className="size-4" />
                    </button>
                    <div>
                      <CardTitle>Find recipient</CardTitle>
                      <CardDescription>
                        Enter the @username to send money to
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <form onSubmit={handleUsernameLookup} className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                        @
                      </span>
                      <Input
                        ref={usernameRef}
                        className="pl-7"
                        value={usernameInput}
                        onChange={(e) => {
                          setUsernameInput(e.target.value.replace(/^@/, ''))
                          setResolvedUser(null)
                          setLookupError('')
                        }}
                        placeholder="username"
                        autoFocus
                        autoComplete="off"
                        autoCapitalize="none"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={!usernameInput.trim() || lookupLoading}
                    >
                      {lookupLoading ? (
                        <LoaderCircleIcon className="size-4 animate-spin" />
                      ) : (
                        <SearchIcon className="size-4" />
                      )}
                    </Button>
                  </form>

                  {lookupError && (
                    <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      <AlertTriangleIcon className="size-4 shrink-0" />
                      {lookupError}
                    </div>
                  )}

                  {resolvedUser && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 rounded-xl border bg-muted/40 p-4">
                        <Avatar className="size-12">
                          <AvatarFallback className="text-base font-semibold bg-primary/15 text-primary">
                            {getInitials(resolvedUser.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">
                            {resolvedUser.full_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            @{resolvedUser.username}
                          </p>
                        </div>
                        <CheckCircle2Icon className="size-5 text-emerald-500 shrink-0" />
                      </div>
                      <Button
                        className="w-full"
                        onClick={handleProceedWithUser}
                      >
                        Send to {resolvedUser.full_name.split(' ')[0]}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── STEP: USERNAME FORM (amount + details) ── */}
            {step === 'username-form' && resolvedUser && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setStep('username-lookup')}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowLeftIcon className="size-4" />
                    </button>
                    <div>
                      <CardTitle>Transfer details</CardTitle>
                      <CardDescription>Enter how much to send</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 rounded-xl border bg-muted/40 px-4 py-3 mb-5">
                    <Avatar className="size-9">
                      <AvatarFallback className="text-sm font-semibold bg-primary/15 text-primary">
                        {getInitials(resolvedUser.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        {resolvedUser.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        @{resolvedUser.username}
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={handleReviewUsername}
                    className="flex flex-col gap-4"
                  >
                    <div className="flex flex-col gap-2">
                      <Label>From account</Label>
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
                      <Label>Amount</Label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                          Rs.
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="pl-10"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0.00"
                          required
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>
                        Note{' '}
                        <span className="text-muted-foreground font-normal">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What's this for?"
                      />
                    </div>
                    {formError && (
                      <p className="text-sm text-destructive">{formError}</p>
                    )}
                    <Button type="submit" className="mt-1">
                      Review Transfer
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* ── STEP: BANK FORM ── */}
            {step === 'bank-form' && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setStep('select')}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowLeftIcon className="size-4" />
                    </button>
                    <div>
                      <CardTitle>Bank Transfer</CardTitle>
                      <CardDescription>
                        Send money to a bank account
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={handleReviewBank}
                    className="flex flex-col gap-4"
                  >
                    <div className="flex flex-col gap-2">
                      <Label>Recipient account number</Label>
                      <Input
                        value={toAccountInput}
                        onChange={(e) => setToAccountInput(e.target.value)}
                        placeholder="e.g. 1000000001"
                        autoComplete="off"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>From account</Label>
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
                      <Label>Amount</Label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                          Rs.
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="pl-10"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="0.00"
                          required
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>
                        Note{' '}
                        <span className="text-muted-foreground font-normal">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What's this for?"
                      />
                    </div>
                    {formError && (
                      <p className="text-sm text-destructive">{formError}</p>
                    )}
                    <Button type="submit" className="mt-1">
                      Review Transfer
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* ── STEP: CONFIRM ── */}
            {step === 'confirm' && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setStep(
                          sendMode === 'username'
                            ? 'username-form'
                            : 'bank-form'
                        )
                      }
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ArrowLeftIcon className="size-4" />
                    </button>
                    <div>
                      <CardTitle>Confirm transfer</CardTitle>
                      <CardDescription>Review before sending</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border divide-y text-sm">
                    <div className="flex justify-between px-4 py-3">
                      <span className="text-muted-foreground">From</span>
                      <span className="font-medium">
                        {selectedAccount?.account_name}
                      </span>
                    </div>
                    <div className="flex justify-between px-4 py-3">
                      <span className="text-muted-foreground">To</span>
                      <div className="text-right">
                        <p className="font-medium">{recipientLabel}</p>
                        {recipientSub && (
                          <p className="text-xs text-muted-foreground">
                            {recipientSub}
                          </p>
                        )}
                      </div>
                    </div>
                    {sendMode === 'username' && resolvedUser && (
                      <div className="flex justify-between px-4 py-3">
                        <span className="text-muted-foreground">Account</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {resolvedUser.account_number}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between px-4 py-3">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-semibold font-playfair tabular-nums">
                        {formatCurrency(Number(amount))}
                      </span>
                    </div>
                    {description && (
                      <div className="flex justify-between px-4 py-3">
                        <span className="text-muted-foreground">Note</span>
                        <span className="max-w-[200px] text-right">
                          {description}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-1">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() =>
                        setStep(
                          sendMode === 'username'
                            ? 'username-form'
                            : 'bank-form'
                        )
                      }
                    >
                      Back
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleTransfer}
                      disabled={transferLoading}
                    >
                      {transferLoading ? (
                        <LoaderCircleIcon className="size-4 animate-spin mr-2" />
                      ) : null}
                      {transferLoading ? 'Sending...' : 'Confirm & Send'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── STEP: SUCCESS ── */}
            {step === 'success' && (
              <Card>
                <CardContent className="flex flex-col items-center gap-4 py-12">
                  <div className="flex size-20 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2Icon className="size-10 text-emerald-600" />
                  </div>
                  <div className="text-center">
                    <h2 className="text-xl font-semibold">Money sent!</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatCurrency(Number(amount))} was sent to{' '}
                      {sendMode === 'username'
                        ? resolvedUser?.full_name
                        : toAccountInput}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    Ref: {txId}
                  </p>
                  <Button onClick={reset} className="mt-2">
                    Send again
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* ── STEP: FAILURE ── */}
            {step === 'failure' && (
              <Card>
                <CardContent className="flex flex-col items-center gap-4 py-12">
                  <div className="flex size-20 items-center justify-center rounded-full bg-red-100">
                    <AlertTriangleIcon className="size-10 text-destructive" />
                  </div>
                  <div className="text-center">
                    <h2 className="text-xl font-semibold">Transfer failed</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {failMessage}
                    </p>
                    {failBalance != null && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Available balance: {formatCurrency(failBalance)}
                      </p>
                    )}
                  </div>
                  <Button onClick={reset} className="mt-2">
                    Try again
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
