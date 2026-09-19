'use client'

import { useEffect, useRef } from 'react'
import html2canvas from 'html2canvas'

type GlassType = 'rounded' | 'circle' | 'pill'

type LiquidGlassGlobals = {
  Container: new (options?: {
    borderRadius?: number
    type?: GlassType
    tintOpacity?: number
  }) => GlassInstance
  Button: new (options?: {
    text?: string
    size?: number
    type?: GlassType
    onClick?: ((text: string) => void) | null
    warp?: boolean
    tintOpacity?: number
  }) => GlassInstance
}

type GlassInstance = {
  element: HTMLElement
  parent?: GlassInstance | null
  addChild: (child: GlassInstance) => GlassInstance
  render?: () => void
}

declare global {
  interface Window {
    html2canvas?: typeof html2canvas
    Container?: LiquidGlassGlobals['Container']
    Button?: LiquidGlassGlobals['Button']
    glassControls?: Record<string, number>
  }
}

const SCRIPT_BASE = '/liquid-glass'

function loadClassicScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      resolve()
      return
    }
    const el = document.createElement('script')
    el.src = src
    el.async = false
    el.onload = () => resolve()
    el.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(el)
  })
}

let loading: Promise<LiquidGlassGlobals> | null = null

export function loadLiquidGlass(): Promise<LiquidGlassGlobals> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Liquid Glass JS is browser-only'))
  }
  if (window.Container && window.Button) {
    return Promise.resolve({ Container: window.Container, Button: window.Button })
  }
  if (loading) return loading

  loading = (async () => {
    window.html2canvas = html2canvas
    await loadClassicScript(`${SCRIPT_BASE}/container.js`)
    await loadClassicScript(`${SCRIPT_BASE}/button.js`)
    await loadClassicScript(`${SCRIPT_BASE}/expose-globals.js`)
    if (!window.Container || !window.Button) {
      throw new Error('Liquid Glass JS did not expose window.Container / window.Button')
    }
    return { Container: window.Container, Button: window.Button }
  })()

  return loading
}

function forgetInstance(instance: GlassInstance) {
  const Container = window.Container as unknown as { instances?: GlassInstance[] }
  const list = Container?.instances
  if (!list) return
  const index = list.indexOf(instance)
  if (index >= 0) list.splice(index, 1)
}

/** Mount a standalone glass button into `host`. */
export function useLiquidGlassButton(options: {
  text: string
  size?: number
  type?: GlassType
  warp?: boolean
  tintOpacity?: number
  onClick?: (text: string) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let instance: GlassInstance | null = null

    void loadLiquidGlass().then(({ Button }) => {
      if (cancelled || !hostRef.current) return
      instance = new Button({
        text: options.text,
        size: options.size ?? 32,
        type: options.type ?? 'pill',
        warp: options.warp ?? false,
        tintOpacity: options.tintOpacity ?? 0.2,
        onClick: options.onClick ?? null
      })
      host.appendChild(instance.element)
    })

    return () => {
      cancelled = true
      if (instance) {
        instance.element.remove()
        forgetInstance(instance)
      }
    }
  }, [options.text, options.size, options.type, options.warp, options.tintOpacity, options.onClick])

  return hostRef
}
