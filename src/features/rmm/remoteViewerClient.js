const PORTABLE_UA_RE = /Android|iPhone|iPad|iPod|Mobile|Tablet|Kindle|Silk/i
const PORTABLE_PLATFORM_RE = /iPhone|iPad|iPod|Android/i
const WINDOWS_RE = /Windows|Win32|Win64|WinCE/i

export function detectRemoteViewerClient(navigatorLike = globalThis.navigator) {
  const nav = navigatorLike || {}
  const ua = String(nav.userAgent || '')
  const uaData = nav.userAgentData || null
  const platform = String(uaData?.platform || nav.platform || '')
  const vendor = String(nav.vendor || '')
  const touchPoints = Math.max(0, Number(nav.maxTouchPoints || 0))

  // Chromium's high-entropy-free mobile bit is the strongest explicit signal
  // when the browser exposes it. Safari/WebKit currently does not always do so.
  if (uaData?.mobile === true) return { viewerClient: 'browser', deviceClass: 'portable', reason: 'ua-client-hint' }

  // Normal phone/tablet user agents and navigator.platform values.
  if (PORTABLE_UA_RE.test(ua) || PORTABLE_PLATFORM_RE.test(platform)) {
    return { viewerClient: 'browser', deviceClass: 'portable', reason: 'portable-platform' }
  }

  // iPadOS and some iOS WebKit wrappers can deliberately present a desktop
  // Safari/Mac user agent. Real Macs do not expose a multi-touch screen, so
  // Apple + Mac platform + multiple touch points is the established iPadOS
  // desktop-mode signal and remains independent of viewport or resolution.
  const appleDesktopUaOnTouchHardware =
    /Apple/i.test(vendor) && /Mac/i.test(platform) && touchPoints > 1
  if (appleDesktopUaOnTouchHardware) {
    return { viewerClient: 'browser', deviceClass: 'portable', reason: 'apple-touch-desktop-ua' }
  }

  // Do not reinterpret Windows touch laptops/tablets as mobile. They can use
  // the native Viewer and often expose many touch points.
  if (WINDOWS_RE.test(platform) || WINDOWS_RE.test(ua)) {
    return { viewerClient: 'native', deviceClass: 'desktop', reason: 'windows-desktop' }
  }

  return { viewerClient: 'native', deviceClass: 'desktop', reason: 'desktop-default' }
}
