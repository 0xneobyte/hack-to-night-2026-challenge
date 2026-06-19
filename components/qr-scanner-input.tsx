'use client'

import { CameraIcon, CameraOffIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface QrScannerInputProps {
  /** Called with the extracted payment code once a QR is scanned or entered. */
  onResult: (code: string) => void
}

/** Pulls a payment code out of a scanned string (a deep link or a raw code). */
function extractCode(raw: string): string {
  const text = raw.trim()
  try {
    const url = new URL(text)
    const fromQuery = url.searchParams.get('code')
    if (fromQuery) return fromQuery
  } catch {
    // Not a URL — fall through and treat the whole string as the code.
  }
  return text
}

/**
 * Camera QR scanner with a manual-entry fallback so the feature still works
 * when the camera is unavailable or permission is denied.
 */
export function QrScannerInput({ onResult }: QrScannerInputProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const [manual, setManual] = useState('')

  useEffect(() => {
    if (!scanning || !videoRef.current) return

    let scanner: { stop: () => void; destroy: () => void } | null = null
    let cancelled = false

    import('qr-scanner')
      .then(({ default: QrScanner }) => {
        if (cancelled || !videoRef.current) return
        const instance = new QrScanner(
          videoRef.current,
          (result: { data: string }) => {
            const code = extractCode(result.data)
            if (code) {
              setScanning(false)
              onResult(code)
            }
          },
          { highlightScanRegion: true, highlightCodeOutline: true }
        )
        scanner = instance
        instance.start().catch(() => {
          setError(
            'Could not access the camera. Enter the code manually below.'
          )
          setScanning(false)
        })
      })
      .catch(() => {
        setError('Scanner failed to load. Enter the code manually below.')
        setScanning(false)
      })

    return () => {
      cancelled = true
      if (scanner) {
        scanner.stop()
        scanner.destroy()
      }
    }
  }, [scanning, onResult])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3">
        {scanning ? (
          <>
            {/* biome-ignore lint/a11y/useMediaCaption: live camera preview */}
            <video
              ref={videoRef}
              className="aspect-square w-full max-w-xs rounded-lg border object-cover"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScanning(false)}
            >
              <CameraOffIcon className="size-4" /> Stop camera
            </Button>
          </>
        ) : (
          <Button
            onClick={() => {
              setError('')
              setScanning(true)
            }}
          >
            <CameraIcon className="size-4" /> Scan QR with camera
          </Button>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        OR
        <div className="h-px flex-1 bg-border" />
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const code = extractCode(manual)
          if (code) onResult(code)
        }}
      >
        <Label>Enter payment code</Label>
        <div className="flex gap-2">
          <Input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Paste code or link"
          />
          <Button type="submit" variant="secondary" disabled={!manual.trim()}>
            Open
          </Button>
        </div>
      </form>
    </div>
  )
}
