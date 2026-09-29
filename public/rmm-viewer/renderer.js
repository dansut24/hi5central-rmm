"use strict";

/* -----------------------------------------
   UI elements
------------------------------------------ */

const elStatusDot    = document.getElementById("status-dot");
const elStatusLabel  = document.getElementById("status-label");
const elDeviceLabel  = document.getElementById("device-label");
const elBtnElevate   = document.getElementById("btn-elevate");
const elBtnFiles     = document.getElementById("btn-files");
const elBtnChat      = document.getElementById("btn-chat");
const elBtnAudio     = document.getElementById("btn-audio");
const elBtnBlockInput = document.getElementById("btn-block-input");
const elBtnBackstage = document.getElementById("btn-backstage");
const elBtnConsole   = document.getElementById("btn-console");
const elBtnStartMenu = document.getElementById("btn-start-menu");
const elBtnCad       = document.getElementById("btn-cad");
const elBtnMonitor   = document.getElementById("btn-monitor");
const elMonitorMenu  = document.getElementById("monitor-menu");
const elBtnDisc      = document.getElementById("btn-disconnect");
const elFilesPanel   = document.getElementById("files-panel");
const elChatPanel    = document.getElementById("chat-panel");
const elFilesClose   = document.getElementById("files-close");
const elChatClose    = document.getElementById("chat-close");
const elFilePath     = document.getElementById("file-path");
const elFileRefresh  = document.getElementById("file-refresh");
const elFileUpload   = document.getElementById("file-upload");
const elFileUploadInput = document.getElementById("file-upload-input");
const elFileMobileStatus = document.getElementById("file-mobile-status");
const elFileList     = document.getElementById("file-list");
const elChatLog      = document.getElementById("chat-log");
const elChatInput    = document.getElementById("chat-input");
const elChatSend     = document.getElementById("chat-send");
const elVideo        = document.getElementById("remote-video");
const elMain         = document.getElementById("main");
const elAudio        = document.getElementById("remote-audio");
const elOverlay      = document.getElementById("overlay");
const elOverlayTitle = document.getElementById("overlay-title");
const elOverlaySub   = document.getElementById("overlay-sub");
const elSpinner      = document.getElementById("spinner");
const elErrorDetail  = document.getElementById("error-detail");
const elStatsBar     = document.getElementById("statsbar");
const elStatRes      = document.getElementById("stat-res");
const elStatState    = document.getElementById("stat-state");
const elStatCodec    = document.getElementById("stat-codec");
const elDiagIceState = document.getElementById("diag-ice-state");
const elDiagConnState = document.getElementById("diag-connection-state");
const elDiagCandidatePair = document.getElementById("diag-candidate-pair");
const elDiagBitrate = document.getElementById("diag-bitrate");
const elDiagFps = document.getElementById("diag-fps");
const elDiagFrames = document.getElementById("diag-frames");
const elDiagPacketsLost = document.getElementById("diag-packets-lost");
const elDiagRtt = document.getElementById("diag-rtt");
const elDiagIceServers = document.getElementById("diag-ice-servers");
const elMobileViewControls = document.getElementById("mobile-view-controls");
const elMobileZoomOut = document.getElementById("mobile-zoom-out");
const elMobileZoomFit = document.getElementById("mobile-zoom-fit");
const elMobileZoomIn = document.getElementById("mobile-zoom-in");
const elBtnKeyboard = document.getElementById("btn-keyboard");
const elMobileKeyboard = document.getElementById("mobile-keyboard");
const elMobileKeyboardRows = document.getElementById("mobile-keyboard-rows");
const elMobileKeyboardClose = document.getElementById("mobile-keyboard-close");
const elMobileTextInput = document.getElementById("mobile-text-input");
const elMobileTextSend = document.getElementById("mobile-text-send");
const elMobileInputMode = document.getElementById("mobile-input-mode");
const elMobilePanMode = document.getElementById("mobile-pan-mode");
const elMobilePrecisionMode = document.getElementById("mobile-precision-mode");
const elMobileToolbarHandle = document.getElementById("mobile-toolbar-handle");
const elMobileBottomActions = document.getElementById("mobile-bottom-actions");
const elMobileScrollRail = document.getElementById("mobile-scroll-rail");
const elMobileScrollThumb = document.getElementById("mobile-scroll-thumb");
const elMobilePointerReticle = document.getElementById("mobile-pointer-reticle");
const elMobilePrecisionLoupe = document.getElementById("mobile-precision-loupe");
const elMobileClipboardPaste = document.getElementById("mobile-clipboard-paste");
const elMobileClipboardCopy = document.getElementById("mobile-clipboard-copy");
const elMobileClipboardStatus = document.getElementById("mobile-clipboard-status");
const elBtnSettings = document.getElementById("btn-settings");
const elSettingsPanel = document.getElementById("settings-panel");
const elSettingsClose = document.getElementById("settings-close");
const elViewerScaleMode = document.getElementById("viewer-scale-mode");
const elRemoteResolutionPref = document.getElementById("remote-resolution-pref");
const elMobileInputPref = document.getElementById("mobile-input-pref");
const elMobileToolbarPref = document.getElementById("mobile-toolbar-pref");
const elMobileAdaptivePref = document.getElementById("mobile-adaptive-pref");
const elMobileDiagnosticsPref = document.getElementById("mobile-diagnostics-pref");
const elMobileQualityIndicator = document.getElementById("mobile-quality-indicator");
const elMobileDiagnosticsCard = document.getElementById("mobile-diagnostics-card");
const elDiagMobileQuality = document.getElementById("diag-mobile-quality");
const elDiagMobileProfile = document.getElementById("diag-mobile-profile");
const elDiagMobileRecovery = document.getElementById("diag-mobile-recovery");
const elDiagMobileViewport = document.getElementById("diag-mobile-viewport");
const elDiagMobileMonitor = document.getElementById("diag-mobile-monitor");
const elDiagMobileWakeLock = document.getElementById("diag-mobile-wakelock");
const elFileTransferUi = document.getElementById("file-transfer-ui");
const elFileTransferProgress = document.querySelector("#file-transfer-progress > span");
const elFileTransferCancel = document.getElementById("file-transfer-cancel");
const elFileTransferRetry = document.getElementById("file-transfer-retry");

if (elVideo) {
  elVideo.autoplay = true;
  elVideo.playsInline = true;
  elVideo.muted = true;
  elVideo.defaultMuted = true;
  elVideo.setAttribute("playsinline", "");
  elVideo.setAttribute("webkit-playsinline", "");
  elVideo.setAttribute("autoplay", "");
  elVideo.setAttribute("muted", "");
}

/* -----------------------------------------
   State
------------------------------------------ */

let ws = null;
let pc = null;
let inputDc = null;
let inputControlDc = null;
let mouseMoveDc = null;
let mouseMoveSeq = 0;

let currentSession = null;
let audioEnabled = false;
let localInputBlocked = false;
let remoteDescSet = false;
let pendingRemoteIce = [];

let statsTimer = null;
let transitionWatchdogTimer = null;
let lastStats = { tsMs: 0, bytes: 0, frames: 0, packetsLost: 0, packetsReceived: 0, jitterDelay: 0, jitterEmitted: 0 };
let wakeLockSentinel = null;
let wakeLockRequested = false;
let mobileRecoveryStage = 'Idle';
let mobileRecoveryAttempts = 0;
let mobileReconnectTimer = null;
let mobileReconnectDeadline = 0;
let mobileDisconnectProbeTimer = null;
let mobileTransportProbeTimer = null;
let mobileReconnectCooldownUntil = 0;
let mobileEndpointRestartUntil = 0;
let mobileLastGoodStatsAt = 0;
let mobileQualityState = { current: 'good', candidate: null, count: 0, changedAt: 0, samples: [] };
let mobileAdaptiveState = { tier: 0, bad: 0, good: 0, lastChangeAt: Date.now(), targetFps: 30, targetBitrateKbps: 8000, label: 'Native · 8 Mbps · 30 fps' };
let mobileFileTransfer = null;
let connectFileAccessGranted = false;
let connectFilePermissionPending = false;
let connectElevationPending = false;
let connectElevated = false;
let connectHostReconnecting = false;
let connectSessionHeld = false;

let inputBound = false;
let controlActive = false;
const pressedKeys = new Set();
let remoteAltTabActive = false;

let remoteCursorEl = null;
let lastCursorNorm = null;

let mobileViewZoom = 1;
let mobileViewPanX = 0;
let mobileViewPanY = 0;
let mobileViewportResumeAnchor = null;
let mobileViewportStableAnchor = null;
let mobileViewportResumeToken = 0;
let mobileViewportResumeUntil = 0;

const MOBILE_PREFS_KEY = "hi5central.viewer.mobile.v2";
const MOBILE_PREF_DEFAULTS = { inputMode: "direct", toolbar: "auto", resolution: "auto", scale: "fit", adaptive: "on", diagnostics: "off", monitorIndex: 0 };
let mobilePrefsStore = { devices: {}, fallback: { ...MOBILE_PREF_DEFAULTS } };
let mobilePrefs = { ...MOBILE_PREF_DEFAULTS };

function normalizeMobilePrefs(value) {
  const p = { ...MOBILE_PREF_DEFAULTS, ...(value && typeof value === 'object' ? value : {}) };
  if (!['direct','trackpad'].includes(p.inputMode)) p.inputMode = 'direct';
  if (!['auto','always'].includes(p.toolbar)) p.toolbar = 'auto';
  if (!['auto','native','1080p','720p'].includes(p.resolution)) p.resolution = 'auto';
  if (!['fit','stretch'].includes(p.scale)) p.scale = 'fit';
  if (!['on','off'].includes(p.adaptive)) p.adaptive = 'on';
  if (!['on','off'].includes(p.diagnostics)) p.diagnostics = 'off';
  p.monitorIndex = Number.isInteger(Number(p.monitorIndex)) ? Math.max(-1, Math.min(31, Number(p.monitorIndex))) : 0;
  return p;
}

try {
  const saved = JSON.parse(localStorage.getItem(MOBILE_PREFS_KEY) || "{}");
  if (saved?.devices && typeof saved.devices === 'object') {
    mobilePrefsStore = { devices: saved.devices, fallback: normalizeMobilePrefs(saved.fallback) };
    mobilePrefs = normalizeMobilePrefs(mobilePrefsStore.fallback);
  } else if (saved && typeof saved === 'object' && Object.keys(saved).length) {
    // Migrate the first mobile-v2 global format into the per-device fallback.
    mobilePrefs = normalizeMobilePrefs(saved);
    mobilePrefsStore.fallback = { ...mobilePrefs };
  }
} catch {}

let mobileInputMode = mobilePrefs.inputMode;
let mobilePanMode = false;
let mobilePrecisionMode = false;
let mobileToolbarTimer = null;
let mobileLastTap = null;
let mobileClipboardRequestPending = false;
let mobileGestureLifecycleReset = null;
let mobileBrowserGestureRecoveryTimer = null;
let mobileHistoryGuardActive = false;
let mobileHistoryGuardReleasing = false;
const mobileHistoryGuardId = 'hi5-' + Math.random().toString(36).slice(2);
const mobileEdgeTouchIds = new Set();
let mobileTrackpadCursor = { x_norm: 0.5, y_norm: 0.5 };

function loadMobilePrefsForDevice(deviceId) {
  const key = String(deviceId || '').trim();
  mobilePrefs = normalizeMobilePrefs((key && mobilePrefsStore.devices[key]) || mobilePrefsStore.fallback);
  mobileInputMode = mobilePrefs.inputMode;
  mobilePanMode = false;
  mobilePrecisionMode = false;
  mobileLastTap = null;
}

function saveMobilePrefs() {
  mobilePrefs = normalizeMobilePrefs({
    inputMode: mobileInputMode,
    toolbar: mobilePrefs.toolbar,
    resolution: mobilePrefs.resolution,
    scale: mobilePrefs.scale,
    adaptive: mobilePrefs.adaptive,
    diagnostics: mobilePrefs.diagnostics,
    monitorIndex: mobilePrefs.monitorIndex
  });
  const key = String(currentSession?.deviceId || '').trim();
  if (key) mobilePrefsStore.devices[key] = { ...mobilePrefs };
  else mobilePrefsStore.fallback = { ...mobilePrefs };
  try { localStorage.setItem(MOBILE_PREFS_KEY, JSON.stringify(mobilePrefsStore)); } catch {}
}

function setMobileClipboardStatus(text) {
  if (elMobileClipboardStatus) elMobileClipboardStatus.textContent = String(text || '');
}

function resolvedMobileResolutionPref() {
  if (!isMobileViewerSurface()) return mobilePrefs.resolution;
  // Auto prioritises text/image fidelity. 720p remains an explicit performance
  // option for constrained links, but is no longer forced on every phone.
  return mobilePrefs.resolution === 'auto' ? 'native' : mobilePrefs.resolution;
}

function mobileStreamProfilePayload() {
  const pref = resolvedMobileResolutionPref();
  const adaptive = isMobileViewerSurface() && mobilePrefs.adaptive === 'on' ? mobileAdaptiveState : { targetFps: 30, targetBitrateKbps: 8000 };
  const base = { target_fps: adaptive.targetFps, target_bitrate_kbps: adaptive.targetBitrateKbps, preference: pref };
  if (pref === '720p') return { ...base, max_width: 1280, max_height: 720 };
  if (pref === '1080p') return { ...base, max_width: 1920, max_height: 1080 };
  return { ...base, max_width: 0, max_height: 0 };
}

function isMobileViewerSurface() {
  return window.matchMedia?.('(max-width: 820px), (pointer: coarse)')?.matches ?? false;
}

function clampMobileViewport() {
  if (!elVideo || !isMobileViewerSurface()) return;
  const main = elVideo.parentElement?.getBoundingClientRect?.();
  if (!main || !main.width || !main.height) return;
  const videoAspect = (elVideo.videoWidth || 16) / (elVideo.videoHeight || 9);
  const mainAspect = main.width / main.height;
  let baseWidth;
  let baseHeight;
  if (mainAspect > videoAspect) {
    baseHeight = main.height;
    baseWidth = baseHeight * videoAspect;
  } else {
    baseWidth = main.width;
    baseHeight = baseWidth / videoAspect;
  }
  // Let a zoomed monitor corner move inward from the physical screen edge,
  // but fade that allowance smoothly back to zero as zoom returns to Fit.
  // The old hard on/off margin caused a visible jump near 1x.
  const overscrollMax = Math.min(96, Math.max(36, Math.min(main.width, main.height) * 0.12));
  const overscrollBlend = Math.max(0, Math.min(1, (mobileViewZoom - 1) / 0.5));
  const overscroll = overscrollMax * overscrollBlend;
  const maxX = Math.max(0, (baseWidth * mobileViewZoom - main.width) / 2) + overscroll;
  const maxY = Math.max(0, (baseHeight * mobileViewZoom - main.height) / 2) + overscroll;
  mobileViewPanX = Math.max(-maxX, Math.min(maxX, mobileViewPanX));
  mobileViewPanY = Math.max(-maxY, Math.min(maxY, mobileViewPanY));
}

function applyMobileViewport({ clamp = true } = {}) {
  if (!elVideo) return;
  if (!isMobileViewerSurface()) {
    elVideo.style.transform = '';
    return;
  }
  mobileViewZoom = Math.max(1, Math.min(4, mobileViewZoom));
  // Do not feed clamped coordinates back into an active pinch. When zooming
  // out near an edge, the legal pan bounds shrink every frame; clamping here
  // makes the image visibly "tick" under the fingers. We settle bounds once
  // the gesture ends instead.
  if (clamp) clampMobileViewport();
  elVideo.style.transform = 'translate3d(' + mobileViewPanX + 'px, ' + mobileViewPanY + 'px, 0) scale(' + mobileViewZoom + ')';
  refreshRemoteCursorPosition();
}

function setMobileViewZoom(nextZoom) {
  mobileViewZoom = Math.max(1, Math.min(4, Number(nextZoom) || 1));
  if (mobileViewZoom === 1) { mobileViewPanX = 0; mobileViewPanY = 0; }
  applyMobileViewport();
  rememberMobileViewportStableAnchor();
}

function resetMobileViewport() {
  mobileViewZoom = 1;
  mobileViewPanX = 0;
  mobileViewPanY = 0;
  applyMobileViewport();
  rememberMobileViewportStableAnchor();
}

function setMobileViewControlsVisible(visible) {
  if (!elMobileViewControls) return;
  elMobileViewControls.classList.toggle('visible', !!visible && isMobileViewerSurface());
}

function setMobileBottomActionsVisible(visible) {
  if (!elMobileBottomActions) return;
  elMobileBottomActions.classList.toggle('visible', !!visible && isMobileViewerSurface());
}

function captureMobileViewportAnchor() {
  if (!isMobileViewerSurface() || !elMain || !elVideo || !elVideo.videoWidth || !elVideo.videoHeight) return null;
  const main = elMain.getBoundingClientRect();
  const content = getVideoContentRect(elVideo);
  if (!main.width || !main.height || !content.width || !content.height) return null;
  const centerX = main.left + main.width / 2;
  const centerY = main.top + main.height / 2;
  return {
    zoom: mobileViewZoom,
    focusX: Math.max(-0.5, Math.min(1.5, (centerX - content.left) / content.width)),
    focusY: Math.max(-0.5, Math.min(1.5, (centerY - content.top) / content.height))
  };
}

function rememberMobileViewportStableAnchor() {
  const anchor = captureMobileViewportAnchor();
  if (anchor) mobileViewportStableAnchor = { ...anchor };
  return anchor;
}

function restoreMobileViewportAnchor(anchor) {
  if (!anchor || !isMobileViewerSurface() || !elMain || !elVideo) return;
  mobileViewZoom = Math.max(1, Math.min(4, Number(anchor.zoom) || 1));
  if (mobileViewZoom <= 1.001) {
    mobileViewZoom = 1;
    mobileViewPanX = 0;
    mobileViewPanY = 0;
    applyMobileViewport({ clamp: false });
    return;
  }

  // First paint at the new iOS viewport geometry, then translate so the exact
  // same remote point remains under the centre of the phone screen.
  applyMobileViewport({ clamp: false });
  const main = elMain.getBoundingClientRect();
  const content = getVideoContentRect(elVideo);
  if (!main.width || !main.height || !content.width || !content.height) return;
  const centerX = main.left + main.width / 2;
  const centerY = main.top + main.height / 2;
  const targetX = content.left + Number(anchor.focusX ?? 0.5) * content.width;
  const targetY = content.top + Number(anchor.focusY ?? 0.5) * content.height;
  mobileViewPanX += centerX - targetX;
  mobileViewPanY += centerY - targetY;
  applyMobileViewport({ clamp: false });
  mobileViewportStableAnchor = { ...anchor, zoom: mobileViewZoom };
}

function cancelMobileViewportResumeRestore() {
  ++mobileViewportResumeToken;
  mobileViewportResumeUntil = 0;
}

function scheduleMobileViewportResumeRestore(anchor = mobileViewportResumeAnchor) {
  if (!anchor || !isMobileViewerSurface()) return;
  mobileViewportResumeAnchor = { ...anchor };
  mobileViewportResumeUntil = performance.now() + 1600;
  const token = ++mobileViewportResumeToken;
  const restore = () => {
    if (token !== mobileViewportResumeToken || !currentSession || document.hidden) return;
    restoreMobileViewportAnchor(mobileViewportResumeAnchor);
  };
  requestAnimationFrame(() => requestAnimationFrame(restore));
  for (const delay of [70, 180, 380, 750, 1200]) setTimeout(restore, delay);
}

function activateMobileHistoryGuard() {
  if (mobileHistoryGuardActive || !isMobileViewerSurface()) return;
  try {
    history.pushState({ ...(history.state || {}), hi5ViewerGuard: mobileHistoryGuardId }, '', location.href);
    mobileHistoryGuardActive = true;
  } catch {}
}

function releaseMobileHistoryGuard() {
  if (!mobileHistoryGuardActive) return;
  const isOurGuard = history.state?.hi5ViewerGuard === mobileHistoryGuardId;
  mobileHistoryGuardActive = false;
  if (!isOurGuard) return;
  mobileHistoryGuardReleasing = true;
  try { history.back(); } catch { mobileHistoryGuardReleasing = false; }
}

function recoverMobileViewerFromBrowserGesture(reason = 'browser-gesture') {
  if (!currentSession || !isMobileViewerSurface()) return;
  const anchor = captureMobileViewportAnchor() || mobileViewportStableAnchor || mobileViewportResumeAnchor;
  if (anchor) {
    mobileViewportStableAnchor = { ...anchor };
    mobileViewportResumeAnchor = { ...anchor };
  }
  try { mobileGestureLifecycleReset?.(); } catch {}
  leaveRemoteControlMode();
  mobileEdgeTouchIds.clear();
  if (mobileBrowserGestureRecoveryTimer) clearTimeout(mobileBrowserGestureRecoveryTimer);
  mobileBrowserGestureRecoveryTimer = setTimeout(() => {
    mobileBrowserGestureRecoveryTimer = null;
    if (!currentSession || document.hidden) return;
    ensureRemoteVideoPlayback(reason);
    armDecodedFrameReveal();
    requestRemoteKeyframe(reason);
    if (anchor) scheduleMobileViewportResumeRestore(anchor);
  }, 40);
}

function handleMobileViewportGeometryChange() {
  if (!isMobileViewerSurface() || document.hidden) return;
  if (mobileViewportResumeAnchor && performance.now() < mobileViewportResumeUntil) {
    requestAnimationFrame(() => restoreMobileViewportAnchor(mobileViewportResumeAnchor));
    return;
  }
  if (mobileViewZoom > 1.001 && mobileViewportStableAnchor) {
    requestAnimationFrame(() => restoreMobileViewportAnchor(mobileViewportStableAnchor));
    return;
  }
  applyMobileViewport({ clamp: mobileViewZoom <= 1.001 });
}

elMobileZoomOut?.addEventListener('click', () => { setMobileViewZoom(mobileViewZoom - 0.5); wakeMobileToolbar(); });
elMobileZoomIn?.addEventListener('click', () => { setMobileViewZoom(mobileViewZoom + 0.5); wakeMobileToolbar(); });
elMobileZoomFit?.addEventListener('click', () => { resetMobileViewport(); wakeMobileToolbar(); });
window.addEventListener('resize', handleMobileViewportGeometryChange);
window.visualViewport?.addEventListener('resize', handleMobileViewportGeometryChange);
window.visualViewport?.addEventListener('scroll', handleMobileViewportGeometryChange);
window.addEventListener('pageshow', () => {
  if (mobileViewportResumeAnchor) scheduleMobileViewportResumeRestore(mobileViewportResumeAnchor);
});

function isMobileRemoteCanvasTarget(target) {
  const el = target instanceof Element ? target : null;
  if (!el || !currentSession || !isMobileViewerSurface()) return false;
  if (el.closest('#mobile-bottom-actions, #mobile-view-controls, #mobile-keyboard, #topbar, #files-panel, #chat-panel, #settings-panel')) return false;
  return el === elMain || el === elVideo || !!el.closest('#main');
}

// iOS Safari can reserve a left-edge touch for interactive browser history
// navigation before Pointer Events fully settle. A non-passive TouchEvent
// guard at capture phase prevents that native horizontal navigation only when
// the active remote canvas owns the gesture. Controls/panels keep normal touch.
document.addEventListener('touchstart', (ev) => {
  if (!isMobileRemoteCanvasTarget(ev.target)) return;
  let blocked = false;
  for (const touch of Array.from(ev.changedTouches || [])) {
    const x = Number(touch.clientX || 0);
    if (x <= 34 || x >= Math.max(0, window.innerWidth - 34)) {
      mobileEdgeTouchIds.add(touch.identifier);
      blocked = true;
    }
  }
  if (blocked && ev.cancelable) ev.preventDefault();
}, { capture: true, passive: false });

document.addEventListener('touchmove', (ev) => {
  if (!currentSession || !isMobileViewerSurface()) return;
  const touches = Array.from(ev.changedTouches || []);
  if (touches.some((touch) => mobileEdgeTouchIds.has(touch.identifier)) && ev.cancelable) ev.preventDefault();
}, { capture: true, passive: false });

