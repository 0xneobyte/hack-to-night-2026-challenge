'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import AuthButton from '@/components/authButton'
import { createClient } from '@/lib/supabase/client'

type Stage = 'request' | 'sent' | 'update' | 'done'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('request')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Detect when the user arrives via the recovery link (Supabase sets
  // the session automatically via the URL hash — we listen for the
  // PASSWORD_RECOVERY event to switch to the "set new password" stage).
  useEffect(() => {
    const supabase = createClient()
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStage('update')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/reset-password` }
    )

    setLoading(false)

    if (resetError) {
      setError(resetError.message)
      return
    }

    setStage('sent')
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setStage('done')
    setTimeout(() => router.push('/login'), 2000)
  }

  return (
    <section className="mx-auto flex min-h-[500px] w-full max-w-[1100px] items-center justify-center rounded-[58px] bg-white px-8 py-10 shadow-[0_1px_3px_0_rgba(0,0,0,0.30),0_4px_8px_3px_rgba(0,0,0,0.15)] lg:min-h-[684px]">
      <div className="w-full max-w-[670px]">
        {stage === 'sent' && (
          <div className="text-center">
            <div className="mb-6 text-6xl">✉️</div>
            <h2 className="mb-4 text-3xl font-bold text-black">
              Check your email
            </h2>
            <p className="text-gray-600">
              We&apos;ve sent a password reset link to <strong>{email}</strong>.
              Click it to set a new password.
            </p>
          </div>
        )}

        {stage === 'done' && (
          <div className="text-center">
            <div className="mb-6 text-6xl">✅</div>
            <h2 className="mb-4 text-3xl font-bold text-black">
              Password updated!
            </h2>
            <p className="text-gray-600">Redirecting you to login…</p>
          </div>
        )}

        {stage === 'request' && (
          <form onSubmit={handleRequestReset}>
            <h1 className="mb-16 text-center text-[2.6rem] font-bold text-black text-balance">
              RESET PASSWORD
            </h1>

            <div className="space-y-8">
              <div className="grid items-center gap-4 md:grid-cols-[120px_1fr]">
                <label className="text-xl text-black" htmlFor="reset-email">
                  Email:
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-[64px] rounded-[40px] border-0 bg-[#d9d9d9] px-7 text-lg text-black outline-none"
                />
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="mt-12 flex justify-center">
              <AuthButton type="submit" disabled={loading}>
                {loading ? 'SENDING…' : 'SEND RESET LINK'}
              </AuthButton>
            </div>
          </form>
        )}

        {stage === 'update' && (
          <form onSubmit={handleUpdatePassword}>
            <h1 className="mb-16 text-center text-[2.6rem] font-bold text-black text-balance">
              SET NEW PASSWORD
            </h1>

            <div className="space-y-8">
              <div className="grid items-center gap-4 md:grid-cols-[160px_1fr]">
                <label
                  className="text-xl text-black"
                  htmlFor="reset-new-password"
                >
                  New Password:
                </label>
                <input
                  id="reset-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="h-[64px] rounded-[40px] border-0 bg-[#d9d9d9] px-7 text-lg text-black outline-none"
                />
              </div>

              <div className="grid items-center gap-4 md:grid-cols-[160px_1fr]">
                <label
                  className="text-xl text-black"
                  htmlFor="reset-confirm-password"
                >
                  Confirm Password:
                </label>
                <input
                  id="reset-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-[64px] rounded-[40px] border-0 bg-[#d9d9d9] px-7 text-lg text-black outline-none"
                />
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">
                {error}
              </p>
            )}

            <div className="mt-12 flex justify-center">
              <AuthButton type="submit" disabled={loading}>
                {loading ? 'UPDATING…' : 'UPDATE PASSWORD'}
              </AuthButton>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
