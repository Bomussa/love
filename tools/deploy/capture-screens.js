#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'

async function main () {
  const base = process.env.SITE_URL || 'http://localhost:3000'
  const targets = ['/admin/login', '/', '/api/reports/live']
  const dir = path.join('logs', 'screenshots')
  fs.mkdirSync(dir, { recursive: true })
  const b = await puppeteer.launch({ headless: true })
  const p = await b.newPage()
  for (const t of targets) {
    const url = base.replace(/\/$/, '') + t
    await p.goto(url, { waitUntil: 'domcontentloaded' })
    const name = t.replace(/\W+/g, '_').replace(/^_+|_+$/g, '') || 'home'
    await p.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true })
  }
  await b.close()
}

main().catch(err => { console.error(err); process.exit(1) })
