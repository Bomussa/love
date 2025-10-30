#!/usr/bin/env node
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const fs = require('node:fs')
const localtunnel = require('localtunnel')

const port = Number(process.env.PORT || 3000)
const out = path.join('data','status','tunnel.json')
try { fs.mkdirSync(path.dirname(out), { recursive: true }) } catch {}

;(async () => {
  const tunnel = await localtunnel({ port })
  const info = { url: tunnel.url, startedAt: new Date().toISOString() }
  fs.writeFileSync(out, JSON.stringify(info, null, 2), 'utf8')
  console.log('[tunnel] public URL:', tunnel.url)
  tunnel.on('close', () => { try { fs.unlinkSync(out) } catch {} })
})().catch(err => { console.error('[tunnel] failed', err); process.exit(1) })
