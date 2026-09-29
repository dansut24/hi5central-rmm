import { Fragment, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCode2,
  GitBranch,
  Monitor,
  PackageCheck,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  WifiOff,
  Wrench,
  X,
} from 'lucide-react'
import {
  approveVendorSource,
  archiveVendorSource,
  createPatchAssignment,
  createPatchPolicy,
  evaluateWindowsUpdatePolicies,
  pauseWindowsUpdateRollout,
  resumeWindowsUpdateRollout,
  rollbackWindowsUpdateRelease,
  createSoftwareCatalogueEntry,
  createVendorSource,
  deletePatchAssignment,
  deleteSoftwareCatalogueEntry,
  deploySoftwarePatch,
  deploySoftwarePatches,
  installSoftwareFromCatalogue,
  loadRmmPatching,
  loadRmmVulnerabilities,
  loadSoftwareQualificationLab,
  planSoftwarePatches,
  previewPatchAssignment,
  remediateVulnerabilityExposure,
  searchSoftwareCatalogue,
  testVendorSource,
  updatePatchPolicy,
  updateVendorSource,
  updateSoftwareValidation,
  revalidateSoftwareCatalogueEntry,
  retrySoftwareQualification,
  runSoftwareQualificationAction,
} from '../../lib/rmmPatchingApi.js'
import { loadRmmScope } from '../../lib/rmmScopeApi.js'
import './RmmPatching.css'

function StatusPill({ children, tone = 'neutral' }) {
  return <span className={`rmm-status-pill ${tone}`}>{children}</span>
}

function rmmPortalThemeStyle() {
  if (typeof document === 'undefined') return {}
  const root = document.querySelector('.rmm-app')
  if (!root) return {}
  const computed = window.getComputedStyle(root)
  const names = [
    '--rmm-bg',
    '--rmm-surface',
    '--rmm-soft',
    '--rmm-soft-strong',
    '--rmm-text',
    '--rmm-muted',
    '--rmm-border',
    '--rmm-sidebar',
    '--rmm-sidebar-2',
    '--rmm-accent',
    '--rmm-accent-soft',
    '--rmm-shadow',
  ]
  return Object.fromEntries(names.map((name) => [name, computed.getPropertyValue(name).trim()]))
}
function patchTone(status) {
  if (status === 'provider_blocked') return 'critical'
  if (status === 'update_available' || status === 'older_version_present') return 'warning'
  if (status === 'current') return 'healthy'
  if (status === 'detection_pending') return 'running'
  return 'neutral'
}

function versionAtLeast(current = '', required = '') {
  const left = String(current).match(/\d+/g)?.map(Number) || []
  const right = String(required).match(/\d+/g)?.map(Number) || []
  const size = Math.max(left.length, right.length)
  for (let index = 0; index < size; index += 1) {
    const delta = (left[index] || 0) - (right[index] || 0)
    if (delta) return delta > 0
  }
  return Boolean(left.length && right.length)
}

function patchLabel(status) {
  return ({
    update_available: 'Update available',
    provider_blocked: 'Provider blocked',
    current: 'Current',
    older_version_present: 'Target installed · older version remains',
    detection_pending: 'Detection pending',
    unmapped: 'Unmapped',
    unsupported: 'Unsupported',
  })[status] || status
}
function qualificationLabel(state) {
  return ({
    qualified: 'Qualified',
    qualified_limited: 'Qualified — limited capabilities',
    deployment_candidate: 'Deployment candidate',
    intelligence_only: 'Intelligence only',
    blocked: 'Blocked',
  })[state] || 'Not classified'
}
function qualificationTone(state) {
  if (state === 'qualified') return 'healthy'
  if (state === 'qualified_limited') return 'warning'
  if (state === 'deployment_candidate') return 'running'
  if (state === 'blocked') return 'critical'
  return 'neutral'
}
function readinessTone(state) {
  if (['ready', 'healthy', 'verified', 'passed', 'covered'].includes(state)) return 'healthy'
  if (['attention', 'blocked', 'failed', 'review_required'].includes(state)) return 'critical'
  if (['missing', 'legacy_pass', 'unavailable', 'limited', 'unsupported', 'no_published_identity'].includes(state)) return 'warning'
  if (['queued', 'not_tested', 'pending', 'cancelled', 'not_implemented'].includes(state)) return 'neutral'
  return 'running'
}
function readinessLabel(state) {
  return String(state || 'pending').replaceAll('_', ' ')
}

function PageHeading({ action }) {
  return (
    <div className="rmm-page-heading">
      <div>
        <span className="rmm-eyebrow">Maintenance</span>
        <h1>Patching</h1>
        <p>Software catalogue, Windows Update and patch policy targeting.</p>
      </div>
      {action}
    </div>
  )
}

function Metric({ icon: Icon, label, value, tone = '' }) {
  return <div className={tone}><span><Icon size={17} /></span><div><strong>{value}</strong><small>{label}</small></div></div>
}
function MappingModal({ application, onClose, onSave }) {
  const [form, setForm] = useState({
    canonicalName: application?.name || '',
    publisher: application?.publisher || '',
    namePattern: application?.name || '',
    publisherPattern: application?.publisher || '',
    provider: 'winget',
    packageId: '',
    targetVersion: '',
    releaseChannel: 'stable',
  })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const valid = form.canonicalName.trim().length > 1 && form.namePattern.trim().length > 1

  return <div className="rmm-patch-modal-backdrop">
    <form className="rmm-patch-modal" onSubmit={(event) => {
      event.preventDefault()
      if (valid) onSave(form)
    }}>
      <header>
        <div><span className="rmm-eyebrow">Software catalogue</span><h2>Map patchable software</h2></div>
        <button aria-label="Close" onClick={onClose} type="button"><X size={17} /></button>
      </header>
      <p>Map real inventory to a controlled patch provider. The complete catalogue remains server-side.</p>
      <div className="rmm-patch-form-grid">
        <label>Canonical application<input autoFocus value={form.canonicalName} onChange={(event) => update('canonicalName', event.target.value)} /></label>
        <label>Publisher<input value={form.publisher} onChange={(event) => update('publisher', event.target.value)} /></label>
        <label>Name contains<input value={form.namePattern} onChange={(event) => update('namePattern', event.target.value)} /></label>
        <label>Publisher contains<input value={form.publisherPattern} onChange={(event) => update('publisherPattern', event.target.value)} /></label>
        <label>Provider<select value={form.provider} onChange={(event) => update('provider', event.target.value)}><option value="winget">WinGet</option><option value="managed">Hi5Central managed</option><option value="vendor">Vendor updater</option></select></label>
        <label>Package ID<input value={form.packageId} onChange={(event) => update('packageId', event.target.value)} placeholder="e.g. Google.Chrome" /></label>
        <label>Target version<input value={form.targetVersion} onChange={(event) => update('targetVersion', event.target.value)} placeholder="Leave blank until confirmed" /></label>
        <label>Release channel<input value={form.releaseChannel} onChange={(event) => update('releaseChannel', event.target.value)} /></label>
      </div>
      <div className="rmm-patch-security-note">
        <ShieldCheck size={16} />
        <span><strong>Catalogue protection:</strong> only a per-job package manifest will ever be sent to PatchHost.</span>
      </div>
      <footer>
        <button onClick={onClose} type="button">Cancel</button>
        <button className="rmm-primary" disabled={!valid} type="submit"><PackageCheck size={15} /> Save mapping</button>
      </footer>
    </form>
  </div>
}

function SoftwareValidationModal({ application, source, onClose, onSave, saving }) {
  const catalogue = application?.catalogue || {}
  const sourceMeta = source?.metadata || {}
  const verification = catalogue.verification || {}
  const execution = catalogue.execution || {}
  const vulnerabilityIdentity = catalogue.vulnerabilityIdentity || {}
  const vulnerabilityAudit = catalogue.vulnerabilityIdentityAudit || {}
  const [feedback, setFeedback] = useState(null)
  const [form, setForm] = useState({
    canonicalName: catalogue.canonicalName || application?.name || '',
    publisher: catalogue.publisher || application?.publisher || '',
    namePattern: catalogue.namePattern || application?.name || '',
    publisherPattern: catalogue.publisherPattern || application?.publisher || '',
    sourceUrl: source?.source_url || '',
    repository: sourceMeta.repository || '',
    assetPattern: sourceMeta.assetPattern || '',
    checksumAssetPattern: sourceMeta.checksumAssetPattern || '',
    releaseTagPattern: sourceMeta.releaseTagPattern || '',
    staticInstallerUrl: sourceMeta.staticInstallerUrl || '',
    staticSha256: sourceMeta.staticSha256 || '',
    staticReleaseUrl: sourceMeta.staticReleaseUrl || '',
    expectedSigner: catalogue.expectedSigner || '',
    verificationMethod: verification.method || verification.provider || 'winget',
    verificationPackageId: verification.packageId || catalogue.executionPackageId || catalogue.packageId || '',
    productCode: verification.productCode || '',
    filePath: verification.filePath || '',
    displayNameContains: verification.displayNameContains || catalogue.namePattern || '',
    verificationPublisher: verification.publisherContains || catalogue.publisherPattern || '',
    versionTransform: verification.versionTransform || '',
    installArguments: execution.installArguments || '',
    responseFileName: execution.responseFile?.fileName || '',
    responseFileContent: execution.responseFile?.content || '',
    nvdVendor: vulnerabilityIdentity.nvdVendor || '',
    nvdProduct: vulnerabilityIdentity.nvdProduct || '',
    osvEcosystem: vulnerabilityIdentity.osvEcosystem || '',
    osvPackage: vulnerabilityIdentity.osvPackage || '',
    githubRepository: vulnerabilityIdentity.githubRepository || '',
    vulnerabilityDisposition: vulnerabilityIdentity.disposition || '',
    vulnerabilityIdentityNote: vulnerabilityIdentity.note || '',
  })
  const update = (key, value) => {
    setFeedback(null)
    setForm((current) => ({ ...current, [key]: value }))
  }
  const vendorManaged = Boolean(catalogue.builtIn && catalogue.sourceKey)

  async function submitValidation(event) {
    event.preventDefault()
    setFeedback({ tone: 'running', message: 'Saving validation settings and running validation…' })
    const result = await onSave({
      canonicalName: form.canonicalName,
      publisher: form.publisher,
      namePattern: form.namePattern,
      publisherPattern: form.publisherPattern,
      sourceUrl: form.sourceUrl,
      repository: form.repository,
      assetPattern: form.assetPattern,
      checksumAssetPattern: form.checksumAssetPattern,
      releaseTagPattern: form.releaseTagPattern,
      staticInstallerUrl: form.staticInstallerUrl,
      staticSha256: form.staticSha256,
      staticReleaseUrl: form.staticReleaseUrl,
      expectedSigner: form.expectedSigner,
      verification: {
        ...verification,
        method: form.verificationMethod,
        packageId: form.verificationPackageId,
        productCode: form.productCode,
        filePath: form.filePath,
        displayNameContains: form.displayNameContains,
        publisherContains: form.verificationPublisher,
        versionTransform: form.versionTransform,
      },
      execution: {
        ...execution,
        installArguments: form.installArguments,
        responseFile: form.responseFileName || form.responseFileContent
          ? { fileName: form.responseFileName, content: form.responseFileContent }
          : null,
      },
      vulnerabilityIdentity: {
        nvdVendor: form.nvdVendor,
        nvdProduct: form.nvdProduct,
        osvEcosystem: form.osvEcosystem,
        osvPackage: form.osvPackage,
        githubRepository: form.githubRepository,
        disposition: form.vulnerabilityDisposition,
        note: form.vulnerabilityIdentityNote,
      },
    })
    if (result?.success) {
      setFeedback({
        tone: result.warning ? 'warning' : 'success',
        message: result.message || 'Saved successfully. Source revalidation has started.',
      })
      if (result.installArguments !== undefined) {
        setForm((current) => ({ ...current, installArguments: result.installArguments }))
      }
      return
    }
    setFeedback({
      tone: result?.saved ? 'warning' : 'error',
      message: result?.error || 'Unable to save and revalidate this software.',
    })
  }

  return <div className="rmm-patch-modal-backdrop">
    <form className="rmm-patch-modal" onSubmit={submitValidation}>
      <header>
        <div><span className="rmm-eyebrow">Per-software validation</span><h2>{catalogue.canonicalName || application?.name}</h2></div>
        <button aria-label="Close" onClick={onClose} type="button"><X size={17} /></button>
      </header>
      <p>Changes affect only this catalogue item. Trust-affecting edits remove its previous qualification until the source, artifact and endpoint tests pass again.</p>
      <div className="rmm-patch-form-grid">
        <label>Canonical application<input value={form.canonicalName} onChange={(event) => update('canonicalName', event.target.value)} /></label>
        <label>Publisher<input value={form.publisher} onChange={(event) => update('publisher', event.target.value)} /></label>
        <label>Installed name contains<input value={form.namePattern} onChange={(event) => update('namePattern', event.target.value)} /></label>
        <label>Installed publisher contains<input value={form.publisherPattern} onChange={(event) => update('publisherPattern', event.target.value)} /></label>
        {vendorManaged && <><label>Vendor source URL<input value={form.sourceUrl} onChange={(event) => update('sourceUrl', event.target.value)} /></label>
        <label>Repository<input value={form.repository} onChange={(event) => update('repository', event.target.value)} placeholder="owner/repository" /></label>
        <label>Installer asset pattern<input value={form.assetPattern} onChange={(event) => update('assetPattern', event.target.value)} /></label>
        <label>Checksum asset pattern<input value={form.checksumAssetPattern} onChange={(event) => update('checksumAssetPattern', event.target.value)} /></label>
        <label>Release tag pattern<input value={form.releaseTagPattern} onChange={(event) => update('releaseTagPattern', event.target.value)} /></label>
        <label>Static installer URL<input value={form.staticInstallerUrl} onChange={(event) => update('staticInstallerUrl', event.target.value)} /></label>
        <label>Static SHA-256<input value={form.staticSha256} onChange={(event) => update('staticSha256', event.target.value)} /></label>
        <label>Static release URL<input value={form.staticReleaseUrl} onChange={(event) => update('staticReleaseUrl', event.target.value)} /></label>
        <label>Expected Authenticode signer<input value={form.expectedSigner} onChange={(event) => update('expectedSigner', event.target.value)} /></label></>}
        <div className="rmm-validation-section-title wide">
          <strong>Install & verification</strong>
          <span>These values are used by deployment qualification and optional lifecycle tests. The installed result is verified independently from installer exit code.</span>
        </div>
        <label>Verification method<select value={form.verificationMethod} onChange={(event) => update('verificationMethod', event.target.value)}><option value="winget">WinGet package identity</option><option value="uninstall_registry">Uninstall registry / MSI identity</option><option value="file_version">Installed EXE/DLL file version</option></select></label>
        {form.verificationMethod === 'winget' && <label>Verification package ID<input value={form.verificationPackageId} onChange={(event) => update('verificationPackageId', event.target.value)} placeholder="e.g. timokoessler.2FAGuard" /></label>}
        {form.verificationMethod === 'uninstall_registry' && <label>MSI ProductCode<input value={form.productCode} onChange={(event) => update('productCode', event.target.value)} placeholder="Optional {GUID}" /></label>}
        {form.verificationMethod === 'file_version' && <label className="wide">Installed EXE/DLL path<input value={form.filePath} onChange={(event) => update('filePath', event.target.value)} placeholder="%ProgramFiles%\\Vendor\\App\\app.exe" /></label>}
        <label>Verification display name<input value={form.displayNameContains} onChange={(event) => update('displayNameContains', event.target.value)} /></label>
        <label>Verification publisher<input value={form.verificationPublisher} onChange={(event) => update('verificationPublisher', event.target.value)} /></label>
        <label>Version transform<input value={form.versionTransform} onChange={(event) => update('versionTransform', event.target.value)} placeholder="Normally blank" /></label>
        <label>Silent install arguments<input value={form.installArguments} onChange={(event) => update('installArguments', event.target.value)} /></label>
        <label className="wide">Vendor response-file name<input value={form.responseFileName} onChange={(event) => update('responseFileName', event.target.value)} placeholder="Optional, e.g. setup.xml" /></label>
        <label className="wide">Vendor response-file content<textarea rows={8} value={form.responseFileContent} onChange={(event) => update('responseFileContent', event.target.value)} placeholder="Optional. Use {HI5_TARGET_VERSION} for the release being tested. Silent arguments must reference {HI5_RESPONSE_FILE}." /></label>
        {(form.responseFileName || form.responseFileContent) && <div className="rmm-validation-identity-state wide">
          <FileCode2 size={15} />
          <span><strong>Job-scoped response file:</strong> written only inside the PatchHost job directory, substituted into <code>{'{HI5_RESPONSE_FILE}'}</code>, then purged after the job.</span>
        </div>}

        <div className="rmm-validation-section-title wide">
          <strong>Vulnerability identity</strong>
          <span>Use the authoritative identity source that actually tracks this application. You can keep unused identity types blank.</span>
        </div>
        <label className="wide">Identity disposition<select value={form.vulnerabilityDisposition} onChange={(event) => {
          const value = event.target.value
          setFeedback(null)
          setForm((current) => value === 'no_published_identity'
            ? { ...current, vulnerabilityDisposition: value, nvdVendor: '', nvdProduct: '', osvEcosystem: '', osvPackage: '', githubRepository: '' }
            : { ...current, vulnerabilityDisposition: value })
        }}><option value="">Authoritative identity required / still researching</option><option value="no_published_identity">No published authoritative identity found</option></select></label>
        {form.vulnerabilityDisposition === 'no_published_identity'
          ? <label className="wide">Review note<input value={form.vulnerabilityIdentityNote} onChange={(event) => update('vulnerabilityIdentityNote', event.target.value)} placeholder="What was checked / why no authoritative identity is available" /></label>
          : <>
        <label className="wide">GitHub repository<input value={form.githubRepository} onChange={(event) => update('githubRepository', event.target.value)} placeholder="owner/repository — e.g. timokoessler/2FAGuard" /></label>
        <label>NVD vendor<input value={form.nvdVendor} onChange={(event) => update('nvdVendor', event.target.value)} placeholder="CPE vendor token" /></label>
        <label>NVD product<input value={form.nvdProduct} onChange={(event) => update('nvdProduct', event.target.value)} placeholder="CPE product token" /></label>
        <label>OSV ecosystem<input value={form.osvEcosystem} onChange={(event) => update('osvEcosystem', event.target.value)} placeholder="e.g. npm, PyPI, GIT" /></label>
        <label>OSV package<input value={form.osvPackage} onChange={(event) => update('osvPackage', event.target.value)} placeholder="Package name / repository URI" /></label>
        </>}
        <div className="rmm-validation-identity-state wide">
          <ShieldCheck size={15} />
          <span><strong>Current identity:</strong> {readinessLabel(vulnerabilityAudit.state || 'needs_review')}{vulnerabilityAudit.resolvedSource ? ' · ' + vulnerabilityAudit.resolvedSource : ''}{vulnerabilityAudit.checkedAt ? ' · checked ' + labDate(vulnerabilityAudit.checkedAt) : ''}</span>
        </div>
      </div>
      <div className="rmm-patch-security-note"><ShieldCheck size={16} /><span><strong>Fail closed:</strong> a changed source or signer is not deployable again until validation succeeds.</span></div>
      {feedback && <div className={'rmm-validation-feedback ' + feedback.tone} role={feedback.tone === 'error' ? 'alert' : 'status'} aria-live="polite">
        {feedback.tone === 'success'
          ? <CheckCircle2 size={16} />
          : feedback.tone === 'running'
            ? <RefreshCw size={16} className="spin" />
            : <AlertTriangle size={16} />}
        <span>{feedback.message}</span>
      </div>}
      <footer><button onClick={onClose} type="button">{feedback?.tone === 'success' ? 'Close' : 'Cancel'}</button><button className="rmm-primary" disabled={saving || form.canonicalName.trim().length < 2 || form.namePattern.trim().length < 2} type="submit"><RefreshCw size={15} /> {saving ? 'Saving & revalidating…' : 'Save & revalidate'}</button></footer>
    </form>
  </div>
}

