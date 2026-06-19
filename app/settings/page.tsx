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
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  UserIcon,
  MailIcon,
  KeyIcon,
  ShieldIcon,
  CheckIcon,
  CreditCardIcon
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  id: string
  full_name: string
  nic: string | null
  role: string
  email: string | null
  created_at: string
}

interface Account {
  id: number
  account_number: string
  account_name: string
  balance: number
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)

  // Edit states
  const [displayName, setDisplayName] = useState('')
  const [nameEditing, setNameEditing] = useState(false)
  const [nameSaving, setNameSaving] = useState(false)
  const [nameSuccess, setNameSuccess] = useState(false)

  const [newEmail, setNewEmail] = useState('')
  const [emailEditing, setEmailEditing] = useState(false)
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailSuccess, setEmailSuccess] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordEditing, setPasswordEditing] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      const [profileRes, accountsRes] = await Promise.all([
        fetch('/api/profile'),
        fetch('/api/accounts')
      ])

      if (profileRes.ok) {
        const json = await profileRes.json()
        if (json.ok) {
          const p = json.data?.profile ?? json.profile
          setProfile(p)
          setDisplayName(p.full_name)
        }
      }
      if (accountsRes.ok) {
        const json = await accountsRes.json()
        if (json.ok) setAccounts(json.data?.accounts ?? json.accounts ?? [])
      }
      setLoading(false)
    }
    loadData()
  }, [])

  async function handleNameSave() {
    if (!displayName.trim() || displayName.trim().length < 2) {
      setError('Display name must be at least 2 characters')
      return
    }
    setError(null)
    setNameSaving(true)

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({
      data: { full_name: displayName.trim() }
    })

    if (updateError) {
      setError(updateError.message)
      setNameSaving(false)
      return
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: displayName.trim() })
      .eq('id', profile!.id)

    setNameSaving(false)

    if (profileError) {
      setError(profileError.message)
      return
    }

    setProfile((prev) =>
      prev ? { ...prev, full_name: displayName.trim() } : prev
    )
    setNameEditing(false)
    setNameSuccess(true)
    setTimeout(() => setNameSuccess(false), 3000)
  }

  async function handleEmailChange() {
    if (!newEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setError('Please enter a valid email address')
      return
    }
    setError(null)
    setEmailSaving(true)

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({
      email: newEmail.trim()
    })

    setEmailSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setEmailEditing(false)
    setEmailSuccess(true)
    setNewEmail('')
    setTimeout(() => setEmailSuccess(false), 5000)
  }

  async function handlePasswordChange() {
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setError(null)
    setPasswordSaving(true)

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    })

    setPasswordSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setPasswordEditing(false)
    setPasswordSuccess(true)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setTimeout(() => setPasswordSuccess(false), 3000)
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
        <div className="flex flex-1 flex-col p-4 md:p-6 gap-6 max-w-2xl mx-auto w-full">
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage your account and preferences
            </p>
          </div>

          {loading ? (
            <p className="text-muted-foreground py-10 text-center">
              Loading...
            </p>
          ) : (
            <>
              {error && (
                <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Profile Info (read-only) */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ShieldIcon className="size-5 text-muted-foreground" />
                    <div>
                      <CardTitle>Personal Information</CardTitle>
                      <CardDescription>
                        Legal information cannot be changed. Contact support for
                        updates.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        NIC Number
                      </p>
                      <p className="font-medium">{profile?.nic || 'Not set'}</p>
                    </div>
                    <Badge variant="secondary">Read-only</Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Role</p>
                      <p className="font-medium capitalize">{profile?.role}</p>
                    </div>
                    <Badge variant="secondary">Read-only</Badge>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Member since
                    </p>
                    <p className="font-medium">
                      {profile?.created_at
                        ? formatDate(profile.created_at)
                        : '-'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Display Name */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <UserIcon className="size-5 text-muted-foreground" />
                    <div>
                      <CardTitle>Display Name</CardTitle>
                      <CardDescription>
                        This is how your name appears across the app
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {nameEditing ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="display-name">Name</Label>
                        <Input
                          id="display-name"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setNameEditing(false)
                            setDisplayName(profile?.full_name || '')
                            setError(null)
                          }}
                        >
                          Cancel
                        </Button>
                        <Button onClick={handleNameSave} disabled={nameSaving}>
                          {nameSaving ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{profile?.full_name}</p>
                      <div className="flex items-center gap-2">
                        {nameSuccess && (
                          <span className="flex items-center gap-1 text-sm text-emerald-600">
                            <CheckIcon className="size-4" /> Saved
                          </span>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setNameEditing(true)}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Email */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <MailIcon className="size-5 text-muted-foreground" />
                    <div>
                      <CardTitle>Email Address</CardTitle>
                      <CardDescription>
                        A confirmation email will be sent to verify the new
                        address
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {emailEditing ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-2">
                        <Label>Current Email</Label>
                        <Input value={profile?.email || ''} disabled />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="new-email">New Email</Label>
                        <Input
                          id="new-email"
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="new@example.com"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEmailEditing(false)
                            setNewEmail('')
                            setError(null)
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleEmailChange}
                          disabled={emailSaving}
                        >
                          {emailSaving ? 'Sending...' : 'Change Email'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{profile?.email}</p>
                      <div className="flex items-center gap-2">
                        {emailSuccess && (
                          <span className="text-sm text-emerald-600">
                            Confirmation sent!
                          </span>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEmailEditing(true)}
                        >
                          Change
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Password */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <KeyIcon className="size-5 text-muted-foreground" />
                    <div>
                      <CardTitle>Password</CardTitle>
                      <CardDescription>
                        Update your password to keep your account secure
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {passwordEditing ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="new-password">New Password</Label>
                        <Input
                          id="new-password"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min 6 characters"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="confirm-password">
                          Confirm Password
                        </Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setPasswordEditing(false)
                            setNewPassword('')
                            setConfirmPassword('')
                            setError(null)
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handlePasswordChange}
                          disabled={passwordSaving}
                        >
                          {passwordSaving ? 'Updating...' : 'Update Password'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">********</p>
                      <div className="flex items-center gap-2">
                        {passwordSuccess && (
                          <span className="flex items-center gap-1 text-sm text-emerald-600">
                            <CheckIcon className="size-4" /> Updated
                          </span>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPasswordEditing(true)}
                        >
                          Change
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Linked Accounts (read-only) */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CreditCardIcon className="size-5 text-muted-foreground" />
                    <div>
                      <CardTitle>Linked Accounts</CardTitle>
                      <CardDescription>
                        Your bank accounts linked to this profile
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {accounts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No accounts linked
                    </p>
                  ) : (
                    accounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div>
                          <p className="font-medium text-sm">
                            {acc.account_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {acc.account_number}
                          </p>
                        </div>
                        <p className="font-semibold font-playfair tabular-nums">
                          Rs.{' '}
                          {acc.balance.toLocaleString('en-LK', {
                            minimumFractionDigits: 2
                          })}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
