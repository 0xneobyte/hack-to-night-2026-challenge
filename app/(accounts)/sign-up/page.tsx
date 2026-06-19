'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import AuthButton from '@/components/authButton'
import { createClient } from '@/lib/supabase/client'

export default function SignUpPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [nic, setNic] = useState('')
  const [branch, setBranch] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          nic: nic || null,
          branch: branch || null
        }
      }
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // If email confirmation is disabled, the user is immediately signed in
    if (data.session) {
      router.push('/dashboard')
      router.refresh()
      return
    }

    // Email confirmation required — show success message
    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <section className="mx-auto flex min-h-[500px] w-full max-w-[1100px] items-center justify-center rounded-[58px] bg-white px-8 py-10 shadow-[0_1px_3px_0_rgba(0,0,0,0.30),0_4px_8px_3px_rgba(0,0,0,0.15)]">
        <div className="text-center">
          <div className="mb-6 text-6xl">✉️</div>
          <h2 className="mb-4 text-3xl font-bold text-black">
            Check your email
          </h2>
          <p className="text-gray-600">
            We&apos;ve sent a confirmation link to <strong>{email}</strong>.
            <br />
            Click it to activate your account.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto min-h-[700px] w-full max-w-[1100px] rounded-[58px] bg-white px-8 py-9 shadow-[0_1px_3px_0_rgba(0,0,0,0.30),0_4px_8px_3px_rgba(0,0,0,0.15)] lg:min-h-[820px] lg:px-14">
      <div className="relative mx-auto w-full max-w-[860px]">
        <img
          src="/loginlogo.png"
          alt="Nova Bank"
          className="absolute left-0 top-0 hidden w-[128px] md:block"
        />

        <h1 className="mb-12 text-center text-[2.6rem] font-bold text-black text-balance">
          SIGN UP
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            {
              label: 'Account Name',
              id: 'sign-up-account-name',
              value: fullName,
              onChange: setFullName,
              type: 'text',
              required: true
            },
            {
              label: 'Account Number',
              id: 'sign-up-account-number',
              value: nic,
              onChange: setNic,
              type: 'text',
              required: false
            },
            {
              label: 'Branch',
              id: 'sign-up-branch',
              value: branch,
              onChange: setBranch,
              type: 'text',
              required: false
            },
            {
              label: 'Email',
              id: 'sign-up-email',
              value: email,
              onChange: setEmail,
              type: 'email',
              required: true
            },
            {
              label: 'Password',
              id: 'sign-up-password',
              value: password,
              onChange: setPassword,
              type: 'password',
              required: true
            },
            {
              label: 'Confirm Password',
              id: 'sign-up-confirm-password',
              value: confirmPassword,
              onChange: setConfirmPassword,
              type: 'password',
              required: true
            }
          ].map(({ label, id, value, onChange, type, required }) => (
            <div
              key={id}
              className="grid items-center gap-4 md:grid-cols-[180px_1fr]"
            >
              <label className="text-xl text-black" htmlFor={id}>
                {label} :
              </label>
              <input
                id={id}
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                required={required}
                className="h-[64px] rounded-[40px] border-0 bg-[#d9d9d9] px-7 text-lg text-black outline-none"
              />
            </div>
          ))}

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="mt-8 flex justify-center">
            <AuthButton type="submit" disabled={loading}>
              {loading ? 'SIGNING UP…' : 'SIGN UP'}
            </AuthButton>
          </div>
        </form>
      </div>
    </section>
  )
}