const clearMobileEdgeTouches = (ev) => {
  for (const touch of Array.from(ev.changedTouches || [])) mobileEdgeTouchIds.delete(touch.identifier);
};
document.addEventListener('touchend', clearMobileEdgeTouches, { capture: true, passive: true });
document.addEventListener('touchcancel', (ev) => {
  clearMobileEdgeTouches(ev);
  if (currentSession && isMobileViewerSurface()) recoverMobileViewerFromBrowserGesture('touchcancel-recovery');
}, { capture: true, passive: true });

function showMobileTouchContact(clientX, clientY) {
  if (!isMobileViewerSurface()) return;
  const dot = document.createElement('div');
  dot.className = 'mobile-touch-contact';
  dot.style.left = clientX + 'px';
  dot.style.top = clientY + 'px';
  document.body.appendChild(dot);
  setTimeout(() => dot.remove(), 500);
}

function shouldShowMobileReticle() {
  return isMobileViewerSurface() && (mobileInputMode === 'trackpad' || mobilePrecisionMode);
}

function updateMobileReticle(xNorm = mobileTrackpadCursor.x_norm, yNorm = mobileTrackpadCursor.y_norm) {
  if (!elMobilePointerReticle) return;
  if (!shouldShowMobileReticle() || !elVideo?.videoWidth || !elVideo?.videoHeight) {
    elMobilePointerReticle.style.display = 'none';
    return;
  }
  const r = getVideoContentRect(elVideo);
  elMobilePointerReticle.style.left = (r.left + Math.max(0, Math.min(1, xNorm)) * r.width) + 'px';
  elMobilePointerReticle.style.top = (r.top + Math.max(0, Math.min(1, yNorm)) * r.height) + 'px';
  elMobilePointerReticle.style.display = 'block';
}

function hideMobilePrecisionLoupe() {
  if (elMobilePrecisionLoupe) elMobilePrecisionLoupe.style.display = 'none';
}

function updateMobilePrecisionLoupe(xNorm, yNorm, clientX, clientY) {
  if (!mobilePrecisionMode || !elMobilePrecisionLoupe || !elVideo?.videoWidth || !elVideo?.videoHeight) {
    hideMobilePrecisionLoupe();
    return;
  }
  try {
    const ctx = elMobilePrecisionLoupe.getContext('2d');
    if (!ctx) return;
    const vw = elVideo.videoWidth;
    const vh = elVideo.videoHeight;
    const cropW = Math.max(80, Math.min(240, Math.round(vw * 0.10)));
    const cropH = Math.max(80, Math.min(240, Math.round(vh * 0.10)));
    const cx = Math.max(0, Math.min(vw, xNorm * vw));
    const cy = Math.max(0, Math.min(vh, yNorm * vh));
    const sx = Math.max(0, Math.min(vw - cropW, cx - cropW / 2));
    const sy = Math.max(0, Math.min(vh - cropH, cy - cropH / 2));
    const cw = elMobilePrecisionLoupe.width;
    const ch = elMobilePrecisionLoupe.height;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(elVideo, sx, sy, cropW, cropH, 0, 0, cw, ch);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,.96)';
    ctx.beginPath();
    ctx.moveTo(cw / 2, 0); ctx.lineTo(cw / 2, ch);
    ctx.moveTo(0, ch / 2); ctx.lineTo(cw, ch / 2);
    ctx.stroke();
    const margin = 8;
    const displayW = 92;
    const displayH = 92;
    let left = clientX - displayW / 2;
    let top = clientY - displayH - 34;
    left = Math.max(margin, Math.min(window.innerWidth - displayW - margin, left));
    if (top < margin) top = Math.min(window.innerHeight - displayH - margin, clientY + 34);
    elMobilePrecisionLoupe.style.left = left + 'px';
    elMobilePrecisionLoupe.style.top = top + 'px';
    elMobilePrecisionLoupe.style.display = 'block';
  } catch {}
}

function setMobileToolbarCollapsed(collapsed) {
  if (!isMobileViewerSurface()) return;
  document.body.classList.toggle('mobile-toolbar-collapsed', !!collapsed);
}

function scheduleMobileToolbarHide(delay = 4200) {
  if (mobileToolbarTimer) clearTimeout(mobileToolbarTimer);
  mobileToolbarTimer = null;
  if (!isMobileViewerSurface() || mobilePrefs.toolbar !== 'auto' || !currentSession) return;
  mobileToolbarTimer = setTimeout(() => {
    if (mobileKeyboardOpen || elFilesPanel?.classList.contains('visible') || elChatPanel?.classList.contains('visible') || elSettingsPanel?.classList.contains('visible')) return;
    setMobileToolbarCollapsed(true);
  }, delay);
}

function wakeMobileToolbar() {
  if (!isMobileViewerSurface()) return;
  setMobileToolbarCollapsed(false);
  scheduleMobileToolbarHide();
}

const MOBILE_ADAPTIVE_TIERS = [
  { bitrate: 8000, fps: 30, label: 'Native · 8 Mbps · 30 fps' },
  { bitrate: 6000, fps: 30, label: 'Native · 6 Mbps · 30 fps' },
  { bitrate: 4500, fps: 24, label: 'Native · 4.5 Mbps · 24 fps' },
  { bitrate: 3200, fps: 20, label: 'Native · 3.2 Mbps · 20 fps' },
  { bitrate: 2200, fps: 15, label: 'Native · 2.2 Mbps · 15 fps' }
];

function setMobileRecoveryStage(stage) {
  mobileRecoveryStage = String(stage || 'Idle');
  if (elDiagMobileRecovery) elDiagMobileRecovery.textContent = mobileRecoveryStage;
}

function setMobileQualityUi(label, quality, detail = '') {
  if (elMobileQualityIndicator) {
    elMobileQualityIndicator.textContent = label;
    elMobileQualityIndicator.dataset.quality = quality || 'good';
    elMobileQualityIndicator.title = detail || ('Connection quality: ' + label);
    elMobileQualityIndicator.classList.toggle('visible', !!currentSession && isMobileViewerSurface());
  }
  if (elDiagMobileQuality) elDiagMobileQuality.textContent = detail ? label + ' · ' + detail : label;
}

function updateMobileDiagnosticsUi() {
  const enabled = isMobileViewerSurface() && mobilePrefs.diagnostics === 'on';
  elMobileDiagnosticsCard?.classList.toggle('visible', enabled);
  if (elMobileDiagnosticsPref) elMobileDiagnosticsPref.value = mobilePrefs.diagnostics;
  if (elMobileAdaptivePref) elMobileAdaptivePref.value = mobilePrefs.adaptive;
  if (elDiagMobileProfile) elDiagMobileProfile.textContent = mobileAdaptiveState.label;
  if (elDiagMobileViewport) {
    const vv = window.visualViewport;
    elDiagMobileViewport.textContent = mobileViewZoom.toFixed(2) + '× · ' + Math.round(vv?.width || innerWidth) + '×' + Math.round(vv?.height || innerHeight);
  }
  if (elDiagMobileMonitor) {
    const monitor = remoteMonitors.find((m) => Number(m.index) === Number(currentMonitorIndex));
    elDiagMobileMonitor.textContent = monitor ? getMonitorLabel(monitor) : String(currentMonitorIndex);
  }
  if (elDiagMobileWakeLock) elDiagMobileWakeLock.textContent = wakeLockSentinel ? 'Active' : (wakeLockRequested ? 'Requested' : 'Inactive');
}

async function requestMobileWakeLock() {
  if (!isMobileViewerSurface() || !currentSession || document.hidden || !('wakeLock' in navigator)) return false;
  if (wakeLockSentinel && !wakeLockSentinel.released) return true;
  wakeLockRequested = true;
  updateMobileDiagnosticsUi();
  try {
    wakeLockSentinel = await navigator.wakeLock.request('screen');
    wakeLockRequested = false;
    wakeLockSentinel.addEventListener('release', () => { wakeLockSentinel = null; updateMobileDiagnosticsUi(); });
    updateMobileDiagnosticsUi();
    return true;
  } catch {
    wakeLockRequested = false;
    wakeLockSentinel = null;
    updateMobileDiagnosticsUi();
    return false;
  }
}

async function releaseMobileWakeLock() {
  wakeLockRequested = false;
  const sentinel = wakeLockSentinel;
  wakeLockSentinel = null;
  try { await sentinel?.release?.(); } catch {}
  updateMobileDiagnosticsUi();
}

function resetMobileAdaptiveState() {
  mobileAdaptiveState = { tier: 0, bad: 0, good: 0, lastChangeAt: Date.now(), targetFps: 30, targetBitrateKbps: 8000, label: MOBILE_ADAPTIVE_TIERS[0].label };
  mobileQualityState = { current: 'good', candidate: null, count: 0, changedAt: Date.now(), samples: [] };
  updateMobileDiagnosticsUi();
}

function applyMobileAdaptiveTier(nextTier, reason = '') {
  const tier = Math.max(0, Math.min(MOBILE_ADAPTIVE_TIERS.length - 1, Number(nextTier) || 0));
  const cfg = MOBILE_ADAPTIVE_TIERS[tier];
  if (!cfg || tier === mobileAdaptiveState.tier) return false;
  mobileAdaptiveState.tier = tier;
  mobileAdaptiveState.targetFps = cfg.fps;
  mobileAdaptiveState.targetBitrateKbps = cfg.bitrate;
  mobileAdaptiveState.label = cfg.label;
  mobileAdaptiveState.lastChangeAt = Date.now();
  mobileAdaptiveState.bad = 0;
  mobileAdaptiveState.good = 0;
  console.log('[adaptive] tier changed', { tier, reason, ...cfg });
  updateMobileDiagnosticsUi();
  sendViewerStreamProfile();
  return true;
}

function median(values) {
  const nums = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!nums.length) return 0;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function observeMobileNetworkQuality({ rttMs, jitterMs, jitterBufferMs, lossRate, packetCount = 0, packetsLostDelta = 0 }) {
  if (!currentSession || !isMobileViewerSurface()) return;
  const sample = {
    at: Date.now(),
    rtt: Number.isFinite(rttMs) && rttMs > 0 ? rttMs : null,
    jitter: Number.isFinite(jitterMs) && jitterMs >= 0 ? jitterMs : null,
    buffer: Number.isFinite(jitterBufferMs) && jitterBufferMs >= 0 ? jitterBufferMs : null,
    packetCount: Math.max(0, Number(packetCount) || 0),
    packetsLost: Math.max(0, Number(packetsLostDelta) || 0),
    loss: Number.isFinite(lossRate) ? Math.max(0, lossRate) : 0
  };
  mobileQualityState.samples.push(sample);
  if (mobileQualityState.samples.length > 10) mobileQualityState.samples.shift();

  const samples = mobileQualityState.samples;
  if (samples.length < 4) {
    setMobileQualityUi('Measuring', 'good', 'Collecting stable network samples');
    return;
  }

  const rtt = median(samples.map((x) => x.rtt));
  const jitter = median(samples.map((x) => x.jitter));
  const buffer = median(samples.map((x) => x.buffer));
  const packetTotal = samples.reduce((sum, x) => sum + x.packetCount, 0);
  const lostTotal = samples.reduce((sum, x) => sum + x.packetsLost, 0);
  // Packet loss is only trustworthy when enough RTP packets were observed. A
  // mostly static desktop may emit only a few packets per second, where one lost
  // packet would otherwise create a meaningless double-digit percentage.
  const loss = packetTotal >= 120 ? lostTotal / packetTotal : 0;

  const poor = rtt >= 350 || buffer >= 240 || jitter >= 90 || (packetTotal >= 120 && loss >= 0.04);
  const excellent = rtt > 0 && rtt < 140 && buffer < 90 && jitter < 35 && (packetTotal < 120 || loss < 0.008);
  const observed = poor ? 'poor' : (excellent ? 'excellent' : 'good');

  if (observed === mobileQualityState.current) {
    mobileQualityState.candidate = null;
    mobileQualityState.count = 0;
  } else {
    if (mobileQualityState.candidate === observed) mobileQualityState.count += 1;
    else { mobileQualityState.candidate = observed; mobileQualityState.count = 1; }
    const needed = observed === 'poor' ? 3 : (observed === 'excellent' ? 5 : 3);
    if (mobileQualityState.count >= needed && Date.now() - mobileQualityState.changedAt >= 4000) {
      mobileQualityState.current = observed;
      mobileQualityState.changedAt = Date.now();
      mobileQualityState.candidate = null;
      mobileQualityState.count = 0;
    }
  }

  const current = mobileQualityState.current;
  const label = current === 'poor' ? 'Poor' : (current === 'excellent' ? 'Excellent' : 'Good');
  const detail = Math.round(rtt || 0) + 'ms · ' + (loss * 100).toFixed(1) + '% loss · 10s window';
  setMobileQualityUi(label, current, detail);
  if (current !== 'poor') mobileLastGoodStatsAt = Date.now();

  if (mobilePrefs.adaptive !== 'on') return;
  // Only sustained Poor quality can reduce the stream. "Good" is considered
  // healthy and must not lower bitrate/FPS due to ordinary Wi-Fi variance.
  if (current === 'poor') { mobileAdaptiveState.bad += 1; mobileAdaptiveState.good = 0; }
  else if (current === 'excellent') { mobileAdaptiveState.good += 1; mobileAdaptiveState.bad = 0; }
  else { mobileAdaptiveState.bad = Math.max(0, mobileAdaptiveState.bad - 1); mobileAdaptiveState.good = Math.max(0, mobileAdaptiveState.good - 1); }

  const sinceChange = Date.now() - mobileAdaptiveState.lastChangeAt;
  if (mobileAdaptiveState.bad >= 5 && sinceChange >= 15000) {
    applyMobileAdaptiveTier(mobileAdaptiveState.tier + 1, 'sustained-poor-network');
  } else if (mobileAdaptiveState.good >= 12 && sinceChange >= 15000) {
    applyMobileAdaptiveTier(mobileAdaptiveState.tier - 1, 'sustained-network-recovery');
  }
}

function updateMobileModeUi() {
  if (elMobileInputMode) {
    elMobileInputMode.textContent = mobileInputMode === 'trackpad' ? 'Trackpad' : 'Touch';
    elMobileInputMode.classList.toggle('active', mobileInputMode === 'trackpad');
  }
  elMobilePanMode?.classList.toggle('active', mobilePanMode);
  elMobilePrecisionMode?.classList.toggle('active', mobilePrecisionMode);
  if (elMobileInputPref) elMobileInputPref.value = mobileInputMode;
  if (elMobileToolbarPref) elMobileToolbarPref.value = mobilePrefs.toolbar;
  if (elMobileAdaptivePref) elMobileAdaptivePref.value = mobilePrefs.adaptive;
  if (elMobileDiagnosticsPref) elMobileDiagnosticsPref.value = mobilePrefs.diagnostics;
  if (elRemoteResolutionPref) elRemoteResolutionPref.value = mobilePrefs.resolution;
  if (elViewerScaleMode) elViewerScaleMode.value = mobilePrefs.scale;
  if (elMobileScrollRail) elMobileScrollRail.classList.toggle('visible', !!currentSession && isMobileViewerSurface() && mobileInputMode === 'trackpad');
  updateMobileReticle();
  updateMobileDiagnosticsUi();
}

function setMobileInputMode(mode) {
  mobileInputMode = mode === 'trackpad' ? 'trackpad' : 'direct';
  mobilePanMode = false;
  mobilePrecisionMode = false;
  mobileLastTap = null;
  saveMobilePrefs();
  updateMobileModeUi();
  wakeMobileToolbar();
}

function toggleMobilePanMode() {
  mobilePanMode = !mobilePanMode;
  if (mobilePanMode) mobilePrecisionMode = false;
  updateMobileModeUi();
  hideMobilePrecisionLoupe();
  wakeMobileToolbar();
}

function toggleMobilePrecisionMode() {
  mobilePrecisionMode = !mobilePrecisionMode;
  if (mobilePrecisionMode) mobilePanMode = false;
  updateMobileModeUi();
  if (!mobilePrecisionMode) hideMobilePrecisionLoupe();
  wakeMobileToolbar();
}

function applyViewerScalePreference() {
  const scale = mobilePrefs.scale === 'stretch' ? 'fill' : 'contain';
  if (isMobileViewerSurface() && elVideo) elVideo.style.objectFit = scale;
  else if (elVideo) elVideo.style.objectFit = mobilePrefs.scale === 'stretch' ? 'fill' : '';
  applyMobileViewport({ clamp: false });
}

function toggleSettingsPanel(force) {
  if (!elSettingsPanel) return;
  const show = typeof force === 'boolean' ? force : !elSettingsPanel.classList.contains('visible');
  elSettingsPanel.classList.toggle('visible', show);
  if (show) { leaveRemoteControlMode(); wakeMobileToolbar(); }
  else scheduleMobileToolbarHide(1800);
}

elMobileInputMode?.addEventListener('click', () => setMobileInputMode(mobileInputMode === 'trackpad' ? 'direct' : 'trackpad'));
elMobilePanMode?.addEventListener('click', toggleMobilePanMode);
elMobilePrecisionMode?.addEventListener('click', toggleMobilePrecisionMode);
elMobileToolbarHandle?.addEventListener('click', wakeMobileToolbar);
elBtnSettings?.addEventListener('click', () => toggleSettingsPanel());
elSettingsClose?.addEventListener('click', () => toggleSettingsPanel(false));
elMobileInputPref?.addEventListener('change', () => setMobileInputMode(elMobileInputPref.value));
elMobileAdaptivePref?.addEventListener('change', () => {
  mobilePrefs.adaptive = elMobileAdaptivePref.value === 'off' ? 'off' : 'on';
  resetMobileAdaptiveState();
  saveMobilePrefs();
  sendViewerStreamProfile();
});
elMobileDiagnosticsPref?.addEventListener('change', () => {
  mobilePrefs.diagnostics = elMobileDiagnosticsPref.value === 'on' ? 'on' : 'off';
  saveMobilePrefs();
  updateMobileDiagnosticsUi();
});
elMobileQualityIndicator?.addEventListener('click', () => {
  toggleSettingsPanel(true);
  mobilePrefs.diagnostics = 'on';
  saveMobilePrefs();
  updateMobileDiagnosticsUi();
});
elMobileToolbarPref?.addEventListener('change', () => {
  mobilePrefs.toolbar = elMobileToolbarPref.value === 'always' ? 'always' : 'auto';
  saveMobilePrefs();
  setMobileToolbarCollapsed(false);
  scheduleMobileToolbarHide();
});
elRemoteResolutionPref?.addEventListener('change', () => {
  mobilePrefs.resolution = ['native','1080p','720p'].includes(elRemoteResolutionPref.value) ? elRemoteResolutionPref.value : 'auto';
  saveMobilePrefs();
  sendViewerStreamProfile();
});
elViewerScaleMode?.addEventListener('change', () => {
  mobilePrefs.scale = elViewerScaleMode.value === 'stretch' ? 'stretch' : 'fit';
  saveMobilePrefs();
  applyViewerScalePreference();
});

if (new URLSearchParams(location.search).get('diagnostics') === '1') mobilePrefs.diagnostics = 'on';

let mobileKeyboardOpen = false;
let mobileKeyboardLayer = 'letters';
const mobileKeyboardModifiers = { shift: false, ctrl: false, alt: false };

const MOBILE_LETTER_ROWS = [
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  [{ label: 'Shift', modifier: 'shift', wide: true }, 'z','x','c','v','b','n','m', { label: '⌫', code: 'Backspace', key: 'Backspace', wide: true }],
  [{ label: '123', layer: 'symbols', wide: true }, { label: 'Ctrl', modifier: 'ctrl' }, { label: 'Alt', modifier: 'alt' }, { label: '⊞', action: 'start_menu' }, { label: 'Space', text: ' ', code: 'Space', space: true }, { label: 'Enter', code: 'Enter', key: 'Enter', wide: true }],
  [{ label: 'Esc', code: 'Escape', key: 'Escape' }, { label: 'Tab', code: 'Tab', key: 'Tab' }, { label: '←', code: 'ArrowLeft', key: 'ArrowLeft' }, { label: '↑', code: 'ArrowUp', key: 'ArrowUp' }, { label: '↓', code: 'ArrowDown', key: 'ArrowDown' }, { label: '→', code: 'ArrowRight', key: 'ArrowRight' }, { label: 'Del', code: 'Delete', key: 'Delete' }, { label: 'Fn', layer: 'function' }]
];
const MOBILE_SYMBOL_ROWS = [
  ['1','2','3','4','5','6','7','8','9','0'],
  ['`','-','=','[',']','\\',';','\'',',','.','/'],
  ['!','@','#','$','%','^','&','*','(',')'],
  [{ label: 'ABC', layer: 'letters', wide: true }, { label: 'Ctrl', modifier: 'ctrl' }, { label: 'Alt', modifier: 'alt' }, { label: '⊞', action: 'start_menu' }, { label: 'Space', text: ' ', code: 'Space', space: true }, { label: 'Enter', code: 'Enter', key: 'Enter', wide: true }],
  [{ label: 'Esc', code: 'Escape', key: 'Escape' }, { label: 'Tab', code: 'Tab', key: 'Tab' }, { label: '←', code: 'ArrowLeft', key: 'ArrowLeft' }, { label: '↑', code: 'ArrowUp', key: 'ArrowUp' }, { label: '↓', code: 'ArrowDown', key: 'ArrowDown' }, { label: '→', code: 'ArrowRight', key: 'ArrowRight' }, { label: 'Del', code: 'Delete', key: 'Delete' }, { label: 'Fn', layer: 'function' }]
];
const MOBILE_FUNCTION_ROWS = [
  [{label:'F1',code:'F1',key:'F1'},{label:'F2',code:'F2',key:'F2'},{label:'F3',code:'F3',key:'F3'},{label:'F4',code:'F4',key:'F4'},{label:'F5',code:'F5',key:'F5'},{label:'F6',code:'F6',key:'F6'}],
  [{label:'F7',code:'F7',key:'F7'},{label:'F8',code:'F8',key:'F8'},{label:'F9',code:'F9',key:'F9'},{label:'F10',code:'F10',key:'F10'},{label:'F11',code:'F11',key:'F11'},{label:'F12',code:'F12',key:'F12'}],
  [{label:'Home',code:'Home',key:'Home'},{label:'End',code:'End',key:'End'},{label:'PgUp',code:'PageUp',key:'PageUp'},{label:'PgDn',code:'PageDown',key:'PageDown'},{label:'Ins',code:'Insert',key:'Insert'},{label:'Del',code:'Delete',key:'Delete'}],
  [{label:'Caps',code:'CapsLock',key:'CapsLock'},{label:'Num',code:'NumLock',key:'NumLock'},{label:'Scroll',code:'ScrollLock',key:'ScrollLock'},{label:'PrtSc',code:'PrintScreen',key:'PrintScreen'},{label:'Pause',code:'Pause',key:'Pause'},{label:'Menu',code:'ContextMenu',key:'ContextMenu'}],
  [{label:'ABC',layer:'letters',wide:true},{label:'123',layer:'symbols',wide:true},{label:'Ctrl',modifier:'ctrl'},{label:'Alt',modifier:'alt'},{label:'Shift',modifier:'shift'},{label:'⊞',action:'start_menu'},{label:'Enter',code:'Enter',key:'Enter',wide:true}]
];
const SHIFTED_NUMBER_TEXT = {"0":")","1":"!","2":"@","3":"#","4":"$","5":"%","6":"^","7":"&","8":"*","9":"("};
const SHIFTED_PUNCTUATION_TEXT = {"`":"~","-":"_","=":"+","[":"{","]":"}","\\":"|",";":":","'":"\"",",":"<",".":">","/":"?"};

function keyboardCodeForText(text) {
  if (/^[a-z]$/i.test(text)) return 'Key' + text.toUpperCase();
  if (/^[0-9]$/.test(text)) return 'Digit' + text;
  if (text === ' ') return 'Space';
  const punctuation = {
    '`': 'Backquote', '-': 'Minus', '=': 'Equal',
    '[': 'BracketLeft', ']': 'BracketRight', '\\': 'Backslash',
    ';': 'Semicolon', "'": 'Quote', ',': 'Comma',
    '.': 'Period', '/': 'Slash'
  };
  return punctuation[text] || '';
}