function VendorSourceModal({ source, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    displayName: source?.display_name || '',
    sourceType: source?.source_type || 'github_releases',
    canonicalName: source?.canonical_name || '',
    publisher: source?.publisher || '',
    repository: source?.repository || '',
    sourceUrl: source?.source_url || '',
    versionPath: source?.parser_config?.versionPath || '',
    releaseDatePath: source?.parser_config?.releaseDatePath || '',
    releaseUrlPath: source?.parser_config?.releaseUrlPath || '',
    installerUrlPath: source?.parser_config?.installerUrlPath || '',
    sha256Path: source?.parser_config?.sha256Path || '',
    productCodePath: source?.parser_config?.productCodePath || '',
    staticVersion: source?.parser_config?.staticVersion || source?.latest_version || '',
    staticInstallerUrl: source?.parser_config?.staticInstallerUrl || source?.latest_installer_url || '',
    staticSha256: source?.parser_config?.staticSha256 || source?.latest_installer_sha256 || '',
    staticReleaseUrl: source?.parser_config?.staticReleaseUrl || source?.source_url || '',
    deploymentMode: source?.deployment_mode || 'winget_preferred',
    providerPackageId: source?.provider_package_id || '',
    verificationMethod: source?.verification_config?.method || (source?.deployment_mode === 'vendor_direct' && !source?.provider_package_id ? 'uninstall_registry' : 'winget'),
    productCode: source?.verification_config?.productCode || '',
    verificationDisplayName: source?.verification_config?.displayNameContains || source?.name_pattern || source?.canonical_name || '',
    verificationPublisher: source?.verification_config?.publisherContains || source?.publisher_pattern || source?.publisher || '',
    filePath: source?.verification_config?.filePath || '',
    expectedSigner: source?.expected_signer || '',
    namePattern: source?.name_pattern || source?.canonical_name || '',
    publisherPattern: source?.publisher_pattern || source?.publisher || '',
    assetPattern: source?.asset_pattern || '',
    checksumAssetPattern: source?.checksum_asset_pattern || '',
    installerType: source?.installer_type || '',
    installArguments: source?.install_arguments || '',
    channel: source?.channel || 'stable',
    architecture: source?.architecture || 'x64',
    pollMinutes: source?.poll_minutes || 60,
  })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const direct = form.deploymentMode === 'vendor_direct'
  const winget = form.deploymentMode === 'winget_preferred'
  const github = form.sourceType === 'github_releases'
  const json = form.sourceType === 'vendor_json'
  const sourceReady = github
    ? form.repository.trim().length > 2
    : json
      ? form.sourceUrl.trim().startsWith('https://') && form.versionPath.trim()
      : Boolean(form.staticVersion.trim() && form.staticInstallerUrl.trim().startsWith('https://') && /^[A-Fa-f0-9]{64}$/.test(form.staticSha256.trim()))
  const directReady = !direct || (form.expectedSigner.trim()
    && (form.installerType !== 'exe' || form.installArguments.trim())
    && (github
      ? form.assetPattern.trim() && form.checksumAssetPattern.trim()
      : json
        ? form.installerUrlPath.trim() && form.sha256Path.trim()
        : form.staticInstallerUrl.trim() && form.staticSha256.trim()))
  const verificationReady = form.verificationMethod === 'winget'
    ? Boolean(form.providerPackageId.trim())
    : form.verificationMethod === 'uninstall_registry'
      ? Boolean(form.productCode.trim() || form.productCodePath.trim() || form.verificationDisplayName.trim())
      : Boolean(form.filePath.trim())
  const valid = form.displayName.trim().length > 1
    && form.canonicalName.trim().length > 1
    && sourceReady
    && (!winget || form.providerPackageId.trim())
    && directReady
    && verificationReady

  return <div className="rmm-patch-modal-backdrop">
    <form className="rmm-patch-modal vendor-source" onSubmit={(event) => {
      event.preventDefault()
      if (valid && !saving) onSave(form)
    }}>
      <header>
        <div><span className="rmm-eyebrow">Self-service vendor patching</span><h2>{source ? 'Edit vendor source' : 'Add vendor source'}</h2></div>
        <button aria-label="Close" onClick={onClose} type="button"><X size={17} /></button>
      </header>
      <p>Use GitHub Releases, a vendor JSON endpoint, or a manually entered static vendor release as authoritative patch intelligence. Sources must be tested and approved before they can affect patch targets.</p>
      <div className="rmm-patch-form-grid">
        <label>Source name<input autoFocus value={form.displayName} onChange={(event) => update('displayName', event.target.value)} placeholder="e.g. Tailscale Windows" /></label>
        <label>Source type<select value={form.sourceType} onChange={(event) => update('sourceType', event.target.value)}><option value="github_releases">GitHub Releases</option><option value="vendor_json">Vendor JSON API</option><option value="static_release">Static vendor release</option></select></label>
        {github ? <label className="wide">GitHub repository<input value={form.repository} onChange={(event) => update('repository', event.target.value)} placeholder="owner/repository or https://github.com/owner/repository" /></label> : json ? <><label className="wide">Vendor JSON URL<input value={form.sourceUrl} onChange={(event) => update('sourceUrl', event.target.value)} placeholder="https://vendor.example/api/releases" /></label><label>Version JSON path<input value={form.versionPath} onChange={(event) => update('versionPath', event.target.value)} placeholder="e.g. latest.version or releases.0.version" /></label><label>Release date path<input value={form.releaseDatePath} onChange={(event) => update('releaseDatePath', event.target.value)} placeholder="Optional" /></label><label>Release URL path<input value={form.releaseUrlPath} onChange={(event) => update('releaseUrlPath', event.target.value)} placeholder="Optional" /></label><label>Installer URL path<input value={form.installerUrlPath} onChange={(event) => update('installerUrlPath', event.target.value)} placeholder={direct ? 'Required for vendor direct' : 'Optional'} /></label><label>SHA-256 JSON path<input value={form.sha256Path} onChange={(event) => update('sha256Path', event.target.value)} placeholder={direct ? 'Required for vendor direct' : 'Optional'} /></label></> : <><label>Release version<input value={form.staticVersion} onChange={(event) => update('staticVersion', event.target.value)} placeholder="e.g. 4.91.0" /></label><label className="wide">Installer URL<input value={form.staticInstallerUrl} onChange={(event) => update('staticInstallerUrl', event.target.value)} placeholder="https://vendor.example/releases/app.exe" /></label><label className="wide">SHA-256<input value={form.staticSha256} onChange={(event) => update('staticSha256', event.target.value)} placeholder="64-character SHA-256" /></label><label className="wide">Vendor release page<input value={form.staticReleaseUrl} onChange={(event) => update('staticReleaseUrl', event.target.value)} placeholder="Optional HTTPS evidence page" /></label></>}
        <label>Application<input value={form.canonicalName} onChange={(event) => update('canonicalName', event.target.value)} /></label>
        <label>Publisher<input value={form.publisher} onChange={(event) => update('publisher', event.target.value)} /></label>
        <label>Deployment mode<select value={form.deploymentMode} onChange={(event) => update('deploymentMode', event.target.value)}><option value="winget_preferred">WinGet preferred</option><option value="vendor_direct">Vendor direct</option><option value="intelligence_only">Intelligence only</option></select></label>
        <label>WinGet package ID<input value={form.providerPackageId} onChange={(event) => update('providerPackageId', event.target.value)} placeholder="Required for WinGet preferred / optional fallback" /></label>
        <label>Post-install verification<select value={form.verificationMethod} onChange={(event) => update('verificationMethod', event.target.value)}><option value="winget">WinGet package identity</option><option value="uninstall_registry">Uninstall registry / MSI identity</option><option value="file_version">Installed EXE/DLL file version</option></select></label>
        {form.verificationMethod === 'uninstall_registry' && <><label>MSI ProductCode<input value={form.productCode} onChange={(event) => update('productCode', event.target.value)} placeholder="Optional static {GUID}" /></label>{json && <label>ProductCode JSON path<input value={form.productCodePath} onChange={(event) => update('productCodePath', event.target.value)} placeholder="e.g. productCode" /></label>}<label>Verification DisplayName<input value={form.verificationDisplayName} onChange={(event) => update('verificationDisplayName', event.target.value)} placeholder="Fallback uninstall entry match" /></label><label>Verification publisher<input value={form.verificationPublisher} onChange={(event) => update('verificationPublisher', event.target.value)} placeholder="Optional publisher match" /></label></>}
        {form.verificationMethod === 'file_version' && <label className="wide">Installed EXE/DLL path<input value={form.filePath} onChange={(event) => update('filePath', event.target.value)} placeholder="%ProgramFiles%\\Vendor\\App\\app.exe" /></label>}
        <label>Name contains<input value={form.namePattern} onChange={(event) => update('namePattern', event.target.value)} placeholder={form.canonicalName || 'Inventory detection'} /></label>
        <label>Publisher contains<input value={form.publisherPattern} onChange={(event) => update('publisherPattern', event.target.value)} /></label>
        <label>Channel<input value={form.channel} onChange={(event) => update('channel', event.target.value)} /></label>
        <label>Architecture<select value={form.architecture} onChange={(event) => update('architecture', event.target.value)}><option value="x64">x64</option><option value="arm64">arm64</option><option value="x86">x86</option></select></label>
        <label>Poll interval (minutes)<input min="15" max="10080" type="number" value={form.pollMinutes} onChange={(event) => update('pollMinutes', event.target.value)} /></label>
        <label>Installer type<select value={form.installerType} onChange={(event) => update('installerType', event.target.value)}><option value="">Auto-detect</option><option value="msi">MSI</option><option value="exe">EXE</option></select></label>{direct && form.installerType === 'exe' && <label className="wide">Silent installer arguments<input value={form.installArguments} onChange={(event) => update('installArguments', event.target.value)} placeholder="e.g. install --quiet --accept-license" /><small>Explicit arguments are required for vendor-direct EXE sources; Hi5Central never guesses vendor silent switches.</small></label>}
        {direct && github && <><label>Installer asset pattern<input value={form.assetPattern} onChange={(event) => update('assetPattern', event.target.value)} placeholder="e.g. *windows*x64*.msi" /></label><label>Checksum asset pattern<input value={form.checksumAssetPattern} onChange={(event) => update('checksumAssetPattern', event.target.value)} placeholder="e.g. *sha256*" /></label></>}
        {direct && <label className="wide">Expected Authenticode signer<input value={form.expectedSigner} onChange={(event) => update('expectedSigner', event.target.value)} placeholder="Exact trusted publisher identity" /></label>}
      </div>
      <div className="rmm-patch-security-note"><ShieldCheck size={16} /><span><strong>Approval gate:</strong> saving creates a draft. JSON selectors are fixed field paths only—no executable expressions. Test validates public HTTPS, release data and trust evidence. Post-install verification is explicit and independent from installer exit codes; approval is a separate action.</span></div>
      <footer><button onClick={onClose} type="button">Cancel</button><button className="rmm-primary" disabled={!valid || saving} type="submit">{saving ? 'Saving…' : source ? 'Save & retest' : 'Create draft'}</button></footer>
    </form>
  </div>
}

function SoftwarePatchModal({ application, installs, devices, onClose, onPatch, saving }) {
  return <div className="rmm-patch-modal-backdrop">
    <div className="rmm-patch-modal">
      <header>
        <div><span className="rmm-eyebrow">Controlled deployment</span><h2>Patch {application.name}</h2></div>
        <button aria-label="Close" onClick={onClose} type="button"><X size={17} /></button>
      </header>
      <p>Select one managed endpoint. Hi5Central resolves the safest available provider at dispatch time and PatchHost verifies the installed version before reporting success.</p>
      <div className="rmm-patch-device-picker">
        {installs.map((install) => {
          const device = devices.find((item) => item.agentDeviceId === install.agentDeviceId)
          const installReady = Boolean(device?.online && device?.patchCapabilities?.softwareInstall)
          return <article key={install.inventoryId + ':' + install.key}>
            <div>
              <strong>{install.deviceName}</strong>
              <small>{install.installedVersions?.length > 1 ? install.installedVersions.join(' · ') : install.installedVersion || 'Version not reported'} → {install.targetVersion || application.catalogue?.targetVersion || 'Target pending'}</small>
              {install.registrationCount > 1 && <small>{install.behindRegistrations} of {install.registrationCount} registrations behind target</small>}
            </div>
            <div className="rmm-patch-device-state">
              {!device?.online
                ? <StatusPill tone="neutral"><WifiOff size={12} /> Offline</StatusPill>
                : device?.patchCapabilities?.softwareInstall
                  ? <StatusPill tone="healthy">PatchHost ready</StatusPill>
                  : <StatusPill tone="warning">Install capability pending</StatusPill>}
            </div>
            <button className="rmm-primary compact" disabled={saving || !installReady || !application.catalogue?.id} onClick={() => onPatch(install)} type="button">
              <PackageCheck size={14} /> Patch this device
            </button>
          </article>
        })}
      </div>
      {!installs.length && <div className="rmm-empty"><CheckCircle2 size={22} /><strong>No devices require this update</strong><span>All detected installations are already current or do not have a confirmed target.</span></div>}
      <div className="rmm-patch-security-note"><ShieldCheck size={16} /><span>Offline devices are never queued. Vendor-direct jobs require HTTPS, SHA-256 and a valid Authenticode signer before installation.</span></div>
      <footer><button onClick={onClose} type="button">Close</button></footer>
    </div>
  </div>
}

