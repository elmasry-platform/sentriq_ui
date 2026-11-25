"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { X } from "lucide-react"

const focusable = 'a[href],button:not([disabled]),textarea,input:not([disabled]),select,[tabindex]:not([tabindex="-1"])'

/**
 * Modal with better keyboard support: labelled, focus moves in, Tab is trapped, Esc closes,
 * focus returns to whatever opened it, and the page behind does not scroll.
 */
export function Dialog({ title, closeLabel, onClose, children, wide = false }: { title: string; closeLabel: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const panel = useRef<HTMLElement>(null)
  const titleId = useRef(`dialog-${Math.random().toString(36).slice(2, 8)}`).current

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const node = panel.current
    const first = node?.querySelector<HTMLElement>("[data-autofocus]") ?? node?.querySelector<HTMLElement>(focusable)
    first?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); onClose(); return }
      if (event.key !== "Tab" || !node) return
      const items = Array.from(node.querySelectorAll<HTMLElement>(focusable)).filter((item) => item.offsetParent !== null)
      if (!items.length) return
      const firstItem = items[0], lastItem = items[items.length - 1]
      if (event.shiftKey && document.activeElement === firstItem) { event.preventDefault(); lastItem.focus() }
      else if (!event.shiftKey && document.activeElement === lastItem) { event.preventDefault(); firstItem.focus() }
    }
    document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; previous?.focus?.() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div className="inspection-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={panel} className={`inspection-modal ux-dialog${wide ? " ux-dialog-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="inspection-modal-heading"><h2 id={titleId}>{title}</h2><button type="button" aria-label={closeLabel} title={closeLabel} onClick={onClose}><X size={18} /></button></div>
      {children}
    </section>
  </div>
}