function normalizeMobileKey(def) {
  if (typeof def === 'string') return { label: def.toUpperCase(), text: def, code: keyboardCodeForText(def) };
  return { ...def };
}

function clearMobileKeyboardModifiers() {
  mobileKeyboardModifiers.shift = false;
  mobileKeyboardModifiers.ctrl = false;
  mobileKeyboardModifiers.alt = false;
}

function updateMobileKeyboardModifierButtons() {
  if (!elMobileKeyboardRows) return;
  for (const button of elMobileKeyboardRows.querySelectorAll('[data-modifier]')) {
    button.classList.toggle('active', !!mobileKeyboardModifiers[button.dataset.modifier]);
  }
}

function sendMobileKeyCombo(def) {
  enterRemoteControlMode();
  const ctrl = mobileKeyboardModifiers.ctrl;
  const alt = mobileKeyboardModifiers.alt;
  const shift = mobileKeyboardModifiers.shift;
  const code = def.code || keyboardCodeForText(def.text || '');
  const key = def.key || def.text || def.label || '';

  if (def.action) {
    sendShortcut(def.action);
    clearMobileKeyboardModifiers();
    renderMobileKeyboard();
    return;
  }

  if (def.text != null && !ctrl && !alt) {
    let text = String(def.text);
    if (shift) {
      if (/^[a-z]$/i.test(text)) text = text.toUpperCase();
      else if (SHIFTED_NUMBER_TEXT[text]) text = SHIFTED_NUMBER_TEXT[text];
      else if (SHIFTED_PUNCTUATION_TEXT[text]) text = SHIFTED_PUNCTUATION_TEXT[text];
    }
    sendInput('text_input', { code, key: text, text, repeat: false }, true);
  } else if (code) {
    if (ctrl) sendInput('key_down', { code: 'ControlLeft', key: 'Control' }, true);
    if (alt) sendInput('key_down', { code: 'AltLeft', key: 'Alt' }, true);
    if (shift) sendInput('key_down', { code: 'ShiftLeft', key: 'Shift' }, true);
    sendInput('key_down', { code, key, repeat: false, ctrl, alt, shift }, true);
    sendInput('key_up', { code, key, ctrl, alt, shift }, true);
    if (shift) sendInput('key_up', { code: 'ShiftLeft', key: 'Shift' }, true);
    if (alt) sendInput('key_up', { code: 'AltLeft', key: 'Alt' }, true);
    if (ctrl) sendInput('key_up', { code: 'ControlLeft', key: 'Control' }, true);
  }

  clearMobileKeyboardModifiers();
  renderMobileKeyboard();
}

function handleMobileKeyboardKey(def) {
  if (def.layer) {
    mobileKeyboardLayer = def.layer;
    renderMobileKeyboard();
    return;
  }
  if (def.modifier) {
    mobileKeyboardModifiers[def.modifier] = !mobileKeyboardModifiers[def.modifier];
    updateMobileKeyboardModifierButtons();
    return;
  }
  sendMobileKeyCombo(def);
}

function renderMobileKeyboard() {
  if (!elMobileKeyboardRows) return;
  elMobileKeyboardRows.innerHTML = '';
  const rows = mobileKeyboardLayer === 'symbols' ? MOBILE_SYMBOL_ROWS : (mobileKeyboardLayer === 'function' ? MOBILE_FUNCTION_ROWS : MOBILE_LETTER_ROWS);
  for (const rowDefs of rows) {
    const row = document.createElement('div');
    row.className = 'remote-keyboard-row';
    for (const rawDef of rowDefs) {
      const def = normalizeMobileKey(rawDef);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'remote-key' + (def.wide ? ' wide' : '') + (def.space ? ' space' : '') + (def.layer ? ' layer' : '');
      button.textContent = def.label || def.text || def.key || '';
      if (def.modifier) {
        button.dataset.modifier = def.modifier;
        button.classList.toggle('active', !!mobileKeyboardModifiers[def.modifier]);
      }
      button.addEventListener('click', () => handleMobileKeyboardKey(def));
      row.appendChild(button);
    }
    elMobileKeyboardRows.appendChild(row);
  }
}

function toggleMobileKeyboard(force) {
  if (!elMobileKeyboard || !isMobileViewerSurface()) return;
  const anchor = captureMobileViewportAnchor();
  wakeMobileToolbar();
  mobileKeyboardOpen = typeof force === 'boolean' ? force : !mobileKeyboardOpen;
  elMobileKeyboard.classList.toggle('visible', mobileKeyboardOpen);
  elBtnKeyboard?.classList.toggle('active', mobileKeyboardOpen);
  if (!mobileKeyboardOpen) clearMobileKeyboardModifiers();
  renderMobileKeyboard();
  if (anchor) scheduleMobileViewportResumeRestore(anchor);
  else window.requestAnimationFrame(() => applyMobileViewport({ clamp: false }));
}

function sendMobileTextEntry() {
  if (!elMobileTextInput) return;
  const text = String(elMobileTextInput.value || '');
  if (!text) return;
  enterRemoteControlMode();
  sendInput('text_input', { text }, true);
  elMobileTextInput.value = '';
  elMobileTextInput.focus({ preventScroll: true });
}

renderMobileKeyboard();
elBtnKeyboard?.addEventListener('click', () => toggleMobileKeyboard());
elMobileKeyboardClose?.addEventListener('click', () => toggleMobileKeyboard(false));
elMobileTextSend?.addEventListener('click', sendMobileTextEntry);
elMobileTextInput?.addEventListener('focus', () => {
  const anchor = captureMobileViewportAnchor();
  if (anchor) scheduleMobileViewportResumeRestore(anchor);
});
elMobileTextInput?.addEventListener('blur', () => {
  const anchor = captureMobileViewportAnchor() || mobileViewportStableAnchor;
  if (anchor) scheduleMobileViewportResumeRestore(anchor);
});
elMobileTextInput?.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && !ev.shiftKey) {
    ev.preventDefault();
    ev.stopPropagation();
    sendMobileTextEntry();
  }
});

let remoteMonitors = [];
let currentMonitorIndex = 0;
let monitorMenuOpen = false;
let monitorMenuCloseTimer = null;
let pendingMonitorIndex = null;
let mobilePreferredMonitorApplied = false;
let chatMessages = [];
const chatMessageKeys = new Set();
let chatMessageSequence = 0;
let remoteFileEntries = [];
let remoteFilePath = "/";

// Initial mobile UI rendering must happen after monitor/session state is
// initialised. updateMobileDiagnosticsUi() reads these values.
updateMobileModeUi();
applyViewerScalePreference();

/* transition state */
let hasEverRenderedFrame = false;
let lastFrameAtMs = 0;
let lastFramesDecoded = 0;
let passiveOverlayActive = false;
let secureDesktopLikely = false;
let secureDesktopActive = false;
let desktopHandoffActive = false;
let loginDesktopInputActive = false;
let loginDesktopWakeTimer = null;
let loginDesktopWakeAttempts = 0;
let revealOnNextFrame = false;
let monitorSwitchUntilMs = 0;
let lastKeyframeRequestAtMs = 0;
let overlayMode = "hard";

/* -----------------------------------------
   TURN / ICE config
------------------------------------------ */

const FALLBACK_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function normalizeIceServers(value) {
  if (!Array.isArray(value)) return [...FALLBACK_ICE_SERVERS];
  const safe = value.filter((server) => {
    if (!server || typeof server !== "object") return false;
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return urls.some((url) => typeof url === "string" && /^(stun|stuns|turn|turns):/i.test(url));
  }).map((server) => ({
    urls: server.urls,
    ...(typeof server.username === "string" ? { username: server.username } : {}),
    ...(typeof server.credential === "string" ? { credential: server.credential } : {})
  }));
  return safe.length ? safe : [...FALLBACK_ICE_SERVERS];
}

function activeIceServers() {
  return normalizeIceServers(currentSession?.iceServers);
}

const FRAME_STALL_MS = 950;
const MONITOR_SWITCH_GRACE_MS = 1800;
const NEGOTIATION_GRACE_MS = 2500;

/* -----------------------------------------
   UI helpers
------------------------------------------ */

function setStatus(dotClass, label) {
  const text = String(label || "");
  const hideActiveStreamTag =
    text === "Streaming" ||
    text.startsWith("Streaming ·") ||
    text === "Switching…" ||
    text === "Switching...";

  const statusChip = elStatusLabel?.closest(".session-meta");
  if (statusChip) statusChip.style.display = hideActiveStreamTag ? "none" : "";

  if (elStatusDot) elStatusDot.className = dotClass || "";
  if (elStatusLabel) elStatusLabel.textContent = hideActiveStreamTag ? "" : text;
}

async function ensureRemoteVideoPlayback(reason = "") {
  if (!elVideo || !elVideo.srcObject) return false;
  elVideo.autoplay = true;
  elVideo.playsInline = true;
  elVideo.muted = true;
  elVideo.defaultMuted = true;
  elVideo.setAttribute("playsinline", "");
  elVideo.setAttribute("webkit-playsinline", "");
  try {
    await elVideo.play();
    return true;
  } catch (err) {
    console.warn("[video] play() deferred", { reason, error: err?.message || String(err) });
    return false;
  }
}

function armDecodedFrameReveal() {
  if (!elVideo || typeof elVideo.requestVideoFrameCallback !== "function") return;
  try {
    elVideo.requestVideoFrameCallback(() => {
      markFrameRendered();
      updateResolution();
      refreshRemoteCursorPosition();
    });
  } catch {}
}

function setOverlayMode(mode) {
  overlayMode = mode;
  if (!elOverlay) return;
  elOverlay.classList.toggle("passive", mode === "passive");
  elOverlay.classList.toggle("secure-black", mode === "secure-black");
  elOverlay.classList.toggle("silent", mode === "silent");
  elOverlay.classList.toggle("secure-black-silent", mode === "secure-black-silent");
  elOverlay.classList.toggle("transition-hold", mode === "transition-hold");
}

function showOverlay(title, sub, {
  spinner = false,
  error = "",
  keepVideo = false,
  passive = false,
  secureBlack = false,
  silent = false
} = {}) {
  if (elOverlay) elOverlay.classList.remove("hidden");
  setMobileViewControlsVisible(false);

  let mode = "hard";
  if (secureBlack && silent) mode = "secure-black-silent";
  else if (secureBlack) mode = "secure-black";
  else if (silent) mode = "silent";
  else if (passive) mode = "passive";

  setOverlayMode(mode);

  if (elVideo) {
    if (keepVideo) elVideo.classList.add("visible");
    else elVideo.classList.remove("visible");
  }

  if (elStatsBar) {
    if (keepVideo) elStatsBar.classList.add("visible");
    else elStatsBar.classList.remove("visible");
  }

  hideRemoteCursor();
  closeMonitorMenu();

  if (elOverlayTitle) elOverlayTitle.textContent = title || "";
  if (elOverlaySub) elOverlaySub.textContent = sub || "";

  if (elSpinner) elSpinner.style.display = spinner ? "block" : "none";
  if (elErrorDetail) {
    elErrorDetail.style.display = error ? "block" : "none";
    elErrorDetail.textContent = error || "";
  }
}

function showPassiveOverlay() {
  // Intentionally silent: keep the recovery logic, but do not show
  // transitional overlays for monitor switches, stream stalls, handshake,
  // or normal desktop return.
  passiveOverlayActive = false;
}

function showSecureBlackOverlay({ spinner = false } = {}) {
  passiveOverlayActive = false;
  if (hasEverRenderedFrame) {
    if (elOverlay) {
      elOverlay.classList.remove("hidden");
      setOverlayMode("transition-hold");
    }
    if (elOverlayTitle) elOverlayTitle.textContent = "";
    if (elOverlaySub) elOverlaySub.textContent = "";
    if (elSpinner) elSpinner.style.display = "none";
    if (elErrorDetail) {
      elErrorDetail.style.display = "none";
      elErrorDetail.textContent = "";
    }
    if (elVideo) elVideo.classList.add("visible");
    if (elStatsBar) elStatsBar.classList.add("visible");
    if (isMobileViewerSurface()) {
      setMobileViewControlsVisible(true);
      setMobileBottomActionsVisible(true);
      applyMobileViewport({ clamp: mobileViewZoom <= 1.001 });
    }
    hideRemoteCursor();
    return;
  }
  showOverlay("", "", { spinner, keepVideo: false, secureBlack: true, silent: true });
}

function clearSecureDesktopState() {
  secureDesktopActive = false;
  desktopHandoffActive = false;
  secureDesktopLikely = false;
  revealOnNextFrame = false;
}

function stopLoginDesktopWake() {
  if (loginDesktopWakeTimer) {
    clearTimeout(loginDesktopWakeTimer);
    loginDesktopWakeTimer = null;
  }
  loginDesktopWakeAttempts = 0;
}

function armLoginDesktopWake() {
  stopLoginDesktopWake();
  const attempt = () => {
    if (!currentSession || !loginDesktopInputActive) {
      stopLoginDesktopWake();
      return;
    }

    // Windows can expose a protected LockApp wallpaper before the credential
    // surface is capturable. A modifier-only key safely dismisses that layer
    // without inserting text into a credential field.
    sendInput('key_down', { code: 'ControlLeft', key: 'Control' }, true);
    window.setTimeout(() => {
      if (currentSession && loginDesktopInputActive) {
        sendInput('key_up', { code: 'ControlLeft', key: 'Control' }, true);
      }
    }, 35);

    loginDesktopWakeAttempts += 1;
    if (loginDesktopWakeAttempts < 4) {
      loginDesktopWakeTimer = window.setTimeout(attempt, 220);
    } else {
      loginDesktopWakeTimer = null;
    }
  };

  loginDesktopWakeTimer = window.setTimeout(attempt, 90);
}

function captureReconnectPoster() {
  if (!elVideo || !elVideo.videoWidth || !elVideo.videoHeight) return false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = elVideo.videoWidth;
    canvas.height = elVideo.videoHeight;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return false;
    ctx.drawImage(elVideo, 0, 0, canvas.width, canvas.height);
    elVideo.poster = canvas.toDataURL('image/jpeg', 0.84);
    return true;
  } catch {
    return false;
  }
}

function clearReconnectPoster() {
  if (!elVideo) return;
  try { elVideo.removeAttribute('poster'); } catch {}
}

function showLoginDesktopTransition() {
  passiveOverlayActive = false;
  if (elOverlay) {
    elOverlay.classList.remove("hidden");
    setOverlayMode("transition-hold");
  }
  if (elOverlayTitle) elOverlayTitle.textContent = "";
  if (elOverlaySub) elOverlaySub.textContent = "";
  if (elSpinner) elSpinner.style.display = "none";
  if (elErrorDetail) {
    elErrorDetail.style.display = "none";
    elErrorDetail.textContent = "";
  }
  if (elVideo) elVideo.classList.add("visible");
  if (elStatsBar) elStatsBar.classList.add("visible");
  if (isMobileViewerSurface()) {
    setMobileViewControlsVisible(true);
    setMobileBottomActionsVisible(true);
    applyMobileViewport({ clamp: mobileViewZoom <= 1.001 });
  }
  hideRemoteCursor();
}

function completeDesktopSourceTransition(reason = "desktop-source-ready") {
  clearSecureDesktopState();
  showStream();
  setStatus("online", "Streaming");
  ensureRemoteVideoPlayback(reason);
  armDecodedFrameReveal();
  requestRemoteKeyframe(reason);
}

function hideOverlay() {
  passiveOverlayActive = false;
  if (elOverlay) elOverlay.classList.add("hidden");
  setOverlayMode("hard");
}

function showStream() {
  hideOverlay();
  if (elVideo) elVideo.classList.add("visible");
  if (elStatsBar) elStatsBar.classList.add("visible");
  if (isMobileViewerSurface()) {
    applyViewerScalePreference();
    applyMobileViewport({ clamp: mobileViewZoom <= 1.001 });
    setMobileViewControlsVisible(true);
    setMobileBottomActionsVisible(true);
    updateMobileModeUi();
    requestMobileWakeLock();
    wakeMobileToolbar();
  }
}

function markFrameRendered() {
  clearReconnectPoster();
  const firstRenderedFrame = !hasEverRenderedFrame;
  if (isMobileViewerSurface()) {
    mobileRecoveryAttempts = 0;
    if (mobileRecoveryStage !== 'Idle') setMobileRecoveryStage('Idle');
  }
  hasEverRenderedFrame = true;
  lastFrameAtMs = Date.now();

  if (secureDesktopActive || desktopHandoffActive) {
    return;
  }

  if (firstRenderedFrame || revealOnNextFrame) {
    revealOnNextFrame = false;
    secureDesktopLikely = false;
    showStream();
    setStatus("online", "Streaming");
    return;
  }

  if (secureDesktopLikely || passiveOverlayActive) {
    secureDesktopLikely = false;
    showStream();
    setStatus("online", "Streaming");
  }
}

function updateResolution() {
  if (!elVideo) return;
  if (elVideo.videoWidth && elVideo.videoHeight && elStatRes) {
    elStatRes.textContent = `${elVideo.videoWidth}×${elVideo.videoHeight}`;
  }
  if (isMobileViewerSurface()) handleMobileViewportGeometryChange();
  refreshRemoteCursorPosition();
}
if (elVideo) elVideo.addEventListener("resize", updateResolution);

function physicalMonitorOrdinal(index) {
  const physicalMonitors = remoteMonitors.filter(m => m.index >= 0);
  return physicalMonitors.findIndex(m => m.index === index) + 1;
}

function getMonitorLabel(monitor) {
  if (!monitor) return "Monitors";
  if (monitor.index === -1) return "All Monitors";
  return `Monitor ${physicalMonitorOrdinal(monitor.index)}`;
}

function updateMonitorButton() {
  if (!elBtnMonitor) return;

  if (!currentSession || remoteMonitors.length === 0) {
    elBtnMonitor.disabled = true;
    elBtnMonitor.textContent = "Monitors";
    return;
  }

  const current = remoteMonitors.find(m => m.index === currentMonitorIndex) || remoteMonitors[0];
  if (!current) {
    elBtnMonitor.disabled = true;
    elBtnMonitor.textContent = "Monitors";
    return;
  }

  elBtnMonitor.textContent = getMonitorLabel(current);
  elBtnMonitor.title = current.name || getMonitorLabel(current);
  elBtnMonitor.disabled = remoteMonitors.length <= 1;
}

function requestMonitorSwitch(index, { persist = true } = {}) {
  const monitorIndex = Number(index);
  if (!ws || ws.readyState !== WebSocket.OPEN || !currentSession || !Number.isInteger(monitorIndex)) return false;
  if (monitorIndex === currentMonitorIndex && pendingMonitorIndex == null) {
    if (persist && isMobileViewerSurface()) { mobilePrefs.monitorIndex = monitorIndex; saveMobilePrefs(); }
    return true;
  }
  pendingMonitorIndex = monitorIndex;
  monitorSwitchUntilMs = Date.now() + MONITOR_SWITCH_GRACE_MS;
  ws.send(JSON.stringify({ type: 'switch_monitor', session_id: currentSession.sessionId, monitor_index: monitorIndex }));
  if (persist && isMobileViewerSurface()) { mobilePrefs.monitorIndex = monitorIndex; saveMobilePrefs(); }
  return true;
}

function renderMonitorMenu() {
  if (!elMonitorMenu) return;

  const items = remoteMonitors.filter(m => m.index !== currentMonitorIndex);

  elMonitorMenu.innerHTML = "";
  if (items.length === 0) return;

  for (const monitor of items) {
    const btn = document.createElement("button");
    btn.className = "monitor-item";
    btn.type = "button";

    const title = document.createElement("div");
    title.className = "monitor-title";
    title.textContent = getMonitorLabel(monitor);

    const sub = document.createElement("div");
    sub.className = "monitor-sub";
    sub.textContent = monitor.name || `${monitor.w}×${monitor.h}`;

    btn.appendChild(title);
    btn.appendChild(sub);

    btn.addEventListener("click", () => {
      requestMonitorSwitch(monitor.index, { persist: true });
      closeMonitorMenu();
    });

    elMonitorMenu.appendChild(btn);
  }
}

function clearMonitorMenuCloseTimer() {
  if (monitorMenuCloseTimer) {
    clearTimeout(monitorMenuCloseTimer);
    monitorMenuCloseTimer = null;
  }
}

function scheduleMonitorMenuClose() {
  clearMonitorMenuCloseTimer();
  monitorMenuCloseTimer = setTimeout(() => {
    closeMonitorMenu();
  }, 120);
}

function openMonitorMenu() {
  if (!elMonitorMenu || !currentSession) return;
  renderMonitorMenu();
  if (!elMonitorMenu.children.length) return;
  clearMonitorMenuCloseTimer();
  elMonitorMenu.classList.add("visible");
  monitorMenuOpen = true;
}

function closeMonitorMenu() {
  clearMonitorMenuCloseTimer();
  if (!elMonitorMenu) return;
  elMonitorMenu.classList.remove("visible");
  monitorMenuOpen = false;
}

/* -----------------------------------------
   Remote cursor overlay
------------------------------------------ */

function ensureRemoteCursor() {
  if (remoteCursorEl) return remoteCursorEl;

  remoteCursorEl = document.createElement("div");
  remoteCursorEl.id = "remote-cursor-overlay";
  remoteCursorEl.style.position = "fixed";
  remoteCursorEl.style.left = "0";
  remoteCursorEl.style.top = "0";
  remoteCursorEl.style.width = "28px";
  remoteCursorEl.style.height = "28px";
  remoteCursorEl.style.pointerEvents = "none";
  remoteCursorEl.style.zIndex = "99999";
  remoteCursorEl.style.display = "none";
  remoteCursorEl.style.transform = "translate3d(0, 0, 0)";
  remoteCursorEl.style.willChange = "transform";
  remoteCursorEl.style.filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.5))";

  remoteCursorEl.innerHTML = `
    <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible">
      <path d="M2 1 L2 22 L7.8 16.7 L11.6 25.4 L15.3 23.8 L11.5 15.2 L19.2 15.2 Z"
            fill="white" stroke="black" stroke-width="1.35" stroke-linejoin="round"/>
    </svg>
  `;

  document.body.appendChild(remoteCursorEl);
  return remoteCursorEl;
}

function hideRemoteCursor() {
  if (remoteCursorEl) {
    remoteCursorEl.style.display = "none";
  }
}

function moveRemoteCursorByClient(clientX, clientY) {
  if (isMobileViewerSurface()) { hideRemoteCursor(); return; }
  const cursor = ensureRemoteCursor();
  cursor.style.display = "block";
  cursor.style.transform = `translate3d(${Math.round(clientX)}px, ${Math.round(clientY)}px, 0)`;
}

async function openFileBrowserWindow() {
  if (isMobileViewerSurface()) wakeMobileToolbar();
  try {
    if (typeof window.hi5OpenFileBrowserWindow === "function") {
      await window.hi5OpenFileBrowserWindow("");
      return true;
    }
    if (typeof window.hi5?.openFileBrowserWindow === "function") {
      await window.hi5.openFileBrowserWindow();
      return true;
    }
  } catch (e) {
    console.warn("[files] native file browser open failed:", e);
  }

  if (elFilesPanel) elFilesPanel.classList.add("visible");
  return false;
}

async function closeFileBrowserWindow() {
  try {
    if (typeof window.hi5CloseFileBrowserWindow === "function") {
      await window.hi5CloseFileBrowserWindow("");
    } else if (typeof window.hi5?.closeFileBrowserWindow === "function") {
      await window.hi5.closeFileBrowserWindow();
    }
  } catch {}
  if (elFilesPanel) elFilesPanel.classList.remove("visible");
}

function postFileToNativeWindow(msg) {
  const json = JSON.stringify(msg || {});
  try {
    if (typeof window.hi5PostFileMessageToWindow === "function") {
      window.hi5PostFileMessageToWindow(json);
    } else if (typeof window.hi5?.postFileMessageToWindow === "function") {
      window.hi5.postFileMessageToWindow(json);
    }
  } catch (e) {
    console.warn("[files] post to native file window failed:", e);
  }
}

