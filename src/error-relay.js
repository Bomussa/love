if (typeof window !== 'undefined' && typeof console !== 'undefined' && !window.__mmcErrorRelayInstalled) {
  window.__mmcErrorRelayInstalled = true

  const originalError = console.error.bind(console)
  const originalWarn = console.warn.bind(console)
  const originalLog = console.log.bind(console)

  const match = (text) => /failed|invalid|error|password|clinic|login/i.test(String(text || ''))
  const show = (text) => {
    const message = String(text || '').trim()
    if (!message) return
    window.alert(message)
  }

  console.error = (...args) => {
    const text = args.map(String).join(' ')
    if (match(text)) show(text)
    originalError(...args)
  }

  console.warn = (...args) => {
    const text = args.map(String).join(' ')
    if (match(text)) show(text)
    originalWarn(...args)
  }

  console.log = (...args) => {
    const text = args.map(String).join(' ')
    if (match(text)) show(text)
    originalLog(...args)
  }
}
