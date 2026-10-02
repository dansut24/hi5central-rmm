const PORTABLE_UA_RE = /Android|iPhone|iPad|iPod|Mobile|Tablet|Kindle|Silk/i
const PORTABLE_PLATFORM_RE = /iPhone|iPad|iPod|Android/i
const WINDOWS_RE = /Windows|Win32|Win64|WinCE/i
const MACOS_RE = /macOS|Macintosh|MacIntel|MacPPC|Mac68K/i
const LINUX_RE = /Linux|X11|Ubuntu|Fedora|Debian/i

function result(viewerClient, deviceClass, reason, platform) {
  return { viewerClient, deviceClass, reason, platform }
}

export function detectRemoteViewerClient(navigatorLike = globalThis.navigator) {
  const nav = navigatorLike || {}
  const ua = String(nav.userAgent || '')
  const uaData = nav.userAgentData || null
  const platform = String(uaData?.platform || nav.platform || '')
  const vendor = String(nav.vendor || '')
  const touchPoints = Math.max(0, Number(nav.maxTouchPoints || 0))

  // Chromium's high-entropy-free mobile bit is the strongest explicit signal
  // when the browser exposes it. Safari/WebKit currently does not always do so.
  if (uaData?.mobile === true) return result('browser', 'portable', 'ua-client-hint', 'mobile')

  // Normal phone/tablet user agents and navigator.platform values.
  if (PORTABLE_UA_RE.test(ua) || PORTABLE_PLATFORM_RE.test(platform)) {
    return result('browser', 'portable', 'portable-platform', 'mobile')
  }

  // iPadOS and some iOS WebKit wrappers can deliberately present a desktop
  // Safari/Mac user agent. Real Macs do not expose a multi-touch screen, so
  // Apple + Mac platform + multiple touch points is the established iPadOS
  // desktop-mode signal and remains independent of viewport or resolution.
  const appleDesktopUaOnTouchHardware =
    /Apple/i.test(vendor) && /Mac/i.test(platform) && touchPoints > 1
  if (appleDesktopUaOnTouchHardware) {
    return result('browser', 'portable', 'apple-touch-desktop-ua', 'mobile')
  }

  if (WINDOWS_RE.test(platform) || WINDOWS_RE.test(ua)) {
    return result('native', 'desktop', 'windows-desktop', 'windows')
  }

  if (MACOS_RE.test(platform) || MACOS_RE.test(ua)) {
    return result('native', 'desktop', 'macos-desktop', 'macos')
  }

  // Android was already removed above, so a remaining Linux signal represents
  // a desktop Linux browser rather than a phone/tablet.
  if (LINUX_RE.test(platform) || LINUX_RE.test(ua)) {
    return result('native', 'desktop', 'linux-desktop', 'linux')
  }

  return result('native', 'desktop', 'desktop-default', 'unknown')
}

export function remoteViewerPlatformLabel(platform = '') {
  if (platform === 'windows') return 'Windows'
  if (platform === 'macos') return 'macOS'
  if (platform === 'linux') return 'Linux'
  return 'this computer'
}

// Browsers intentionally do not expose an API that says whether a custom URL
// protocol is installed. The most reliable web-only signal is whether launching
// the URL causes the page to lose focus/visibility. A false result is therefore
// treated as "not detected" rather than proof that the Viewer is absent.
export function launchRemoteViewerProtocol(
  url,
  {
    windowLike = globalThis.window,
    documentLike = globalThis.document,
    timeoutMs = 2200,
  } = {},
) {
  if (!url || !windowLike || !documentLike) return Promise.resolve(false)

  return new Promise((resolve) => {
    let settled = false
    let timer = null

    const cleanup = () => {
      if (timer != null) windowLike.clearTimeout(timer)
      windowLike.removeEventListener?.('blur', onBlur)
      windowLike.removeEventListener?.('pagehide', onPageHide)
      documentLike.removeEventListener?.('visibilitychange', onVisibility)
    }

    const finish = (opened) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(Boolean(opened))
    }

    const onBlur = () => finish(true)
    const onPageHide = () => finish(true)
    const onVisibility = () => {
      if (documentLike.hidden) finish(true)
    }

    windowLike.addEventListener?.('blur', onBlur)
    windowLike.addEventListener?.('pagehide', onPageHide)
    documentLike.addEventListener?.('visibilitychange', onVisibility)

    timer = windowLike.setTimeout(() => finish(false), Math.max(500, Number(timeoutMs) || 2200))

    try {
      windowLike.location.href = url
    } catch {
      finish(false)
    }
  })
}