function updateConnectCapabilityButtons() {
  if (elBtnElevate) {
    const isConnect = !!currentSession?.isConnectSession;
    elBtnElevate.hidden = !isConnect;
    elBtnElevate.disabled = !isConnect || connectElevationPending || connectElevated || connectHostReconnecting || connectSessionHeld;
    const label = elBtnElevate.querySelector(".label");
    if (label) label.textContent = connectElevated ? "Admin active" : (connectElevationPending ? "Admin…" : "Admin");
    elBtnElevate.title = connectElevated
      ? "Administrator access is active"
      : (connectElevationPending ? "Waiting for customer approval" : "Request administrator access");
  }
  if (elBtnFiles && currentSession?.isConnectSession) {
    elBtnFiles.disabled = connectFilePermissionPending || connectHostReconnecting || connectSessionHeld;
    elBtnFiles.title = connectFileAccessGranted
      ? "Files"
      : (connectFilePermissionPending ? "Waiting for customer file-access approval" : "Request file access");
  }
  if (elBtnCad && currentSession?.isConnectSession) {
    elBtnCad.disabled = !connectElevated || connectElevationPending || connectHostReconnecting || connectSessionHeld;
    elBtnCad.title = connectElevated
      ? "Ctrl+Alt+Del"
      : "Administrator access is required for Ctrl+Alt+Del";
  }
}

function requestConnectPermission(permission) {
  if (!currentSession?.isConnectSession || !ws || ws.readyState !== WebSocket.OPEN) return false;
  const normalized = String(permission || "").toLowerCase();
  if (normalized === "files") {
    if (connectFileAccessGranted) return true;
    if (connectFilePermissionPending) return false;
    connectFilePermissionPending = true;
    setMobileFileStatus("Waiting for customer approval…");
    setStatus("", "Waiting for customer file-access approval…");
  } else if (normalized === "elevation") {
    if (connectElevated || connectElevationPending) return false;
    connectElevationPending = true;
    setStatus("", "Waiting for customer administrator approval…");
  } else {
    return false;
  }
  updateConnectCapabilityButtons();
  try {
    ws.send(JSON.stringify({
      type: "connect_permission_request",
      session_id: currentSession.sessionId,
      permission: normalized
    }));
    return true;
  } catch {
    if (normalized === "files") connectFilePermissionPending = false;
    if (normalized === "elevation") connectElevationPending = false;
    updateConnectCapabilityButtons();
    return false;
  }
}

function openFilesWithPermission() {
  if (!currentSession?.isConnectSession) {
    toggleFilesPanel(true);
    requestRemoteFileList(elFilePath?.value || "/");
    return;
  }
  if (!connectFileAccessGranted) {
    toggleFilesPanel(true);
    setMobileFileStatus("Ask the customer to approve file access.");
    requestConnectPermission("files");
    return;
  }
  toggleFilesPanel(true);
  requestRemoteFileList(elFilePath?.value || "/");
}

function requestConnectElevation() {
  if (!currentSession?.isConnectSession) return;
  if (connectElevated) {
    setStatus("online", "Administrator access active");
    return;
  }
  requestConnectPermission("elevation");
}

function toggleFilesPanel(force) {
  const open = typeof force === "boolean" ? force : true;
  if (open) openFileBrowserWindow(); else closeFileBrowserWindow();
}

function getChatBody(msg) {
  return String(
    msg?.body ??
    msg?.message ??
    msg?.text ??
    msg?.content ??
    ""
  ).trim();
}

function normalizeChatSender(sender) {
  const s = String(sender || "").toLowerCase();
  return (s === "tech" || s === "technician" || s === "viewer" || s === "me") ? "tech" : "user";
}

function createChatMessageId() {
  try { if (crypto?.randomUUID) return crypto.randomUUID(); } catch {}
  chatMessageSequence += 1;
  return `chat-${Date.now()}-${chatMessageSequence}`;
}

function chatMessageKey(msg) {
  const id = String(msg?.message_id || msg?.messageId || "").trim();
  if (id) return `id:${id}`;
  const body = getChatBody(msg);
  const sender = normalizeChatSender(msg?.sender);
  const stamp = String(msg?.unix_ms ?? msg?.timestamp ?? msg?.ts ?? "");
  return stamp ? `event:${sender}:${stamp}:${body}` : "";
}

function appendChatMessage(msg) {
  if (!msg) return null;
  const body = getChatBody(msg);
  if (!body) return null;
  const messageId = String(msg.message_id || msg.messageId || "").trim() || createChatMessageId();
  const normalized = {
    ...msg,
    message_id: messageId,
    messageId: messageId,
    sender: normalizeChatSender(msg.sender),
    body,
    message: body,
    text: body
  };
  const key = chatMessageKey(normalized);
  if (key && chatMessageKeys.has(key)) return null;
  if (key) chatMessageKeys.add(key);
  chatMessages.push(normalized);
  return normalized;
}

async function openTechChatWindow() {
  leaveRemoteControlMode();
  if (isMobileViewerSurface()) wakeMobileToolbar();
  if (isMobileViewerSurface()) toggleMobileKeyboard(false);
  try {
    if (typeof window.hi5OpenChatWindow === "function") {
      await window.hi5OpenChatWindow("");
      syncChatWindow();
      return true;
    }
    if (typeof window.hi5?.openChatWindow === "function") {
      await window.hi5.openChatWindow();
      syncChatWindow();
      return true;
    }
  } catch (e) {
    console.warn("[chat] native open chat failed:", e);
  }

  // Browser/mobile fallback: keep chat inside the Viewer and let the OS
  // keyboard own the text field instead of the remote keyboard interceptor.
  if (elChatPanel) elChatPanel.classList.add("visible");
  renderChat();
  if (isMobileViewerSurface() && elChatInput) {
    setTimeout(() => { try { elChatInput.focus({ preventScroll: true }); } catch { try { elChatInput.focus(); } catch {} } }, 60);
  }
  return false;
}

async function closeTechChatWindow() {
  try {
    if (typeof window.hi5CloseChatWindow === "function") {
      await window.hi5CloseChatWindow("");
    } else if (typeof window.hi5?.closeChatWindow === "function") {
      await window.hi5.closeChatWindow();
    }
  } catch {}
  if (elChatPanel) elChatPanel.classList.remove("visible");
}

function postChatToNativeWindow(msg) {
  const body = getChatBody(msg);
  if (!body) return;

  const payload = {
    ...msg,
    sender: normalizeChatSender(msg.sender),
    body,
    message: body,
    text: body
  };

  const json = JSON.stringify(payload);

  try {
    if (typeof window.hi5PostChatMessageToWindow === "function") {
      window.hi5PostChatMessageToWindow(json);
    } else if (typeof window.hi5?.postChatMessageToWindow === "function") {
      window.hi5.postChatMessageToWindow(json);
    }
  } catch (e) {
    console.warn("[chat] post to native chat window failed:", e);
  }
}

function syncChatWindow() {
  for (const msg of chatMessages) {
    postChatToNativeWindow(msg);
  }
}

function toggleChatPanel(force) {
  const open = typeof force === "boolean" ? force : true;
  if (open) {
    openTechChatWindow();
  } else {
    closeTechChatWindow();
  }
}

function renderChat() {
  if (!elChatLog) return;
  elChatLog.innerHTML = "";

  for (const msg of chatMessages) {
    const bodyText = getChatBody(msg);
    if (!bodyText) continue;

    const sender = normalizeChatSender(msg.sender);
    const item = document.createElement("div");
    item.className = `chat-bubble ${sender}`;

    const meta = document.createElement("div");
    meta.className = "chat-meta";
    meta.textContent = msg.display_name || msg.displayName || (sender === "tech" ? "Technician" : "Remote user");

    const body = document.createElement("div");
    body.className = "chat-body";
    body.textContent = bodyText;

    item.appendChild(meta);
    item.appendChild(body);
    elChatLog.appendChild(item);
  }

  elChatLog.scrollTop = elChatLog.scrollHeight;
}

function setMobileFileStatus(text) {
  if (elFileMobileStatus) elFileMobileStatus.textContent = text || "";
}

function updateFileTransferUi({ visible = true, percent = 0, canCancel = true, canRetry = false } = {}) {
  elFileTransferUi?.classList.toggle('visible', !!visible);
  if (elFileTransferProgress) elFileTransferProgress.style.width = Math.max(0, Math.min(100, Number(percent) || 0)) + '%';
  if (elFileTransferCancel) { elFileTransferCancel.style.display = canCancel ? '' : 'none'; elFileTransferCancel.disabled = !canCancel; }
  if (elFileTransferRetry) { elFileTransferRetry.style.display = canRetry ? '' : 'none'; elFileTransferRetry.disabled = !canRetry; }
}

function finishFileTransferUi(status, { retry = false } = {}) {
  setMobileFileStatus(status);
  updateFileTransferUi({ visible: true, percent: mobileFileTransfer?.progress || 0, canCancel: false, canRetry: retry });
}

function joinRemoteFilePath(base, name) {
  base = String(base || "/");
  name = String(name || "").replace(/^[\\/]+/, "");
  if (!base || base === "/") return "/" + name;
  if (/[\\/]$/.test(base)) return base + name;
  return base + (base.includes("\\") ? "\\" : "/") + name;
}

function base64ToBytes(data) {
  const bin = atob(String(data || ""));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes) {
  let bin = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + step)));
  }
  return btoa(bin);
}

