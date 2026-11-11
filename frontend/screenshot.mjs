// Usage: node screenshot.mjs <url> [label]
// Saves to ./temporary screenshots/screenshot-N[-label].png (N auto-increments, never overwrites).
// Env: WIDTH / HEIGHT (viewport, default 1280x800), TOKEN (preloaded into localStorage as vtm.token),
//      DELAY (extra ms to wait after load, default 500), FULL=1 (full-page capture).
import { mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'

const [, , url, rawLabel] = process.argv
if (!url) {
  console.error('usage: node screenshot.mjs <url> [label]')
  process.exit(1)
}

const here = path.dirname(fileURLToPath(import.meta.url))
const dir = path.join(here, 'temporary screenshots')
await mkdir(dir, { recursive: true })

const existing = await readdir(dir)
const next =
  existing.reduce((max, name) => {
    const m = /^screenshot-(\d+)/.exec(name)
    return m ? Math.max(max, Number(m[1])) : max
  }, 0) + 1

const label = rawLabel ? `-${rawLabel.replace(/[^\w-]+/g, '-')}` : ''
const file = path.join(dir, `screenshot-${next}${label}.png`)

const width = Number(process.env.WIDTH) || 1280
const height = Number(process.env.HEIGHT) || 800
const delay = Number(process.env.DELAY) || 500
const token = process.env.TOKEN

const browser = await puppeteer.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 1 })
  if (token) {
    // Runs before any page script, so the app boots already signed in.
    await page.evaluateOnNewDocument((t) => {
      localStorage.setItem('vtm.token', t)
    }, token)
  }
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 })
  await page.evaluate(() => (document.fonts ? document.fonts.ready : null))
  await new Promise((r) => setTimeout(r, delay))
  await page.screenshot({ path: file, fullPage: process.env.FULL === '1' })
  console.log(file)
} finally {
  await browser.close()
}
