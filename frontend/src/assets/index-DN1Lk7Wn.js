import { r as t } from './index-3K2VaF5U.js';

let e; let a; let o; const r = { data: '' }; const i = /(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g; const s = /\/\*[^]*?\*\/|  +/g; const n = /\n+/g; const l = (t, e) => { let a = ''; let o = ''; let r = ''; for (let i in t) { const s = t[i]; i[0] == '@' ? i[1] == 'i' ? a = `${i} ${s};` : o += i[1] == 'f' ? l(s, i) : `${i}{${l(s, i[1] == 'k' ? '' : e)}}` : typeof s === 'object' ? o += l(s, e ? e.replace(/([^,])+/g, (t) => i.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g, (e) => (/&/.test(e) ? e.replace(/&/g, t) : t ? `${t} ${e}` : e))) : i) : s != null && (i = /^--/.test(i) ? i : i.replace(/[A-Z]/g, '-$&').toLowerCase(), r += l.p ? l.p(i, s) : `${i}:${s};`); } return a + (e && r ? `${e}{${r}}` : r) + o; }; const c = {}; const d = (t) => { if (typeof t === 'object') { let e = ''; for (const a in t)e += a + d(t[a]); return e; } return t; }; function p(t) { const e = this || {}; const a = t.call ? t(e.p) : t; return ((t, e, a, o, r) => { const p = d(t); const m = c[p] || (c[p] = ((t) => { let e = 0; let a = 11; for (;e < t.length;)a = 101 * a + t.charCodeAt(e++) >>> 0; return `go${a}`; })(p)); if (!c[m]) { const e = p !== t ? t : ((t) => { let e; let a; const o = [{}]; for (;e = i.exec(t.replace(s, ''));)e[4] ? o.shift() : e[3] ? (a = e[3].replace(n, ' ').trim(), o.unshift(o[0][a] = o[0][a] || {})) : o[0][e[1]] = e[2].replace(n, ' ').trim(); return o[0]; })(t); c[m] = l(r ? { [`@keyframes ${m}`]: e } : e, a ? '' : `.${m}`); } const u = a && c.g ? c.g : null; return a && (c.g = c[m]), f = c[m], g = e, y = o, (b = u) ? g.data = g.data.replace(b, f) : g.data.indexOf(f) === -1 && (g.data = y ? f + g.data : g.data + f), m; let f; let g; let y; let b; })(a.unshift ? a.raw ? ((t, e, a) => t.reduce((t, o, r) => { let i = e[r]; if (i && i.call) { const t = i(a); const e = t && t.props && t.props.className || /^go/.test(t) && t; i = e ? `.${e}` : t && typeof t === 'object' ? t.props ? '' : l(t, '') : !1 === t ? '' : t; } return t + o + (i == null ? '' : i); }, ''))(a, [].slice.call(arguments, 1), e.p) : a.reduce((t, a) => Object.assign(t, a && a.call ? a(e.p) : a), {}) : a, ((t) => { if (typeof window === 'object') { const e = (t ? t.querySelector('#_goober') : window._goober) || Object.assign(document.createElement('style'), { innerHTML: ' ', id: '_goober' }); return e.nonce = window.__nonce__, e.parentNode || (t || document.head).appendChild(e), e.firstChild; } return t || r; })(e.target), e.g, e.o, e.k); }p.bind({ g: 1 }); const m = p.bind({ k: 1 }); function u(t, r) { const i = this || {}; return function () { const r = arguments; return function s(n, l) { const c = { ...n }; const d = c.className || s.className; i.p = { theme: a && a(), ...c }, i.o = / *go\d+/.test(d), c.className = p.apply(i, r) + (d ? ` ${d}` : ''); let m = t; return t[0] && (m = c.as || t, delete c.as), o && m[0] && o(c), e(m, c); }; }; } const f = (t, e) => (((t) => typeof t === 'function')(t) ? t(e) : t); const g = (() => { let t = 0; return () => (++t).toString(); })(); const y = (() => { let t; return () => { if (void 0 === t && typeof window < 'u') { const e = matchMedia('(prefers-reduced-motion: reduce)'); t = !e || e.matches; } return t; }; })(); const b = 'default'; const h = (t, e) => { const { toastLimit: a } = t.settings; switch (e.type) { case 0: return { ...t, toasts: [e.toast, ...t.toasts].slice(0, a) }; case 1: return { ...t, toasts: t.toasts.map((t) => (t.id === e.toast.id ? { ...t, ...e.toast } : t)) }; case 2: const { toast: o } = e; return h(t, { type: t.toasts.find((t) => t.id === o.id) ? 1 : 0, toast: o }); case 3: const { toastId: r } = e; return { ...t, toasts: t.toasts.map((t) => (t.id === r || void 0 === r ? { ...t, dismissed: !0, visible: !1 } : t)) }; case 4: return void 0 === e.toastId ? { ...t, toasts: [] } : { ...t, toasts: t.toasts.filter((t) => t.id !== e.toastId) }; case 5: return { ...t, pausedAt: e.time }; case 6: const i = e.time - (t.pausedAt || 0); return { ...t, pausedAt: void 0, toasts: t.toasts.map((t) => ({ ...t, pauseDuration: t.pauseDuration + i })) }; } }; const x = []; const v = { toasts: [], pausedAt: void 0, settings: { toastLimit: 20 } }; const w = {}; const $ = (t, e = b) => { w[e] = h(w[e] || v, t), x.forEach(([t, a]) => { t === e && a(w[e]); }); }; const k = (t) => Object.keys(w).forEach((e) => $(t, e)); const E = (t = b) => (e) => { $(e, t); }; const j = (t) => (e, a) => {
  const o = ((t, e = 'blank', a) => ({
    createdAt: Date.now(), visible: !0, dismissed: !1, type: e, ariaProps: { role: 'status', 'aria-live': 'polite' }, message: t, pauseDuration: 0, ...a, id: (a == null ? void 0 : a.id) || g(),
  }))(e, t, a); return E(o.toasterId || ((t) => Object.keys(w).find((e) => w[e].toasts.some((e) => e.id === t)))(o.id))({ type: 2, toast: o }), o.id;
}; const I = (t, e) => j('blank')(t, e); I.error = j('error'), I.success = j('success'), I.loading = j('loading'), I.custom = j('custom'), I.dismiss = (t, e) => { const a = { type: 3, toastId: t }; e ? E(e)(a) : k(a); }, I.dismissAll = (t) => I.dismiss(void 0, t), I.remove = (t, e) => { const a = { type: 4, toastId: t }; e ? E(e)(a) : k(a); }, I.removeAll = (t) => I.remove(void 0, t), I.promise = (t, e, a) => { const o = I.loading(e.loading, { ...a, ...a == null ? void 0 : a.loading }); return typeof t === 'function' && (t = t()), t.then((t) => { const r = e.success ? f(e.success, t) : void 0; return r ? I.success(r, { id: o, ...a, ...a == null ? void 0 : a.success }) : I.dismiss(o), t; }).catch((t) => { const r = e.error ? f(e.error, t) : void 0; r ? I.error(r, { id: o, ...a, ...a == null ? void 0 : a.error }) : I.dismiss(o); }), t; }; let A; let z; let N; let O; const _ = m`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`; const C = m`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`; const F = m`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`; const L = u('div')`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${(t) => t.primary || '#ff4b4b'};
  position: relative;
  transform: rotate(45deg);

  animation: ${_} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${C} 0.15s ease-out forwards;
    animation-delay: 150ms;
    position: absolute;
    border-radius: 3px;
    opacity: 0;
    background: ${(t) => t.secondary || '#fff'};
    bottom: 9px;
    left: 4px;
    height: 2px;
    width: 12px;
  }

  &:before {
    animation: ${F} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`; const D = m`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`; const S = u('div')`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${(t) => t.secondary || '#e0e0e0'};
  border-right-color: ${(t) => t.primary || '#616161'};
  animation: ${D} 1s linear infinite;
`; const T = m`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`; const M = m`
0% {
	height: 0;
	width: 0;
	opacity: 0;
}
40% {
  height: 0;
	width: 6px;
	opacity: 1;
}
100% {
  opacity: 1;
  height: 10px;
}`; const P = u('div')`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${(t) => t.primary || '#61d345'};
  position: relative;
  transform: rotate(45deg);

  animation: ${T} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${M} 0.2s ease-out forwards;
    opacity: 0;
    animation-delay: 200ms;
    position: absolute;
    border-right: 2px solid;
    border-bottom: 2px solid;
    border-color: ${(t) => t.secondary || '#fff'};
    bottom: 6px;
    left: 6px;
    height: 10px;
    width: 6px;
  }
`; const q = u('div')`
  position: absolute;
`; const H = u('div')`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`; const V = m`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`; const Z = u('div')`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${V} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`; const B = ({ toast: e }) => { const { icon: a, type: o, iconTheme: r } = e; return void 0 !== a ? typeof a === 'string' ? t.createElement(Z, null, a) : a : o === 'blank' ? null : t.createElement(H, null, t.createElement(S, { ...r }), o !== 'loading' && t.createElement(q, null, o === 'error' ? t.createElement(L, { ...r }) : t.createElement(P, { ...r }))); }; const G = (t) => `\n0% {transform: translate3d(0,${-200 * t}%,0) scale(.6); opacity:.5;}\n100% {transform: translate3d(0,0,0) scale(1); opacity:1;}\n`; const J = (t) => `\n0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}\n100% {transform: translate3d(0,${-150 * t}%,-1px) scale(.6); opacity:0;}\n`; const K = u('div')`
  display: flex;
  align-items: center;
  background: #fff;
  color: #363636;
  line-height: 1.3;
  will-change: transform;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1), 0 3px 3px rgba(0, 0, 0, 0.05);
  max-width: 350px;
  pointer-events: auto;
  padding: 8px 10px;
  border-radius: 8px;
`; const Q = u('div')`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`;t.memo(({
  toast: e, position: a, style: o, children: r,
}) => { const i = e.height ? ((t, e) => { const a = t.includes('top') ? 1 : -1; const [o, r] = y() ? ['0%{opacity:0;} 100%{opacity:1;}', '0%{opacity:1;} 100%{opacity:0;}'] : [G(a), J(a)]; return { animation: e ? `${m(o)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards` : `${m(r)} 0.4s forwards cubic-bezier(.06,.71,.55,1)` }; })(e.position || a || 'top-center', e.visible) : { opacity: 0 }; const s = t.createElement(B, { toast: e }); const n = t.createElement(Q, { ...e.ariaProps }, f(e.message, e)); return t.createElement(K, { className: e.className, style: { ...i, ...o, ...e.style } }, typeof r === 'function' ? r({ icon: s, message: n }) : t.createElement(t.Fragment, null, s, n)); }), A = t.createElement, l.p = z, e = A, a = N, o = O, p`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`;export {
  P as CheckmarkIcon, L as ErrorIcon, S as LoaderIcon, B as ToastIcon, f as resolveValue, I as toast,
};