function saveBrowserFile(name, parts) {
  const blob = new Blob(parts, { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name || "download";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

const browserDownloadPaths = new Set();
const browserChunkDownloads = new Map();

function requestBrowserDownload(entry) {
  const path = String(entry?.path || "");
  if (!path) return;
  browserDownloadPaths.add(path);
  mobileFileTransfer = { type: 'download', entry: { ...entry }, path, progress: 0, cancelled: false };
  setMobileFileStatus(`Downloading ${entry.name || "file"}…`);
  updateFileTransferUi({ visible: true, percent: 0, canCancel: true, canRetry: false });
  if (!sendRemoteFileRequest("remote_file_download_request", { path })) {
    browserDownloadPaths.delete(path);
    setMobileFileStatus("Could not start download.");
  }
}

async function uploadBrowserFiles(files) {
  const list = Array.from(files || []);
  if (!list.length) return;
  mobileFileTransfer = { type: 'upload', files: list, progress: 0, cancelled: false, transferId: '', path: '' };
  updateFileTransferUi({ visible: true, percent: 0, canCancel: true, canRetry: false });
  const inlineBytes = 384 * 1024;
  const chunkBytes = 48 * 1024;
  for (const file of list) {
    if (mobileFileTransfer?.cancelled) return;
    const dest = joinRemoteFilePath(remoteFilePath, file.name);
    if (mobileFileTransfer) mobileFileTransfer.path = dest;
    setMobileFileStatus(`Uploading ${file.name}…`);
    if (file.size <= inlineBytes) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!sendRemoteFileRequest("remote_file_upload_request", { path: dest, data: bytesToBase64(bytes) })) {
        setMobileFileStatus(`Could not upload ${file.name}.`);
        break;
      }
      continue;
    }
    const transferId = `ul-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    if (mobileFileTransfer) mobileFileTransfer.transferId = transferId;
    if (!sendRemoteFileRequest("remote_file_upload_start", { transfer_id: transferId, path: dest, name: file.name, size: file.size })) {
      setMobileFileStatus(`Could not start upload for ${file.name}.`);
      break;
    }
    let offset = 0;
    let chunkIndex = 0;
    while (offset < file.size) {
      if (mobileFileTransfer?.cancelled) {
        sendRemoteFileRequest('remote_file_upload_cancel', { transfer_id: transferId, path: dest });
        finishFileTransferUi('Upload cancelled.', { retry: true });
        return;
      }
      const end = Math.min(file.size, offset + chunkBytes);
      const bytes = new Uint8Array(await file.slice(offset, end).arrayBuffer());
      if (!sendRemoteFileRequest("remote_file_upload_chunk", { transfer_id: transferId, path: dest, chunk_index: chunkIndex++, offset, size: bytes.length, data: bytesToBase64(bytes) })) {
        setMobileFileStatus(`Upload interrupted for ${file.name}.`);
        return;
      }
      offset = end;
      const pct = Math.round(offset / file.size * 100);
      if (mobileFileTransfer) mobileFileTransfer.progress = pct;
      setMobileFileStatus(`Uploading ${file.name}… ${pct}%`);
      updateFileTransferUi({ visible: true, percent: pct, canCancel: true, canRetry: false });
      if ((chunkIndex % 8) === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    sendRemoteFileRequest("remote_file_upload_complete_request", { transfer_id: transferId, path: dest, size: file.size });
  }
}

function renderRemoteFiles() {
  if (!elFileList) return;
  elFileList.innerHTML = "";
  for (const entry of remoteFileEntries) {
    const row = document.createElement("div");
    row.className = "file-entry";
    const main = document.createElement("div");
    main.className = "file-main";
    const title = document.createElement("div");
    title.textContent = `${entry.is_dir ? "📁" : "📄"} ${entry.name}`;
    const meta = document.createElement("div");
    meta.className = "file-meta";
    meta.textContent = entry.is_dir ? "Folder" : `${entry.size || 0} bytes`;
    main.appendChild(title);
    main.appendChild(meta);
    row.appendChild(main);
    if (entry.is_dir) {
      row.addEventListener("click", () => requestRemoteFileList(entry.path || entry.name));
    } else {
      const dl = document.createElement("button");
      dl.className = "file-download";
      dl.type = "button";
      dl.textContent = "Download";
      dl.addEventListener("click", (ev) => { ev.stopPropagation(); requestBrowserDownload(entry); });
      row.appendChild(dl);
    }
    elFileList.appendChild(row);
  }
}

function sendRemoteFileRequest(fileType, payload = {}) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !currentSession) return false;
  if (currentSession.isConnectSession && !connectFileAccessGranted) {
    requestConnectPermission("files");
    return false;
  }

  const directPayload = {
    type: fileType,
    session_id: currentSession.sessionId,
    sessionId: currentSession.sessionId,
    ...payload
  };

  // Direct file-browser path only. The control server now forwards remote_file_*
  // and file_transfer_* messages, so do not tunnel through chat_message.
  try { ws.send(JSON.stringify(directPayload)); } catch { return false; }
  return true;
}

function normalizeFileMessage(msg) {
  if (!msg) return null;
  if (msg.channel === "file_browser") {
    const nested = msg.payload && typeof msg.payload === "object" ? msg.payload : {};
    return { ...msg, ...nested, type: msg.file_type || msg.fileType || nested.type };
  }
  return msg;
}

function requestRemoteFileList(path) {
  remoteFilePath = path || "/";
  if (elFilePath) elFilePath.value = remoteFilePath;
  sendRemoteFileRequest("remote_file_list_request", { path: remoteFilePath });
}

const pendingRemoteDownloads = new Map();

window.__hi5FilesRequestRemoteList = function(path) {
  requestRemoteFileList(path || "/");
};

window.__hi5FilesUploadRemote = function(req) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !currentSession || !req) return false;
  return sendRemoteFileRequest("remote_file_upload_request", { path: req.path, data: req.data || "" });
};

window.__hi5FilesDownloadRemote = function(req) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !currentSession || !req) return false;
  if (req.local_dir) pendingRemoteDownloads.set(String(req.path || ""), String(req.local_dir));
  return sendRemoteFileRequest("remote_file_download_request", { path: req.path });
};

window.__hi5FilesDeleteRemote = function(path) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !currentSession) return false;
  return sendRemoteFileRequest("remote_file_delete_request", { path });
};

window.__hi5FilesMkdirRemote = function(path) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !currentSession) return false;
  return sendRemoteFileRequest("remote_file_mkdir_request", { path });
};

window.__hi5FilesRenameRemote = function(req) {
  if (!ws || ws.readyState !== WebSocket.OPEN || !currentSession || !req) return false;
  return sendRemoteFileRequest("remote_file_rename_request", { from: req.from, to: req.to });
};

function sendChatMessageBody(body) {
  body = String(body || "").trim();
  if (!body || !ws || ws.readyState !== WebSocket.OPEN || !currentSession) return false;

  const messageId = createChatMessageId();
  const payload = {
    type: "chat_message",
    session_id: currentSession.sessionId,
    sessionId: currentSession.sessionId,
    message_id: messageId,
    messageId: messageId,
    sender: "tech",
    display_name: "Technician",
    displayName: "Technician",
    body,
    message: body,
    text: body
  };

  ws.send(JSON.stringify(payload));

  const appended = appendChatMessage(payload);
  if (appended) {
    renderChat();
    postChatToNativeWindow(appended);
  }
  return true;
}

function sendChatMessage() {
  const body = (elChatInput?.value || "").trim();
  if (!sendChatMessageBody(body)) return;
  if (elChatInput) {
    elChatInput.value = "";
    try { elChatInput.focus(); } catch {}
  }
}

window.__hi5ChatSendFromNative = function(body) {
  return sendChatMessageBody(body);
};

function showRemoteCursor() {
  if (isMobileViewerSurface()) { hideRemoteCursor(); return; }
  const el = ensureRemoteCursor();
  el.style.display = "block";
}

function getVideoContentRect(el) {
  const rect = el.getBoundingClientRect();
  const objectFit = String(getComputedStyle(el).objectFit || "fill").toLowerCase();

  if (objectFit === "fill") {
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }

  const vw = el.videoWidth || 1;
  const vh = el.videoHeight || 1;
  const elementAspect = rect.width / rect.height;
  const videoAspect = vw / vh;

  let drawWidth, drawHeight, offsetX, offsetY;
  if (elementAspect > videoAspect) {
    drawHeight = rect.height;
    drawWidth = drawHeight * videoAspect;
    offsetX = (rect.width - drawWidth) / 2;
    offsetY = 0;
  } else {
    drawWidth = rect.width;
    drawHeight = drawWidth / videoAspect;
    offsetX = 0;
    offsetY = (rect.height - drawHeight) / 2;
  }

  return {
    left: rect.left + offsetX,
    top: rect.top + offsetY,
    width: drawWidth,
    height: drawHeight
  };
}

function moveRemoteCursorByNorm(xNorm, yNorm) {
  if (!elVideo || !elVideo.videoWidth || !elVideo.videoHeight) return;

  lastCursorNorm = {
    x_norm: Math.max(0, Math.min(1, xNorm)),
    y_norm: Math.max(0, Math.min(1, yNorm))
  };

  const r = getVideoContentRect(elVideo);
  const x = r.left + (lastCursorNorm.x_norm * r.width);
  const y = r.top + (lastCursorNorm.y_norm * r.height);

  moveRemoteCursorByClient(x, y);
}

function refreshRemoteCursorPosition() {
  if (!lastCursorNorm) return;
  moveRemoteCursorByNorm(lastCursorNorm.x_norm, lastCursorNorm.y_norm);
}

/* -----------------------------------------
   Cleanup / control mode
------------------------------------------ */

function stopStatsPoll() {
  if (statsTimer) {
    clearInterval(statsTimer);
    statsTimer = null;
  }
  if (transitionWatchdogTimer) {
    clearInterval(transitionWatchdogTimer);
    transitionWatchdogTimer = null;
  }
  lastStats = { tsMs: 0, bytes: 0, frames: 0, packetsLost: 0, packetsReceived: 0, jitterDelay: 0, jitterEmitted: 0 };
  lastFramesDecoded = 0;
}

function startTransitionWatchdog() {
  if (transitionWatchdogTimer) return;

  transitionWatchdogTimer = setInterval(() => {
    if (!pc || pc.connectionState !== "connected") return;

    const now = Date.now();

    if (!hasEverRenderedFrame) {
      if (lastFrameAtMs && now >= lastFrameAtMs) {
        requestRemoteKeyframe("initial-frame-timeout");
        ensureRemoteVideoPlayback("initial-frame-timeout");
      }
      return;
    }

    if (monitorSwitchUntilMs && now < monitorSwitchUntilMs) {
      return;
    }

    if (secureDesktopActive || desktopHandoffActive) {
      return;
    }

    const stalledFor = now - lastFrameAtMs;
    if (stalledFor > FRAME_STALL_MS) {
      // The Agent intentionally skips unchanged desktop frames. A static screen
      // can therefore have no decoded frames for an arbitrary period while the
      // WebRTC transport is completely healthy. Never escalate frame age alone
      // into a session reconnect; only ICE/signaling/network state may do that.
      secureDesktopLikely = true;
      requestRemoteKeyframe('decoded-frame-stall');
      ensureRemoteVideoPlayback('decoded-frame-stall');
      if (stalledFor > 2400) armDecodedFrameReveal();
    }
  }, 250);
}

function enterRemoteControlMode() {
  controlActive = true;
  if (elVideo) {
    elVideo.style.cursor = "none";
    try { elVideo.focus(); } catch {}
  }
  showRemoteCursor();
  refreshRemoteCursorPosition();
}

function requestRemoteKeyframe(reason = "viewer-recovery") {
  if (!currentSession || !inputDc || inputDc.readyState !== "open") return false;
  const now = Date.now();
  if (now - lastKeyframeRequestAtMs < 1200) return false;
  lastKeyframeRequestAtMs = now;
  try {
    inputDc.send(JSON.stringify({ kind: "request_keyframe", reason }));
    console.log("[video] requested remote keyframe", { reason });
    return true;
  } catch (err) {
    console.warn("[video] keyframe request failed", err);
    return false;
  }
}

function sendFastMouseMove(extra = {}) {
  if (!mouseMoveDc || mouseMoveDc.readyState !== "open") return false;
  const x = Number(extra.x_norm);
  const y = Number(extra.y_norm);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  try {
    const buffer = new ArrayBuffer(21);
    const view = new DataView(buffer);
    mouseMoveSeq = (mouseMoveSeq + 1) >>> 0;
    view.setUint8(0, 1);
    view.setUint32(1, mouseMoveSeq, true);
    view.setFloat32(5, Math.max(0, Math.min(1, x)), true);
    view.setFloat32(9, Math.max(0, Math.min(1, y)), true);
    view.setFloat64(13, performance.now(), true);
    mouseMoveDc.send(buffer);
    return true;
  } catch {
    return false;
  }
}

function sendControlObject(message) {
  const payload = JSON.stringify(message || {});
  const channels = [inputControlDc, inputDc];
  for (const channel of channels) {
    if (!channel || channel.readyState !== 'open') continue;
    try { channel.send(payload); return true; } catch {}
  }
  return false;
}

function sendViewerStreamProfile() {
  if (!currentSession) return false;
  const profile = mobileStreamProfilePayload();
  return sendControlObject({ kind: 'viewer_stream_profile', viewer_client: isMobileViewerSurface() ? 'mobile' : 'desktop', ...profile });
}

function sendInput(kind, extra = {}, force = false) {
  if (!currentSession) return;
  if (!force && !controlActive) return;
  if (!force && (secureDesktopActive || desktopHandoffActive) && !loginDesktopInputActive) return;

  if (kind === 'mouse_move' && sendFastMouseMove(extra)) return;

  // Mobile Safari reliably carries the high-rate binary pointer channel, but
  // some Connect sessions open the reliable input-control SCTP channel without
  // delivering tap/key payloads. For attended Connect on mobile, keep pointer
  // movement on WebRTC and route actual controls over the authenticated
  // signaling WebSocket instead. These messages are tiny and latency-insensitive
  // compared with mouse movement.
  const useConnectMobileWsControl =
    Boolean(currentSession.isConnectSession) &&
    isMobileViewerSurface() &&
    kind !== 'mouse_move';

  if (!useConnectMobileWsControl) {
    const payload = JSON.stringify({ kind, ...extra });
    const channel = inputControlDc && inputControlDc.readyState === 'open' ? inputControlDc : inputDc;
    if (channel && channel.readyState === "open") {
      channel.send(payload);
      return;
    }
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: "input_event",
      kind,
      session_id: currentSession.sessionId,
      ...extra,
    }));
  }
}

async function pastePhoneClipboardToRemote() {
  let text = '';
  try { text = await navigator.clipboard.readText(); } catch {}
  if (!text) text = String(elMobileTextInput?.value || '');
  if (!text) {
    setMobileClipboardStatus('Clipboard is empty or unavailable.');
    return;
  }
  enterRemoteControlMode();
  sendInput('clipboard_paste', { text }, true);
  setMobileClipboardStatus('Pasted clipboard to remote.');
  scheduleMobileToolbarHide();
}

function requestRemoteClipboard() {
  if (!currentSession) return;
  mobileClipboardRequestPending = true;
  setMobileClipboardStatus('Copying remote selection…');
  enterRemoteControlMode();
  sendInput('clipboard_get', {}, true);
}

async function handleViewerControlMessage(raw) {
  let msg = null;
  try { msg = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(new TextDecoder().decode(raw)); } catch { return; }
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'clipboard_result') {
    mobileClipboardRequestPending = false;
    const text = String(msg.text || '');
    if (!msg.ok) {
      setMobileClipboardStatus('Remote clipboard could not be read.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setMobileClipboardStatus('Remote clipboard copied to this device.');
    } catch {
      if (elMobileTextInput) {
        elMobileTextInput.value = text;
        try { elMobileTextInput.focus({ preventScroll: true }); elMobileTextInput.select(); } catch {}
      }
      setMobileClipboardStatus('Remote clipboard loaded below — use Copy if prompted by iOS.');
    }
  } else if (msg.type === 'viewer_stream_profile_result') {
    console.log('[mobile] stream profile', msg);
  }
}

elMobileClipboardPaste?.addEventListener('click', pastePhoneClipboardToRemote);
elMobileClipboardCopy?.addEventListener('click', requestRemoteClipboard);

function updateSessionToggleButtons() {
  if (elBtnAudio) {
    elBtnAudio.classList.toggle("session-toggle-active", audioEnabled);
    elBtnAudio.innerHTML = `${audioEnabled ? "🔊" : "🔇"}<span class="label">Audio</span>`;
    elBtnAudio.title = audioEnabled ? "Mute remote audio" : "Play remote audio";
  }
  if (elBtnBlockInput) {
    elBtnBlockInput.classList.toggle("session-toggle-active", localInputBlocked);
    elBtnBlockInput.innerHTML = `${localInputBlocked ? "🔒" : "🔓"}<span class="label">User input</span>`;
    elBtnBlockInput.title = localInputBlocked
      ? "Allow the local user's keyboard and mouse"
      : "Block the local user's keyboard and mouse";
  }
}

function setRemoteAudioEnabled(enabled) {
  audioEnabled = !!enabled;
  if (elAudio) {
    elAudio.muted = !audioEnabled;
    elAudio.defaultMuted = !audioEnabled;
    if (audioEnabled) elAudio.play().catch(() => {});
  }
  updateSessionToggleButtons();
}

function setLocalInputBlocked(blocked, notifyAgent = true) {
  localInputBlocked = !!blocked;
  if (notifyAgent && currentSession) {
    sendInput("local_input_block", { blocked: localInputBlocked }, true);
  }
  updateSessionToggleButtons();
}

function sendShortcut(action) {
  if (!currentSession) return false;
  enterRemoteControlMode();

  // Ctrl+Alt+Del is special: send a dedicated service-side command first,
  // then also send the normal shortcut as a nested/VM fallback.
  if (action === "ctrl_alt_del" || action === "ctrl_alt_del_service" || action === "sas") {
    const servicePayload = {
      type: "service_shortcut",
      kind: "service_shortcut",
      action: "ctrl_alt_del_service",
      session_id: currentSession.sessionId,
    };

    try {
      if (inputDc && inputDc.readyState === "open") {
        inputDc.send(JSON.stringify(servicePayload));
        return true;
      }
    } catch {}

    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(servicePayload));
        return true;
      }
    } catch {}

    return false;
  }

  sendInput("shortcut", { action }, true);
  return true;
}

const NON_TEXT_KEYS = new Set([
  "Alt", "AltGraph", "CapsLock", "Control", "Dead", "Delete", "End",
  "Enter", "Escape", "Fn", "FnLock", "Home", "Hyper", "Insert",
  "Meta", "NumLock", "OS", "PageDown", "PageUp", "Process",
  "ScrollLock", "Shift", "Super", "Symbol", "SymbolLock",
  "Tab", "Unidentified", "ContextMenu", "Pause", "PrintScreen"
]);

function isModifierCode(code) {
  return code === "ShiftLeft" || code === "ShiftRight" ||
    code === "ControlLeft" || code === "ControlRight" ||
    code === "AltLeft" || code === "AltRight" ||
    code === "MetaLeft" || code === "MetaRight";
}

function isPrintableKey(ev) {
  if (!ev || ev.metaKey) return false;
  const altGraph = !!ev.getModifierState?.("AltGraph");
  // Browsers commonly expose AltGr as Ctrl+Alt. When AltGraph produced a
  // printable character, send the actual Unicode character instead of a
  // physical US-layout key combination.
  if ((ev.ctrlKey || ev.altKey) && !altGraph) return false;
  if (isModifierCode(ev.code)) return false;
  if (typeof ev.key !== "string") return false;
  if (ev.key.length === 0) return false;
  if (NON_TEXT_KEYS.has(ev.key)) return false;
  return Array.from(ev.key).length === 1;
}

window.__hi5NativeShortcut = function(action) {
  try {
    if (typeof action === "string" && action.length > 0) {
      releaseAllKeys();
      sendShortcut(action);
      return true;
    }
  } catch (err) {
    console.warn("[viewer] native shortcut dispatch failed", err);
  }
  return false;
};

function sendBackstageMode(enabled) {
  if (!currentSession) return false;
  const targetMode = enabled ? "backstage" : "console";
  if (currentSession.launchMode && currentSession.launchMode !== targetMode) {
    console.warn("[viewer] remote mode switch rejected by immutable session mode", { launchMode: currentSession.launchMode, targetMode });
    return false;
  }

  const type = enabled ? "backstage_start" : "backstage_stop";
  const payload = JSON.stringify({
    type,
    kind: type,
    session_id: currentSession.sessionId,
  });

  let sent = false;

  // Prefer the established WebRTC data channel. The control server may not
  // forward new viewer->agent message types, but the data channel goes direct
  // to the agent's active session input handler.
  if (inputDc && inputDc.readyState === "open") {
    try {
      inputDc.send(payload);
      sent = true;
      console.log("[backstage] sent over datachannel", { type });
    } catch (err) {
      console.warn("[backstage] datachannel send failed", err);
    }
  }

  // Fallback for older agents/control servers.
  if (!sent && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, session_id: currentSession.sessionId }));
    sent = true;
    console.log("[backstage] sent over websocket fallback", { type });
  }

  if (!sent) return false;

  setStatus("online", enabled ? "Backstage Desktop" : "Streaming");
  if (enabled) {
    showOverlay("Backstage Desktop", "Starting private tools workspace…", { spinner: true, keepVideo: true, passive: true });
  } else {
    showOverlay("Console", "Returning to interactive console…", { spinner: true, keepVideo: true, passive: true });
  }
  return true;
}

function releaseAllKeys() {
  if (!currentSession) {
    pressedKeys.clear();
    return;
  }

  for (const code of Array.from(pressedKeys)) {
    sendInput("key_up", { code }, true);
  }
  pressedKeys.clear();
}

function leaveRemoteControlMode() {
  releaseAllKeys();
  controlActive = false;

  if (elVideo) {
    elVideo.style.cursor = "default";
  }
  hideRemoteCursor();
}

function resetTransitionState() {
  hasEverRenderedFrame = false;
  lastFrameAtMs = 0;
  lastFramesDecoded = 0;
  passiveOverlayActive = false;
  secureDesktopLikely = false;
  secureDesktopActive = false;
  desktopHandoffActive = false;
  loginDesktopInputActive = false;
  stopLoginDesktopWake();
  revealOnNextFrame = false;
  monitorSwitchUntilMs = 0;
  lastKeyframeRequestAtMs = 0;
  overlayMode = "hard";
}

function disconnect(reason, options = {}) {
  const silent = !!options.silent;
  const closeNative = !!options.closeNative;
  console.log("[viewer] disconnect called:", reason || "(none)", silent ? "silent" : "", closeNative ? "close-native" : "");
  stopStatsPoll();

  remoteDescSet = false;
  pendingRemoteIce = [];
  lastCursorNorm = null;

  remoteMonitors = [];
  currentMonitorIndex = 0;
  pendingMonitorIndex = null;
  mobilePreferredMonitorApplied = false;
  updateMonitorButton();
  closeMonitorMenu();

  leaveRemoteControlMode();
  hideRemoteCursor();
  hideMobilePrecisionLoupe();
  if (elMobilePointerReticle) elMobilePointerReticle.style.display = 'none';
  if (elMobileScrollRail) elMobileScrollRail.classList.remove('visible');
  setMobileViewControlsVisible(false);
  setMobileBottomActionsVisible(false);
  elMobileQualityIndicator?.classList.remove('visible');
  releaseMobileWakeLock();
  if (mobileToolbarTimer) { clearTimeout(mobileToolbarTimer); mobileToolbarTimer = null; }
  document.body.classList.remove('mobile-toolbar-collapsed');
  mobilePanMode = false;
  mobilePrecisionMode = false;
  mobileEdgeTouchIds.clear();
  mobileGestureLifecycleReset = null;
  if (mobileBrowserGestureRecoveryTimer) { clearTimeout(mobileBrowserGestureRecoveryTimer); mobileBrowserGestureRecoveryTimer = null; }
  if (mobileReconnectTimer) { clearTimeout(mobileReconnectTimer); mobileReconnectTimer = null; }
  clearMobileTransportProbe();
  mobileReconnectDeadline = 0;
  mobileReconnectCooldownUntil = 0;
  mobileEndpointRestartUntil = 0;
  mobileRecoveryAttempts = 0;
  connectFileAccessGranted = false;
  connectFilePermissionPending = false;
  connectElevationPending = false;
  connectElevated = false;
  connectHostReconnecting = false;
  connectSessionHeld = false;
  resetTransitionState();

  if (localInputBlocked && currentSession) {
    try { sendInput("local_input_block", { blocked: false }, true); } catch {}
    localInputBlocked = false;
  }
  setRemoteAudioEnabled(false);
  updateSessionToggleButtons();

  if (!silent && ws && ws.readyState === WebSocket.OPEN && currentSession) {
    try {
      ws.send(JSON.stringify({
        type: "chat_close",
        session_id: currentSession.sessionId,
        close_remote: true,
        reason: reason || "viewer_disconnect"
      }));
    } catch {}
    try {
      ws.send(JSON.stringify({
        type: "viewer_disconnected",
        session_id: currentSession.sessionId
      }));
    } catch {}
  }

  try { closeTechChatWindow(); } catch {}

  if (inputDc) { try { inputDc.close(); } catch {} inputDc = null; }
  if (inputControlDc) { try { inputControlDc.close(); } catch {} inputControlDc = null; }
  if (mouseMoveDc) { try { mouseMoveDc.close(); } catch {} mouseMoveDc = null; }

  if (pc) {
    try { pc.close(); } catch {}
    pc = null;
  }
  if (ws) {
    try { ws.onopen = null; ws.onmessage = null; ws.onerror = null; ws.onclose = null; } catch {}
    try { ws.close(); } catch {}
    ws = null;
  }

  if (elVideo) {
    try { elVideo.pause(); } catch {}
    elVideo.srcObject = null;
    clearReconnectPoster();
    elVideo.classList.remove("visible");
  }

  if (elBtnDisc) elBtnDisc.disabled = true;
  if (elBtnElevate) { elBtnElevate.disabled = true; elBtnElevate.hidden = true; }
  if (elBtnFiles) elBtnFiles.disabled = true;
  if (elBtnChat) elBtnChat.disabled = true;
  if (elBtnAudio) elBtnAudio.disabled = true;
  if (elBtnBlockInput) elBtnBlockInput.disabled = true;
  if (elBtnKeyboard) elBtnKeyboard.disabled = true;
  if (elMobileClipboardPaste) elMobileClipboardPaste.disabled = true;
  if (elMobileClipboardCopy) elMobileClipboardCopy.disabled = true;
  if (mobileKeyboardOpen) toggleMobileKeyboard(false);
  if (elBtnBackstage) elBtnBackstage.disabled = true;
  if (elBtnConsole) elBtnConsole.disabled = true;
  if (elBtnStartMenu) elBtnStartMenu.disabled = true;
  if (elBtnCad) elBtnCad.disabled = true;
  if (elDeviceLabel) elDeviceLabel.textContent = "";
  currentSession = null;

  if (!silent) releaseMobileHistoryGuard();

  setStatus("", reason || "Disconnected");
  showOverlay(
    reason ? "Disconnected" : "Hi5Central Viewer",
    reason || "Launch this app from Hi5Central to start a remote desktop session."
  );

  if (!silent) {
    try { window.hi5?.notifyDisconnected?.(); } catch {}
  }
  if (closeNative) {
    try { window.hi5?.closeViewer?.(); } catch {}
  }
}

window.__hi5NativeCloseRequested = function() {
  disconnect("Disconnected by technician", { closeNative: true });
};

if (elBtnDisc) {
  elBtnDisc.addEventListener("click", () => disconnect("Disconnected by technician", { closeNative: true }));
}
if (elBtnAudio) {
  elBtnAudio.addEventListener("click", () => setRemoteAudioEnabled(!audioEnabled));
}
if (elBtnBlockInput) {
  elBtnBlockInput.addEventListener("click", () => setLocalInputBlocked(!localInputBlocked, true));
}

if (elBtnMonitor) {
  elBtnMonitor.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (monitorMenuOpen) {
      closeMonitorMenu();
    } else {
      openMonitorMenu();
    }
  });

  elBtnMonitor.addEventListener("mouseenter", () => {
    if (currentSession && remoteMonitors.length > 1) {
      openMonitorMenu();
    }
  });

  elBtnMonitor.addEventListener("mouseleave", () => {
    scheduleMonitorMenuClose();
  });
}

if (elMonitorMenu) {
  elMonitorMenu.addEventListener("mouseenter", () => {
    clearMonitorMenuCloseTimer();
  });

  elMonitorMenu.addEventListener("mouseleave", () => {
    scheduleMonitorMenuClose();
  });
}

document.addEventListener("click", (ev) => {
  if (!monitorMenuOpen) return;
  if (elMonitorMenu?.contains(ev.target)) return;
  if (elBtnMonitor?.contains(ev.target)) return;
  closeMonitorMenu();
});

/* -----------------------------------------
   Stats
------------------------------------------ */

function startStatsPoll() {
  if (statsTimer) return;
  statsTimer = setInterval(() => pollStatsOnce().catch(() => {}), 1000);
  startTransitionWatchdog();
}

function fmtKbps(kbps) {
  if (!isFinite(kbps) || kbps < 0) return "—";
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(2)} Mbps`;
  return `${Math.round(kbps)} kbps`;
}

async function pollStatsOnce() {
  if (!pc) return;
  const stats = await pc.getStats();

  let inbound = null;
  let selectedPair = null;

  stats.forEach((r) => {
    if (r.type === "inbound-rtp") {
      const isVideo = (r.kind === "video") || (r.mediaType === "video");
      if (isVideo) inbound = r;
    }
    if (r.type === "candidate-pair" && r.nominated && (r.state === "succeeded" || r.state === "in-progress")) {
      selectedPair = r;
    }
  });

  const nowMs = Date.now();

  let bitrateKbps = NaN;
  let fps = NaN;
  let framesDecoded = null;
  let packetsLost = null;
  let packetsReceived = null;
  let lossRate = 0;
  let packetSampleCount = 0;
  let packetsLostDelta = 0;
  let jitterMs = null;
  let jitterBufferMs = null;

  if (inbound) {
    const bytesReceived = Number(inbound.bytesReceived || 0);
    framesDecoded = Number(inbound.framesDecoded || 0);
    packetsLost = Number(inbound.packetsLost || 0);
    packetsReceived = Number(inbound.packetsReceived || 0);
    jitterMs = Number.isFinite(Number(inbound.jitter)) ? Number(inbound.jitter) * 1000 : null;
    const jitterDelay = Number(inbound.jitterBufferDelay || 0);
    const jitterEmitted = Number(inbound.jitterBufferEmittedCount || 0);
    if (jitterEmitted > lastStats.jitterEmitted) {
      const emittedDelta = jitterEmitted - lastStats.jitterEmitted;
      const delayDelta = jitterDelay - lastStats.jitterDelay;
      if (emittedDelta > 0 && delayDelta >= 0) jitterBufferMs = (delayDelta / emittedDelta) * 1000;
    }

    if (framesDecoded > lastFramesDecoded) {
      lastFramesDecoded = framesDecoded;
      markFrameRendered();
      if (monitorSwitchUntilMs && nowMs >= monitorSwitchUntilMs) {
        monitorSwitchUntilMs = 0;
      }
    }

    if (lastStats.tsMs) {
      const dt = (nowMs - lastStats.tsMs) / 1000;
      if (dt > 0.2) {
        const dBytes = bytesReceived - lastStats.bytes;
        bitrateKbps = (dBytes * 8) / dt / 1000;

        const dFrames = framesDecoded - lastStats.frames;
        fps = dFrames / dt;
        const dLost = Math.max(0, packetsLost - lastStats.packetsLost);
        const dReceived = Math.max(0, packetsReceived - lastStats.packetsReceived);
        const dTotal = dLost + dReceived;
        packetsLostDelta = dLost;
        packetSampleCount = dTotal;
        lossRate = dTotal > 0 ? dLost / dTotal : 0;
      }
    }

    lastStats.tsMs = nowMs;
    lastStats.bytes = bytesReceived;
    lastStats.frames = framesDecoded;
    lastStats.packetsLost = packetsLost;
    lastStats.packetsReceived = packetsReceived;
    lastStats.jitterDelay = jitterDelay;
    lastStats.jitterEmitted = jitterEmitted;
  }

  const rttMs = selectedPair && isFinite(selectedPair.currentRoundTripTime)
    ? Math.round(selectedPair.currentRoundTripTime * 1000)
    : null;

  // Diagnostics are advisory and should never fall back to the signaling WebSocket
  // as an input event. Send them only on the established WebRTC control channel.
  if (inputDc && inputDc.readyState === "open") {
    try {
      inputDc.send(JSON.stringify({
        kind: "viewer_diagnostics",
        rtt_ms: rttMs ?? 0,
        jitter_ms: Number.isFinite(jitterMs) ? jitterMs : 0,
        jitter_buffer_ms: Number.isFinite(jitterBufferMs) ? jitterBufferMs : 0,
        bitrate_kbps: Number.isFinite(bitrateKbps) ? bitrateKbps : 0,
        fps: Number.isFinite(fps) ? fps : 0,
        packets_lost: packetsLost ?? 0,
        packet_loss_rate: lossRate
      }));
    } catch {}
  }

  const state = pc.connectionState || pc.iceConnectionState || "—";
  const brStr  = fmtKbps(bitrateKbps);
  const fpsStr = isFinite(fps) ? `${Math.round(fps)} fps` : "— fps";
  const frmStr = (framesDecoded != null) ? `frames ${framesDecoded}` : "frames —";
  const lossStr = (packetsLost != null) ? `lost ${packetsLost}` : "lost —";
  const rttStr = (rttMs != null) ? `rtt ${rttMs}ms` : "rtt —";

  if (elStatState) {
    elStatState.textContent = `${state} · ${brStr} · ${fpsStr} · ${frmStr} · ${lossStr} · ${rttStr}`;
  }
  if (elDiagIceState) elDiagIceState.textContent = pc.iceConnectionState || "—";
  if (elDiagConnState) elDiagConnState.textContent = pc.connectionState || "—";
  if (elDiagCandidatePair) elDiagCandidatePair.textContent = selectedPair ? `${selectedPair.localCandidateId || "local"} → ${selectedPair.remoteCandidateId || "remote"}` : "—";
  if (elDiagBitrate) elDiagBitrate.textContent = brStr;
  if (elDiagFps) elDiagFps.textContent = fpsStr;
  if (elDiagFrames) elDiagFrames.textContent = String(framesDecoded ?? "—");
  if (elDiagPacketsLost) elDiagPacketsLost.textContent = String(packetsLost ?? "—");
  if (elDiagRtt) elDiagRtt.textContent = rttMs != null ? `${rttMs}ms` : "—";
  if (elDiagIceServers) elDiagIceServers.textContent = activeIceServers().map(s => Array.isArray(s.urls) ? s.urls.join(",") : s.urls).join(" | ");

  observeMobileNetworkQuality({ rttMs, jitterMs, jitterBufferMs, lossRate, packetCount: packetSampleCount, packetsLostDelta });
  updateMobileDiagnosticsUi();
  updateSelectedCodecFromStats();
  console.log("[stats]", { state, bitrate: brStr, fps, framesDecoded, packetsLost, rttMs });
}

/* -----------------------------------------
   Input helpers
------------------------------------------ */

function getNormalizedPointer(ev) {
  const r = getVideoContentRect(elVideo);
  const x = (ev.clientX - r.left) / r.width;
  const y = (ev.clientY - r.top) / r.height;

  return {
    x_norm: Math.max(0, Math.min(1, x)),
    y_norm: Math.max(0, Math.min(1, y))
  };
}

function bindRemoteInput() {
  if (inputBound || !elVideo) return;
  inputBound = true;

  elVideo.tabIndex = 0;
  elVideo.style.outline = "none";
  elVideo.style.border = "none";
  elVideo.style.cursor = "default";
  elVideo.style.touchAction = "none";

  // Some mobile browsers/WebViews emit compatibility mouse events after
  // PointerEvents. Suppress that duplicate path so one tap is one remote click.
  let suppressCompatibilityMouseUntilMs = 0;
  const noteTouchInteraction = () => {
    suppressCompatibilityMouseUntilMs = Date.now() + 1200;
  };
  const compatibilityMouseSuppressed = () => Date.now() < suppressCompatibilityMouseUntilMs;

  elVideo.addEventListener("mouseenter", (ev) => {
    if (!pc || pc.connectionState !== "connected") return;
    enterRemoteControlMode();
    moveRemoteCursorByClient(ev.clientX, ev.clientY);
  });

  elVideo.addEventListener("mouseleave", () => {
    leaveRemoteControlMode();
  });

  elVideo.addEventListener("mousedown", (ev) => {
    if (compatibilityMouseSuppressed()) { ev.preventDefault(); return; }
    enterRemoteControlMode();
    moveRemoteCursorByClient(ev.clientX, ev.clientY);

    moveRemoteCursorByClient(ev.clientX, ev.clientY);
    const p = getNormalizedPointer(ev);
    moveRemoteCursorByNorm(p.x_norm, p.y_norm);
    sendInput("mouse_move", p);
    sendInput("mouse_down", { button: ev.button });

    ev.preventDefault();
  });

  window.addEventListener("mouseup", (ev) => {
    if (compatibilityMouseSuppressed()) return;
    if (!controlActive) return;
    sendInput("mouse_up", { button: ev.button });
  });

  elVideo.addEventListener("mousemove", (ev) => {
    if (compatibilityMouseSuppressed()) return;
    if (!controlActive) enterRemoteControlMode();
    moveRemoteCursorByClient(ev.clientX, ev.clientY);
    const p = getNormalizedPointer(ev);
    lastCursorNorm = p;
    sendInput("mouse_move", p);
  });

  elVideo.addEventListener("wheel", (ev) => {
    if (compatibilityMouseSuppressed()) { ev.preventDefault(); return; }
    // Trackpads fire wheel events without a physical wheel click. Treat wheel
    // as an intent to control the remote/backstage surface so two-finger
    // scrolling works even before a click focuses the viewer.
    if (!controlActive) {
      enterRemoteControlMode();
    }
    if (!controlActive) return;

    const p = getNormalizedPointer(ev);
    moveRemoteCursorByNorm(p.x_norm, p.y_norm);

    sendInput("wheel", {
      ...p,
      delta_x: Math.round(ev.deltaX),
      delta_y: Math.round(ev.deltaY),
      delta_mode: ev.deltaMode || 0,
      shift: !!ev.shiftKey,
      ctrl: !!ev.ctrlKey,
      alt: !!ev.altKey
    });

    ev.preventDefault();
  }, { passive: false });

  // Mobile/tablet interaction. One state machine owns touch pointers across
  // Direct Touch, Trackpad and transient Pan mode. Two-finger behaviour is
  // intentionally mode-specific so pinch, scroll and remote clicks never race.
  const gestureSurface = elMain || elVideo.parentElement || elVideo;
  const mobilePointers = new Map();
  let remoteTouchId = null;
  let remoteTouchStart = null;
  let remoteTouchLast = null;
  let remoteTouchDragging = false;
  let remoteTouchScrolling = false;
  let remoteTouchScrollAccumulator = 0;
  let remoteTouchLongPressTimer = null;
  let remoteTouchLongPressFired = false;
  let viewportGesture = null;
  let viewportGestureConsumed = false;
  let viewportGestureRaf = 0;
  let panGesture = null;
  let trackpadScroll = null;
  let scrollRailPointerId = null;
  let scrollRailLastY = 0;
  let scrollRailAccumulator = 0;
  const TOUCH_SCROLL_STEP_PX = 40;
  const RAIL_SCROLL_STEP_PX = 56;

  if (gestureSurface && isMobileViewerSurface()) gestureSurface.style.touchAction = "none";

  const clearRemoteLongPress = () => {
    if (remoteTouchLongPressTimer) clearTimeout(remoteTouchLongPressTimer);
    remoteTouchLongPressTimer = null;
  };
  const pointerDistance = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  const mobilePair = () => Array.from(mobilePointers.values()).slice(0, 2);
  const isPointInsideRemoteVideo = (clientX, clientY) => {
    if (!elVideo || !elVideo.videoWidth || !elVideo.videoHeight) return false;
    const r = getVideoContentRect(elVideo);
    return clientX >= r.left && clientX <= r.left + r.width && clientY >= r.top && clientY <= r.top + r.height;
  };
  const currentTrackpadPoint = () => ({
    x_norm: Math.max(0, Math.min(1, mobileTrackpadCursor.x_norm)),
    y_norm: Math.max(0, Math.min(1, mobileTrackpadCursor.y_norm))
  });
  const flushTouchWheelAccumulator = (value, thresholdPx) => {
    let steps = value > 0 ? Math.floor(value / thresholdPx) : Math.ceil(value / thresholdPx);
    steps = Math.max(-2, Math.min(2, steps));
    if (!steps) return value;
    sendInput('wheel', { delta_x: 0, delta_y: steps * 120, delta_mode: 0 }, true);
    return value - steps * thresholdPx;
  };

  const sendMobileClick = (p, clientX, clientY, button = 0) => {
    const point = { x_norm: p.x_norm, y_norm: p.y_norm };
    mobileTrackpadCursor = { ...point };
    moveRemoteCursorByNorm(point.x_norm, point.y_norm);
    updateMobileReticle(point.x_norm, point.y_norm);
    sendInput('mouse_click', { ...point, button }, true);
    // Pulse the actual remote target, not the raw finger position. This mirrors
    // Windows touch feedback and never lies during a pinch/pan gesture.
    const r = getVideoContentRect(elVideo);
    showMobileTouchContact(r.left + point.x_norm * r.width, r.top + point.y_norm * r.height);
  };

  const finishMobileTap = (p, clientX, clientY) => {
    const now = performance.now();
    const previous = mobileLastTap;
    const nearPrevious = previous && (now - previous.at) <= 420 &&
      Math.hypot(clientX - previous.clientX, clientY - previous.clientY) <= 34;
    sendMobileClick(p, clientX, clientY, 0);
    mobileLastTap = nearPrevious ? null : { at: now, clientX, clientY };
  };

  const cancelRemoteTouch = ({ releaseDrag = true } = {}) => {
    clearRemoteLongPress();
    if (releaseDrag && remoteTouchDragging) sendInput('mouse_up', { button: 0 }, true);
    remoteTouchId = null;
    remoteTouchStart = null;
    remoteTouchLast = null;
    remoteTouchDragging = false;
    remoteTouchScrolling = false;
    remoteTouchScrollAccumulator = 0;
    remoteTouchLongPressFired = false;
    hideMobilePrecisionLoupe();
  };

  const beginViewportGesture = () => {
    const pts = mobilePair();
    if (pts.length < 2 || !gestureSurface) return false;
    cancelRemoteTouch();
    trackpadScroll = null;
    const a=pts[0], b=pts[1];
    const centerX=(a.clientX+b.clientX)/2, centerY=(a.clientY+b.clientY)/2;
    const rect=gestureSurface.getBoundingClientRect();
    const zoom=Math.max(1,mobileViewZoom);
    const distance=Math.max(1,pointerDistance(a,b));
    viewportGesture={
      distance, zoom,
      anchorX:(centerX-(rect.left+rect.width/2)-mobileViewPanX)/zoom,
      anchorY:(centerY-(rect.top+rect.height/2)-mobileViewPanY)/zoom,
      smoothCenterX:centerX, smoothCenterY:centerY, smoothDistance:distance
    };
    viewportGestureConsumed=true;
    return true;
  };

  const updateViewportGesture = () => {
    const pts=mobilePair();
    if(pts.length<2||!gestureSurface) return false;
    if(!viewportGesture&&!beginViewportGesture()) return false;
    const a=pts[0], b=pts[1];
    const rawCenterX=(a.clientX+b.clientX)/2, rawCenterY=(a.clientY+b.clientY)/2;
    const rawDistance=Math.max(1,pointerDistance(a,b));
    const alpha=.72;
    viewportGesture.smoothCenterX += (rawCenterX-viewportGesture.smoothCenterX)*alpha;
    viewportGesture.smoothCenterY += (rawCenterY-viewportGesture.smoothCenterY)*alpha;
    viewportGesture.smoothDistance += (rawDistance-viewportGesture.smoothDistance)*alpha;
    const centerX=viewportGesture.smoothCenterX, centerY=viewportGesture.smoothCenterY;
    const nextZoom=Math.max(1,Math.min(4,viewportGesture.zoom*(viewportGesture.smoothDistance/Math.max(1,viewportGesture.distance))));
    const rect=gestureSurface.getBoundingClientRect();
    mobileViewZoom=nextZoom;
    mobileViewPanX=(centerX-(rect.left+rect.width/2))-viewportGesture.anchorX*nextZoom;
    mobileViewPanY=(centerY-(rect.top+rect.height/2))-viewportGesture.anchorY*nextZoom;
    applyMobileViewport({clamp:false});
    rememberMobileViewportStableAnchor();
    return true;
  };

  const scheduleViewportGestureUpdate=()=>{
    if(viewportGestureRaf) return;
    viewportGestureRaf=requestAnimationFrame(()=>{
      viewportGestureRaf=0;
      if(mobilePointers.size>=2&&viewportGesture) updateViewportGesture();
    });
  };

  const beginTrackpadScroll=()=>{
    const pts=mobilePair();
    if(pts.length<2) return false;
    cancelRemoteTouch();
    viewportGesture=null;
    trackpadScroll={ centerY:(pts[0].clientY+pts[1].clientY)/2 };
    viewportGestureConsumed=true;
    return true;
  };
  const updateTrackpadScroll=()=>{
    const pts=mobilePair();
    if(pts.length<2||!trackpadScroll) return;
    const centerY=(pts[0].clientY+pts[1].clientY)/2;
    const dy=centerY-trackpadScroll.centerY;
    if(Math.abs(dy)>=1.5){
      sendInput('wheel',{delta_x:0,delta_y:Math.round(-dy*3.2),delta_mode:0},true);
      trackpadScroll.centerY=centerY;
    }
  };

  const beginPanGesture=(point)=>{
    cancelRemoteTouch();
    panGesture={clientX:point.clientX,clientY:point.clientY,panX:mobileViewPanX,panY:mobileViewPanY};
    viewportGestureConsumed=true;
  };
  const updatePanGesture=(point)=>{
    if(!panGesture) return;
    mobileViewPanX=panGesture.panX+(point.clientX-panGesture.clientX);
    mobileViewPanY=panGesture.panY+(point.clientY-panGesture.clientY);
    applyMobileViewport({clamp:true});
    rememberMobileViewportStableAnchor();
  };

  const startLongPress=(pointerId)=>{
    clearRemoteLongPress();
    remoteTouchLongPressTimer=setTimeout(()=>{
      if(mobilePointers.size!==1||remoteTouchId!==pointerId||remoteTouchDragging) return;
      const p=mobileInputMode==='trackpad'?currentTrackpadPoint():getNormalizedPointer(mobilePointers.get(pointerId));
      sendInput('mouse_click',{...p,button:2},true);
      const r=getVideoContentRect(elVideo);
      showMobileTouchContact(r.left+p.x_norm*r.width,r.top+p.y_norm*r.height);
      remoteTouchLongPressFired=true;
    },650);
  };

  const mobilePointerAllowed=(ev)=>{
    if(!isMobileViewerSurface()) return false;
    if(ev.pointerType!=="touch"&&ev.pointerType!=="pen") return false;
    return ev.target===gestureSurface||ev.target===elVideo;
  };

  gestureSurface?.addEventListener('pointerdown',(ev)=>{
    if(!mobilePointerAllowed(ev)) return;
    cancelMobileViewportResumeRestore();
    noteTouchInteraction();
    ev.preventDefault();
    const point={id:ev.pointerId,clientX:ev.clientX,clientY:ev.clientY,startX:ev.clientX,startY:ev.clientY};
    mobilePointers.set(ev.pointerId,point);
    try{gestureSurface.setPointerCapture(ev.pointerId);}catch{}

    if(mobilePointers.size>=2){
      if(mobileInputMode==='trackpad'&&!mobilePanMode) beginTrackpadScroll();
      else beginViewportGesture();
      return;
    }

    if(mobilePanMode){ beginPanGesture(point); return; }
    if(mobileInputMode==='direct'&&!isPointInsideRemoteVideo(ev.clientX,ev.clientY)) return;

    enterRemoteControlMode();
    remoteTouchId=ev.pointerId;
    remoteTouchStart={clientX:ev.clientX,clientY:ev.clientY};
    remoteTouchLast={clientX:ev.clientX,clientY:ev.clientY};
    remoteTouchDragging=false;
    remoteTouchScrolling=false;
    remoteTouchScrollAccumulator=0;
    remoteTouchLongPressFired=false;

    // Trackpad double-tap-and-hold becomes a normal Windows drag. If the
    // finger does not move, down/up still forms the second click of a double-click.
    if (mobileInputMode === 'trackpad' && mobileLastTap && (performance.now() - mobileLastTap.at) <= 420) {
      const p = currentTrackpadPoint();
      sendInput('mouse_down', { ...p, button: 0 }, true);
      const rr = getVideoContentRect(elVideo);
      showMobileTouchContact(rr.left + p.x_norm * rr.width, rr.top + p.y_norm * rr.height);
      remoteTouchDragging = true;
      mobileLastTap = null;
    }

    if(mobileInputMode==='direct'){
      const p=getNormalizedPointer(ev);
      mobileTrackpadCursor={...p};
      moveRemoteCursorByNorm(p.x_norm,p.y_norm);
      sendInput('mouse_move',p);
      updateMobileReticle(p.x_norm,p.y_norm);
      updateMobilePrecisionLoupe(p.x_norm,p.y_norm,ev.clientX,ev.clientY);
    } else {
      const p=lastCursorNorm||mobileTrackpadCursor||{x_norm:.5,y_norm:.5};
      mobileTrackpadCursor={x_norm:p.x_norm??.5,y_norm:p.y_norm??.5};
      updateMobileReticle();
    }
    startLongPress(ev.pointerId);
  },{passive:false});

  gestureSurface?.addEventListener('pointermove',(ev)=>{
    const point=mobilePointers.get(ev.pointerId);
    if(!point) return;
    noteTouchInteraction();
    ev.preventDefault();
    point.clientX=ev.clientX; point.clientY=ev.clientY;
    mobilePointers.set(ev.pointerId,point);

    if(mobilePointers.size>=2){
      if(mobileInputMode==='trackpad'&&!mobilePanMode){ if(!trackpadScroll) beginTrackpadScroll(); updateTrackpadScroll(); }
      else { if(!viewportGesture) beginViewportGesture(); scheduleViewportGestureUpdate(); }
      return;
    }
    if(mobilePanMode){ updatePanGesture(point); return; }
    if(viewportGestureConsumed||ev.pointerId!==remoteTouchId) return;

    const touchTravel=remoteTouchStart?pointerDistance(ev,remoteTouchStart):0;
    if(touchTravel>4) clearRemoteLongPress();
    const moved=touchTravel>(mobilePrecisionMode?18:12);

    if(mobileInputMode==='trackpad'){
      const r=getVideoContentRect(elVideo);
      const dx=ev.clientX-(remoteTouchLast?.clientX??ev.clientX);
      const dy=ev.clientY-(remoteTouchLast?.clientY??ev.clientY);
      const sensitivity=1.22;
      mobileTrackpadCursor.x_norm=Math.max(0,Math.min(1,mobileTrackpadCursor.x_norm+(dx/Math.max(1,r.width))*sensitivity));
      mobileTrackpadCursor.y_norm=Math.max(0,Math.min(1,mobileTrackpadCursor.y_norm+(dy/Math.max(1,r.height))*sensitivity));
      const p=currentTrackpadPoint();
      moveRemoteCursorByNorm(p.x_norm,p.y_norm);
      sendInput('mouse_move',p);
      updateMobileReticle(p.x_norm,p.y_norm);
      updateMobilePrecisionLoupe(p.x_norm,p.y_norm,ev.clientX,ev.clientY);
    } else {
      const totalDx=remoteTouchStart?ev.clientX-remoteTouchStart.clientX:0;
      const totalDy=remoteTouchStart?ev.clientY-remoteTouchStart.clientY:0;
      const verticalIntent=Math.abs(totalDy)>Math.abs(totalDx)*1.15;
      if(!mobilePrecisionMode&&!remoteTouchDragging&&!remoteTouchLongPressFired){
        if(!remoteTouchScrolling&&touchTravel>12&&verticalIntent){
          remoteTouchScrolling=true;
          remoteTouchScrollAccumulator=0;
          mobileLastTap=null;
          clearRemoteLongPress();
          hideMobilePrecisionLoupe();
        }
        if(remoteTouchScrolling){
          const dy=ev.clientY-(remoteTouchLast?.clientY??ev.clientY);
          remoteTouchScrollAccumulator+=-dy;
          remoteTouchScrollAccumulator=flushTouchWheelAccumulator(remoteTouchScrollAccumulator,TOUCH_SCROLL_STEP_PX);
          remoteTouchLast={clientX:ev.clientX,clientY:ev.clientY};
          return;
        }
      }
      const p=getNormalizedPointer(ev);
      mobileTrackpadCursor={...p};
      moveRemoteCursorByNorm(p.x_norm,p.y_norm);
      sendInput('mouse_move',p);
      updateMobileReticle(p.x_norm,p.y_norm);
      updateMobilePrecisionLoupe(p.x_norm,p.y_norm,ev.clientX,ev.clientY);
      if(moved&&!mobilePrecisionMode&&!remoteTouchDragging&&!remoteTouchLongPressFired){
        sendInput('mouse_down',{button:0},true);
        const rr=getVideoContentRect(elVideo);
        showMobileTouchContact(rr.left+p.x_norm*rr.width,rr.top+p.y_norm*rr.height);
        remoteTouchDragging=true;
      }
    }
    remoteTouchLast={clientX:ev.clientX,clientY:ev.clientY};
  },{passive:false});

  const resetMobileGestureWhenReleased=()=>{
    if(mobilePointers.size!==0) return;
    if(viewportGestureRaf){cancelAnimationFrame(viewportGestureRaf);viewportGestureRaf=0;}
    clearRemoteLongPress();
    cancelRemoteTouch({releaseDrag:false});
    viewportGesture=null; viewportGestureConsumed=false; panGesture=null; trackpadScroll=null;
  };

  const resetMobileGestureForLifecycle=()=>{
    if(viewportGestureRaf){cancelAnimationFrame(viewportGestureRaf);viewportGestureRaf=0;}
    clearRemoteLongPress();
    for(const pointerId of mobilePointers.keys()){
      try{gestureSurface?.releasePointerCapture(pointerId);}catch{}
    }
    if(remoteTouchDragging){
      try{sendInput('mouse_up',{button:0},true);}catch{}
    }
    mobilePointers.clear();
    remoteTouchId=null; remoteTouchStart=null; remoteTouchLast=null;
    remoteTouchDragging=false; remoteTouchScrolling=false; remoteTouchScrollAccumulator=0; remoteTouchLongPressFired=false;
    viewportGesture=null; viewportGestureConsumed=false; panGesture=null; trackpadScroll=null;
    if(scrollRailPointerId!=null){
      try{elMobileScrollRail?.releasePointerCapture(scrollRailPointerId);}catch{}
      scrollRailPointerId=null;
    }
    hideMobilePrecisionLoupe();
  };
  mobileGestureLifecycleReset = resetMobileGestureForLifecycle;

  const finishMobilePointer=(ev,cancelled)=>{
    const point=mobilePointers.get(ev.pointerId);
    if(!point) return;
    noteTouchInteraction(); ev.preventDefault();
    const wasRemote=ev.pointerId===remoteTouchId;
    const wasViewport=viewportGestureConsumed||mobilePointers.size>=2||!!panGesture||!!trackpadScroll;
    mobilePointers.delete(ev.pointerId);
    try{gestureSurface.releasePointerCapture(ev.pointerId);}catch{}

    if(wasRemote){
      clearRemoteLongPress();
      if(remoteTouchDragging){ sendInput('mouse_up',{button:0},true); }
      else if(!remoteTouchScrolling&&!cancelled&&!wasViewport&&!remoteTouchLongPressFired){
        const p=mobileInputMode==='trackpad'?currentTrackpadPoint():getNormalizedPointer(ev);
        finishMobileTap(p,ev.clientX,ev.clientY);
      }
      hideMobilePrecisionLoupe();
      remoteTouchId=null; remoteTouchStart=null; remoteTouchLast=null; remoteTouchDragging=false; remoteTouchScrolling=false; remoteTouchScrollAccumulator=0; remoteTouchLongPressFired=false;
    }

    if(wasViewport){
      const completedOneShotPan = !!panGesture && mobilePanMode;
      if(viewportGestureRaf){cancelAnimationFrame(viewportGestureRaf);viewportGestureRaf=0;}
      if(mobileViewZoom<1.02&&viewportGesture){mobileViewZoom=1;mobileViewPanX=0;mobileViewPanY=0;applyMobileViewport({clamp:false});}
      viewportGesture=null; trackpadScroll=null; panGesture=null; viewportGestureConsumed=true;
      cancelRemoteTouch();
      if (completedOneShotPan) { mobilePanMode = false; updateMobileModeUi(); }
    }
    resetMobileGestureWhenReleased();
  };

  gestureSurface?.addEventListener('pointerup',(ev)=>finishMobilePointer(ev,false),{passive:false});
  gestureSurface?.addEventListener('pointercancel',(ev)=>{
    finishMobilePointer(ev,true);
    recoverMobileViewerFromBrowserGesture('pointercancel-recovery');
  },{passive:false});

  // Dedicated edge scroll zone remains as a Trackpad fallback. Direct Touch
  // now scrolls naturally with a one-finger vertical swipe anywhere on the
  // remote surface. Accumulate finger travel before emitting fixed 120-unit
  // Windows wheel notches so tiny movements cannot race to the page bottom.
  elMobileScrollRail?.addEventListener('pointerdown',(ev)=>{
    if(!isMobileViewerSurface()||!currentSession) return;
    cancelMobileViewportResumeRestore();
    ev.preventDefault(); ev.stopPropagation();
    scrollRailPointerId=ev.pointerId; scrollRailLastY=ev.clientY; scrollRailAccumulator=0;
    try{elMobileScrollRail.setPointerCapture(ev.pointerId);}catch{}
    enterRemoteControlMode();
  },{passive:false});
  elMobileScrollRail?.addEventListener('pointermove',(ev)=>{
    if(ev.pointerId!==scrollRailPointerId) return;
    ev.preventDefault(); ev.stopPropagation();
    const dy=ev.clientY-scrollRailLastY;
    if(Math.abs(dy)>=1){
      scrollRailAccumulator+=-dy;
      scrollRailAccumulator=flushTouchWheelAccumulator(scrollRailAccumulator,RAIL_SCROLL_STEP_PX);
      scrollRailLastY=ev.clientY;
      if(elMobileScrollThumb){
        const rect=elMobileScrollRail.getBoundingClientRect();
        const pos=Math.max(0,Math.min(rect.height-42,ev.clientY-rect.top-21));
        elMobileScrollThumb.style.top=pos+'px';
      }
    }
  },{passive:false});
  const endScrollRail=(ev)=>{
    if(ev.pointerId!==scrollRailPointerId) return;
    ev.preventDefault(); ev.stopPropagation();
    try{elMobileScrollRail.releasePointerCapture(ev.pointerId);}catch{}
    scrollRailPointerId=null;
    scrollRailAccumulator=0;
  };
  elMobileScrollRail?.addEventListener('pointerup',endScrollRail,{passive:false});
  elMobileScrollRail?.addEventListener('pointercancel',endScrollRail,{passive:false});

  window.addEventListener("blur", () => {
    if (remoteAltTabActive) {
      sendShortcut("alt_tab_end");
      remoteAltTabActive = false;
    }
    if (currentSession && isMobileViewerSurface() && !document.hidden) {
      recoverMobileViewerFromBrowserGesture('window-blur-recovery');
    } else {
      leaveRemoteControlMode();
    }
  });

  window.addEventListener('orientationchange', () => {
    if (!isMobileViewerSurface()) return;
    const anchor = mobileViewportStableAnchor || captureMobileViewportAnchor();
    if (anchor) { mobileViewportStableAnchor = { ...anchor }; scheduleMobileViewportResumeRestore(anchor); }
    setTimeout(() => { if (anchor) scheduleMobileViewportResumeRestore(anchor); }, 350);
  });

  screen.orientation?.addEventListener?.('change', () => {
    const anchor = mobileViewportStableAnchor || captureMobileViewportAnchor();
    if (anchor) scheduleMobileViewportResumeRestore(anchor);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (isMobileViewerSurface()) {
        mobileViewportResumeAnchor = captureMobileViewportAnchor();
        if (mobileViewportResumeAnchor) mobileViewportStableAnchor = { ...mobileViewportResumeAnchor };
        resetMobileGestureForLifecycle();
      }
      releaseMobileWakeLock();
      leaveRemoteControlMode();
    } else {
      requestMobileWakeLock();
      ensureRemoteVideoPlayback("visibility-resume");
      armDecodedFrameReveal();
      if (isMobileViewerSurface() && mobileViewportResumeAnchor) {
        scheduleMobileViewportResumeRestore(mobileViewportResumeAnchor);
      }
      if (currentSession?.viewerClient === 'browser' && (!ws || ws.readyState > WebSocket.OPEN)) {
        scheduleMobileSessionReconnect('visibility-resume', { closeSocket: false });
      }
    }
  });

  window.addEventListener('offline', () => {
    if (!currentSession || !isMobileViewerSurface()) return;
    setMobileRecoveryStage('Network offline');
    setMobileQualityUi('Offline', 'reconnecting', 'Waiting for network');
  });
  window.addEventListener('online', () => {
    if (!currentSession || !isMobileViewerSurface()) return;
    setMobileRecoveryStage('Network restored · checking path');
    ensureRemoteVideoPlayback('network-online');
    requestRemoteKeyframe('network-online');
    if (pc?.connectionState !== 'connected' || ws?.readyState !== WebSocket.OPEN) {
      scheduleMobileTransportHealthProbe('network-online', 3000);
    }
  });
  navigator.connection?.addEventListener?.('change', () => {
    if (!currentSession || !isMobileViewerSurface()) return;
    if (pc?.connectionState === 'connected' && ws?.readyState === WebSocket.OPEN) {
      requestRemoteKeyframe('network-path-change');
      return;
    }
    setMobileRecoveryStage('Network path changed · checking');
    scheduleMobileTransportHealthProbe('network-path-change', 3500);
  });

  window.addEventListener('pagehide', () => {
    if (!isMobileViewerSurface()) return;
    releaseMobileWakeLock();
    mobileViewportResumeAnchor = captureMobileViewportAnchor() || mobileViewportResumeAnchor;
    if (mobileViewportResumeAnchor) mobileViewportStableAnchor = { ...mobileViewportResumeAnchor };
    resetMobileGestureForLifecycle();
  });

  window.addEventListener('popstate', () => {
    if (mobileHistoryGuardReleasing) {
      mobileHistoryGuardReleasing = false;
      return;
    }
    if (!currentSession || !isMobileViewerSurface() || !mobileHistoryGuardActive) return;
    recoverMobileViewerFromBrowserGesture('history-pop-recovery');
    // Re-arm the same-page guard so a completed Safari swipe cannot leave the
    // live session. This does not affect normal navigation after disconnect.
    try {
      history.pushState({ ...(history.state || {}), hi5ViewerGuard: mobileHistoryGuardId }, '', location.href);
    } catch {}
  });

  document.addEventListener("pointerdown", () => {
    if (isMobileViewerSurface() && elVideo?.srcObject) {
      ensureRemoteVideoPlayback("mobile-user-gesture");
      armDecodedFrameReveal();
    }
  }, { passive: true });

  function isLocalViewerInputTarget(target) {
    const el = target instanceof Element ? target : null;
    if (!el) return false;
    if (el.closest("#chat-panel, #settings-panel, #files-panel")) return true;
    const tag = String(el.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select" || !!el.closest("[contenteditable='true']");
  }

  function shortcutFromKeyboardEvent(ev) {
    if (!ev) return "";

    // Windows-key combinations. The native viewer hook handles these when
    // maximised, but keep this path for WebView builds that also surface Meta.
    if (ev.metaKey || ev.key === "Meta" || ev.key === "OS") {
      switch (ev.code) {
        case "KeyD": return "win_d";
        case "KeyR": return "win_r";
        case "KeyE": return "win_e";
        case "KeyL": return "lock";
        case "Tab": return "win_tab";
        case "Escape": return "start_menu";
        case "MetaLeft":
        case "MetaRight":
          return "start_menu";
        default:
          break;
      }
    }

    if (ev.altKey && ev.code === "Tab") return remoteAltTabActive ? "alt_tab_next" : "alt_tab_begin";
    if (ev.altKey && ev.code === "F4") return "alt_f4";
    if (ev.ctrlKey && ev.shiftKey && ev.code === "Escape") return "ctrl_shift_esc";
    if (ev.ctrlKey && ev.code === "Escape") return "ctrl_esc";
    if (ev.ctrlKey && ev.altKey && (ev.code === "Delete" || ev.code === "End")) return "ctrl_alt_del";
    return "";
  }

  window.addEventListener("keydown", (ev) => {
    if (isLocalViewerInputTarget(ev.target)) return;
    if (!controlActive || !pc || pc.connectionState !== "connected") return;

    const keyboardShortcut = shortcutFromKeyboardEvent(ev);
    if (keyboardShortcut) {
      releaseAllKeys();
      sendShortcut(keyboardShortcut);
      if (keyboardShortcut === "alt_tab_begin" || keyboardShortcut === "alt_tab_next") {
        remoteAltTabActive = true;
      }
      ev.preventDefault();
      return;
    }

    if (!ev.metaKey) {
      if (pressedKeys.has("MetaLeft")) {
        sendInput("key_up", { code: "MetaLeft" }, true);
        pressedKeys.delete("MetaLeft");
      }
      if (pressedKeys.has("MetaRight")) {
        sendInput("key_up", { code: "MetaRight" }, true);
        pressedKeys.delete("MetaRight");
      }
    }
    if (!ev.ctrlKey) {
      if (pressedKeys.has("ControlLeft")) {
        sendInput("key_up", { code: "ControlLeft" }, true);
        pressedKeys.delete("ControlLeft");
      }
      if (pressedKeys.has("ControlRight")) {
        sendInput("key_up", { code: "ControlRight" }, true);
        pressedKeys.delete("ControlRight");
      }
    }
    if (!ev.shiftKey) {
      if (pressedKeys.has("ShiftLeft")) {
        sendInput("key_up", { code: "ShiftLeft" }, true);
        pressedKeys.delete("ShiftLeft");
      }
      if (pressedKeys.has("ShiftRight")) {
        sendInput("key_up", { code: "ShiftRight" }, true);
        pressedKeys.delete("ShiftRight");
      }
    }
    if (!ev.altKey) {
      if (pressedKeys.has("AltLeft")) {
        sendInput("key_up", { code: "AltLeft" }, true);
        pressedKeys.delete("AltLeft");
      }
      if (pressedKeys.has("AltRight")) {
        sendInput("key_up", { code: "AltRight" }, true);
        pressedKeys.delete("AltRight");
      }
    }

    const altGraph = !!ev.getModifierState?.('AltGraph');
    const commandModified = !!(ev.ctrlKey || ev.altKey || ev.metaKey);
    if (isPrintableKey(ev) && (!commandModified || altGraph)) {
      sendInput("text_input", {
        code: ev.code,
        key: ev.key,
        text: ev.key,
        repeat: !!ev.repeat
      });
      ev.preventDefault();
      return;
    }

    if (!pressedKeys.has(ev.code)) {
      pressedKeys.add(ev.code);
      sendInput("key_down", {
        code: ev.code,
        key: ev.key || "",
        repeat: false,
        shift: !!ev.shiftKey,
        ctrl: !!ev.ctrlKey,
        alt: !!ev.altKey,
        meta: !!ev.metaKey
      });
    } else if (ev.repeat) {
      sendInput("key_down", {
        code: ev.code,
        key: ev.key || "",
        repeat: true,
        shift: !!ev.shiftKey,
        ctrl: !!ev.ctrlKey,
        alt: !!ev.altKey,
        meta: !!ev.metaKey
      });
    }

    if (ev.code === "MetaLeft" || ev.code === "MetaRight") {
      setTimeout(() => {
        if (pressedKeys.has(ev.code)) {
          sendInput("key_up", { code: ev.code }, true);
          pressedKeys.delete(ev.code);
        }
      }, 250);
    }

    ev.preventDefault();
  });

  window.addEventListener("keyup", (ev) => {
    if (isLocalViewerInputTarget(ev.target)) return;
    if (!pc || pc.connectionState !== "connected") return;

    if (remoteAltTabActive && (ev.key === "Alt" || ev.code === "AltLeft" || ev.code === "AltRight")) {
      sendShortcut("alt_tab_end");
      remoteAltTabActive = false;
      ev.preventDefault();
      return;
    }

    if (remoteAltTabActive && ev.code === "Tab") {
      ev.preventDefault();
      return;
    }

    if (pressedKeys.has(ev.code)) {
      pressedKeys.delete(ev.code);
    }

    sendInput("key_up", {
      code: ev.code,
      key: ev.key || "",
      shift: !!ev.shiftKey,
      ctrl: !!ev.ctrlKey,
      alt: !!ev.altKey,
      meta: !!ev.metaKey
    });

    ev.preventDefault();
  });
}

/* -----------------------------------------
   ICE normalization
------------------------------------------ */

function normalizeRemoteIce(msg) {
  if (!msg) return null;

  let candidateStr = null;
  let mid = null;
  let mline = null;

  if (typeof msg.candidate === "string") {
    candidateStr = msg.candidate;
  } else if (msg.candidate && typeof msg.candidate === "object") {
    candidateStr = typeof msg.candidate.candidate === "string" ? msg.candidate.candidate : null;
    mid = msg.candidate.sdpMid ?? msg.candidate.mid ?? null;
    mline = msg.candidate.sdpMLineIndex ?? msg.candidate.mline_index ?? null;
  }

  mid = msg.mid ?? mid;
  mline = msg.mline_index ?? msg.sdpMLineIndex ?? mline;

  if (!candidateStr) return null;

  return { candidate: candidateStr, mid: mid ?? null, mline_index: (mline != null ? Number(mline) : null) };
}

async function applyRemoteIce(msg) {
  const iceMsg = normalizeRemoteIce(msg);
  if (!iceMsg) return;

  if (!pc || !remoteDescSet) {
    pendingRemoteIce.push(iceMsg);
    return;
  }

  try {
    const ice = {
      candidate: iceMsg.candidate,
      ...(iceMsg.mid != null ? { sdpMid: iceMsg.mid } : {}),
      ...(iceMsg.mline_index != null ? { sdpMLineIndex: iceMsg.mline_index } : {}),
    };
    await pc.addIceCandidate(ice);
  } catch (e) {
    console.warn("[rtc] addIceCandidate failed:", e?.message || e, msg);
  }
}

async function flushPendingIce() {
  if (!pc || !remoteDescSet || pendingRemoteIce.length === 0) return;
  const batch = pendingRemoteIce;
  pendingRemoteIce = [];
  for (const m of batch) await applyRemoteIce(m);
}


function extractSdpVideoCodecs(sdp) {
  const lines = String(sdp || "").split(/\r?\n/);
  const rtpmap = new Map();
  const fmtp = new Map();
  for (const line of lines) {
    let m = line.match(/^a=rtpmap:(\d+)\s+([^/\s]+)\/([^\s]+)/i);
    if (m) rtpmap.set(m[1], `${m[2]}/${m[3]}`);
    m = line.match(/^a=fmtp:(\d+)\s+(.+)$/i);
    if (m) fmtp.set(m[1], m[2]);
  }
  return Array.from(rtpmap.entries()).map(([pt, codec]) => ({ pt, codec, fmtp: fmtp.get(pt) || "" }));
}

function logSdpCodecSummary(label, sdp) {
  const codecs = extractSdpVideoCodecs(sdp);
  console.log(`[codec] ${label}`, codecs);
  return codecs;
}

function setViewerCodecLabel(value) {
  if (elStatCodec) elStatCodec.textContent = value || "—";
}

async function updateSelectedCodecFromStats() {
  if (!pc) return;
  try {
    const stats = await pc.getStats();
    let inbound = null;
    stats.forEach((r) => {
      if (r.type === "inbound-rtp" && ((r.kind === "video") || (r.mediaType === "video"))) inbound = r;
    });
    if (!inbound || !inbound.codecId) return;
    const codec = stats.get(inbound.codecId);
    if (codec) {
      const mime = codec.mimeType || codec.mime || "";
      const label = `${mime.replace(/^video\//i, "").toUpperCase()} pt=${codec.payloadType ?? "?"}`;
      setViewerCodecLabel(label);
      console.log("[codec] selected inbound codec", { mimeType: codec.mimeType, payloadType: codec.payloadType, clockRate: codec.clockRate, sdpFmtpLine: codec.sdpFmtpLine });
    }
  } catch (e) {
    console.warn("[codec] selected codec stats failed", e?.message || e);
  }
}

/* -----------------------------------------
   WebRTC negotiation
------------------------------------------ */

async function handleOffer(msg) {
  const offerSdp = msg?.sdp;
  if (!offerSdp) return;

  if (pc) teardownPeerForReconnect();
  mobileEndpointRestartUntil = 0;
  logSdpCodecSummary("remote offer", offerSdp);

  setStatus("", "Negotiating…");

  pc = new RTCPeerConnection({ iceServers: activeIceServers() });

  let transceiver = null;
  try {
    transceiver = pc.addTransceiver("video", { direction: "recvonly" });
  } catch (e) {
    console.warn("[rtc] addTransceiver failed:", e?.message || e);
  }

  try {
    const caps = RTCRtpReceiver.getCapabilities?.("video");
    const codecs = caps?.codecs || [];

    if (transceiver && transceiver.setCodecPreferences && codecs.length) {
      // Prefer codecs that keep browser/mobile sessions sharp without forcing
      // the conservative H.264 level-3.1 720p ceiling. The Agent still makes
      // the final choice from the codecs actually returned in our SDP answer.
      const vp8 = codecs.filter(c => String(c.mimeType).toLowerCase() === "video/vp8");
      const h264 = codecs.filter(c => String(c.mimeType).toLowerCase() === "video/h264");
      const vp9 = codecs.filter(c => String(c.mimeType).toLowerCase() === "video/vp9");
      const rest = codecs.filter(c => {
        const mt = String(c.mimeType).toLowerCase();
        return mt !== "video/vp8" && mt !== "video/h264" && mt !== "video/vp9";
      });
      console.log("[codec] viewer codec preference", { vp8: vp8.length, h264: h264.length, vp9: vp9.length, rest: rest.length });
      transceiver.setCodecPreferences([...vp8, ...h264, ...vp9, ...rest]);
    }
  } catch (e) {
    console.warn("[webrtc] codec preference step failed:", e?.message || e);
  }

  pc.ondatachannel = (ev) => {
    const channel = ev.channel;
    if (!channel) return;

    const attachControlMessage = () => {
      channel.onmessage = (message) => {
        const data = message?.data;
        if (typeof data === 'string') handleViewerControlMessage(data);
        else if (data instanceof ArrayBuffer) handleViewerControlMessage(data);
        else if (data?.arrayBuffer) data.arrayBuffer().then(handleViewerControlMessage).catch(() => {});
      };
    };

    if (channel.label === "input") {
      inputDc = channel;
      attachControlMessage();
      inputDc.onopen = () => { sendViewerStreamProfile(); };
      inputDc.onclose = () => { if (inputDc === channel) inputDc = null; };
      inputDc.onerror = () => {};
      return;
    }

    if (channel.label === "input-control") {
      inputControlDc = channel;
      attachControlMessage();
      inputControlDc.onopen = () => { sendViewerStreamProfile(); };
      inputControlDc.onclose = () => { if (inputControlDc === channel) inputControlDc = null; };
      inputControlDc.onerror = () => {};
      return;
    }

    if (channel.label === "input-move" || channel.label === "viewer-mouse-move") {
      mouseMoveDc = channel;
      mouseMoveDc.binaryType = 'arraybuffer';
      mouseMoveDc.onclose = () => { if (mouseMoveDc === channel) mouseMoveDc = null; };
      mouseMoveDc.onerror = () => {};
    }
  };

  pc.ontrack = async (ev) => {
    console.log("[rtc] ontrack", { trackKind: ev.track?.kind, streams: ev.streams?.length || 0 });
    setTimeout(updateSelectedCodecFromStats, 500);
    setTimeout(updateSelectedCodecFromStats, 1500);
    const stream = (ev.streams && ev.streams[0])
      ? ev.streams[0]
      : new MediaStream([ev.track]);

    if (ev.track?.kind === "audio") {
      if (!elAudio) return;
      elAudio.autoplay = true;
      elAudio.muted = !audioEnabled;
      elAudio.defaultMuted = !audioEnabled;
      elAudio.srcObject = stream;
      if (audioEnabled) {
        try { await elAudio.play(); } catch {}
      }
      return;
    }

    if (ev.track?.kind !== "video" || !elVideo) return;

    elVideo.autoplay = true;
    elVideo.playsInline = true;
    elVideo.muted = true;
    elVideo.defaultMuted = true;
    elVideo.controls = false;

    elVideo.onloadedmetadata = null;
    elVideo.onloadeddata = null;
    elVideo.oncanplay = null;
    elVideo.onplaying = null;
    elVideo.onpause = null;
    elVideo.onerror = null;

    elVideo.onloadedmetadata = async () => {
      updateResolution();
      refreshRemoteCursorPosition();
      await ensureRemoteVideoPlayback("loadedmetadata");
      armDecodedFrameReveal();
    };

    elVideo.onloadeddata = () => {
      markFrameRendered();
      armDecodedFrameReveal();
    };

    elVideo.oncanplay = async () => {
      await ensureRemoteVideoPlayback("canplay");
      armDecodedFrameReveal();
    };

    elVideo.onplaying = () => {
      clearSecureDesktopState();
      markFrameRendered();
      updateResolution();
      refreshRemoteCursorPosition();
      armDecodedFrameReveal();
    };

    elVideo.onerror = () => {
      console.error("[video] error", elVideo.error);
    };

    if (elVideo.srcObject !== stream) {
      elVideo.srcObject = stream;
    }

    ev.track.onunmute = () => {
      ensureRemoteVideoPlayback("track-unmute");
      armDecodedFrameReveal();
    };

    bindRemoteInput();
    refreshRemoteCursorPosition();
    setStatus("", "Connected · waiting for video");

    await ensureRemoteVideoPlayback("ontrack");
    armDecodedFrameReveal();

    try { window.hi5?.notifyConnected?.(currentSession?.deviceId); } catch {}

    startStatsPoll();

    if (!hasEverRenderedFrame) {
      lastFrameAtMs = Date.now() + NEGOTIATION_GRACE_MS;
    }
  };

  pc.onicegatheringstatechange = () => console.log("[rtc] iceGatheringState:", pc.iceGatheringState);
  pc.oniceconnectionstatechange = () => {
    console.log("[rtc] iceConnectionState:", pc.iceConnectionState);
    if (pc.iceConnectionState === 'failed') scheduleMobileSessionReconnect('ice-failed');
  };
  pc.onconnectionstatechange = () => {
    console.log("[rtc] connectionState:", pc.connectionState);

    if (pc.connectionState === "connected") {
      const recovered = mobileRecoveryAttempts > 0 || mobileRecoveryStage !== 'Idle' || mobileReconnectDeadline > 0;
      mobileReconnectDeadline = 0;
      mobileRecoveryAttempts = 0;
      clearMobileTransportProbe();
      if (mobileReconnectTimer) { clearTimeout(mobileReconnectTimer); mobileReconnectTimer = null; }
      if (recovered) {
        mobileReconnectCooldownUntil = Date.now() + 10000;
        mobileQualityState = { current: 'good', candidate: null, count: 0, changedAt: Date.now(), samples: [] };
        setMobileQualityUi('Measuring', 'good', 'Connection restored · stabilising measurements');
      }
      setMobileRecoveryStage('Idle');
      requestMobileWakeLock();
      ensureRemoteVideoPlayback("peer-connected");
      armDecodedFrameReveal();
      if (hasEverRenderedFrame) {
        showStream();
        setStatus("online", "Streaming");
      } else {
        setStatus("", "Connected · waiting for video");
      }
    } else if (pc.connectionState === 'failed') {
      clearMobileTransportProbe();
      scheduleMobileSessionReconnect('peer-failed');
    } else if (pc.connectionState === 'disconnected' && isMobileViewerSurface()) {
      setMobileRecoveryStage('Network interrupted · checking path');
      scheduleMobileTransportHealthProbe('peer-disconnected', 3500);
    }
  };
  pc.onsignalingstatechange = () => console.log("[rtc] signalingState:", pc.signalingState);

  pc.onicecandidate = (ev) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    if (ev.candidate) {
      ws.send(JSON.stringify({
        type: "ice_candidate",
        session_id: currentSession.sessionId,
        candidate: ev.candidate.candidate,
        mid: ev.candidate.sdpMid ?? null,
        mline_index: ev.candidate.sdpMLineIndex ?? null
      }));
    }
  };

  await pc.setRemoteDescription({ type: "offer", sdp: offerSdp });
  remoteDescSet = true;
  await flushPendingIce();

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  logSdpCodecSummary("local answer", answer.sdp);

  ws.send(JSON.stringify({
    type: "webrtc_answer",
    session_id: currentSession.sessionId,
    sdp: answer.sdp,
    sdp_type: answer.type
  }));
}

/* -----------------------------------------
   Signaling / session start
------------------------------------------ */

async function onSignalMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw.data);
  } catch {
    return;
  }

  console.log("[signal] raw message:", msg);

  switch (msg.type) {
    case "viewer_connected":
      break;

    case "agent_reconnecting": {
      const graceMs = Math.max(10000, Number(msg.grace_ms || 0) || 240000);
      mobileEndpointRestartUntil = Date.now() + graceMs;
      clearMobileTransportProbe();
      if (mobileReconnectTimer) { clearTimeout(mobileReconnectTimer); mobileReconnectTimer = null; }
      mobileReconnectDeadline = 0;
      setMobileRecoveryStage('Waiting for endpoint');
      setMobileQualityUi('Reconnecting', 'reconnecting', 'Endpoint restarting');
      setStatus('', 'Waiting for endpoint…');
      teardownPeerForReconnect();
      break;
    }

    case "agent_reconnected": {
      mobileEndpointRestartUntil = 0;
      mobileQualityState = { current: 'good', candidate: null, count: 0, changedAt: Date.now(), samples: [] };
      setMobileRecoveryStage('Endpoint returned · negotiating');
      setMobileQualityUi('Measuring', 'good', 'Endpoint returned');
      setStatus('', 'Endpoint returned · reconnecting…');
      break;
    }

    case "host_disconnected": {
      if (!currentSession?.isConnectSession) break;
      connectHostReconnecting = true;
      const seamlessLoginHandoff = loginDesktopInputActive || secureDesktopActive;
      if (seamlessLoginHandoff) {
        setMobileRecoveryStage('Windows desktop handoff');
        setStatus('', 'Windows sign-in screen');
      } else {
        setMobileRecoveryStage('Waiting for customer Connect app');
        setMobileQualityUi('Reconnecting', 'reconnecting', 'Customer app reconnecting');
        setStatus('', 'Customer Connect app reconnecting…');
      }
      teardownPeerForReconnect();
      updateConnectCapabilityButtons();
      break;
    }

    case "host_reconnected": {
      if (!currentSession?.isConnectSession) break;
      connectHostReconnecting = false;
      if (loginDesktopInputActive || secureDesktopActive) {
        setMobileRecoveryStage('Windows desktop handoff');
        setStatus('', 'Windows sign-in screen');
      } else {
        setMobileRecoveryStage('Customer app returned · negotiating');
        setMobileQualityUi('Measuring', 'good', 'Customer app returned');
        setStatus('', 'Customer app returned · reconnecting…');
      }
      updateConnectCapabilityButtons();
      break;
    }

    case "connect_capabilities": {
      if (!currentSession?.isConnectSession) break;
      connectElevated = msg.elevated === true;
      connectFileAccessGranted = msg.files_granted === true;
      const heldUntil = msg.held_until ? new Date(msg.held_until).getTime() : 0;
      connectSessionHeld = Number.isFinite(heldUntil) && heldUntil > Date.now();
      if (connectElevated) {
        connectElevationPending = false;
        clearSecureDesktopState();
        showStream();
        ensureRemoteVideoPlayback('connect-elevation-ready');
        setStatus('online', 'Administrator access active · negotiating remote control');
      }
      if (connectSessionHeld) {
        teardownPeerForReconnect();
        setMobileRecoveryStage('Session on hold');
        setStatus('online', 'Session on hold · resume it from Hi5Central when ready');
      }
      updateConnectCapabilityButtons();
      break;
    }

    case "connect_permission_response": {
      if (!currentSession?.isConnectSession) break;
      const permission = String(msg.permission || '').toLowerCase();
      const approved = msg.approved === true;
      const reason = String(msg.reason || '');
      if (permission === 'files') {
        connectFilePermissionPending = false;
        connectFileAccessGranted = approved;
        if (approved) {
          setMobileFileStatus('File access approved.');
          setStatus('online', 'File access approved');
          toggleFilesPanel(true);
          requestRemoteFileList(elFilePath?.value || '/');
        } else {
          setMobileFileStatus(reason === 'permission_required'
            ? 'Customer approval is required before file access can be used.'
            : 'Customer declined file access.');
          setStatus('error', reason === 'permission_required'
            ? 'File access requires customer approval'
            : 'Customer declined file access');
        }
      } else if (permission === 'elevation') {
        if (approved && (msg.elevated === true || reason === 'already_elevated')) {
          connectElevated = true;
          connectElevationPending = false;
          setStatus('online', 'Administrator access active');
        } else if (approved) {
          connectElevationPending = true;
          setStatus('', 'Customer approved · waiting for elevated Connect app…');
        } else {
          connectElevationPending = false;
          setStatus('error', reason === 'uac_cancelled_or_failed'
            ? 'Windows administrator approval was cancelled'
            : 'Customer declined administrator access');
        }
      }
      updateConnectCapabilityButtons();
      break;
    }

    case "connect_hold_response": {
      if (!currentSession?.isConnectSession) break;
      connectSessionHeld = msg.approved === true;
      if (connectSessionHeld) {
        connectFileAccessGranted = false;
        connectFilePermissionPending = false;
        teardownPeerForReconnect();
        setMobileRecoveryStage('Session on hold');
        setMobileQualityUi('On hold', 'good', 'Customer approved hold');
      }
      setStatus(msg.approved ? 'online' : 'error',
        msg.approved
          ? 'Session on hold · customer approved return access'
          : 'Customer declined session hold');
      updateConnectCapabilityButtons();
      break;
    }

    case "connect_hold_released": {
      if (!currentSession?.isConnectSession) break;
      connectSessionHeld = false;
      mobileReconnectDeadline = 0;
      setMobileRecoveryStage('Hold released · negotiating');
      setStatus('', 'Session hold released · reconnecting…');
      updateConnectCapabilityButtons();
      break;
    }

    case "session_config": {
      if (currentSession) {
        currentSession.iceServers = normalizeIceServers(msg.ice_servers || msg.iceServers || []);
        if (elDiagIceServers) elDiagIceServers.textContent = activeIceServers().map((server) => Array.isArray(server.urls) ? server.urls.join(",") : server.urls).join(" | ");
      }
      break;
    }

    case "start_webrtc_sent":
      break;

    case "webrtc_offer":
      await handleOffer(msg);
      break;

    case "ice_candidate":
      await applyRemoteIce(msg);
      break;

    case "monitor_info": {
      remoteMonitors = Array.isArray(msg.monitors) ? msg.monitors : [];
      currentMonitorIndex = Number(msg.current ?? 0);

      if (isMobileViewerSurface() && !mobilePreferredMonitorApplied && remoteMonitors.length) {
        mobilePreferredMonitorApplied = true;
        const preferred = Number(mobilePrefs.monitorIndex);
        if (remoteMonitors.some((m) => Number(m.index) === preferred) && preferred !== currentMonitorIndex) {
          setTimeout(() => requestMonitorSwitch(preferred, { persist: false }), 80);
        }
      }

      if (pendingMonitorIndex != null && currentMonitorIndex === pendingMonitorIndex) {
        pendingMonitorIndex = null;
        monitorSwitchUntilMs = 0;
        if (isMobileViewerSurface()) { mobilePrefs.monitorIndex = currentMonitorIndex; saveMobilePrefs(); }
        setStatus("online", "Streaming");
        showStream();
      }

      updateMonitorButton();
      if (monitorMenuOpen) {
        renderMonitorMenu();
      }
      break;
    }

    case "shortcut_result": {
      const action = String(msg.action || "").toLowerCase();
      if (action === "ctrl_alt_del" || action === "cad" || action === "sas") {
        if (!msg.ok) {
          const text = msg.message || "Ctrl+Alt+Del could not be sent by Windows.";
          console.warn("[viewer] CAD unavailable", msg.code || "sas_failed", text);
          setStatus("error", text);
          setTimeout(() => {
            if (pc && pc.connectionState === "connected") setStatus("online", "Streaming");
          }, 4500);
        }
      }
      break;
    }

    case "agent_presence": {
      if (msg.technician_name) {
        setStatus("online", `Streaming · ${msg.technician_name}`);
      }
      break;
    }

    case "chat_message": {
      const appended = appendChatMessage({ ...msg, sender: msg.sender || "user" });
      if (appended) {
        renderChat();
        openTechChatWindow();
        postChatToNativeWindow(appended);
      }
      break;
    }

    case "remote_file_list": {
      remoteFileEntries = Array.isArray(msg.entries) ? msg.entries : [];
      remoteFilePath = msg.path || "/";
      if (elFilePath) elFilePath.value = remoteFilePath;
      renderRemoteFiles();
      postFileToNativeWindow(msg);
      break;
    }

    case "remote_file_download": {
      const path = String(msg.path || "");
      if (browserDownloadPaths.has(path)) {
        browserDownloadPaths.delete(path);
        saveBrowserFile(msg.name || "download", [base64ToBytes(msg.data || "")]);
        if (mobileFileTransfer) mobileFileTransfer.progress = 100;
        finishFileTransferUi(`Downloaded ${msg.name || "file"}.`, { retry: false });
        break;
      }
      const localDir = pendingRemoteDownloads.get(path);
      if (localDir) {
        msg.local_dir = localDir;
        pendingRemoteDownloads.delete(path);
      }
      postFileToNativeWindow(msg);
      break;
    }

    case "file_transfer_start": {
      const path = String(msg.path || "");
      if (msg.direction === "download" && browserDownloadPaths.has(path)) {
        browserDownloadPaths.delete(path);
        browserChunkDownloads.set(String(msg.transfer_id || ""), { name: msg.name || "download", path, parts: [], received: 0, total: Number(msg.size || 0), cancelled: !!mobileFileTransfer?.cancelled });
        if (mobileFileTransfer) mobileFileTransfer.transferId = String(msg.transfer_id || '');
        setMobileFileStatus(`Downloading ${msg.name || "file"}…`);
        break;
      }
      postFileToNativeWindow(msg);
      break;
    }
    case "file_transfer_chunk": {
      const st = browserChunkDownloads.get(String(msg.transfer_id || ""));
      if (st) {
        if (!st.cancelled) st.parts.push(base64ToBytes(msg.data || ""));
        st.received += Number(msg.size || 0);
        const pct = st.total ? Math.min(100, Math.round(st.received / st.total * 100)) : 0;
        if (mobileFileTransfer) mobileFileTransfer.progress = pct;
        setMobileFileStatus(`Downloading ${st.name}… ${pct}%`);
        updateFileTransferUi({ visible: true, percent: pct, canCancel: true, canRetry: false });
        break;
      }
      postFileToNativeWindow(msg);
      break;
    }
    case "file_transfer_complete": {
      const id = String(msg.transfer_id || "");
      const st = browserChunkDownloads.get(id);
      if (st) {
        browserChunkDownloads.delete(id);
        if (!st.cancelled) saveBrowserFile(st.name, st.parts);
        if (mobileFileTransfer) mobileFileTransfer.progress = 100;
        finishFileTransferUi(st.cancelled ? 'Download cancelled.' : `Downloaded ${st.name}.`, { retry: !!st.cancelled });
        break;
      }
      postFileToNativeWindow(msg);
      break;
    }
    case "file_transfer_error": {
      const id = String(msg.transfer_id || "");
      if (browserChunkDownloads.has(id)) {
        browserChunkDownloads.delete(id);
        finishFileTransferUi(msg.error || "File transfer failed.", { retry: true });
        break;
      }
      postFileToNativeWindow(msg);
      break;
    }
    case "remote_file_upload_complete": {
      if (mobileFileTransfer) mobileFileTransfer.progress = 100;
      finishFileTransferUi("Upload complete.", { retry: false });
      requestRemoteFileList(remoteFilePath || "/");
      postFileToNativeWindow(msg);
      break;
    }
    case "remote_file_upload_cancelled": {
      finishFileTransferUi('Upload cancelled.', { retry: true });
      break;
    }
    case "remote_file_upload_error": {
      finishFileTransferUi(msg.error || 'Upload failed.', { retry: true });
      postFileToNativeWindow(msg);
      break;
    }
    case "remote_file_download_error": {
      finishFileTransferUi(msg.error || 'Download failed.', { retry: true });
      postFileToNativeWindow(msg);
      break;
    }
    case "remote_file_delete_complete":
    case "remote_file_mkdir_complete":
    case "remote_file_rename_complete":
    case "remote_file_delete_error":
    case "remote_file_mkdir_error":
    case "remote_file_rename_error": {
      postFileToNativeWindow(msg);
      break;
    }

    case "session_state": {
      const state = msg.state || "";

      if (state === "connect_uac_customer_action_required") {
        connectElevationPending = true;
        secureDesktopActive = true;
        desktopHandoffActive = false;
        revealOnNextFrame = false;
        secureDesktopLikely = false;
        showOverlay(
          "Windows administrator approval",
          "The customer must approve the Windows User Account Control prompt on the device before remote support can continue with administrator access.",
          { spinner: true, keepVideo: true, passive: true }
        );
        setStatus('', 'Waiting for customer to approve Windows UAC on the device…');
        updateConnectCapabilityButtons();
        break;
      }

      if (state === "connect_uac_cancelled") {
        connectElevationPending = false;
        clearSecureDesktopState();
        showStream();
        setStatus('error', 'Windows administrator approval was cancelled');
        updateConnectCapabilityButtons();
        break;
      }

      if (state === "login_desktop_entering") {
        secureDesktopActive = true;
        desktopHandoffActive = false;
        loginDesktopInputActive = true;
        revealOnNextFrame = false;
        secureDesktopLikely = false;
        showLoginDesktopTransition();
        setStatus('', 'Windows sign-in screen');
        armLoginDesktopWake();
        break;
      }

      if (state === "login_desktop_ready") {
        loginDesktopInputActive = true;
        stopLoginDesktopWake();
        completeDesktopSourceTransition("login-desktop-ready");
        setStatus('online', 'Windows sign-in screen');
        break;
      }

      if (state === "secure_desktop_entering") {
        secureDesktopActive = true;
        desktopHandoffActive = false;
        loginDesktopInputActive = false;
        stopLoginDesktopWake();
        revealOnNextFrame = false;
        secureDesktopLikely = false;
        showSecureBlackOverlay();
        break;
      }

      if (state === "secure_desktop_ready") {
        completeDesktopSourceTransition("secure-desktop-ready");
        break;
      }

      if (state === "secure_desktop_exited") {
        loginDesktopInputActive = false;
        completeDesktopSourceTransition("secure-desktop-exited");
        break;
      }

      if (state === "desktop_handoff_entering") {
        desktopHandoffActive = true;
        secureDesktopActive = false;
        revealOnNextFrame = false;
        secureDesktopLikely = false;
        showSecureBlackOverlay();
        break;
      }

      if (state === "desktop_handoff_ready") {
        loginDesktopInputActive = false;
        completeDesktopSourceTransition("desktop-handoff-ready");
        break;
      }

      break;
    }

    case "viewer_disconnected":
      disconnect("Disconnected by user");
      break;

    default:
      break;
  }
}

