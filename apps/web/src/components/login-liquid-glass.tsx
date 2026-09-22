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

type SnapshotContainer = {
  pageSnapshot?: HTMLCanvasElement | null
  isCapturing?: boolean
  waitingForSnapshot?: GlassInstance[]
  instances?: Array<
    GlassInstance & {
      gl_refs?: {
        gl?: WebGLRenderingContext
        texture?: WebGLTexture
        textureSizeLoc?: WebGLUniformLocation | null
      }
    }
  >
}

/** Debounced html2canvas recapture so glass samples the moving hero after layout changes. */
export function recaptureGlassSnapshot(): void {
  const Container = window.Container as unknown as SnapshotContainer | undefined
  if (!Container || typeof html2canvas !== 'function') return
  Container.pageSnapshot = null
  Container.isCapturing = true
  Container.waitingForSnapshot = Container.instances?.slice() ?? []
  void html2canvas(document.body, {
    scale: 1,
    useCORS: true,
    allowTaint: true,
    backgroundColor: null,
    ignoreElements: (element) =>
      element.classList.contains('glass-container') ||
      element.classList.contains('glass-button') ||
      element.classList.contains('glass-button-text'),
  })
    .then((snapshot) => {
      Container.pageSnapshot = snapshot
      Container.isCapturing = false
      const img = new Image()
      img.src = snapshot.toDataURL()
      img.onload = () => {
        Container.instances?.forEach((instance) => {
          const gl = instance.gl_refs?.gl
          const texture = instance.gl_refs?.texture
          if (!gl || !texture) return
          gl.bindTexture(gl.TEXTURE_2D, texture)
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
          if (instance.gl_refs?.textureSizeLoc) {
            gl.uniform2f(instance.gl_refs.textureSizeLoc, img.width, img.height)
          }
          instance.render?.()
        })
        Container.waitingForSnapshot = []
      }
    })
    .catch(() => {
      Container.isCapturing = false
      Container.waitingForSnapshot = []
    })
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
