const PATTERNS = [
  /login failed/i,
  /invalid credentials/i,
  /invalid username or password/i,
  /invalid doctor credentials/i,
  /clinic not found/i,
  /connection error/i,
  /failed to load/i,
  /تعذر تسجيل الدخول/i,
  /حدث خطأ في تسجيل الدخول/i,
  /خطأ في تسجيل الدخول/i,
  /خطأ في اسم المستخدم أو كلمة المرور/i,
  /اسم المستخدم أو كلمة المرور غير صحيحة/i,
  /بيانات الدخول غير صحيحة/i,
  /العيادة غير موجودة/i,
  /يرجى إدخال اسم المستخدم وكلمة المرور/i,
]

const TOAST_ID = 'mmc-auth-error-toast'
const installed = typeof window !== 'undefined' && !window.__mmcAuthErrorRelayInstalled

function textOf(args) {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg
      if (arg instanceof Error) return arg.message || ''
      if (arg && typeof arg === 'object') return arg.message || arg.error || arg.reason || ''
      return String(arg ?? '')
    })
    .filter(Boolean)
    .join(' ')
    .trim()
}

function looksLikeAuthIssue(text) {
  const message = String(text || '').trim()
  if (!message) return false
  return PATTERNS.some((pattern) => pattern.test(message))
}

function ensureToast() {
  let el = document.getElementById(TOAST_ID)
  if (el) return el

  el = document.createElement('div')
  el.id = TOAST_ID
  el.setAttribute('role', 'alert')
  el.setAttribute('aria-live', 'assertive')
  el.style.cssText = [
    'position:fixed',
    'left:50%',
    'bottom:18px',
    'transform:translateX(-50%)',
    'z-index:2147483647',
    'max-width:min(92vw,560px)',
    'padding:12px 16px',
    'border-radius:14px',
    'border:1px solid rgba(248,113,113,.45)',
    'background:rgba(127,29,29,.96)',
    'color:#fff',
    'font-size:14px',
    'line-height:1.5',
    'font-weight:700',
    'text-align:center',
    'box-shadow:0 16px 40px rgba(0,0,0,.35)',
    'backdrop-filter:blur(10px)',
    'display:none',
  ].join(';')
  document.body.appendChild(el)
  return el
}

function showToast(message) {
  if (typeof document === 'undefined') return
  const el = ensureToast()
  el.textContent = message
  el.style.display = 'block'
  clearTimeout(el.__mmcHideTimer)
  el.__mmcHideTimer = setTimeout(() => {
    el.style.display = 'none'
  }, 4500)
}

function patch(methodName) {
  const original = console[methodName].bind(console)
  console[methodName] = (...args) => {
    try {
      const message = textOf(args)
      if (looksLikeAuthIssue(message)) showToast(message)
    } catch {
      // keep original logging path untouched
    }
    original(...args)
  }
}

if (installed) {
  window.__mmcAuthErrorRelayInstalled = true
  patch('log')
  patch('warn')
  patch('error')

  window.addEventListener('error', (event) => {
    const message = event?.message || event?.error?.message || ''
    if (looksLikeAuthIssue(message)) showToast(message)
  })

  window.addEventListener('unhandledrejection', (event) => {
    const message = event?.reason?.message || String(event?.reason || '')
    if (looksLikeAuthIssue(message)) showToast(message)
  })
}

export default null