function clearMobileTransportProbe() {
  if (mobileDisconnectProbeTimer) { clearTimeout(mobileDisconnectProbeTimer); mobileDisconnectProbeTimer = null; }
  if (mobileTransportProbeTimer) { clearTimeout(mobileTransportProbeTimer); mobileTransportProbeTimer = null; }
}

function scheduleMobileTransportHealthProbe(reason = 'transport-probe', delayMs = 3500) {
  if (!currentSession || !isMobileViewerSurface() || currentSession.viewerClient !== 'browser') return false;
  if (mobileEndpointRestartUntil > Date.now()) return false;
  if (mobileTransportProbeTimer) clearTimeout(mobileTransportProbeTimer);
  const cooldownRemaining = Math.max(0, mobileReconnectCooldownUntil - Date.now());
  const waitMs = Math.max(delayMs, Math.min(8000, cooldownRemaining));
  mobileTransportProbeTimer = setTimeout(() => {
    mobileTransportProbeTimer = null;
    if (!currentSession || document.hidden) return;
    const peerState = pc?.connectionState || '';
    const socketOpen = ws?.readyState === WebSocket.OPEN;
    if (peerState === 'connected' && socketOpen) {
      setMobileRecoveryStage('Idle');
      return;
    }
    if (peerState === 'connecting' || pc?.iceConnectionState === 'checking') {
      scheduleMobileTransportHealthProbe(reason, 2500);
      return;
    }
    if (!socketOpen || peerState === 'failed' || peerState === 'disconnected' || !pc) {
      scheduleMobileSessionReconnect(reason, { closeSocket: !!ws });
    }
  }, waitMs);
  return true;
}

