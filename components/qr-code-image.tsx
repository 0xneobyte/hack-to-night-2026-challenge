'use client'

import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

interface QrCodeImageProps {
  /** The text/URL to encode. */
  value: string
  size?: number
}

/** Renders a QR code as a PNG data URL for the given value. */
export function QrCodeImage({ value, size = 220 }: QrCodeImageProps) {
  const [src, setSrc] = useState<string>('')

  useEffect(() => {
    let active = true
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M'
    })
      .then((url) => {
        if (active) setSrc(url)
      })
      .catch(() => {
        if (active) setSrc('')
      })
    return () => {
      active = false
    }
  }, [value, size])

  if (!src) {
    return (
      <div
        className="animate-pulse rounded-lg bg-muted"
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Payment QR code"
      width={size}
      height={size}
      className="rounded-lg border bg-white p-2"
    />
  )
}