function PolicyModal({ policy, policyType = 'os', catalogue = [], onClose, onSave }) {
  const type = policyType === 'software' ? 'software' : 'os'
  const maintenance = policy?.maintenance_window || {}
  const windowsRules = policy?.windows_rules || {}
  const windowsDelays = windowsRules.delayDays || {}
  const rollout = windowsRules.rollout || {}
  const rolloutWaves = Array.isArray(rollout.waves) ? rollout.waves : []
  const rolloutWave = (id, fallback) => rolloutWaves.find((wave) => wave.id === id) || fallback
  const pilotWave = rolloutWave('pilot', { percentage: 5, delayDays: 0 })
  const earlyWave = rolloutWave('early', { percentage: 15, delayDays: 1 })
  const broadWave = rolloutWave('broad', { percentage: 60, delayDays: 3 })
  const finalWave = rolloutWave('final', { percentage: 20, delayDays: 5 })
  const softwareRules = policy?.software_rules || {}
  const softwareMaintenance = softwareRules.maintenanceWindow || maintenance
  const vulnerabilityRules = softwareRules.vulnerabilityRules || {}
  const detectedTimezone = typeof Intl !== 'undefined'
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London'
    : 'Europe/London'
  const softwareTargetMode = ['selected_catalogue', 'all_catalogue', 'all_winget'].includes(softwareRules.targetMode)
    ? softwareRules.targetMode
    : 'all_catalogue'
  const [softwareAppSearch, setSoftwareAppSearch] = useState('')
  const [form, setForm] = useState({
    name: policy?.name || '',
    description: policy?.description || '',
    approvalMode: policy?.approval_mode || 'manual',
    deploymentDelayDays: policy?.deployment_delay_days ?? 3,
    softwareEnabled: type === 'software',
    softwareTargetMode,
    softwareCatalogueIds: Array.isArray(softwareRules.catalogueIds) ? softwareRules.catalogueIds : [],
    windowsEnabled: type === 'os',
    rebootPolicy: policy?.reboot_policy || 'never',
    maxRetries: policy?.max_retries ?? 2,
    maintenanceStart: maintenance.start || '18:00',
    maintenanceEnd: maintenance.end || '05:00',
    maintenanceTimezone: maintenance.timezone && maintenance.timezone !== 'tenant' ? maintenance.timezone : detectedTimezone,
    maintenanceDays: Array.isArray(maintenance.days) && maintenance.days.length ? maintenance.days : [1, 2, 3, 4, 5],
    softwareMaintenanceStart: softwareMaintenance.start || '18:00',
    softwareMaintenanceEnd: softwareMaintenance.end || '05:00',
    softwareMaintenanceTimezone: softwareMaintenance.timezone && softwareMaintenance.timezone !== 'tenant' ? softwareMaintenance.timezone : detectedTimezone,
    softwareMaintenanceDays: Array.isArray(softwareMaintenance.days) && softwareMaintenance.days.length ? softwareMaintenance.days : [1, 2, 3, 4, 5],
    windowsAutoInstall: windowsRules.autoInstall === true,
    includeDrivers: windowsRules.includeDrivers === true,
    includeFeatureUpdates: windowsRules.includeFeatureUpdates === true,
    includeDefinitions: windowsRules.includeDefinitions !== false,
    windowsCriticalDelay: windowsDelays.critical ?? 0,
    windowsSecurityDelay: windowsDelays.security ?? 2,
    windowsQualityDelay: windowsDelays.quality ?? 7,
    windowsFeatureDelay: windowsDelays.feature ?? 30,
    windowsDriverDelay: windowsDelays.driver ?? 14,
    windowsDefinitionDelay: windowsDelays.definition ?? 0,
    rolloutEnabled: policy ? rollout.enabled === true : true,
    rolloutPilotPercent: pilotWave.percentage ?? 5,
    rolloutPilotDelay: pilotWave.delayDays ?? 0,
    rolloutEarlyPercent: earlyWave.percentage ?? 15,
    rolloutEarlyDelay: earlyWave.delayDays ?? 1,
    rolloutBroadPercent: broadWave.percentage ?? 60,
    rolloutBroadDelay: broadWave.delayDays ?? 3,
    rolloutFinalDelay: finalWave.delayDays ?? 5,
    rolloutDeadlineDays: rollout.deadlineDays ?? 7,
    criticalExploited: vulnerabilityRules.critical_exploited || 'automatic',
    critical: vulnerabilityRules.critical || 'automatic',
    high: vulnerabilityRules.high || 'manual',
    medium: vulnerabilityRules.medium || 'manual',
    low: vulnerabilityRules.low || 'skip',
    advisory: vulnerabilityRules.advisory || 'skip',
  })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const toggleDay = (day) => setForm((current) => ({
    ...current,
    maintenanceDays: current.maintenanceDays.includes(day)
      ? current.maintenanceDays.filter((item) => item !== day)
      : [...current.maintenanceDays, day].sort(),
  }))
  const toggleSoftwareDay = (day) => setForm((current) => ({
    ...current,
    softwareMaintenanceDays: current.softwareMaintenanceDays.includes(day)
      ? current.softwareMaintenanceDays.filter((item) => item !== day)
      : [...current.softwareMaintenanceDays, day].sort(),
  }))
  const toggleSoftwareApp = (id) => setForm((current) => ({
    ...current,
    softwareCatalogueIds: current.softwareCatalogueIds.includes(id)
      ? current.softwareCatalogueIds.filter((item) => item !== id)
      : [...current.softwareCatalogueIds, id],
  }))
  const dayLabels = [['M', 1], ['T', 2], ['W', 3], ['T', 4], ['F', 5], ['S', 6], ['S', 7]]
  const softwareCatalogueOptions = useMemo(() => {
    const byIdentity = new Map()
    for (const item of catalogue.filter((entry) => entry?.id && entry?.canonicalName)) {
      const identity = String(item.executionPackageId || item.packageId || item.canonicalName).toLowerCase()
      const current = byIdentity.get(identity)
      if (!current || (current.builtIn && !item.builtIn)) byIdentity.set(identity, item)
    }
    return [...byIdentity.values()]
      .sort((left, right) => String(left.canonicalName).localeCompare(String(right.canonicalName)))
  }, [catalogue])
  const searchText = softwareAppSearch.trim().toLowerCase()
  const visibleSoftwareApps = softwareCatalogueOptions
    .filter((item) => !searchText || [item.canonicalName, item.publisher, item.packageId, item.executionPackageId].filter(Boolean).join(' ').toLowerCase().includes(searchText))
    .sort((left, right) => {
      const selectedDelta = Number(form.softwareCatalogueIds.includes(right.id)) - Number(form.softwareCatalogueIds.includes(left.id))
      return selectedDelta || String(left.canonicalName).localeCompare(String(right.canonicalName))
    })
    .slice(0, 80)
  const softwareSelectionInvalid = form.softwareEnabled
    && form.softwareTargetMode === 'selected_catalogue'
    && !form.softwareCatalogueIds.length

  return <div className="rmm-patch-modal-backdrop">
    <form className="rmm-patch-modal rmm-patch-policy-modal" onSubmit={(event) => {
      event.preventDefault()
      if (form.name.trim().length < 2) return
      if (form.windowsEnabled && !form.maintenanceDays.length) return
      if (form.softwareEnabled && !form.softwareMaintenanceDays.length) return
      if (softwareSelectionInvalid) return
      onSave({
        ...form,
        policyType: type,
        softwareEnabled: type === 'software',
        windowsEnabled: type === 'os',
        maintenanceWindow: {
          start: form.maintenanceStart,
          end: form.maintenanceEnd,
          timezone: form.maintenanceTimezone,
          days: form.maintenanceDays,
        },
        windowsRules: {
          autoInstall: form.windowsAutoInstall,
          includeDrivers: form.includeDrivers,
          includeFeatureUpdates: form.includeFeatureUpdates,
          includeDefinitions: form.includeDefinitions,
          rollout: {
            enabled: form.rolloutEnabled,
            deadlineDays: Number(form.rolloutDeadlineDays) || 0,
            waves: [
              { id: 'pilot', percentage: Number(form.rolloutPilotPercent) || 0, delayDays: Number(form.rolloutPilotDelay) || 0 },
              { id: 'early', percentage: Number(form.rolloutEarlyPercent) || 0, delayDays: Number(form.rolloutEarlyDelay) || 0 },
              { id: 'broad', percentage: Number(form.rolloutBroadPercent) || 0, delayDays: Number(form.rolloutBroadDelay) || 0 },
              { id: 'final', percentage: Math.max(0, 100 - (Number(form.rolloutPilotPercent) || 0) - (Number(form.rolloutEarlyPercent) || 0) - (Number(form.rolloutBroadPercent) || 0)), delayDays: Number(form.rolloutFinalDelay) || 0 },
            ],
          },
          delayDays: {
            critical: Number(form.windowsCriticalDelay) || 0,
            security: Number(form.windowsSecurityDelay) || 0,
            quality: Number(form.windowsQualityDelay) || 0,
            feature: Number(form.windowsFeatureDelay) || 0,
            driver: Number(form.windowsDriverDelay) || 0,
            definition: Number(form.windowsDefinitionDelay) || 0,
          },
        },
        softwareRules: {
          targetMode: form.softwareTargetMode,
          catalogueIds: form.softwareTargetMode === 'selected_catalogue' ? form.softwareCatalogueIds : [],
          maintenanceWindow: {
            start: form.softwareMaintenanceStart,
            end: form.softwareMaintenanceEnd,
            timezone: form.softwareMaintenanceTimezone,
            days: form.softwareMaintenanceDays,
          },
          vulnerabilityRules: {
            critical_exploited: form.criticalExploited,
            critical: form.critical,
            high: form.high,
            medium: form.medium,
            low: form.low,
            advisory: form.advisory,
          },
        },
      })
    }}>
      <header>
        <div><span className="rmm-eyebrow">{type === 'os' ? 'OS patching policy' : 'Software patching policy'}</span><h2>{policy ? 'Edit ' : 'New '}{type === 'os' ? 'OS patching policy' : 'Software patching policy'}</h2></div>
        <button aria-label="Close" onClick={onClose} type="button"><X size={17} /></button>
      </header>

      <div className="rmm-patch-form-grid">
        <label className="wide">Policy name<input autoFocus value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Standard workstations" /></label>
        <label className="wide">Description<textarea rows="2" value={form.description} onChange={(event) => update('description', event.target.value)} /></label>
      </div>

      {type === 'os' && <section className="rmm-policy-schedule rmm-policy-domain">
        <div className="rmm-policy-section-title"><strong>OS patching</strong><small>Controls Windows Update ownership, deferrals, deployment waves and the OS maintenance window.</small></div>
        <div className="rmm-patch-checks">
          <label><input checked={form.windowsAutoInstall} onChange={(event) => update('windowsAutoInstall', event.target.checked)} type="checkbox" /><span><strong>Automatically install eligible updates</strong><small>Hi5Central owns Windows Update on assigned endpoints; automatic installs run only while the OS maintenance window is open.</small></span></label>
        </div>

        <>
          <div className="rmm-policy-subsection-title"><strong>OS maintenance window</strong><small>Windows updates wait for this window after their category deferral and rollout wave open.</small></div>
          <div className="rmm-patch-form-grid">
            <label>Window starts<input type="time" value={form.maintenanceStart} onChange={(event) => update('maintenanceStart', event.target.value)} /></label>
            <label>Window ends<input type="time" value={form.maintenanceEnd} onChange={(event) => update('maintenanceEnd', event.target.value)} /></label>
            <label className="wide">Timezone<input value={form.maintenanceTimezone} onChange={(event) => update('maintenanceTimezone', event.target.value)} placeholder="Europe/London" /></label>
            <div className="wide rmm-policy-days"><span>OS patch days</span><div>{dayLabels.map(([label, day]) => <button className={form.maintenanceDays.includes(day) ? 'active' : ''} key={day} onClick={() => toggleDay(day)} type="button">{label}</button>)}</div></div>
          </div>

          <div className="rmm-policy-subsection-title"><strong>Update deferrals</strong><small>Delay each Windows Update class before staged rollout begins.</small></div>
          <div className="rmm-policy-delay-grid">
            {[
              ['windowsCriticalDelay', 'Critical', 'Immediate by default'],
              ['windowsSecurityDelay', 'Security', 'Security fixes'],
              ['windowsQualityDelay', 'Quality', 'Cumulative / quality'],
              ['windowsFeatureDelay', 'Feature', 'Feature releases'],
              ['windowsDriverDelay', 'Drivers', 'Driver updates'],
              ['windowsDefinitionDelay', 'Definitions', 'Defender intelligence'],
            ].map(([key, label, detail]) => <label key={key}><span><strong>{label}</strong><small>{detail}</small></span><input min="0" max="365" type="number" value={form[key]} onChange={(event) => update(key, event.target.value)} /><em>days</em></label>)}
          </div>

          <div className="rmm-policy-section-title"><strong>Staged rollout</strong><small>Keep a stable percentage of devices in each wave. The compliance deadline releases remaining devices once due.</small></div>
          <div className="rmm-patch-checks">
            <label><input checked={form.rolloutEnabled} onChange={(event) => update('rolloutEnabled', event.target.checked)} type="checkbox" /><span><strong>Use deployment waves</strong><small>Definitions bypass waves so Defender intelligence can stay current.</small></span></label>
          </div>
          {form.rolloutEnabled && <>
            <div className="rmm-patch-form-grid">
              <label>Pilot devices (%)<input min="0" max="100" type="number" value={form.rolloutPilotPercent} onChange={(event) => update('rolloutPilotPercent', event.target.value)} /></label>
              <label>Pilot starts after<input min="0" max="365" type="number" value={form.rolloutPilotDelay} onChange={(event) => update('rolloutPilotDelay', event.target.value)} /><small>Days after the category deferral.</small></label>
              <label>Early devices (%)<input min="0" max="100" type="number" value={form.rolloutEarlyPercent} onChange={(event) => update('rolloutEarlyPercent', event.target.value)} /></label>
              <label>Early starts after<input min="0" max="365" type="number" value={form.rolloutEarlyDelay} onChange={(event) => update('rolloutEarlyDelay', event.target.value)} /></label>
              <label>Broad devices (%)<input min="0" max="100" type="number" value={form.rolloutBroadPercent} onChange={(event) => update('rolloutBroadPercent', event.target.value)} /></label>
              <label>Broad starts after<input min="0" max="365" type="number" value={form.rolloutBroadDelay} onChange={(event) => update('rolloutBroadDelay', event.target.value)} /></label>
              <label>Final devices (%)<input readOnly type="number" value={Math.max(0, 100 - (Number(form.rolloutPilotPercent) || 0) - (Number(form.rolloutEarlyPercent) || 0) - (Number(form.rolloutBroadPercent) || 0))} /></label>
              <label>Final starts after<input min="0" max="365" type="number" value={form.rolloutFinalDelay} onChange={(event) => update('rolloutFinalDelay', event.target.value)} /></label>
              <label>Compliance deadline<input min="0" max="365" type="number" value={form.rolloutDeadlineDays} onChange={(event) => update('rolloutDeadlineDays', event.target.value)} /><small>Days after the category deferral.</small></label>
            </div>
            <div className="rmm-patch-security-note"><ShieldCheck size={16} /><span>Ring membership is deterministic per device and policy, so the same endpoints remain in Pilot/Early/Broad/Final.</span></div>
          </>}

          <div className="rmm-patch-checks">
            <label><input checked={form.includeFeatureUpdates} onChange={(event) => update('includeFeatureUpdates', event.target.checked)} type="checkbox" /><span><strong>Feature updates</strong><small>Off by default for controlled rollout.</small></span></label>
            <label><input checked={form.includeDrivers} onChange={(event) => update('includeDrivers', event.target.checked)} type="checkbox" /><span><strong>Driver updates</strong><small>Off by default.</small></span></label>
            <label><input checked={form.includeDefinitions} onChange={(event) => update('includeDefinitions', event.target.checked)} type="checkbox" /><span><strong>Defender definitions</strong><small>Enabled by default with no delay.</small></span></label>
          </div>
          <div className="rmm-patch-form-grid">
            <label>Reboot handling<select value={form.rebootPolicy} onChange={(event) => update('rebootPolicy', event.target.value)}><option value="never">Do not reboot automatically</option><option value="maintenance_window">Reboot during maintenance window</option><option value="notify_user">Notify user before reboot</option></select></label>
          </div>
          <div className="rmm-patch-security-note"><ShieldCheck size={16} /><span>Windows updates install without forcing an automatic restart today. Reboot-required endpoints remain flagged until coordinated reboot automation is enabled.</span></div>
        </>
      </section>}

      {type === 'software' && <section className="rmm-policy-schedule rmm-policy-domain">
        <div className="rmm-policy-section-title"><strong>Software patching</strong><small>Choose exactly which software source this policy may patch and when automatic software remediation can run.</small></div>
        <>
          <div className="rmm-patch-form-grid">
            <label className="wide">Application scope<select value={form.softwareTargetMode} onChange={(event) => update('softwareTargetMode', event.target.value)}>
              <option value="selected_catalogue">Selected Hi5Central catalogue applications</option>
              <option value="all_catalogue">All Hi5Central catalogue applications</option>
              <option value="all_winget">Use WinGet</option>
            </select></label>
            <label>Software approval<select value={form.approvalMode} onChange={(event) => update('approvalMode', event.target.value)}><option value="manual">Manual approval</option><option value="automatic">Automatic</option><option value="pilot">Pilot → production</option><option value="blocked">Blocked</option></select></label>
            <label>Default software delay<input min="0" max="365" type="number" value={form.deploymentDelayDays} onChange={(event) => update('deploymentDelayDays', event.target.value)} /></label>
            <label>Retries<input min="0" max="10" type="number" value={form.maxRetries} onChange={(event) => update('maxRetries', event.target.value)} /></label>
          </div>

          {form.softwareTargetMode === 'selected_catalogue' && <div className="rmm-policy-app-picker">
            <div className="rmm-policy-app-picker-head"><div><strong>Selected applications</strong><small>{form.softwareCatalogueIds.length} selected · choose only apps this policy may patch.</small></div></div>
            <label className="rmm-policy-app-search"><Search size={14} /><input value={softwareAppSearch} onChange={(event) => setSoftwareAppSearch(event.target.value)} placeholder="Search Hi5Central catalogue…" /></label>
            <div className="rmm-policy-app-list">
              {visibleSoftwareApps.map((item) => <label key={item.id}>
                <input checked={form.softwareCatalogueIds.includes(item.id)} onChange={() => toggleSoftwareApp(item.id)} type="checkbox" />
                <span><strong>{item.canonicalName}</strong><small>{[item.publisher, item.targetVersion, item.executionPackageId || item.packageId].filter(Boolean).join(' · ')}</small></span>
              </label>)}
              {!visibleSoftwareApps.length && <div className="rmm-empty compact"><Search size={20} /><strong>No catalogue applications found</strong><span>Change the search to select software.</span></div>}
            </div>
            {softwareSelectionInvalid && <div className="rmm-policy-inline-error"><AlertTriangle size={14} /> Select at least one catalogue application.</div>}
            {softwareCatalogueOptions.length > visibleSoftwareApps.length && <small className="rmm-policy-app-hint">Showing up to 80 matches. Search to narrow the catalogue.</small>}
          </div>}

          {form.softwareTargetMode === 'all_catalogue' && <div className="rmm-patch-security-note"><PackageCheck size={16} /><span>All qualified Hi5Central catalogue applications are in scope. Raw WinGet-only packages are not included.</span></div>}
          {form.softwareTargetMode === 'all_winget' && <div className="rmm-patch-security-note"><PackageCheck size={16} /><span>Uses endpoint WinGet discovery as the software patch source. Raw WinGet packages remain separate from Hi5Central qualification.</span></div>}

          <div className="rmm-policy-subsection-title"><strong>Software maintenance window</strong><small>Automatic software remediation waits for this independent window.</small></div>
          <div className="rmm-patch-form-grid">
            <label>Window starts<input type="time" value={form.softwareMaintenanceStart} onChange={(event) => update('softwareMaintenanceStart', event.target.value)} /></label>
            <label>Window ends<input type="time" value={form.softwareMaintenanceEnd} onChange={(event) => update('softwareMaintenanceEnd', event.target.value)} /></label>
            <label className="wide">Timezone<input value={form.softwareMaintenanceTimezone} onChange={(event) => update('softwareMaintenanceTimezone', event.target.value)} placeholder="Europe/London" /></label>
            <div className="wide rmm-policy-days"><span>Software patch days</span><div>{dayLabels.map(([label, day]) => <button className={form.softwareMaintenanceDays.includes(day) ? 'active' : ''} key={day} onClick={() => toggleSoftwareDay(day)} type="button">{label}</button>)}</div></div>
          </div>

          <details className="rmm-policy-software-rules">
            <summary>Vulnerability approval rules</summary>
            <div className="rmm-patch-form-grid">
              {[
                ['criticalExploited', 'Critical / known exploited'],
                ['critical', 'Critical (CVSS ≥ 9.0)'],
                ['high', 'High (CVSS 7.0–8.9)'],
                ['medium', 'Medium (CVSS 4.0–6.9)'],
                ['low', 'Low (CVSS < 4.0)'],
                ['advisory', 'Advisory / no scored CVE'],
              ].map(([key, label]) => <label key={key}>{label}<select value={form[key]} onChange={(event) => update(key, event.target.value)}><option value="automatic">Auto approve</option><option value="manual">Manual approval</option><option value="skip">Skip automatic patching</option></select></label>)}
            </div>
          </details>
        </>
      </section>}

      <footer><button onClick={onClose} type="button">Cancel</button><button className="rmm-primary" disabled={type === 'software' && softwareSelectionInvalid} type="submit"><PackageCheck size={15} /> {policy ? 'Save policy' : 'Create policy'}</button></footer>
    </form>
  </div>
}

function AssignmentModal({ devices, groups, onClose, onSave, policy }) {
  const [scopeType, setScopeType] = useState('Estate')
  const siteOptions = useMemo(() => [...new Map(devices.filter((d) => d.site).map((d) => [d.siteId || d.site, { id: d.siteId || d.site, name: d.site }])).values()], [devices])
  const options = scopeType === 'Estate'
    ? [{ id: 'ALL', name: 'Entire estate' }]
    : scopeType === 'Site'
      ? siteOptions
      : scopeType === 'Group'
        ? groups.map((group) => ({ id: group.id, name: group.name }))
        : devices.map((device) => ({ id: device.id, name: device.name }))
  const [scopeId, setScopeId] = useState('ALL')
  const [preview, setPreview] = useState(null)
  const [previewKey, setPreviewKey] = useState('')
  const [previewBusy, setPreviewBusy] = useState(false)
  const [previewError, setPreviewError] = useState('')

  function invalidatePreview() {
    setPreview(null)
    setPreviewKey('')
    setPreviewError('')
  }

  function changeScopeType(nextType) {
    setScopeType(nextType)
    const nextOptions = nextType === 'Estate'
      ? [{ id: 'ALL', name: 'Entire estate' }]
      : nextType === 'Site'
        ? siteOptions
        : nextType === 'Group'
          ? groups.map((group) => ({ id: group.id, name: group.name }))
          : devices.map((device) => ({ id: device.id, name: device.name }))
    setScopeId(nextOptions[0]?.id || '')
    invalidatePreview()
  }

  const selected = options.find((item) => item.id === scopeId)
  const currentPreviewKey = [policy.id, scopeType, selected?.id || ''].join('|')
  const previewCurrent = Boolean(preview && previewKey === currentPreviewKey)

  async function runPreview() {
    if (!selected) return
    setPreviewBusy(true)
    setPreviewError('')
    try {
      const result = await previewPatchAssignment({
        policyId: policy.id,
        scopeType,
        scopeId: selected.id,
        scopeName: selected.name,
      })
      setPreview(result)
      setPreviewKey(currentPreviewKey)
    } catch (requestError) {
      setPreview(null)
      setPreviewKey('')
      setPreviewError(requestError?.message || 'Unable to preview this assignment.')
    } finally {
      setPreviewBusy(false)
    }
  }

  function resultLabel(result) {
    return ({
      will_apply: 'Will apply',
      already_effective: 'Already effective',
      overridden: 'Overridden',
      not_applicable: 'Not applicable',
    })[result] || result || 'Unknown'
  }

  function resultTone(result) {
    if (result === 'will_apply' || result === 'already_effective') return 'healthy'
    if (result === 'overridden') return 'warning'
    return 'neutral'
  }

  return <div className="rmm-patch-modal-backdrop">
    <form className="rmm-patch-modal assignment-impact" onSubmit={(event) => {
      event.preventDefault()
      if (!selected || !previewCurrent) return
      onSave({
        policyId: policy.id,
        scopeType,
        scopeId: selected.id,
        scopeName: selected.name,
      })
    }}>
      <header><div><span className="rmm-eyebrow">Patch targeting</span><h2>Assign {policy.name}</h2></div><button aria-label="Close" onClick={onClose} type="button"><X size={17} /></button></header>
      <div className="rmm-assignment-fields">
        <label>Scope type<select value={scopeType} onChange={(event) => changeScopeType(event.target.value)}><option>Estate</option><option>Site</option><option>Group</option><option>Device</option></select></label>
        <label>Target<select value={scopeId} onChange={(event) => { setScopeId(event.target.value); invalidatePreview() }}>{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </div>
      <div className="rmm-patch-security-note"><GitBranch size={16} /><span>Precedence follows Estate → Site → Group → Device. Preview shows what will actually become effective before this assignment is saved.</span></div>

      <div className="rmm-assignment-preview-action">
        <button disabled={!selected || previewBusy} onClick={runPreview} type="button"><Search size={14} /> {previewBusy ? 'Calculating impact…' : previewCurrent ? 'Refresh impact preview' : 'Preview impact'}</button>
        {!previewCurrent && !previewBusy && <small>Preview is required before assignment.</small>}
      </div>

      {previewError && <div className="rmm-patch-error compact"><AlertTriangle size={15} /><span>{previewError}</span></div>}

      {previewCurrent && <section className="rmm-assignment-preview">
        <div className="rmm-assignment-impact-metrics">
          <span><strong>{preview.summary?.targeted || 0}</strong><small>Targeted</small></span>
          <span><strong>{preview.summary?.willApply || 0}</strong><small>Will apply</small></span>
          <span><strong>{preview.summary?.alreadyEffective || 0}</strong><small>Already effective</small></span>
          <span><strong>{preview.summary?.replacing || 0}</strong><small>Replacing policy</small></span>
          <span><strong>{preview.summary?.overridden || 0}</strong><small>Overridden</small></span>
          <span><strong>{preview.summary?.notApplicable || 0}</strong><small>Not applicable</small></span>
          <span><strong>{preview.summary?.offline || 0}</strong><small>Offline</small></span>
        </div>
        <div className="rmm-assignment-impact-table">
          <div className="head"><span>Device</span><span>Impact</span><span>Current effective</span><span>After assignment</span></div>
          {(preview.devices || []).slice(0, 25).map((device) => <div className="row" key={device.inventoryId}>
            <span><strong>{device.name || device.reference}</strong><small>{device.reference || device.inventoryId} · {device.online ? 'Online' : device.agentDeviceId ? 'Offline' : 'No Agent'}</small></span>
            <span><StatusPill tone={resultTone(device.result)}>{resultLabel(device.result)}</StatusPill>{device.notApplicableReason && <small>{device.notApplicableReason}</small>}</span>
            <span><strong>{device.currentPolicy?.name || 'None'}</strong>{device.currentPolicy && <small>{device.currentPolicy.scopeType} · priority {device.currentPolicy.priority}</small>}</span>
            <span><strong>{device.effectiveAfter?.name || 'None'}</strong>{device.effectiveAfter && <small>{device.effectiveAfter.scopeType} · priority {device.effectiveAfter.priority}</small>}</span>
          </div>)}
        </div>
        {(preview.devices || []).length > 25 && <small className="rmm-assignment-preview-more">Showing the first 25 of {preview.devices.length} affected devices.</small>}
      </section>}

      <footer><button onClick={onClose} type="button">Cancel</button><button className="rmm-primary" disabled={!selected || !previewCurrent || previewBusy} type="submit">Assign policy</button></footer>
    </form>
  </div>
}
function labDate(value) {
  if (!value) return 'Not yet'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString()
}

function QualificationWorkspace({
  item,
  lab,
  loading,
  busyAction,
  onAction,
  onEdit,
  onRevalidate,
  onRefresh,
  onMarkLimited,
  onClearLimited,
}) {
  const manualLimitation = lab?.application?.qualificationLimitations?.manual || {}
  const limitationKey = [
    item?.id || '',
    manualLimitation.reason || '',
    ...(Array.isArray(manualLimitation.unsupportedCapabilities) ? manualLimitation.unsupportedCapabilities : []),
  ].join('|')
  const [limitEditorOpen, setLimitEditorOpen] = useState(false)
  const [limitReason, setLimitReason] = useState('')
  const [limitUnsupported, setLimitUnsupported] = useState(['uninstall', 'rollback'])
  useEffect(() => {
    const existing = Array.isArray(manualLimitation.unsupportedCapabilities)
      ? manualLimitation.unsupportedCapabilities
      : []
    setLimitReason(manualLimitation.reason || '')
    setLimitUnsupported(existing.length ? existing : ['uninstall', 'rollback'])
    setLimitEditorOpen(false)
  }, [limitationKey])

  if (!item) return <div className="rmm-qualification-empty"><PackageCheck size={20} /><strong>Select an application</strong><span>Open one catalogue application to inspect and run its qualification layers.</span></div>
  if (loading && !lab) return <div className="rmm-qualification-empty"><Clock3 size={20} /><strong>Loading qualification workspace…</strong><span>Reading release, trust and runner evidence.</span></div>
  if (!lab) return <div className="rmm-qualification-empty"><AlertTriangle size={20} /><strong>Qualification details unavailable</strong><span>Refresh this application to retry.</span></div>

  const current = lab.releases?.current
  const previous = lab.releases?.previous
  const clean = lab.tests?.cleanInstall || {}
  const verification = lab.tests?.verification || {}
  const uninstall = lab.tests?.uninstall || {}
  const upgrade = lab.tests?.upgrade || {}
  const rollback = lab.tests?.rollback || {}
  const actions = lab.actions || {}
  const capabilities = lab.application?.qualificationCapabilities || {}
  const limitations = lab.application?.qualificationLimitations || {}
  const runnerOnline = lab.runner?.online
  const layerIcon = {
    source: Box,
    vulnerability: ShieldCheck,
    clean: PackageCheck,
    history: GitBranch,
    upgrade: RefreshCw,
    rollback: RotateCcw,
  }

  function actionButton(action, enabled, label, Icon, title = '') {
    return <button
      disabled={Boolean(busyAction) || !enabled}
      onClick={() => onAction(action)}
      title={!enabled && title ? title : undefined}
      type="button"
    ><Icon size={14} />{busyAction === action ? 'Working…' : label}</button>
  }

  return <div className="rmm-qualification-workspace">
    <header className="rmm-qualification-workspace-head">
      <div>
        <span className="rmm-eyebrow">Qualification workspace</span>
        <h3>{lab.application?.name || item.canonicalName}</h3>
        <p>{lab.application?.publisher || item.publisher || 'Publisher not reported'} · target {lab.application?.targetVersion || item.targetVersion || '—'} · {readinessLabel(lab.application?.deploymentMode || 'pending')}</p>
        <StatusPill tone={qualificationTone(lab.application?.qualificationState)}>{qualificationLabel(lab.application?.qualificationState)}</StatusPill>
      </div>
      <div className="rmm-qualification-runner">
        <small>Qualification runner</small>
        <strong>{lab.runner?.deviceName || 'Not configured'}</strong>
        <StatusPill tone={runnerOnline ? 'healthy' : 'critical'}>{runnerOnline ? 'Online' : 'Offline'}</StatusPill>
      </div>
    </header>

    {lab.application?.qualificationState === 'qualified_limited' && <div className="rmm-qualification-limited">
      <AlertTriangle size={17} />
      <div>
        <strong>Qualified — limited capabilities</strong>
        <span>{manualLimitation.state === 'declared'
          ? 'A technician has explicitly limited unsupported lifecycle operations. Supported operations remain available; unsupported operations are not treated as successful tests.'
          : 'Every available qualification check passed. Upstream limitations remain explicit and are not treated as successful tests.'}</span>
        <div className="rmm-qualification-capability-grid">
          <span><small>Clean install</small><b>{readinessLabel(capabilities.cleanInstall || 'verified')}</b></span>
          <span><small>Uninstall</small><b>{readinessLabel(capabilities.uninstall || 'verified')}</b></span>
          <span><small>Upgrade</small><b>{readinessLabel(capabilities.upgrade || 'unavailable')}</b></span>
          <span><small>Rollback</small><b>{readinessLabel(capabilities.rollback || 'unavailable')}</b></span>
          <span><small>Vulnerability coverage</small><b>{readinessLabel(capabilities.vulnerabilityCoverage || 'limited')}</b></span>
        </div>
        {limitations.historicalInstaller && <p>Historical installer: {readinessLabel(limitations.historicalInstaller.state)}{limitations.historicalInstaller.previousVersion ? ' · ' + limitations.historicalInstaller.previousVersion : ''}{limitations.historicalInstaller.reason ? ' · ' + readinessLabel(limitations.historicalInstaller.reason) : ''}</p>}
        {limitations.vulnerabilityIdentity && <p>Vulnerability identity: {readinessLabel(limitations.vulnerabilityIdentity.state)}{limitations.vulnerabilityIdentity.note ? ' · ' + limitations.vulnerabilityIdentity.note : ''}</p>}
        {manualLimitation.state === 'declared' && <p><strong>Declared limitation:</strong> {(manualLimitation.unsupportedCapabilities || []).map(readinessLabel).join(', ')} · {manualLimitation.reason}</p>}
      </div>
    </div>}

    <div className="rmm-qualification-actions">
      <button disabled={Boolean(busyAction)} onClick={onEdit} type="button"><Wrench size={14} /> Edit validation</button>
      <button disabled={Boolean(busyAction) || !actions.canRevalidate} onClick={onRevalidate} type="button"><RefreshCw size={14} /> Revalidate source</button>
      {actionButton('prepare_previous', actions.canPreparePrevious, 'Prepare previous release', GitBranch, lab.releases?.previousReady ? 'A trusted previous release is already retained.' : 'Automatic history discovery is not available for this source.')}
      {actionButton('clean_cycle', actions.canRunClean, 'Run qualification', PackageCheck, 'Runs the deployment qualification cycle: current-version install, independent verification, then verified uninstall/cleanup.')}
      {actionButton('upgrade', actions.canRunUpgrade, 'Run upgrade test', RefreshCw, 'Optional lifecycle evidence. Deployment qualification does not depend on this test.')}
      {actionButton('rollback', actions.canRunRollback, 'Run rollback test', RotateCcw, 'Optional lifecycle evidence. Deployment qualification does not depend on this test.')}
      <button disabled={Boolean(busyAction)} onClick={() => setLimitEditorOpen((open) => !open)} type="button"><AlertTriangle size={14} /> {lab.application?.qualificationState === 'qualified_limited' ? 'Edit limitations' : 'Mark limited'}</button>
      {lab.application?.qualificationState === 'qualified_limited' && manualLimitation.state === 'declared' && <button disabled={Boolean(busyAction)} onClick={onClearLimited} type="button"><RotateCcw size={14} /> Return to candidate</button>}
      <button disabled={Boolean(busyAction) || loading} onClick={onRefresh} type="button"><RefreshCw size={14} /> Refresh</button>
    </div>

    {limitEditorOpen && <div className="rmm-qualification-limit-editor">
      <div><strong>Limited capability declaration</strong><span>Use this only when a vendor or operating-system restriction makes part of the normal lifecycle genuinely unsupported. Source and installer trust are still required.</span></div>
      <div className="capabilities">
        {[
          ['clean_install', 'Clean install'],
          ['uninstall', 'Uninstall'],
          ['upgrade', 'Upgrade'],
          ['rollback', 'Rollback'],
          ['vulnerability_coverage', 'Vulnerability coverage'],
        ].map(([value, label]) => <label key={value}><input
          checked={limitUnsupported.includes(value)}
          onChange={(event) => setLimitUnsupported((current) => event.target.checked
            ? [...new Set([...current, value])]
            : current.filter((item) => item !== value))}
          type="checkbox"
        /><span>{label}</span></label>)}
      </div>
      <label className="reason">Reason<textarea
        maxLength={1000}
        onChange={(event) => setLimitReason(event.target.value)}
        placeholder="e.g. Windows-integrated component; vendor/OS blocks reliable removal."
        rows={3}
        value={limitReason}
      /></label>
      <div className="actions">
        <button disabled={Boolean(busyAction)} onClick={() => setLimitEditorOpen(false)} type="button">Cancel</button>
        <button className="rmm-primary" disabled={Boolean(busyAction) || !limitUnsupported.length || limitReason.trim().length < 8} onClick={async () => {
          const saved = await onMarkLimited(limitUnsupported, limitReason.trim())
          if (saved) setLimitEditorOpen(false)
        }} type="button">{busyAction === 'mark_limited' ? 'Saving…' : 'Save limited qualification'}</button>
      </div>
    </div>}

    <div className="rmm-qualification-layers">
      {(lab.layers || []).map((layer) => {
        const Icon = layerIcon[layer.id] || PackageCheck
        return <article className={'rmm-qualification-layer ' + (layer.state || '')} key={layer.id}>
          <header>
            <span className="icon"><Icon size={16} /></span>
            <div><strong>{layer.label}</strong><small>{layer.id === 'clean' ? 'Install → verify → uninstall' : layer.id === 'upgrade' ? 'Detect outdated → patch → verify' : layer.id === 'rollback' ? 'Controlled previous-version restore' : 'Qualification evidence'}</small></div>
            <StatusPill tone={readinessTone(layer.state)}>{readinessLabel(layer.state)}</StatusPill>
          </header>

          {layer.id === 'source' && <div className="rmm-qualification-facts">
            <span><small>Source</small><strong>{lab.source?.sourceType?.replaceAll('_', ' ') || '—'}</strong></span>
            <span><small>Host</small><strong>{lab.source?.sourceHost || '—'}</strong></span>
            <span><small>Current artifact</small><strong>{current?.version || lab.application?.targetVersion || '—'}</strong></span>
            <span><small>Expected signer</small><strong>{current?.expectedSigner || 'Not configured'}</strong></span>
            <span><small>Verified signer</small><strong>{current?.signatureVerified && current?.verifiedSigner ? current.verifiedSigner : 'Pending inspection'}</strong></span>
            <span><small>Published SHA-256</small><strong>{current?.publishedSha256Present ? 'Recorded' : 'Missing'}</strong></span>
            <span><small>Artifact hash</small><strong>{current?.sha256Verified ? 'Verified' : 'Pending inspection'}</strong></span>
            <span><small>Last source sync</small><strong>{labDate(lab.source?.lastSuccessAt)}</strong></span>
            {lab.source?.error && <span className="wide"><small>Source error</small><strong>{readinessLabel(lab.source.error)}</strong></span>}
          </div>}

          {layer.id === 'vulnerability' && <div className="rmm-qualification-facts">
            <span><small>Identity state</small><strong>{readinessLabel(lab.vulnerability?.state)}</strong></span>
            <span><small>Validated identities</small><strong>{lab.vulnerability?.identities?.length || 0}</strong></span>
            <span><small>Method</small><strong>{readinessLabel(lab.vulnerability?.method || 'not checked')}</strong></span>
            <span><small>Source</small><strong>{lab.vulnerability?.resolvedSource || '—'}</strong></span>
            {(lab.vulnerability?.identities || []).slice(0, 3).map((identity) => <span className="wide" key={identity.id}><small>{identity.sourceType || 'identity'}</small><strong>{[identity.vendor, identity.product, identity.packageName].filter(Boolean).join(' / ') || 'Validated mapping'}</strong></span>)}
            {lab.vulnerability?.state === 'no_published_identity' && <span className="wide"><small>Coverage limitation</small><strong>No authoritative NVD, OSV or GitHub identity is currently published. Hi5Central will keep rechecking.</strong></span>}
            {lab.vulnerability?.dispositionNote && <span className="wide"><small>Review note</small><strong>{lab.vulnerability.dispositionNote}</strong></span>}
          </div>}

          {layer.id === 'clean' && <div className="rmm-qualification-step-grid">
            <span><small>Install</small><StatusPill tone={readinessTone(clean.state)}>{readinessLabel(clean.state)}</StatusPill><em>{clean.version || lab.application?.targetVersion || '—'}</em></span>
            <span><small>Verify</small><StatusPill tone={readinessTone(verification.state)}>{readinessLabel(verification.state)}</StatusPill><em>{verification.version || 'Inventory target'}</em></span>
            <span><small>Uninstall</small><StatusPill tone={readinessTone(uninstall.state)}>{readinessLabel(uninstall.state)}</StatusPill><em>{uninstall.residueCleanupVerified ? 'Residue cleanup verified' : 'Cleanup required'}</em></span>
            {(clean.error || uninstall.error) && <p>{clean.error || uninstall.error}</p>}
          </div>}

          {layer.id === 'history' && <div className="rmm-release-pair">
            <div><small>Previous stable</small><strong>{previous?.version || 'Not retained'}</strong><span>{lab.releases?.previousUnavailable ? 'Unavailable upstream · ' + readinessLabel(lab.releases?.previousUnavailableReason || previous?.trustReason || 'historical artifact not retrievable') : previous ? readinessLabel(previous.trustState) + ' · ' + (previous.installerType || 'installer') : 'Prepare a trusted previous release before upgrade testing.'}</span></div>
            <ChevronRight size={17} />
            <div><small>Current stable</small><strong>{current?.version || lab.application?.targetVersion || '—'}</strong><span>{current ? readinessLabel(current.trustState) + ' · ' + (current.installerType || 'installer') : 'Current release evidence unavailable.'}</span></div>
          </div>}

          {layer.id === 'upgrade' && <div className="rmm-qualification-facts">
            <span><small>Upgrade state</small><strong>{readinessLabel(upgrade.state)}</strong></span>
            <span><small>From</small><strong>{upgrade.fromVersion || previous?.version || '—'}</strong></span>
            <span><small>Target</small><strong>{upgrade.targetVersion || lab.application?.targetVersion || '—'}</strong></span>
            <span><small>Patch detection</small><strong>{upgrade.patchDetectionVerified ? 'update_available verified' : 'Not yet verified'}</strong></span>
            <span><small>Detected installed</small><strong>{upgrade.patchDetectionInstalledVersion || '—'}</strong></span>
            <span><small>Verified at</small><strong>{labDate(upgrade.verifiedAt)}</strong></span>
            {upgrade.state === 'legacy_pass' && <p>Upgrade passed before the newer patch-detection gate existed. Re-run to prove update_available detection.</p>}
            {upgrade.error && <p>{upgrade.error}</p>}
          </div>}

          {layer.id === 'rollback' && <div className="rmm-qualification-facts">
            <span><small>Rollback state</small><strong>{readinessLabel(rollback.state)}</strong></span>
            <span><small>Version path</small><strong>{rollback.fromVersion || lab.application?.targetVersion || '—'} → {rollback.previousVersion || previous?.version || '—'} → {rollback.restoredVersion || lab.application?.targetVersion || '—'}</strong></span>
            <span><small>Current install</small><strong>{rollback.currentInstallVerified ? 'Verified' : 'Pending'}</strong></span>
            <span><small>Current uninstall</small><strong>{rollback.currentUninstallVerified ? 'Verified' : 'Pending'}</strong></span>
            <span><small>Previous install</small><strong>{rollback.previousInstallVerified ? 'Verified' : 'Pending'}</strong></span>
            <span><small>Previous inventory</small><strong>{rollback.previousInventoryVerified ? 'Verified' : 'Pending'}</strong></span>
            <span><small>Restore detection</small><strong>{rollback.restorePatchDetectionVerified ? 'update_available verified' : 'Pending'}</strong></span>
            <span><small>Restore target</small><strong>{rollback.restoreVerified ? 'Verified' : 'Pending'}</strong></span>
            <span><small>Final uninstall</small><strong>{rollback.finalUninstallVerified ? 'Verified' : 'Pending'}</strong></span>
            <span><small>Residue cleanup</small><strong>{rollback.residueCleanupVerified ? 'Verified' : 'Pending'}</strong></span>
            <span className="wide"><small>Safety boundary</small><strong>Rollback runs only on the qualification runner. Normal patch policies never downgrade managed endpoints.</strong></span>
            {rollback.error && <p>{rollback.error}</p>}
          </div>}
        </article>
      })}
    </div>

    <details className="rmm-qualification-history">
      <summary>Recent qualification activity · {lab.recentJobs?.length || 0}</summary>
      <div>
        {(lab.recentJobs || []).slice(0, 10).map((job) => <span key={job.id}>
          <strong>{job.jobType?.replaceAll('.', ' ') || 'Qualification job'}</strong>
          <small>{readinessLabel(job.status)}{job.stage ? ' · ' + readinessLabel(job.stage) : ''}{job.verifiedVersion ? ' · verified ' + job.verifiedVersion : ''}</small>
          {job.error && <em>{job.error}</em>}
        </span>)}
        {!lab.recentJobs?.length && <span><strong>No qualification jobs yet</strong><small>Run qualification to begin. Upgrade and rollback can be tested separately later.</small></span>}
      </div>
    </details>
  </div>
}

export function RmmPatching({ devices = [], softwareOnly = false }) {
  const [tab, setTab] = useState(softwareOnly ? 'software' : 'catalogue')
  const [bundle, setBundle] = useState(null)
  const [scope, setScope] = useState({ groups: [] })
  const [vulnerabilities, setVulnerabilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [remediatingExposureId, setRemediatingExposureId] = useState('')
  const [error, setError] = useState('')
  const [mappingApp, setMappingApp] = useState(null)
  const [validationApp, setValidationApp] = useState(null)
  const [patchApp, setPatchApp] = useState(null)
  const [catalogueInstallDeviceId, setCatalogueInstallDeviceId] = useState('')
  const [catalogueInstallId, setCatalogueInstallId] = useState('')
  const [catalogueMaintenanceId, setCatalogueMaintenanceId] = useState('')
  const [qualificationLab, setQualificationLab] = useState(null)
  const [qualificationLabLoading, setQualificationLabLoading] = useState(false)
  const [qualificationAction, setQualificationAction] = useState('')
  const [bulkPatchDeviceId, setBulkPatchDeviceId] = useState('')
  const [bulkPatchMode, setBulkPatchMode] = useState('selected_catalogue')
  const [bulkPatchSelected, setBulkPatchSelected] = useState([])
  const [bulkPatchPreview, setBulkPatchPreview] = useState(null)
  const [bulkPatchBusy, setBulkPatchBusy] = useState(false)
  const [softwareSearch, setSoftwareSearch] = useState('')
  const [softwareStateFilter, setSoftwareStateFilter] = useState('all')
  const [softwareProviderFilter, setSoftwareProviderFilter] = useState('all')
  const [softwareSourceFilter, setSoftwareSourceFilter] = useState('all')
  const [softwareHealthFilter, setSoftwareHealthFilter] = useState('all')
  const [softwareQualificationFilter, setSoftwareQualificationFilter] = useState('all')
  const [softwarePage, setSoftwarePage] = useState(1)
  const [softwarePageSize, setSoftwarePageSize] = useState(25)
  const [catalogueQuery, setCatalogueQuery] = useState('')
  const [catalogueSourceFilter, setCatalogueSourceFilter] = useState('all')
  const [cataloguePage, setCataloguePage] = useState(1)
  const [cataloguePageSize, setCataloguePageSize] = useState(50)
  const [catalogueFeed, setCatalogueFeed] = useState({ items: [], total: null, pages: 1, page: 1, sourceCounts: { hi5central: 0, winget: 0 } })
  const [catalogueLoading, setCatalogueLoading] = useState(false)
  const [catalogueRefreshKey, setCatalogueRefreshKey] = useState(0)
  const [showVendorSource, setShowVendorSource] = useState(false)
  const [editingVendorSource, setEditingVendorSource] = useState(null)
  const [showPolicy, setShowPolicy] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState(null)
  const [policyModalType, setPolicyModalType] = useState('os')
  const [windowsEvaluating, setWindowsEvaluating] = useState(false)
  const [windowsControlBusy, setWindowsControlBusy] = useState('')
  const [assignPolicy, setAssignPolicy] = useState(null)

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const [patching, scopePayload, vulnPayload] = await Promise.all([
        loadRmmPatching(),
        loadRmmScope(),
        loadRmmVulnerabilities(75),
      ])
      setBundle(patching)
      setScope(scopePayload || { groups: [] })
      setVulnerabilities(vulnPayload.vulnerabilities || [])
      setCatalogueRefreshKey((value) => value + 1)
    } catch (requestError) {
      setError(requestError?.message || 'Unable to load patching data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([loadRmmPatching(), loadRmmScope(), loadRmmVulnerabilities(75)])
      .then(([patching, scopePayload, vulnPayload]) => {
        if (!active) return
        setBundle(patching)
        setScope(scopePayload || { groups: [] })
        setVulnerabilities(vulnPayload.vulnerabilities || [])
      })
      .catch((requestError) => {
        if (active) setError(requestError?.message || 'Unable to load patching data.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    setCataloguePage(1)
  }, [catalogueQuery, catalogueSourceFilter, cataloguePageSize])

  useEffect(() => {
    if (!catalogueMaintenanceId) return undefined
    let active = true
    let first = true
    const load = async () => {
      try {
        const result = await loadSoftwareQualificationLab(catalogueMaintenanceId)
        if (active) setQualificationLab(result.lab || null)
      } catch (requestError) {
        if (active) {
          setQualificationLab(null)
          setError(requestError?.message || 'Unable to load catalogue qualification workspace.')
        }
      } finally {
        if (active && first) setQualificationLabLoading(false)
        first = false
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 5000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [catalogueMaintenanceId])

  useEffect(() => {
    if (softwareOnly || tab !== 'catalogue') return undefined
    let active = true
    const timer = window.setTimeout(() => {
      setCatalogueLoading(true)
      searchSoftwareCatalogue(
        catalogueQuery,
        catalogueSourceFilter,
        'all',
        cataloguePage,
        cataloguePageSize,
      )
        .then((result) => { if (active) setCatalogueFeed(result) })
        .catch((requestError) => { if (active) setError(requestError?.message || 'Unable to load software catalogue.') })
        .finally(() => { if (active) setCatalogueLoading(false) })
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [
    softwareOnly,
    tab,
    catalogueQuery,
    catalogueSourceFilter,
    cataloguePage,
    cataloguePageSize,
    catalogueRefreshKey,
  ])

  const applications = bundle?.applications || []
  const catalogue = bundle?.catalogue || []
  const catalogueMaintenanceItems = [...catalogue].sort((a, b) => String(a.canonicalName || '').localeCompare(String(b.canonicalName || '')))
  const selectedCatalogueMaintenance = catalogueMaintenanceItems.find((item) => item.id === catalogueMaintenanceId) || null
  const selectedCatalogueMaintenanceApp = selectedCatalogueMaintenance
    ? { name: selectedCatalogueMaintenance.canonicalName, publisher: selectedCatalogueMaintenance.publisher, catalogue: selectedCatalogueMaintenance }
    : null
  const patchDevices = bundle?.devices || []
  const catalogueCandidates = bundle?.catalogueCandidates || []
  const patchObservations = bundle?.patchObservations || []
  const discoveredWingetUpdates = patchObservations
    .filter((item) => item.provider === 'winget' && item.patch_status === 'update_available')
    .sort((a, b) => String(a.application_name || '').localeCompare(String(b.application_name || ''))
      || String(a.device_name || '').localeCompare(String(b.device_name || '')))
  const vendorSources = bundle?.vendorIntel?.sources || []
  const validationSource = validationApp?.catalogue?.sourceKey
    ? vendorSources.find((source) => source.source_key === validationApp.catalogue.sourceKey) || null
    : null
  const vendorLatest = bundle?.vendorIntel?.latest || []
  const vendorReview = vendorLatest.filter((item) => ['rejected', 'signer_review_required', 'installer_review_required'].includes(item.trust_state))
  const vendorReviewCounts = vendorReview.reduce((counts, item) => ({ ...counts, [item.trust_state]: (counts[item.trust_state] || 0) + 1 }), {})
  const vendorReadiness = bundle?.vendorIntel?.readiness || []
  const vendorReadinessCounts = bundle?.vendorIntel?.readinessCounts || {}
  const vendorBacklog = vendorReadiness.filter((item) => item.state === 'automation_backlog')
  const vendorIntelligenceOnly = vendorReadiness.filter((item) => item.state === 'intelligence_only')
  const vendorSourceHealth = bundle?.vendorIntel?.sourceHealth || []
  const vendorSourceHealthMap = new Map(vendorSourceHealth.map((item) => [item.source_key, item]))
  const vendorHealth = bundle?.vendorIntel?.health || {}
  const tenantVendorSources = bundle?.vendorIntel?.tenantSources || []
  const policies = bundle?.policies || []
  const osPolicies = policies.filter((policy) => policy.windows_enabled === true && policy.software_enabled !== true)
  const softwarePolicies = policies.filter((policy) => policy.software_enabled === true && policy.windows_enabled !== true)
  const assignments = bundle?.assignments || []
  const deviceSoftware = bundle?.deviceSoftware || []
  const deployments = bundle?.deployments || []
  const softwareVulnerabilityExposures = bundle?.softwareVulnerabilityExposures || []
  const vulnerabilityHydration = bundle?.vulnerabilityHydration || []
  const vulnerabilityExposureRows = bundle?.vulnerabilityExposureRows || []
  const vulnerabilityCatalogue = bundle?.vulnerabilityCatalogue || {}
  const qualificationQueue = bundle?.qualificationQueue || []
  const qualificationQueueCounts = qualificationQueue.reduce((counts, item) => ({
    ...counts,
    [item.state]: (counts[item.state] || 0) + 1,
  }), {})
  const qualificationReview = qualificationQueue.filter((item) => item.state === 'review_required')
  const qualificationProgress = bundle?.qualificationProgress || {}
  const qualificationFailureGroups = qualificationProgress.failureGroups || []
  const exposureSummary = bundle?.vulnerabilityExposures || {}
  const overview = bundle?.overview || {}
  const exposedApps = applications.filter((item) => item.updateAvailable > 0)
  const mappedApps = applications.filter((item) => item.catalogue)
  const windowsUpdates = bundle?.windowsUpdates || { summary: {}, observations: [], decisions: [] }
  const windowsSummary = windowsUpdates.summary || {}
  const windowsPending = Number(windowsSummary.pending || 0)
  const windowsPendingRows = (windowsUpdates.observations || []).filter((item) => item.pending)
  const windowsDecisions = windowsUpdates.decisions || []
  const windowsReleases = windowsUpdates.releases || []
  const windowsManagement = windowsUpdates.management || []
  const windowsByDevice = [...new Map(windowsPendingRows.map((item) => [item.inventory_id, {
    inventoryId: item.inventory_id,
    agentDeviceId: item.agent_device_id,
    name: item.device_name,
    reference: item.device_reference,
    agentVersion: item.agent_version,
    online: item.websocket_status === 'Connected' && item.last_telemetry_at && Date.now() - new Date(item.last_telemetry_at).getTime() <= 90000,
    updates: windowsPendingRows.filter((row) => row.inventory_id === item.inventory_id),
    decision: windowsDecisions.find((row) => row.inventory_id === item.inventory_id) || null,
  }])).values()]
  const patchHostReady = patchDevices.filter((device) => device.patchCapabilities?.softwareDiscovery).length
  const patchHostInstallReady = patchDevices.filter((device) => device.patchCapabilities?.softwareInstall).length
  const onlineInstallDevices = patchDevices.filter((device) => device.online)
  const selectedInstallDevice = onlineInstallDevices.find((device) => device.agentDeviceId === catalogueInstallDeviceId) || null
  const selectedDeviceInstalledCatalogueIds = new Set(
    deviceSoftware
      .filter((item) => item.agentDeviceId === catalogueInstallDeviceId && item.catalogue?.id)
      .map((item) => item.catalogue.id),
  )
  const installableCatalogue = catalogue
    .filter((item) => item.installable && !selectedDeviceInstalledCatalogueIds.has(item.id))
    .sort((a, b) => String(a.canonicalName || '').localeCompare(String(b.canonicalName || '')))
  const selectedCatalogueInstall = installableCatalogue.find((item) => item.id === catalogueInstallId) || null
  const selectedCatalogueReadiness = selectedCatalogueInstall?.qualificationReadiness || {}
  const selectedInstallPatchHost = selectedInstallDevice?.patchCapabilities?.patchHostVersion
    || selectedInstallDevice?.patchCapabilities?.version
    || ''
  const selectedInstallCapabilityReady = Boolean(
    selectedInstallDevice?.patchCapabilities?.softwareInstall
    && versionAtLeast(selectedInstallPatchHost, '0.2.5'),
  )


  const bulkPatchDevice = patchDevices.find((device) => device.agentDeviceId === bulkPatchDeviceId) || null
  const bulkPatchDeviceUpdates = deviceSoftware
    .filter((item) => item.agentDeviceId === bulkPatchDeviceId && item.patchStatus === 'update_available' && item.catalogue?.id)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  const bulkPatchCapabilityReady = Boolean(bulkPatchDevice?.online && bulkPatchDevice?.patchCapabilities?.softwareBulk)
  const bulkPatchSelectedIds = bulkPatchMode === 'selected_catalogue'
    ? bulkPatchSelected.filter((id) => bulkPatchDeviceUpdates.some((item) => item.catalogue?.id === id))
    : []
  const bulkCatalogueUpdateCount = bulkPatchDeviceUpdates.filter((item) => item.catalogue?.catalogueSource !== 'patchhost').length
  const bulkWingetUpdateCount = patchObservations.filter((item) => item.inventory_id === bulkPatchDevice?.inventoryId && item.provider === 'winget' && item.patch_status === 'update_available').length

  useEffect(() => {
    if (!catalogueInstallDeviceId && onlineInstallDevices.length) {
      setCatalogueInstallDeviceId(onlineInstallDevices[0].agentDeviceId)
    }
  }, [catalogueInstallDeviceId, onlineInstallDevices])

  useEffect(() => {
    if (catalogueInstallId && !installableCatalogue.some((item) => item.id === catalogueInstallId)) {
      setCatalogueInstallId('')
    }
  }, [catalogueInstallId, installableCatalogue])

  useEffect(() => {
    if (!bulkPatchDeviceId && onlineInstallDevices.length) {
      setBulkPatchDeviceId(onlineInstallDevices[0].agentDeviceId)
    }
  }, [bulkPatchDeviceId, onlineInstallDevices])

  useEffect(() => {
    setBulkPatchPreview(null)
    if (bulkPatchMode !== 'selected_catalogue') setBulkPatchSelected([])
  }, [bulkPatchDeviceId, bulkPatchMode])

  useEffect(() => {
    setBulkPatchSelected((current) => current.filter((id) => bulkPatchDeviceUpdates.some((item) => item.catalogue?.id === id)))
  }, [bulkPatchDeviceId, bundle])

  function patchInstallsForApplication(application) {
    const grouped = new Map()
    for (const item of deviceSoftware.filter((entry) => entry.key === application?.key)) {
      const key = item.agentDeviceId || item.inventoryId
      const existing = grouped.get(key) || {
        ...item,
        installedVersions: [],
        registrationCount: 0,
        behindRegistrations: 0,
      }
      existing.registrationCount += 1
      if (item.installedVersion && !existing.installedVersions.includes(item.installedVersion)) {
        existing.installedVersions.push(item.installedVersion)
      }
      if (item.patchStatus === 'update_available') {
        existing.behindRegistrations += 1
        if (existing.behindRegistrations === 1) {
          existing.installedVersion = item.installedVersion
          existing.targetVersion = item.targetVersion
          existing.patchStatus = item.patchStatus
        }
      }
      grouped.set(key, existing)
    }
    return [...grouped.values()].filter((item) => item.behindRegistrations > 0)
  }

  function exposureForApplication(application) {
    const installationKeys = new Set(
      deviceSoftware
        .filter((item) => item.key === application.key && item.catalogue?.id)
        .map((item) => item.inventoryId + '|' + item.catalogue.id),
    )
    const exposure = softwareVulnerabilityExposures
      .filter((item) => installationKeys.has(item.inventory_id + '|' + item.catalogue_id))
      .reduce((summary, item) => ({
        open: summary.open + Number(item.open_count || 0),
        kev: summary.kev + Number(item.kev_count || 0),
        critical: summary.critical + Number(item.critical_count || 0),
        maxCvss: Math.max(summary.maxCvss, Number(item.max_cvss || 0)),
      }), { open: 0, kev: 0, critical: 0, maxCvss: 0 })

    const hydration = vulnerabilityHydration
      .filter((item) => installationKeys.has(item.inventory_id + '|' + item.catalogue_id))
      .reduce((summary, item) => ({
        total: summary.total + 1,
        checked: summary.checked + Number(item.checked === true || item.status === 'checked'),
        pending: summary.pending + Number(item.checked !== true && item.status !== 'checked'),
        unresolvedIdentity: summary.unresolvedIdentity + Number(item.status === 'pending_identity'),
        unresolvedVersion: summary.unresolvedVersion + Number(item.status === 'pending_version'),
      }), { total: 0, checked: 0, pending: 0, unresolvedIdentity: 0, unresolvedVersion: 0 })

    return { ...exposure, ...hydration }
  }

  function applicationPatchState(application) {
    if (application.updateAvailable) return 'update_available'
    if (application.providerBlocked) return 'provider_blocked'
    if (application.olderVersionPresent) return 'older_version_present'
    if (application.catalogue?.targetVersion) return 'current'
    if (application.catalogue) return 'detection_pending'
    return 'unmapped'
  }

  function applicationSourceState(application) {
    if (!application.catalogue) return { type: 'unmapped', health: 'unmapped' }
    const type = application.catalogue.sourceType || application.catalogue.catalogueSource || 'other'
    if (application.catalogue.sourceEnabled === false) return { type, health: 'disabled' }
    const monitored = application.catalogue.sourceKey ? vendorSourceHealthMap.get(application.catalogue.sourceKey) : null
    return { type, health: monitored?.state || (application.catalogue.catalogueSource === 'patchhost' ? 'endpoint' : 'unmonitored') }
  }

  const softwareSourceOptions = [...new Set(applications.map((application) => applicationSourceState(application).type).filter(Boolean))].sort()
  const softwareQuery = softwareSearch.trim().toLowerCase()
  const filteredApplications = applications.filter((application) => {
    const state = applicationPatchState(application)
    const exposure = exposureForApplication(application)
    const provider = String(application.catalogue?.provider || 'unmapped').toLowerCase()
    const source = applicationSourceState(application)
    const qualification = application.catalogue?.qualificationState || 'unmapped'
    if (softwareStateFilter === 'updates' && !['update_available', 'older_version_present', 'provider_blocked'].includes(state)) return false
    if (softwareStateFilter === 'vulnerable' && Number(exposure.open || 0) < 1) return false
    if (softwareStateFilter === 'unmapped' && state !== 'unmapped') return false
    if (softwareStateFilter === 'current' && state !== 'current') return false
    if (softwareProviderFilter !== 'all' && provider !== softwareProviderFilter) return false
    if (softwareSourceFilter !== 'all' && source.type !== softwareSourceFilter) return false
    if (softwareHealthFilter !== 'all' && source.health !== softwareHealthFilter) return false
    if (softwareQualificationFilter !== 'all' && qualification !== softwareQualificationFilter) return false
    if (!softwareQuery) return true
    const searchable = [
      application.name,
      application.publisher,
      application.catalogue?.canonicalName,
      application.catalogue?.packageId,
      application.catalogue?.provider,
      application.catalogue?.targetVersion,
      application.catalogue?.sourceKey,
      application.catalogue?.sourceType,
      application.catalogue?.registry,
      application.catalogue?.trustState,
      qualification,
      source.health,
      ...(application.versions || []).map((item) => item.version),
      state,
    ].filter(Boolean).join(' ').toLowerCase()
    return searchable.includes(softwareQuery)
  })
  const softwarePageCount = Math.max(1, Math.ceil(filteredApplications.length / softwarePageSize))
  const safeSoftwarePage = Math.min(softwarePage, softwarePageCount)
  const pagedApplications = filteredApplications.slice((safeSoftwarePage - 1) * softwarePageSize, safeSoftwarePage * softwarePageSize)

  useEffect(() => {
    setSoftwarePage(1)
  }, [softwareSearch, softwareStateFilter, softwareProviderFilter, softwareSourceFilter, softwareHealthFilter, softwareQualificationFilter, softwarePageSize])

  useEffect(() => {
    if (softwarePage > softwarePageCount) setSoftwarePage(softwarePageCount)
  }, [softwarePage, softwarePageCount])

  async function saveMapping(form) {
    setSaving(true)
    setError('')
    try {
      const result = await createSoftwareCatalogueEntry(form)
      setBundle(result.bundle)
      setMappingApp(null)
    } catch (requestError) {
      setError(requestError?.message || 'Unable to save software mapping.')
    } finally {
      setSaving(false)
    }
  }

  async function removeMapping(application) {
    if (!application.catalogue?.id || application.catalogue.builtIn) return
    if (!window.confirm('Archive the patch mapping for ' + application.name + '?')) return
    setSaving(true)
    try {
      const result = await deleteSoftwareCatalogueEntry(application.catalogue.id)
      setBundle(result.bundle)
    } catch (requestError) {
      setError(requestError?.message || 'Unable to archive software mapping.')
    } finally {
      setSaving(false)
    }
  }

  async function saveSoftwareValidation(form) {
    if (!validationApp?.catalogue?.id) {
      return { success: false, error: 'No catalogue application is selected.' }
    }
    setSaving(true)
    setError('')
    let settingsSaved = false
    try {
      const updated = await updateSoftwareValidation(validationApp.catalogue.id, form)
      settingsSaved = true
      if (updated.bundle) setBundle(updated.bundle)

      let finalPayload = updated
      if (updated.revalidateSource !== false) {
        try {
          const validated = await revalidateSoftwareCatalogueEntry(validationApp.catalogue.id)
          if (validated.bundle) setBundle(validated.bundle)
          finalPayload = validated
        } catch (requestError) {
          if (requestError?.data?.bundle) setBundle(requestError.data.bundle)
          const message = requestError?.message || 'Source revalidation failed.'
          setError(message)
          return {
            success: false,
            saved: true,
            error: 'Validation settings were saved, but source revalidation failed: ' + message,
          }
        }
      }

      const vulnerabilityValidation = updated.vulnerabilityValidation
      const vulnerabilityResolved = vulnerabilityValidation
        && ['covered', 'no_published_identity'].includes(vulnerabilityValidation.state)
      if (vulnerabilityValidation && !vulnerabilityResolved) {
        const reason = vulnerabilityValidation.error
          || vulnerabilityValidation.method
          || vulnerabilityValidation.state
          || 'needs review'
        const message = 'Validation settings were saved, but vulnerability identity validation did not resolve: '
          + String(reason).replaceAll('_', ' ')
        setError(message)
        return { success: false, saved: true, error: message }
      }

      const persisted = (finalPayload?.bundle?.catalogue || updated?.bundle?.catalogue || [])
        .find((item) => item.id === validationApp.catalogue.id)
      const identitySource = vulnerabilityValidation?.resolvedSource || ''
      const advisoryCount = Number(vulnerabilityValidation?.advisoryValidation?.advisoriesSeen)
      const advisorySuffix = Number.isFinite(advisoryCount)
        ? ' · ' + advisoryCount + ' published advisor' + (advisoryCount === 1 ? 'y' : 'ies') + ' checked'
        : ''
      const noPublishedIdentity = vulnerabilityValidation?.state === 'no_published_identity'
      const message = noPublishedIdentity
        ? 'Saved successfully. No published authoritative vulnerability identity was resolved. Hi5Central will keep rechecking this application periodically; vulnerability coverage remains limited.'
        : updated.revalidateSource !== false
          ? vulnerabilityValidation?.state === 'covered'
            ? 'Saved successfully. Source revalidation started and vulnerability identity validated via ' + identitySource + advisorySuffix + '.'
            : 'Saved successfully. Validation settings updated and source revalidation started.'
          : vulnerabilityValidation?.state === 'covered'
            ? 'Saved successfully. Vulnerability identity validated via ' + identitySource + advisorySuffix + '. Existing endpoint qualification evidence was preserved.'
            : 'Saved successfully. Validation settings updated.'

      return {
        success: true,
        warning: noPublishedIdentity,
        message,
        installArguments: persisted?.execution?.installArguments ?? form.execution?.installArguments ?? '',
        vulnerabilityValidation,
      }
    } catch (requestError) {
      if (requestError?.data?.bundle) setBundle(requestError.data.bundle)
      const message = requestError?.message || 'Unable to update and revalidate this software.'
      setError(message)
      return { success: false, saved: settingsSaved, error: message }
    } finally {
      setSaving(false)
    }
  }

  function selectCatalogueMaintenance(value) {
    setCatalogueMaintenanceId(value)
    setQualificationLab(null)
    setQualificationLabLoading(Boolean(value))
    setQualificationAction('')
  }

  async function runQualificationWorkspaceAction(action) {
    if (!catalogueMaintenanceId || qualificationAction) return
    setQualificationAction(action)
    setError('')
    try {
      const result = await runSoftwareQualificationAction(catalogueMaintenanceId, action)
      if (result.bundle) setBundle(result.bundle)
      if (result.lab) setQualificationLab(result.lab)
    } catch (requestError) {
      if (requestError?.data?.bundle) setBundle(requestError.data.bundle)
      if (requestError?.data?.lab) setQualificationLab(requestError.data.lab)
      setError(requestError?.message || 'Unable to run catalogue qualification action.')
    } finally {
      setQualificationAction('')
    }
  }

  async function markQualificationLimited(unsupportedCapabilities, reason) {
    if (!catalogueMaintenanceId || qualificationAction) return false
    setQualificationAction('mark_limited')
    setError('')
    try {
      const result = await runSoftwareQualificationAction(catalogueMaintenanceId, 'mark_limited', {
        unsupportedCapabilities,
        reason,
      })
      if (result.bundle) setBundle(result.bundle)
      if (result.lab) setQualificationLab(result.lab)
      return true
    } catch (requestError) {
      if (requestError?.data?.bundle) setBundle(requestError.data.bundle)
      if (requestError?.data?.lab) setQualificationLab(requestError.data.lab)
      setError(requestError?.message || 'Unable to mark this application as limited.')
      return false
    } finally {
      setQualificationAction('')
    }
  }

  async function clearQualificationLimited() {
    if (!catalogueMaintenanceId || qualificationAction) return
    setQualificationAction('clear_limited')
    setError('')
    try {
      const result = await runSoftwareQualificationAction(catalogueMaintenanceId, 'clear_limited')
      if (result.bundle) setBundle(result.bundle)
      if (result.lab) setQualificationLab(result.lab)
    } catch (requestError) {
      if (requestError?.data?.bundle) setBundle(requestError.data.bundle)
      if (requestError?.data?.lab) setQualificationLab(requestError.data.lab)
      setError(requestError?.message || 'Unable to remove limited qualification.')
    } finally {
      setQualificationAction('')
    }
  }

  async function refreshQualificationWorkspace() {
    if (!catalogueMaintenanceId || qualificationLabLoading) return
    setQualificationLabLoading(true)
    setError('')
    try {
      const result = await loadSoftwareQualificationLab(catalogueMaintenanceId)
      setQualificationLab(result.lab || null)
    } catch (requestError) {
      setError(requestError?.message || 'Unable to refresh catalogue qualification workspace.')
    } finally {
      setQualificationLabLoading(false)
    }
  }

  async function revalidateApplication(application) {
    if (!application?.catalogue?.id || !application.catalogue.sourceKey) return
    setSaving(true)
    setError('')
    try {
      const result = await revalidateSoftwareCatalogueEntry(application.catalogue.id)
      setBundle(result.bundle)
      if (application.catalogue.id === catalogueMaintenanceId) {
        const lab = await loadSoftwareQualificationLab(application.catalogue.id)
        setQualificationLab(lab.lab || null)
      }
    } catch (requestError) {
      if (requestError?.data?.bundle) setBundle(requestError.data.bundle)
      setError(requestError?.message || 'Software validation failed.')
    } finally {
      setSaving(false)
    }
  }

  async function retryApplicationQualification(application) {
    if (!application?.catalogue?.id) return
    setSaving(true)
    setError('')
    try {
      const result = await retrySoftwareQualification(application.catalogue.id)
      setBundle(result.bundle)
    } catch (requestError) {
      if (requestError?.data?.bundle) setBundle(requestError.data.bundle)
      setError(requestError?.message || 'Unable to retry software qualification.')
    } finally {
      setSaving(false)
    }
  }

  async function runSoftwarePatch(install) {
    if (!patchApp?.catalogue?.id || !install?.agentDeviceId) return
    setSaving(true)
    setError('')
    try {
      const result = await deploySoftwarePatch(install.agentDeviceId, patchApp.catalogue.id)
      setBundle(result.bundle)
      setPatchApp(null)
    } catch (requestError) {
      setError(requestError?.message || 'Unable to start software patch.')
    } finally {
      setSaving(false)
    }
  }

  async function runCatalogueInstall() {
    if (!catalogueInstallDeviceId || !catalogueInstallId || !selectedInstallCapabilityReady) return
    setSaving(true)
    setError('')
    try {
      const result = await installSoftwareFromCatalogue(catalogueInstallDeviceId, catalogueInstallId)
      setBundle(result.bundle)
      setCatalogueInstallId('')
    } catch (requestError) {
      setError(requestError?.message || 'Unable to start software installation.')
    } finally {
      setSaving(false)
    }
  }

  async function previewBulkSoftwarePatch() {
    if (!bulkPatchDeviceId) return
    if (bulkPatchMode === 'selected_catalogue' && !bulkPatchSelectedIds.length) {
      setError('Select at least one application to preview.')
      return
    }
    setBulkPatchBusy(true)
    setError('')
    try {
      const preview = await planSoftwarePatches(bulkPatchDeviceId, bulkPatchSelectedIds, bulkPatchMode)
      setBulkPatchPreview(preview)
    } catch (requestError) {
      setBulkPatchPreview(requestError?.data || null)
      setError(requestError?.message || 'Unable to preview software patches.')
    } finally {
      setBulkPatchBusy(false)
    }
  }

  async function executeBulkSoftwarePatch() {
    if (!bulkPatchDeviceId || !bulkPatchPreview?.eligibleCount || !bulkPatchCapabilityReady) return
    setBulkPatchBusy(true)
    setError('')
    try {
      const result = await deploySoftwarePatches(bulkPatchDeviceId, bulkPatchSelectedIds, bulkPatchMode)
      setBundle(result.bundle)
      setBulkPatchPreview(null)
      setBulkPatchSelected([])
    } catch (requestError) {
      setBulkPatchPreview(requestError?.data || bulkPatchPreview)
      setError(requestError?.message || 'Unable to start bulk software patching.')
    } finally {
      setBulkPatchBusy(false)
    }
  }

  async function saveVendorSource(form) {
    setSaving(true)
    setError('')
    try {
      const result = editingVendorSource?.id
        ? await updateVendorSource(editingVendorSource.id, form)
        : await createVendorSource(form)
      setBundle(result.bundle)
      setShowVendorSource(false)
      setEditingVendorSource(null)
      setTab('vendors')
    } catch (requestError) {
      setError(requestError?.message || 'Unable to save vendor source.')
    } finally {
      setSaving(false)
    }
  }

  async function runVendorSourceTest(source) {
    setSaving(true)
    setError('')
    try {
      const result = await testVendorSource(source.id)
      setBundle(result.bundle)
    } catch (requestError) {
      setError(requestError?.message || 'Vendor source test failed.')
    } finally {
      setSaving(false)
    }
  }

  async function runVendorSourceApproval(source) {
    setSaving(true)
    setError('')
    try {
      const result = await approveVendorSource(source.id)
      setBundle(result.bundle)
    } catch (requestError) {
      setError(requestError?.message || 'Unable to approve vendor source.')
    } finally {
      setSaving(false)
    }
  }

  async function removeVendorSource(source) {
    if (!window.confirm('Archive vendor source ' + source.display_name + '?')) return
    setSaving(true)
    setError('')
    try {
      const result = await archiveVendorSource(source.id)
      setBundle(result.bundle)
    } catch (requestError) {
      setError(requestError?.message || 'Unable to archive vendor source.')
    } finally {
      setSaving(false)
    }
  }

  async function remediateExposure(exposure) {
    if (!exposure?.id || remediatingExposureId) return
    setRemediatingExposureId(exposure.id)
    setError('')
    try {
      const result = await remediateVulnerabilityExposure(exposure.id)
      setBundle(result.bundle)
    } catch (requestError) {
      setError(requestError?.message || 'Unable to start vulnerability remediation.')
    } finally {
      setRemediatingExposureId('')
    }
  }

  async function savePolicy(form) {
    setSaving(true)
    setError('')
    try {
      const result = editingPolicy?.id
        ? await updatePatchPolicy(editingPolicy.id, form)
        : await createPatchPolicy(form)
      setBundle(result.bundle)
      setShowPolicy(false)
      setEditingPolicy(null)
      setTab('policies')
    } catch (requestError) {
      setError(requestError?.message || 'Unable to save patch policy.')
    } finally {
      setSaving(false)
    }
  }

  async function evaluateWindowsPatching() {
    if (windowsEvaluating) return
    setWindowsEvaluating(true)
    setError('')
    try {
      const result = await evaluateWindowsUpdatePolicies(true)
      const refreshed = await loadRmmPatching()
      setBundle(refreshed)
      return result
    } catch (requestError) {
      setError(requestError?.message || 'Unable to evaluate Windows Update schedules.')
    } finally {
      setWindowsEvaluating(false)
    }
  }
  async function setWindowsReleaseControl(release, state) {
    if (!release?.updateKey || windowsControlBusy) return
    setWindowsControlBusy(release.updateKey)
    setError('')
    try {
      const result = state === 'paused'
        ? await pauseWindowsUpdateRollout(release.updateKey, 'Paused from Windows Update rollout console')
        : await resumeWindowsUpdateRollout(release.updateKey)
      setBundle((current) => ({ ...(current || {}), windowsUpdates: result.windowsUpdates }))
    } catch (requestError) {
      setError(requestError?.message || 'Unable to update Windows rollout state.')
    } finally {
      setWindowsControlBusy('')
    }
  }

  async function rollbackWindowsRelease(release) {
    if (!release?.updateKey || windowsControlBusy) return
    const readyTargets = (release.rollbackTargets || []).filter((target) => target.online && target.rollbackReady)
    if (!readyTargets.length) {
      setError(release.rollbackAvailableDevices
        ? 'Rollback-capable devices are offline or require Agent 0.1.207.'
        : 'Windows does not report this release as rollback-capable on any managed device.')
      return
    }
    const confirmed = window.confirm(
      'Rollback “' + release.title + '” on ' + readyTargets.length + ' online device' + (readyTargets.length === 1 ? '' : 's') +
      '? Hi5Central will pause this release first so it is not immediately reinstalled.',
    )
    if (!confirmed) return
    setWindowsControlBusy(release.updateKey)
    setError('')
    try {
      const result = await rollbackWindowsUpdateRelease(
        release.updateKey,
        readyTargets.map((target) => target.agentDeviceId),
      )
      setBundle((current) => ({ ...(current || {}), windowsUpdates: result.windowsUpdates }))
    } catch (requestError) {
      setError(requestError?.message || 'Unable to start Windows Update rollback.')
    } finally {
      setWindowsControlBusy('')
    }
  }

  async function saveAssignment(assignment) {
    setSaving(true)
    try {
      const result = await createPatchAssignment(assignment)
      setBundle(result.bundle)
      setAssignPolicy(null)
    } catch (requestError) {
      setError(requestError?.message || 'Unable to assign patch policy.')
    } finally {
      setSaving(false)
    }
  }

  async function removeAssignment(assignment) {
    setSaving(true)
    try {
      const result = await deletePatchAssignment(assignment.id)
      setBundle(result.bundle)
    } catch (requestError) {
      setError(requestError?.message || 'Unable to remove patch assignment.')
    } finally {
      setSaving(false)
    }
  }

  return <>
    {!softwareOnly && <PageHeading action={<div className="rmm-patch-heading-actions"><button disabled={loading} onClick={refresh} type="button"><RefreshCw size={15} /> Refresh</button>{tab === 'policies' && <><button onClick={() => { setEditingPolicy(null); setPolicyModalType('os'); setShowPolicy(true) }} type="button"><Plus size={15} /> New OS policy</button><button className="rmm-primary compact" onClick={() => { setEditingPolicy(null); setPolicyModalType('software'); setShowPolicy(true) }} type="button"><Plus size={15} /> New software policy</button></>}</div>} />}
    {error && <div className="rmm-patch-error"><AlertTriangle size={16} /><span>{error}</span></div>}

    {!softwareOnly && <nav className="rmm-patch-tabs">
      {[
        ['catalogue', 'Catalogue', catalogueFeed.total ?? catalogue.length],
        ['windows', 'Windows Update', windowsPending],
        ['policies', 'Policies', policies.length],
      ].map(([id, label, count]) => <button className={tab === id ? 'active' : ''} key={id} onClick={() => setTab(id)} type="button">{label}<b>{count}</b></button>)}
    </nav>}

    {softwareOnly && tab === 'software' && <section className="rmm-patch-panel">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Software catalogue</span><h2>Catalogue</h2><p>Deploy and patch approved software from the Hi5Central catalogue. WinGet packages are included below as an additional searchable source.</p></div></div>
      <div className="rmm-catalogue-install-card">
        <div className="intro"><PackageCheck size={18} /><div><strong>Install from catalogue</strong><span>Install approved catalogue software on an online managed device. Existing installations stay in the normal Patch workflow.</span></div></div>
        <div className="controls">
          <label>Device<select value={catalogueInstallDeviceId} onChange={(event) => { setCatalogueInstallDeviceId(event.target.value); setCatalogueInstallId('') }}>
            <option value="">Select device</option>
            {onlineInstallDevices.map((device) => <option key={device.agentDeviceId} value={device.agentDeviceId}>{device.name}</option>)}
          </select></label>
          <label>Application<select value={catalogueInstallId} onChange={(event) => setCatalogueInstallId(event.target.value)} disabled={!catalogueInstallDeviceId}>
            <option value="">Select application</option>
            {installableCatalogue.map((item) => <option key={item.id} value={item.id}>{item.canonicalName} · {item.targetVersion} · {qualificationLabel(item.qualificationState)}</option>)}
          </select></label>
          <div className="install-meta">
            <span><small>Target</small><strong>{selectedCatalogueInstall?.targetVersion || '—'}</strong></span>
            <span><small>Provider</small><strong>{selectedCatalogueInstall?.executionPackageId ? 'WinGet' : selectedCatalogueInstall?.deploymentMode?.replaceAll('_', ' ') || '—'}</strong></span>
            <span><small>Qualification</small><strong>{qualificationLabel(selectedCatalogueInstall?.qualificationState)}</strong></span>
            <span><small>Admission</small><strong>{readinessLabel(selectedCatalogueReadiness.state)}</strong></span>
            <span><small>PatchHost</small><strong>{selectedInstallPatchHost || 'Not reported'}</strong></span>
          </div>
          {selectedCatalogueInstall && <div className="install-meta">
            <span><small>Source</small><StatusPill tone={readinessTone(selectedCatalogueReadiness.source?.state)}>{readinessLabel(selectedCatalogueReadiness.source?.state)}</StatusPill></span>
            <span><small>Artifact</small><StatusPill tone={readinessTone(selectedCatalogueReadiness.artifact?.state)}>{readinessLabel(selectedCatalogueReadiness.artifact?.state)}</StatusPill></span>
            <span><small>Clean install</small><StatusPill tone={readinessTone(selectedCatalogueReadiness.installTest?.state)}>{readinessLabel(selectedCatalogueReadiness.installTest?.state)}</StatusPill></span>
            <span><small>Uninstall</small><StatusPill tone={readinessTone(selectedCatalogueReadiness.uninstallTest?.state)}>{readinessLabel(selectedCatalogueReadiness.uninstallTest?.state)}</StatusPill></span>
            <span><small>Upgrade</small><StatusPill tone={readinessTone(selectedCatalogueReadiness.upgradeTest?.state)}>{readinessLabel(selectedCatalogueReadiness.upgradeTest?.state)}</StatusPill></span>
            <span><small>Vulnerability</small><StatusPill tone={readinessTone(selectedCatalogueReadiness.vulnerability?.state)}>{readinessLabel(selectedCatalogueReadiness.vulnerability?.state)}</StatusPill></span>
          </div>}
          <button className="rmm-primary" disabled={saving || !selectedCatalogueInstall || !selectedInstallCapabilityReady} onClick={runCatalogueInstall} type="button"><Plus size={14} /> Install</button>
        </div>
        {selectedInstallDevice && !selectedInstallCapabilityReady && <small className="capability-note">Catalogue installation requires PatchHost 0.2.5 or newer. {selectedInstallPatchHost ? 'This device currently reports ' + selectedInstallPatchHost + '.' : 'This device has not reported a compatible PatchHost version yet.'}</small>}
        {catalogueInstallDeviceId && !installableCatalogue.length && <small className="capability-note">No installable catalogue applications remain for this device.</small>}
      </div>
      <div className="rmm-bulk-patch-card">
        <div className="intro"><ShieldCheck size={18} /><div><strong>Bulk application patching</strong><span>Preview an endpoint-specific plan before anything is queued. Choose selected catalogue applications, every eligible Hi5Central catalogue update, or every WinGet-discovered update.</span></div></div>
        <div className="controls">
          <label>Device<select value={bulkPatchDeviceId} onChange={(event) => setBulkPatchDeviceId(event.target.value)}><option value="">Select online device</option>{onlineInstallDevices.map((device) => <option key={device.agentDeviceId} value={device.agentDeviceId}>{device.name}</option>)}</select></label>
          <label>Patch mode<select value={bulkPatchMode} onChange={(event) => setBulkPatchMode(event.target.value)}><option value="selected_catalogue">Selected catalogue applications</option><option value="all_catalogue">All Hi5Central catalogue updates ({bulkCatalogueUpdateCount})</option><option value="all_winget">All WinGet updates ({bulkWingetUpdateCount})</option></select></label>
          <button disabled={bulkPatchBusy || !bulkPatchDeviceId || (bulkPatchMode === 'selected_catalogue' && !bulkPatchSelectedIds.length)} onClick={previewBulkSoftwarePatch} type="button"><Search size={14} /> Preview plan</button>
        </div>
        {bulkPatchMode === 'selected_catalogue' && <div className="rmm-bulk-patch-selection"><div className="selection-head"><strong>{bulkPatchDeviceUpdates.length} updates detected</strong><button disabled={!bulkPatchDeviceUpdates.length} onClick={() => setBulkPatchSelected(bulkPatchSelectedIds.length === bulkPatchDeviceUpdates.length ? [] : bulkPatchDeviceUpdates.map((item) => item.catalogue.id))} type="button">{bulkPatchSelectedIds.length === bulkPatchDeviceUpdates.length && bulkPatchDeviceUpdates.length ? 'Clear all' : 'Select all'}</button></div>{bulkPatchDeviceUpdates.map((item) => <label key={item.catalogue.id}><input checked={bulkPatchSelectedIds.includes(item.catalogue.id)} onChange={(event) => setBulkPatchSelected((current) => event.target.checked ? [...new Set([...current, item.catalogue.id])] : current.filter((id) => id !== item.catalogue.id))} type="checkbox" /><span><strong>{item.name}</strong><small>{item.installedVersion || 'Unknown'} → {item.targetVersion || 'Unknown'} · {item.catalogue.provider}</small></span></label>)}</div>}
        {bulkPatchDevice && !bulkPatchCapabilityReady && <small className="capability-note">This endpoint is online but has not reported verified bulk software-patch capability yet. Upgrade the Agent before executing a bulk plan.</small>}
        {bulkPatchPreview && <div className="rmm-bulk-patch-preview"><div className="stats"><span><small>Eligible</small><strong>{bulkPatchPreview.eligibleCount || 0}</strong></span><span><small>Ignored</small><strong>{bulkPatchPreview.ignoredCount || 0}</strong></span><span><small>Skipped</small><strong>{bulkPatchPreview.rejectedCount || 0}</strong></span></div><div className="items">{(bulkPatchPreview.items || []).map((item) => <span key={item.catalogueId}><strong>{item.applicationName}</strong><small>{item.installedVersion} → {item.targetVersion} · {item.provider}</small></span>)}</div><button className="rmm-primary" disabled={bulkPatchBusy || !bulkPatchCapabilityReady || !bulkPatchPreview.eligibleCount} onClick={executeBulkSoftwarePatch} type="button"><PackageCheck size={14} /> Patch {bulkPatchPreview.eligibleCount || 0} application{bulkPatchPreview.eligibleCount === 1 ? '' : 's'}</button></div>}
      </div>
      {!!discoveredWingetUpdates.length && <div className="rmm-patch-candidate-section rmm-discovered-update-section">
        <div>
          <span className="rmm-eyebrow">Endpoint discovery</span>
          <h3>WinGet-discovered updates · {discoveredWingetUpdates.length}</h3>
          <p>PatchHost has detected newer WinGet versions on managed endpoints. These remain visible here even when they are not linked to an active qualified Hi5Central catalogue entry.</p>
        </div>
        <div className="rmm-patch-table discovered-updates">
          <div className="head"><span>Application</span><span>Device</span><span>Installed</span><span>Available</span><span>WinGet package</span><span>Mapping</span></div>
          {discoveredWingetUpdates.map((item) => <div className="row" key={[item.inventory_id,item.provider_package_id,item.application_name].join('|')}>
            <span><strong>{item.application_name || item.display_name || item.provider_package_id}</strong><small>{item.publisher || 'Publisher not reported'}</small></span>
            <span><strong>{item.device_name || item.device_reference || 'Managed device'}</strong><small>{item.device_reference || ''}</small></span>
            <span><strong>{item.installed_version || 'Unknown'}</strong></span>
            <span><strong>{item.available_version || 'Unknown'}</strong></span>
            <span><strong>{item.provider_package_id || 'Not reported'}</strong><small>WinGet</small></span>
            <span>{item.catalogue_id
              ? <StatusPill tone="healthy">Catalogue linked</StatusPill>
              : <StatusPill tone="warning">Discovery only</StatusPill>}</span>
          </div>)}
        </div>
        <small className="rmm-patch-candidate-footnote">Discovery-only updates can be previewed and deployed through Bulk application patching → All WinGet updates. They are not shown as qualified catalogue patches until an active catalogue mapping exists.</small>
      </div>}
      <div className="rmm-software-toolbar">
        <label className="search"><Search size={14} /><input value={softwareSearch} onChange={(event) => setSoftwareSearch(event.target.value)} placeholder="Search application, publisher, package ID, provider or version…" /></label>
        <select aria-label="Software state filter" value={softwareStateFilter} onChange={(event) => setSoftwareStateFilter(event.target.value)}><option value="all">All states</option><option value="updates">Updates / attention</option><option value="vulnerable">Vulnerable</option><option value="current">Current</option><option value="unmapped">Unmapped</option></select>
        <select aria-label="Software provider filter" value={softwareProviderFilter} onChange={(event) => setSoftwareProviderFilter(event.target.value)}><option value="all">All providers</option><option value="winget">WinGet</option><option value="managed">Hi5Central managed</option><option value="vendor">Vendor</option><option value="unmapped">Unmapped</option></select>
        <select aria-label="Software source filter" value={softwareSourceFilter} onChange={(event) => setSoftwareSourceFilter(event.target.value)}><option value="all">All sources</option>{softwareSourceOptions.map((source) => <option key={source} value={source}>{source.replaceAll('_', ' ')}</option>)}</select>
        <select aria-label="Software source health filter" value={softwareHealthFilter} onChange={(event) => setSoftwareHealthFilter(event.target.value)}><option value="all">All source health</option><option value="healthy">Healthy</option><option value="attention">Needs attention</option><option value="stale">Stale</option><option value="pending">Pending</option><option value="disabled">Disabled</option><option value="endpoint">Endpoint discovery</option><option value="unmonitored">Unmonitored</option></select>
        <select aria-label="Software qualification filter" value={softwareQualificationFilter} onChange={(event) => setSoftwareQualificationFilter(event.target.value)}><option value="all">All qualification</option><option value="qualified">Qualified</option><option value="qualified_limited">Qualified — limited</option><option value="deployment_candidate">Deployment candidate</option><option value="intelligence_only">Intelligence only</option><option value="blocked">Blocked</option><option value="unmapped">Unmapped</option></select>
        <select aria-label="Rows per page" value={softwarePageSize} onChange={(event) => setSoftwarePageSize(Number(event.target.value))}><option value={10}>10 / page</option><option value={25}>25 / page</option><option value={50}>50 / page</option><option value={100}>100 / page</option></select>
        <span className="summary">{filteredApplications.length} of {applications.length} applications</span>
      </div>
      <div className="rmm-patch-table software">
        <div className="head"><span>Application</span><span>Installed</span><span>Target</span><span>Patch state</span><span>Vulnerabilities</span><span>Provider</span><span /></div>
        {pagedApplications.map((application) => {
          const status = applicationPatchState(application)
          const exposure = exposureForApplication(application)
          const sourceState = applicationSourceState(application)
          return <div className="row" key={application.key}>
            <span><strong>{application.name}</strong><small>{application.publisher || 'Publisher not reported'} · {application.deviceCount} device{application.deviceCount === 1 ? '' : 's'}</small></span>
            <span className="versions"><strong title={application.versions?.map((version) => version.version).join(' · ') || ''}>{application.versions?.map((version) => version.version).join(' · ') || 'Not reported'}</strong>{application.installs > application.deviceCount && <small>{application.installs} registrations across {application.deviceCount} device{application.deviceCount === 1 ? '' : 's'}</small>}</span>
            <span><strong>{application.catalogue?.targetVersion || 'Not set'}</strong><small>{application.catalogue?.packageId || 'No package ID'}</small></span>
            <span><StatusPill tone={patchTone(status)}>{patchLabel(status)}</StatusPill>{application.updateAvailable > 0 && <small>{application.updateAvailable} install{application.updateAvailable === 1 ? '' : 's'} behind</small>}{status === 'provider_blocked' && <small>WinGet reports no applicable upgrade; retry is suppressed until detection changes.</small>}{status === 'older_version_present' && <small>{application.olderVersionPresent} older side-by-side install{application.olderVersionPresent === 1 ? '' : 's'} remain. The approved target is installed; remove older majors separately if they are no longer required.</small>}</span>
            <span>{exposure.open > 0
              ? <StatusPill tone={exposure.kev > 0 || exposure.critical > 0 ? 'critical' : 'warning'}>{exposure.open} open</StatusPill>
              : !application.catalogue
                ? <StatusPill tone="neutral">Unmapped</StatusPill>
                : exposure.checked > 0 && exposure.pending === 0
                  ? <StatusPill tone="healthy">Covered · none known</StatusPill>
                  : exposure.unresolvedIdentity > 0
                    ? <StatusPill tone="warning">Coverage unresolved</StatusPill>
                    : <StatusPill tone="running">Coverage pending</StatusPill>}
              <small>{[
                exposure.kev > 0 ? exposure.kev + ' CISA KEV' : exposure.maxCvss > 0 ? 'Max CVSS ' + exposure.maxCvss : '',
                application.catalogue && exposure.pending > 0
                  ? exposure.checked > 0
                    ? exposure.checked + ' checked · ' + exposure.pending + ' pending'
                    : exposure.unresolvedIdentity > 0
                      ? 'No validated vulnerability identity yet; zero is not asserted'
                      : 'Installed version awaiting vulnerability lookup'
                  : application.catalogue && exposure.checked > 0
                    ? 'Installed version assessed; zero means no applicable known vulnerabilities'
                    : '',
              ].filter(Boolean).join(' · ')}</small>
            </span>
            <span><strong>{application.catalogue?.provider || 'Unmapped'}</strong>{application.catalogue
              ? <><StatusPill tone={qualificationTone(application.catalogue.qualificationState)}>{qualificationLabel(application.catalogue.qualificationState)}</StatusPill><small>{application.catalogue.builtIn ? 'Hi5Central catalogue' : 'Tenant mapping'}{application.catalogue.qualificationVersion ? ' · tested ' + application.catalogue.qualificationVersion : ''}</small><small>{sourceState.type.replaceAll('_', ' ')} · source {sourceState.health.replaceAll('_', ' ')}</small></>
              : <small>Needs mapping</small>}</span>
            <span className="actions">{application.catalogue
              ? <button disabled={saving || application.updateAvailable < 1} onClick={() => setPatchApp(application)} type="button"><PackageCheck size={14} /> Patch</button>
              : <StatusPill tone="neutral">Not in catalogue</StatusPill>}</span>
          </div>
        })}
      </div>
      {!!filteredApplications.length && <div className="rmm-software-pagination"><span>Showing {(safeSoftwarePage - 1) * softwarePageSize + 1}–{Math.min(safeSoftwarePage * softwarePageSize, filteredApplications.length)} of {filteredApplications.length}</span><div><button disabled={safeSoftwarePage <= 1} onClick={() => setSoftwarePage((page) => Math.max(1, page - 1))} type="button"><ChevronLeft size={14} /> Previous</button><strong>Page {safeSoftwarePage} of {softwarePageCount}</strong><button disabled={safeSoftwarePage >= softwarePageCount} onClick={() => setSoftwarePage((page) => Math.min(softwarePageCount, page + 1))} type="button">Next <ChevronRight size={14} /></button></div></div>}
      {!applications.length && <div className="rmm-empty"><Box size={24} /><strong>{loading ? 'Loading software inventory…' : 'No software inventory'}</strong><span>Patchability appears after an Agent reports installed applications.</span></div>}
      {!!applications.length && !filteredApplications.length && <div className="rmm-empty compact"><Search size={22} /><strong>No matching software</strong><span>Clear the search or filters to see the full software inventory.</span></div>}
      {!!catalogueCandidates.length && <div className="rmm-patch-candidate-section">
        <div><span className="rmm-eyebrow">PatchHost discovery</span><h3>Automatically learned package mappings</h3><p>These package IDs came from WinGet matching on managed endpoints. They are catalogue candidates, not manually entered records.</p></div>
        <div className="rmm-patch-table candidates">
          <div className="head"><span>Package</span><span>Provider ID</span><span>Devices</span><span>Updates</span><span>Latest observed</span></div>
          {catalogueCandidates.map((candidate) => <div className="row" key={candidate.id}>
            <span><strong>{candidate.display_name || candidate.provider_package_id}</strong><small>{candidate.publisher || 'Publisher pending enrichment'}</small></span>
            <span><strong>{candidate.provider_package_id}</strong><small>{candidate.provider}</small></span>
            <span><strong>{candidate.devices_seen}</strong></span>
            <span><StatusPill tone={candidate.updates_seen > 0 ? 'warning' : 'healthy'}>{candidate.updates_seen}</StatusPill></span>
            <span><strong>{candidate.latest_observed_version || 'Not reported'}</strong><small>{candidate.state}</small></span>
          </div>)}
        </div>
        <small className="rmm-patch-candidate-footnote">{patchObservations.length} endpoint package observation{patchObservations.length === 1 ? '' : 's'} currently back these candidates.</small>
      </div>}
      <div className="rmm-patch-execution-gate"><Clock3 size={17} /><div><strong>Capability-gated deployment</strong><span>{patchHostReady} endpoint{patchHostReady === 1 ? '' : 's'} report PatchHost discovery · {patchHostInstallReady} report software-install capability. Offline devices and endpoints without install capability cannot receive patch jobs.</span></div></div>
      {!!deployments.length && <div className="rmm-patch-deployment-history">
        <div><span className="rmm-eyebrow">Execution history</span><h3>Recent software patch deployments</h3></div>
        <div className="rmm-patch-table deployments">
          <div className="head"><span>Application</span><span>Device</span><span>Version</span><span>Provider</span><span>Status</span></div>
          {deployments.slice(0, 20).map((deployment) => <div className="row" key={deployment.id}>
            <span><strong>{deployment.application_name}</strong><small>{new Date(deployment.created_at).toLocaleString()}</small></span>
            <span><strong>{deployment.device_name}</strong><small>{deployment.device_reference}</small></span>
            <span><strong>{deployment.installed_version || 'Unknown'} → {deployment.target_version || 'Unknown'}</strong></span>
            <span><strong>{deployment.provider || 'Pending'}</strong><small>{deployment.provider_package_id || ''}</small></span>
            <span><StatusPill tone={['succeeded'].includes(deployment.status) ? 'healthy' : ['failed', 'verification_failed'].includes(deployment.status) ? 'critical' : ['running', 'eligible'].includes(deployment.status) ? 'running' : 'neutral'}>{deployment.status.replaceAll('_', ' ')}</StatusPill></span>
          </div>)}
        </div>
      </div>}
    </section>}

    {!softwareOnly && tab === 'catalogue' && <section className="rmm-patch-panel">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Software catalogue</span><h2>All software</h2><p>One catalogue containing Hi5Central-curated applications and the full WinGet repository. Filter by source to switch between the curated Hi5Central catalogue and raw WinGet packages.</p></div></div>
      <div className="rmm-catalogue-toolbar">
        <label className="search"><Search size={14} /><input value={catalogueQuery} onChange={(event) => setCatalogueQuery(event.target.value)} placeholder="Search application, publisher or package ID…" /></label>
        <select aria-label="Catalogue source filter" value={catalogueSourceFilter} onChange={(event) => setCatalogueSourceFilter(event.target.value)}>
          <option value="all">All sources ({Number(catalogueFeed.sourceCounts?.hi5central || 0) + Number(catalogueFeed.sourceCounts?.winget || 0)})</option>
          <option value="hi5central">Hi5Central ({catalogueFeed.sourceCounts?.hi5central || 0})</option>
          <option value="winget">WinGet ({catalogueFeed.sourceCounts?.winget || 0})</option>
        </select>
        <select aria-label="Catalogue rows per page" value={cataloguePageSize} onChange={(event) => setCataloguePageSize(Number(event.target.value))}>
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>
        <span className="summary">{catalogueLoading ? 'Loading…' : (catalogueFeed.total ?? 0) + ' software'}</span>
      </div>
      <div className="rmm-patch-table catalogue-unified">
        <div className="head"><span>Application</span><span>Publisher</span><span>Source</span><span>Package ID</span><span>Version</span></div>
        {(catalogueFeed.items || []).map((item) => <div className="row" key={item.key}>
          <span><strong>{item.name || item.packageId}</strong><small>{item.moniker || (item.builtIn ? 'Hi5Central global catalogue' : item.source === 'hi5central' ? 'Tenant catalogue' : 'WinGet community repository')}</small></span>
          <span><strong>{item.publisher || item.publishers?.[0] || 'Not reported'}</strong><small>{item.publishers?.slice(1).join(' · ')}</small></span>
          <span><StatusPill tone={item.source === 'hi5central' ? 'healthy' : 'running'}>{item.sourceLabel || (item.source === 'hi5central' ? 'Hi5Central' : 'WinGet')}</StatusPill></span>
          <span><strong>{item.packageId || 'Managed catalogue'}</strong></span>
          <span><strong>{item.version || 'Not published'}</strong></span>
        </div>)}
      </div>
      {!catalogueLoading && !(catalogueFeed.items || []).length && <div className="rmm-empty compact"><Search size={22} /><strong>No software matched</strong><span>Clear the search or filters to see the full catalogue.</span></div>}
      <div className="rmm-software-pagination">
        <span>{catalogueFeed.total ? 'Showing ' + ((Number(catalogueFeed.page || cataloguePage) - 1) * Number(catalogueFeed.pageSize || cataloguePageSize) + 1) + '–' + Math.min(Number(catalogueFeed.page || cataloguePage) * Number(catalogueFeed.pageSize || cataloguePageSize), Number(catalogueFeed.total || 0)) + ' of ' + catalogueFeed.total : '0 software'}</span>
        <div>
          <button disabled={catalogueLoading || Number(catalogueFeed.page || cataloguePage) <= 1} onClick={() => setCataloguePage((page) => Math.max(1, page - 1))} type="button"><ChevronLeft size={14} /> Previous</button>
          <strong>Page {catalogueFeed.page || cataloguePage} of {catalogueFeed.pages || 1}</strong>
          <button disabled={catalogueLoading || Number(catalogueFeed.page || cataloguePage) >= Number(catalogueFeed.pages || 1)} onClick={() => setCataloguePage((page) => Math.min(Number(catalogueFeed.pages || 1), page + 1))} type="button">Next <ChevronRight size={14} /></button>
        </div>
      </div>
    </section>}

    {tab === 'windows' && <section className="rmm-patch-panel">
      <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Windows Update</span><h2>OS patch scheduling</h2><p>Windows Update remains the source of applicable patches. Hi5Central decides when eligible updates may install based on assignment, release delay and maintenance window.</p></div><button disabled={windowsEvaluating} onClick={evaluateWindowsPatching} type="button"><RefreshCw size={14} /> {windowsEvaluating ? 'Evaluating…' : 'Evaluate schedules'}</button></div>
      <div className="rmm-windows-summary">
        <article><small>Pending</small><strong>{windowsSummary.pending || 0}</strong><span>{windowsSummary.devices || 0} device{Number(windowsSummary.devices || 0) === 1 ? '' : 's'}</span></article>
        <article><small>Critical / security</small><strong>{Number(windowsSummary.critical || 0) + Number(windowsSummary.security || 0)}</strong><span>{windowsSummary.critical || 0} critical · {windowsSummary.security || 0} security</span></article>
        <article><small>Quality</small><strong>{windowsSummary.quality || 0}</strong><span>Cumulative and servicing updates</span></article>
        <article><small>Feature / driver</small><strong>{Number(windowsSummary.feature || 0) + Number(windowsSummary.driver || 0)}</strong><span>{windowsSummary.feature || 0} feature · {windowsSummary.driver || 0} driver</span></article>
        <article><small>Reboot required</small><strong>{windowsSummary.rebootRequired || 0}</strong><span>{windowsSummary.pausedReleases || 0} paused release{Number(windowsSummary.pausedReleases || 0) === 1 ? '' : 's'}</span></article>
        <article><small>Managed by Hi5Central</small><strong>{windowsSummary.managedDevices || 0}</strong><span>{windowsSummary.managementConflicts || 0} management conflict{Number(windowsSummary.managementConflicts || 0) === 1 ? '' : 's'}</span></article>
      </div>

      {!!windowsManagement.length && <>
        <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Windows ownership</span><h3>Update management state</h3><p>Hi5Central applies a minimal local Windows Update policy only when an OS patch policy is assigned. Existing WSUS, Group Policy or MDM update management is never overwritten.</p></div></div>
        <div className="rmm-patch-table windows scheduled">
          <div className="head"><span>Device</span><span>Desired</span><span>Applied</span><span>Policy</span><span>Last applied</span><span>Status</span></div>
          {windowsManagement.map((item) => <div className="row" key={item.inventory_id}>
            <span><strong>{item.device_name}</strong><small>{item.device_reference}</small></span>
            <span><StatusPill tone={item.desired_managed ? 'running' : 'neutral'}>{item.desired_managed ? 'Managed' : 'Unmanaged'}</StatusPill><small>{item.desired_managed ? 'OS patch policy assigned' : 'No Windows patch policy'}</small></span>
            <span><StatusPill tone={item.applied_managed ? 'healthy' : item.desired_managed ? 'warning' : 'neutral'}>{item.applied_managed ? 'Managed by Hi5Central' : 'Not applied'}</StatusPill><small>{item.agent_version ? 'Agent ' + item.agent_version : ''}</small></span>
            <span><strong>{item.policy_name || 'None'}</strong><small>{item.policy_id || ''}</small></span>
            <span><strong>{item.last_applied_at ? new Date(item.last_applied_at).toLocaleString() : 'Not yet'}</strong><small>{item.websocket_status === 'Connected' ? 'Online' : 'Offline'}</small></span>
            <span><StatusPill tone={item.last_error ? 'critical' : item.applied_managed === item.desired_managed ? 'healthy' : 'warning'}>{item.last_error ? 'Conflict / error' : item.applied_managed === item.desired_managed ? 'In sync' : 'Pending'}</StatusPill><small>{item.last_error || (item.applied_managed ? 'Windows Update is organisation-managed' : 'Windows default behaviour')}</small></span>
          </div>)}
        </div>
      </>}

      {!!windowsReleases.length && <>
        <div className="rmm-card-heading"><div><span className="rmm-eyebrow">Release control</span><h3>Windows update rollouts</h3><p>Pause a problematic release without disabling Windows patching for the rest of the estate. In-flight installs are allowed to finish; no new scheduled install will include a paused release.</p></div></div>
        <div className="rmm-patch-table windows scheduled">
          <div className="head"><span>Release</span><span>Devices</span><span>Class</span><span>Published</span><span>Rollout state</span><span>Action</span></div>
          {windowsReleases.map((release) => <div className="row" key={release.updateKey}>
            <span><strong>{release.title}</strong><small>{(release.kbArticles || []).join(', ') || release.updateId || 'No KB reference'}</small></span>
            <span><strong>{release.devices}</strong><small>{release.downloadedDevices} downloaded{release.rollbackAvailableDevices ? ' · ' + release.rollbackAvailableDevices + ' rollback-capable' : ''}</small></span>
            <span><StatusPill tone={['critical','security'].includes(release.updateClass) ? 'warning' : 'neutral'}>{release.updateClass}</StatusPill><small>{release.severity || 'No MSRC severity'}</small></span>
            <span><strong>{release.releaseAt ? new Date(release.releaseAt).toLocaleDateString() : 'Observed'}</strong><small>{release.firstSeenAt ? 'First seen ' + new Date(release.firstSeenAt).toLocaleDateString() : ''}</small></span>
            <span><StatusPill tone={release.paused ? 'critical' : 'healthy'}>{release.paused ? 'Paused' : 'Active'}</StatusPill><small>{release.paused ? (release.control?.reason || 'Manual rollout pause') : 'Following assigned rollout waves'}</small></span>
            <span><div className="rmm-row-actions"><button disabled={windowsControlBusy === release.updateKey} onClick={() => setWindowsReleaseControl(release, release.paused ? 'active' : 'paused')} type="button">{windowsControlBusy === release.updateKey ? 'Saving…' : release.paused ? 'Resume' : 'Pause'}</button><button disabled={windowsControlBusy === release.updateKey || !release.rollbackOnlineDevices} onClick={() => rollbackWindowsRelease(release)} title={release.rollbackAvailableDevices && !release.rollbackOnlineDevices ? 'Rollback-capable devices are offline or require Agent 0.1.210' : ''} type="button"><RotateCcw size={13} /> Rollback{release.rollbackAvailableDevices ? ' (' + release.rollbackAvailableDevices + ')' : ''}</button></div></span>
          </div>)}
        </div>
      </>}

      <div className="rmm-patch-table windows scheduled">
        <div className="head"><span>Device</span><span>Pending</span><span>Patch classes</span><span>Policy</span><span>Schedule state</span><span>Agent</span></div>
        {windowsByDevice.map((device) => {
          const classes = device.updates.reduce((result, item) => ({ ...result, [item.update_class]: (result[item.update_class] || 0) + 1 }), {})
          const decision = device.decision
          const reason = decision?.reason || 'awaiting policy evaluation'
          const rolloutUpdate = (decision?.decision?.updates || []).find((item) => item.rolloutEnabled)
          const rolloutDetail = rolloutUpdate
            ? (rolloutUpdate.rolloutWaveName || readinessLabel(rolloutUpdate.rolloutWave)) + ' · ' + (rolloutUpdate.deadlineAt ? 'deadline ' + new Date(rolloutUpdate.deadlineAt).toLocaleDateString() : readinessLabel(reason))
            : readinessLabel(reason)
          const tone = decision?.state === 'dispatched' ? 'running' : decision?.state === 'blocked' || decision?.state === 'failed' ? 'critical' : decision?.state === 'eligible' ? 'warning' : device.online ? 'neutral' : 'neutral'
          return <Fragment key={device.inventoryId}>
            <div className="row">
              <span><strong>{device.name}</strong><small>{device.reference}</small></span>
              <span><strong>{device.updates.length}</strong><small>{device.updates.filter((item) => item.downloaded).length} downloaded</small></span>
              <span><strong>{Object.entries(classes).map(([name, count]) => count + ' ' + name).join(' · ')}</strong><small>{device.updates.filter((item) => item.reboot_required).length ? 'Update metadata reports reboot requirement' : 'No current reboot flag'}</small></span>
              <span><strong>{decision?.policy_name || 'No assigned Windows policy'}</strong><small>{decision?.maintenance_window?.start ? decision.maintenance_window.start + '–' + decision.maintenance_window.end + ' · ' + (decision.maintenance_window.timezone || 'tenant timezone') : 'Assign a patch policy to automate'}</small></span>
              <span><StatusPill tone={tone}>{readinessLabel(decision?.state || (device.online ? 'waiting' : 'offline'))}</StatusPill><small>{reason === 'rollout_paused' ? 'Rollout paused' : rolloutDetail}</small></span>
              <span>{device.online ? <StatusPill tone="healthy">Online</StatusPill> : <StatusPill tone="neutral"><WifiOff size={12} /> Offline</StatusPill>}<small>{device.agentVersion ? 'Agent ' + device.agentVersion : 'Agent version unknown'}</small></span>
            </div>
            <div className="rmm-windows-update-detail-row">
              <details>
                <summary>View {device.updates.length} pending update{device.updates.length === 1 ? '' : 's'}</summary>
                <div className="rmm-windows-update-list">
                  {device.updates.map((update) => <div key={update.id}>
                    <span><strong>{update.title}</strong><small>{(update.kb_articles || []).join(', ') || 'No KB article'} · {update.categories?.join(', ') || update.update_class}</small></span>
                    <span><StatusPill tone={['critical', 'security'].includes(update.update_class) ? 'warning' : 'neutral'}>{update.update_class}</StatusPill><small>{update.release_at ? 'Released ' + new Date(update.release_at).toLocaleDateString() : 'First seen ' + new Date(update.first_seen_at).toLocaleDateString()}</small></span>
                    <span><strong>{update.downloaded ? 'Downloaded' : 'Not downloaded'}</strong><small>{update.severity || 'No MSRC severity'}</small></span>
                  </div>)}
                </div>
              </details>
            </div>
          </Fragment>
        })}
      </div>
      {!windowsByDevice.length && <div className="rmm-empty"><Monitor size={24} /><strong>{loading ? 'Loading Windows Update inventory…' : 'No pending Windows updates'}</strong><span>Applicable Windows updates are populated by managed Agent inventory scans.</span></div>}
      <div className="rmm-patch-security-note"><ShieldCheck size={16} /><span>Scheduled installs are server-authoritative. Offline devices are not left with queued update jobs; they are re-evaluated when online. Feature and driver updates remain excluded unless the assigned policy explicitly enables them.</span></div>
    </section>}
    {tab === 'policies' && <section className="rmm-patch-panel rmm-policy-lists">
      <section className="rmm-policy-list-section">
        <div className="rmm-card-heading">
          <div><span className="rmm-eyebrow">Windows management</span><h2>OS patching policies</h2><p>Windows Update ownership, maintenance windows, deferrals and deployment waves. OS policies are assigned independently from software policies.</p></div>
          <button className="rmm-primary compact" onClick={() => { setEditingPolicy(null); setPolicyModalType('os'); setShowPolicy(true) }} type="button"><Plus size={14} /> New OS policy</button>
        </div>
        <div className="rmm-patch-policy-grid">
          {osPolicies.map((policy) => <article key={policy.id}>
            <header><div><span className="rmm-eyebrow">OS patching policy</span><h3>{policy.name}</h3></div><StatusPill tone={policy.status === 'active' ? 'healthy' : 'neutral'}>{policy.status}</StatusPill></header>
            <p>{policy.description || 'No description provided.'}</p>
            <div className="rmm-policy-domain-summary">
              <div>
                <div className="domain-head"><strong>Windows Update</strong><StatusPill tone="healthy">{policy.windows_rules?.autoInstall ? 'Automatic' : 'Managed'}</StatusPill></div>
                <small>{policy.maintenance_window?.start || '18:00'}–{policy.maintenance_window?.end || '05:00'} · {(policy.maintenance_window?.days || [1,2,3,4,5]).map((day) => ['','Mon','Tue','Wed','Thu','Fri','Sat','Sun'][day]).join(' · ')} · {policy.maintenance_window?.timezone || 'Europe/London'}</small>
                <small>Critical {policy.windows_rules?.delayDays?.critical ?? 0}d · Security {policy.windows_rules?.delayDays?.security ?? policy.deployment_delay_days}d · Quality {policy.windows_rules?.delayDays?.quality ?? policy.deployment_delay_days}d · Feature {policy.windows_rules?.includeFeatureUpdates ? (policy.windows_rules?.delayDays?.feature ?? 14) + 'd' : 'off'} · Drivers {policy.windows_rules?.includeDrivers ? (policy.windows_rules?.delayDays?.driver ?? 14) + 'd' : 'off'}</small>
                {policy.windows_rules?.rollout?.enabled && <small>Rollout · {(policy.windows_rules.rollout.waves || []).map((wave) => (wave.name || wave.id) + ' ' + wave.percentage + '% @ +' + wave.delayDays + 'd').join(' · ')} · deadline +{policy.windows_rules.rollout.deadlineDays ?? 7}d</small>}
              </div>
            </div>
            <footer><span>{assignments.filter((assignment) => assignment.policy_id === policy.id && assignment.enabled !== false).length} assignments</span><div><button disabled={saving} onClick={() => { setEditingPolicy(policy); setPolicyModalType('os'); setShowPolicy(true) }} type="button"><Wrench size={14} /> Edit</button><button disabled={saving} onClick={() => setAssignPolicy(policy)} type="button"><GitBranch size={14} /> Assign scope</button></div></footer>
          </article>)}
        </div>
        {!osPolicies.length && <div className="rmm-empty"><Monitor size={24} /><strong>No OS patching policies</strong><span>Create an OS policy to manage Windows Update schedules and rollout.</span></div>}
        {!!assignments.filter((assignment) => osPolicies.some((policy) => policy.id === assignment.policy_id)).length && <div className="rmm-patch-assignments">
          <div className="head"><span>OS scope</span><span>Policy</span><span>Priority</span><span /></div>
          {assignments.filter((assignment) => osPolicies.some((policy) => policy.id === assignment.policy_id)).map((assignment) => <div className="row" key={assignment.id}><span><strong>{assignment.scope_name || assignment.scope_id}</strong><small>{assignment.scope_type}</small></span><span><strong>{osPolicies.find((policy) => policy.id === assignment.policy_id)?.name || assignment.policy_id}</strong></span><span><strong>{assignment.priority}</strong></span><span><button disabled={saving} onClick={() => removeAssignment(assignment)} type="button"><Trash2 size={14} /></button></span></div>)}
        </div>}
      </section>

      <section className="rmm-policy-list-section">
        <div className="rmm-card-heading">
          <div><span className="rmm-eyebrow">Application management</span><h2>Software patching policies</h2><p>Catalogue targeting, WinGet scope, approval behaviour and software maintenance windows. Software policies are assigned independently from OS policies.</p></div>
          <button className="rmm-primary compact" onClick={() => { setEditingPolicy(null); setPolicyModalType('software'); setShowPolicy(true) }} type="button"><Plus size={14} /> New software policy</button>
        </div>
        <div className="rmm-patch-policy-grid">
          {softwarePolicies.map((policy) => {
            const softwareRules = policy.software_rules || {}
            const softwareMode = ['selected_catalogue', 'all_catalogue', 'all_winget'].includes(softwareRules.targetMode) ? softwareRules.targetMode : 'all_catalogue'
            const softwareWindow = softwareRules.maintenanceWindow || policy.maintenance_window || {}
            const softwareScope = softwareMode === 'selected_catalogue'
              ? (softwareRules.catalogueIds || []).length + ' selected application' + ((softwareRules.catalogueIds || []).length === 1 ? '' : 's')
              : softwareMode === 'all_winget'
                ? 'Use WinGet'
                : 'All Hi5Central catalogue applications'
            return <article key={policy.id}>
              <header><div><span className="rmm-eyebrow">Software patching policy</span><h3>{policy.name}</h3></div><StatusPill tone={policy.status === 'active' ? 'healthy' : 'neutral'}>{policy.status}</StatusPill></header>
              <p>{policy.description || 'No description provided.'}</p>
              <div className="rmm-policy-domain-summary">
                <div>
                  <div className="domain-head"><strong>Application scope</strong><StatusPill tone="healthy">{softwareMode === 'all_winget' ? 'WinGet' : 'Catalogue'}</StatusPill></div>
                  <small>{softwareScope}</small>
                  <small>{softwareWindow.start || '18:00'}–{softwareWindow.end || '05:00'} · {(softwareWindow.days || [1,2,3,4,5]).map((day) => ['','Mon','Tue','Wed','Thu','Fri','Sat','Sun'][day]).join(' · ')} · {softwareWindow.timezone || 'Europe/London'}</small>
                  <small>Approval {readinessLabel(policy.approval_mode)} · default delay {policy.deployment_delay_days ?? 0}d · retries {policy.max_retries ?? 2}</small>
                </div>
              </div>
              <footer><span>{assignments.filter((assignment) => assignment.policy_id === policy.id && assignment.enabled !== false).length} assignments</span><div><button disabled={saving} onClick={() => { setEditingPolicy(policy); setPolicyModalType('software'); setShowPolicy(true) }} type="button"><Wrench size={14} /> Edit</button><button disabled={saving} onClick={() => setAssignPolicy(policy)} type="button"><GitBranch size={14} /> Assign scope</button></div></footer>
            </article>
          })}
        </div>
        {!softwarePolicies.length && <div className="rmm-empty"><PackageCheck size={24} /><strong>No software patching policies</strong><span>Create a software policy for selected catalogue apps, all Hi5Central apps or WinGet.</span></div>}
        {!!assignments.filter((assignment) => softwarePolicies.some((policy) => policy.id === assignment.policy_id)).length && <div className="rmm-patch-assignments">
          <div className="head"><span>Software scope</span><span>Policy</span><span>Priority</span><span /></div>
          {assignments.filter((assignment) => softwarePolicies.some((policy) => policy.id === assignment.policy_id)).map((assignment) => <div className="row" key={assignment.id}><span><strong>{assignment.scope_name || assignment.scope_id}</strong><small>{assignment.scope_type}</small></span><span><strong>{softwarePolicies.find((policy) => policy.id === assignment.policy_id)?.name || assignment.policy_id}</strong></span><span><strong>{assignment.priority}</strong></span><span><button disabled={saving} onClick={() => removeAssignment(assignment)} type="button"><Trash2 size={14} /></button></span></div>)}
        </div>}
      </section>
    </section>}

    {typeof document !== 'undefined' && createPortal(
      <div className="rmm-patch-portal-theme" style={rmmPortalThemeStyle()}>
        {patchApp && <SoftwarePatchModal
          application={patchApp}
          devices={bundle?.devices || []}
          installs={patchInstallsForApplication(patchApp)}
          onClose={() => setPatchApp(null)}
          onPatch={runSoftwarePatch}
          saving={saving}
        />}
        {showPolicy && <PolicyModal catalogue={catalogue} policy={editingPolicy} policyType={policyModalType} onClose={() => { setShowPolicy(false); setEditingPolicy(null) }} onSave={savePolicy} />}
        {assignPolicy && <AssignmentModal devices={bundle?.devices || devices} groups={scope.groups || []} onClose={() => setAssignPolicy(null)} onSave={saveAssignment} policy={assignPolicy} />}
      </div>,
      document.body,
    )}
  </>
}