function teardownPeerForReconnect() {
  clearMobileTransportProbe();
  stopStatsPoll();
  const frozen = captureReconnectPoster();
  remoteDescSet = false;
  pendingRemoteIce = [];
  if (inputDc) { try { inputDc.close(); } catch {} inputDc = null; }
  if (inputControlDc) { try { inputControlDc.close(); } catch {} inputControlDc = null; }
  if (mouseMoveDc) { try { mouseMoveDc.close(); } catch {} mouseMoveDc = null; }
  if (pc) { try { pc.onconnectionstatechange = null; pc.oniceconnectionstatechange = null; pc.close(); } catch {} pc = null; }
  if (frozen && elVideo) {
    try { elVideo.pause(); } catch {}
    try { elVideo.srcObject = null; } catch {}
    elVideo.classList.add("visible");
  }
}

function connectViewerSignaling(reason = 'initial') {
  if (!currentSession) return false;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return true;
  const { sessionId, deviceId, token, wssUrl, viewerClient } = currentSession;
  const url =
    `${wssUrl}?session_id=${encodeURIComponent(sessionId)}` +
    `&device_id=${encodeURIComponent(deviceId)}` +
    (token ? `&token=${encodeURIComponent(token)}` : '') +
    (viewerClient ? `&client=${encodeURIComponent(viewerClient)}` : '');
  console.log('[viewer] opening signaling socket', { sessionId, deviceId, reason, attempt: mobileRecoveryAttempts });
  const socket = new WebSocket(url);
  ws = socket;
  socket.onopen = () => {
    if (ws !== socket) return;
    setStatus('', mobileRecoveryAttempts ? 'Reconnecting…' : 'Connected');
    setMobileRecoveryStage(mobileRecoveryAttempts ? 'Signaling restored' : 'Idle');
    if (mobileRecoveryAttempts > 0) {
      const attempt = mobileRecoveryAttempts;
      window.setTimeout(() => {
        if (!currentSession || ws !== socket || document.hidden) return;
        if (mobileRecoveryAttempts !== attempt) return;
        if (pc?.connectionState === 'connected') return;
        if (mobileReconnectDeadline && Date.now() >= mobileReconnectDeadline) {
          setMobileRecoveryStage('Recovery failed');
          disconnect('Connection lost');
          return;
        }
        scheduleMobileSessionReconnect('media-negotiation-timeout');
      }, 8000);
    }
  };
  socket.onmessage = onSignalMessage;
  socket.onerror = () => {
    if (ws !== socket) return;
    const recoverableConnect = !!currentSession?.isConnectSession;
    const recoverableMobile = isMobileViewerSurface() && currentSession?.viewerClient === 'browser';
    if (recoverableConnect || recoverableMobile) {
      setMobileRecoveryStage('Network interrupted');
      scheduleMobileSessionReconnect('signaling-error');
      return;
    }
    disconnect('Connection error');
  };
  socket.onclose = (event) => {
    if (ws === socket) ws = null;
    if (!currentSession) return;

    // A newer Viewer has deliberately taken ownership of this Connect session.
    // The superseded mobile tab must not reconnect and steal it back.
    if (event?.code === 4001) {
      disconnect('Viewer opened elsewhere', { silent: true });
      return;
    }

    const recoverableConnect = !!currentSession.isConnectSession;
    const recoverableMobile = isMobileViewerSurface() && currentSession.viewerClient === 'browser';
    if (recoverableConnect || recoverableMobile) {
      scheduleMobileSessionReconnect('signaling-closed', { closeSocket: false });
      return;
    }
    disconnect('Disconnected');
  };
  return true;
}

