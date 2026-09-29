(() => {
  const codeInput = document.getElementById('supportCode')
  const lookupButton = document.getElementById('lookupButton')
  const lookupError = document.getElementById('lookupError')
  const lookupStage = document.getElementById('lookupStage')
  const consentStage = document.getElementById('consentStage')
  const downloadStage = document.getElementById('downloadStage')
  const consentCheck = document.getElementById('consentCheck')
  const downloadButton = document.getElementById('downloadButton')
  const backButton = document.getElementById('backButton')
  const claimError = document.getElementById('claimError')
  const downloadLink = document.getElementById('downloadLink')
  let activeCode = ''

  const showError = (node, message = '') => {
    node.textContent = message
    node.classList.toggle('show', Boolean(message))
  }
  const formatCode = (value) => {
    const digits = String(value || '').replace(/\D/g, '').slice(0, 8)
    return digits.length > 4 ? digits.slice(0, 4) + '-' + digits.slice(4) : digits
  }

  codeInput.addEventListener('input', () => {
    codeInput.value = formatCode(codeInput.value)
    showError(lookupError)
  })
  codeInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') lookupButton.click()
  })
  consentCheck.addEventListener('change', () => {
    downloadButton.disabled = !consentCheck.checked
  })

  lookupButton.addEventListener('click', async () => {
    const code = formatCode(codeInput.value)
    if (code.replace(/\D/g, '').length !== 8) {
      showError(lookupError, 'Enter the full 8-digit support code.')
      return
    }
    showError(lookupError)
    lookupButton.disabled = true
    lookupButton.textContent = 'Checking…'
    try {
      const response = await fetch('/api/v1/connect/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ code }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to verify this support code.')
      activeCode = code
      document.getElementById('organisation').textContent = payload.session?.organisation || 'Hi5Central customer'
      document.getElementById('technician').textContent = payload.session?.technician || 'Hi5Central technician'
      const expiry = payload.session?.expiresAt ? new Date(payload.session.expiresAt) : null
      document.getElementById('expires').textContent = expiry && !Number.isNaN(expiry.getTime())
        ? expiry.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Soon'
      lookupStage.classList.add('hidden')
      consentStage.classList.remove('hidden')
    } catch (error) {
      showError(lookupError, error.message || 'Unable to verify this support code.')
    } finally {
      lookupButton.disabled = false
      lookupButton.textContent = 'Check support code'
    }
  })

  backButton.addEventListener('click', () => {
    activeCode = ''
    consentCheck.checked = false
    downloadButton.disabled = true
    showError(claimError)
    consentStage.classList.add('hidden')
    lookupStage.classList.remove('hidden')
    codeInput.focus()
  })

  downloadButton.addEventListener('click', async () => {
    if (!activeCode || !consentCheck.checked) return
    showError(claimError)
    downloadButton.disabled = true
    downloadButton.textContent = 'Preparing secure download…'
    try {
      const response = await fetch('/api/v1/connect/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ code: activeCode, consent: true }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to prepare Hi5Central Connect.')
      if (!payload.downloadUrl) throw new Error('The support download is not available yet.')
      downloadLink.href = payload.downloadUrl
      consentStage.classList.add('hidden')
      downloadStage.classList.remove('hidden')
      const anchor = document.createElement('a')
      anchor.href = payload.downloadUrl
      anchor.rel = 'noreferrer'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
    } catch (error) {
      showError(claimError, error.message || 'Unable to prepare Hi5Central Connect.')
      downloadButton.disabled = false
      downloadButton.textContent = 'Accept & download for Windows'
    }
  })

  codeInput.focus()
})()
