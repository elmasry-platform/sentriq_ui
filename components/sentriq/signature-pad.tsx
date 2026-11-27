"use client"

import { useEffect, useRef, useState } from "react"

type Props = { value: string; label: string; hint: string; clearLabel: string; signedLabel: string; onChange: (dataUrl: string) => void }

// Finger or mouse drawing. Stores a small PNG data URL. A drawn picture only, not a certified e-signature.
export function SignaturePad({ value, label, hint, clearLabel, signedLabel, onChange }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    const element = canvas.current
    if (!element || !value) return
    const context = element.getContext("2d")
    const image = new Image()
    image.onload = () => context?.drawImage(image, 0, 0, element.width, element.height)
    image.src = value
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: ((event.clientX - rect.left) / rect.width) * event.currentTarget.width, y: ((event.clientY - rect.top) / rect.height) * event.currentTarget.height }
  }
  const down = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = event.currentTarget.getContext("2d"); if (!context) return
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* pointer already gone */ }
    drawing.current = true
    const { x, y } = point(event)
    context.lineWidth = 3; context.lineCap = "round"; context.strokeStyle = "#19262D"
    context.beginPath(); context.moveTo(x, y); context.lineTo(x + 0.1, y); context.stroke()
  }
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    const context = event.currentTarget.getContext("2d"); if (!context) return
    const { x, y } = point(event); context.lineTo(x, y); context.stroke()
  }
  const up = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return
    drawing.current = false; setDirty(true)
    onChange(event.currentTarget.toDataURL("image/png"))
  }
  const clear = () => {
    const element = canvas.current; element?.getContext("2d")?.clearRect(0, 0, element.width, element.height)
    setDirty(false); onChange("")
  }

  return <div className="runner-signature">
    <canvas ref={canvas} width={600} height={220} role="img" aria-label={label} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
    <div className="runner-signature-bar"><small>{value || dirty ? signedLabel : hint}</small><button type="button" className="button-outline" onClick={clear} disabled={!value && !dirty}>{clearLabel}</button></div>
  </div>
}