function scheduleMobileSessionReconnect(reason = 'network-recovery', { closeSocket = true } = {}) {
  if (!currentSession) return false;
  const recoverableConnect = !!currentSession.isConnectSession;
  const recoverableMobile = isMobileViewerSurface() && currentSession.viewerClient === 'browser';
  if (!recoverableConnect && !recoverableMobile) return false;
  if (recoverableConnect && connectSessionHeld) return false;
  if (!recoverableConnect && mobileEndpointRestartUntil > Date.now()) return false;
  if (String(reason).includes('frame-stall')) return false;
  const now = Date.now();
  if (!mobileReconnectDeadline) {
    if (recoverableConnect) mobileReconnectDeadline = now + 240000;
    else mobileReconnectDeadline = now + 85000;
  }
  if (document.hidden) {
    setMobileRecoveryStage('Suspended · reconnect pending');
    if (!mobileReconnectTimer) {
      mobileReconnectTimer = setTimeout(() => { mobileReconnectTimer = null; scheduleMobileSessionReconnect('background-resume-pending', { closeSocket: false }); }, 1500);
    }
    return true;
  }
  if (now >= mobileReconnectDeadline) {
    setMobileRecoveryStage('Recovery failed');
    disconnect('Connection lost');
    return false;
  }
  if (mobileReconnectTimer) return true;
  mobileRecoveryAttempts += 1;
  setMobileRecoveryStage('Reconnecting · attempt ' + mobileRecoveryAttempts);
  setMobileQualityUi('Reconnecting', 'reconnecting', reason);
  const anchor = captureMobileViewportAnchor() || mobileViewportStableAnchor;
  if (anchor) mobileViewportResumeAnchor = { ...anchor };
  teardownPeerForReconnect();
  if (closeSocket && ws) {
    const old = ws; ws = null;
    try { old.onclose = null; old.onerror = null; old.close(4002, 'Mobile reconnect'); } catch {}
  }
  const delay = Math.min(2800, 350 + (mobileRecoveryAttempts - 1) * 550);
  mobileReconnectTimer = setTimeout(() => {
    mobileReconnectTimer = null;
    if (!currentSession || document.hidden) {
      if (currentSession) scheduleMobileSessionReconnect('resume-pending', { closeSocket: false });
      return;
    }
    if (!connectViewerSignaling(reason) && Date.now() < mobileReconnectDeadline) {
      scheduleMobileSessionReconnect(reason, { closeSocket: false });
    }
  }, delay);
  return true;
}

function startSession(params) {
  console.log("[viewer] starting authorised remote session");

  disconnect(undefined, { silent: true });

  params = params || {};

  const sessionId = params.session_id || params.sessionId || "";
  const token = params.token || params.viewer_token || params.viewerToken || "";
  const deviceId = params.device_id || params.deviceId || "";
  const wssUrl = params.wss_url || params.wssUrl || params.signaling_url || params.signalingUrl || "";
  const iceServers = normalizeIceServers(params.ice_servers || params.iceServers || []);
  const viewerClient = params.viewer_client || params.viewerClient || '';
  const modeValue = String(params.mode || params.session_mode || params.sessionMode || "console").toLowerCase();
  const launchMode = (modeValue === "backstage" || modeValue === "background" || modeValue === "background_mode") ? "backstage" : "console";

  if (!sessionId || !deviceId || !token || !wssUrl) {
    console.error("[viewer] invalid connection parameters");
    disconnect("Invalid connection parameters");
    return;
  }

  currentSession = {
    sessionId,
    token,
    deviceId,
    wssUrl,
    iceServers,
    viewerClient,
    launchMode,
    isConnectSession: /\/connect\/viewer\/ws(?:\?|$)/i.test(String(wssUrl || ''))
  };
  connectFileAccessGranted = false;
  connectFilePermissionPending = false;
  connectElevationPending = false;
  connectElevated = false;
  connectHostReconnecting = false;
  connectSessionHeld = false;

  if (isMobileViewerSurface()) activateMobileHistoryGuard();
  loadMobilePrefsForDevice(deviceId);
  resetMobileAdaptiveState();

  if (isMobileViewerSurface()) {
    setMobileToolbarCollapsed(false);
    updateMobileModeUi();
    applyViewerScalePreference();
    scheduleMobileToolbarHide(6500);
  }

  remoteMonitors = [];
  currentMonitorIndex = 0;
  pendingMonitorIndex = null;
  updateMonitorButton();
  closeMonitorMenu();

  if (elBtnDisc) elBtnDisc.disabled = false;
  if (elBtnElevate) {
    elBtnElevate.hidden = !currentSession.isConnectSession;
    elBtnElevate.disabled = !currentSession.isConnectSession;
    elBtnElevate.title = currentSession.isConnectSession ? "Request administrator access" : "Administrator access";
  }
  if (elBtnFiles) elBtnFiles.disabled = false;
  if (elBtnChat) elBtnChat.disabled = false;
  if (elBtnAudio) elBtnAudio.disabled = false;
  if (elBtnBlockInput) elBtnBlockInput.disabled = false;
  setRemoteAudioEnabled(false);
  setLocalInputBlocked(false, false);
  if (elBtnKeyboard) elBtnKeyboard.disabled = false;
  if (elMobileClipboardPaste) elMobileClipboardPaste.disabled = false;
  if (elMobileClipboardCopy) elMobileClipboardCopy.disabled = false;
  if (elBtnBackstage) {
    elBtnBackstage.hidden = launchMode !== "backstage";
    elBtnBackstage.disabled = true;
    elBtnBackstage.classList.toggle("session-toggle-active", launchMode === "backstage");
  }
  if (elBtnConsole) {
    elBtnConsole.hidden = launchMode !== "console";
    elBtnConsole.disabled = true;
    elBtnConsole.classList.toggle("session-toggle-active", launchMode === "console");
  }
  if (elBtnStartMenu) elBtnStartMenu.disabled = false;
  if (elBtnCad) elBtnCad.disabled = !!currentSession.isConnectSession;
  updateConnectCapabilityButtons();
  if (elDeviceLabel) elDeviceLabel.textContent = deviceId || "";

  setStatus("", "Connecting…");
  showOverlay("Connecting", "Starting remote session…", { spinner: true });

  mobileReconnectDeadline = 0;
  mobileRecoveryAttempts = 0;
  connectViewerSignaling('initial');
}


if (elBtnBackstage) {
  elBtnBackstage.addEventListener("click", () => sendBackstageMode(true));
}
if (elBtnConsole) {
  elBtnConsole.addEventListener("click", () => sendBackstageMode(false));
}
if (elBtnStartMenu) {
  elBtnStartMenu.addEventListener("click", () => sendShortcut("start_menu"));
}
if (elBtnCad) {
  elBtnCad.addEventListener("click", () => sendShortcut("ctrl_alt_del"));
}

/* -----------------------------------------
   App entry
------------------------------------------ */

showOverlay(
  "Hi5Central Viewer",
  "Launch this app from Hi5Central to start a remote desktop session."
);
updateMonitorButton();

try {
  window.hi5?.onConnect((params) => {
    console.log("[viewer] native launch received");
    startSession(params);
  });
} catch (e) {
  console.error("[viewer] failed to bind hi5 connect hook:", e);
}

// Browser/mobile shells can start the same WebRTC viewer without the native
// WebView host. The server supplies a short-lived session token and per-session ICE credentials.
window.hi5RemoteViewer = Object.freeze({
  start: (params) => startSession(params),
  disconnect: () => disconnect("Disconnected by technician", { closeNative: true }),
  recover: (reason = 'browser-resume') => {
    if (!currentSession) return false;
    ensureRemoteVideoPlayback(reason);
    if (pc?.connectionState === 'connected' && ws?.readyState === WebSocket.OPEN) return true;
    return scheduleMobileSessionReconnect(reason, { closeSocket: false });
  },
  isConnected: () => !!(pc && pc.connectionState === "connected")
});

if (elBtnElevate) elBtnElevate.addEventListener("click", requestConnectElevation);
if (elBtnFiles) elBtnFiles.addEventListener("click", openFilesWithPermission);
if (elBtnChat) elBtnChat.addEventListener("click", () => toggleChatPanel(true));
if (elFilesClose) elFilesClose.addEventListener("click", () => toggleFilesPanel(false));
if (elChatClose) elChatClose.addEventListener("click", () => toggleChatPanel(false));
if (elFileRefresh) elFileRefresh.addEventListener("click", () => requestRemoteFileList(elFilePath?.value || "/"));
elFileTransferCancel?.addEventListener('click', () => {
  if (!mobileFileTransfer) return;
  mobileFileTransfer.cancelled = true;
  if (mobileFileTransfer.type === 'upload' && mobileFileTransfer.transferId) {
    sendRemoteFileRequest('remote_file_upload_cancel', { transfer_id: mobileFileTransfer.transferId, path: mobileFileTransfer.path || '' });
  } else if (mobileFileTransfer.type === 'download' && mobileFileTransfer.transferId) {
    const st = browserChunkDownloads.get(mobileFileTransfer.transferId);
    if (st) st.cancelled = true;
  }
  finishFileTransferUi((mobileFileTransfer.type === 'upload' ? 'Upload' : 'Download') + ' cancelled.', { retry: true });
});
elFileTransferRetry?.addEventListener('click', async () => {
  const previous = mobileFileTransfer;
  if (!previous) return;
  if (previous.type === 'upload' && previous.files?.length) await uploadBrowserFiles(previous.files);
  else if (previous.type === 'download' && previous.entry) requestBrowserDownload(previous.entry);
});
if (elFileUpload) elFileUpload.addEventListener("click", () => elFileUploadInput?.click());
if (elFileUploadInput) elFileUploadInput.addEventListener("change", async () => {
  await uploadBrowserFiles(elFileUploadInput.files);
  elFileUploadInput.value = "";
  requestRemoteFileList(remoteFilePath || "/");
});
if (elChatSend) elChatSend.addEventListener("click", sendChatMessage);
if (elChatInput) elChatInput.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } });
