import { RARITIES, RARITY_ORDER, type ExperienceType } from '../data/catalog'
import { typeIconMarkup } from '../components/iconMarkup'
import { favouriteLabel, shareText, type ShareStats } from '../lib/shareCard'

// 4:5 portrait, the size Instagram feeds and stories crop to without losing anything.
const WIDTH = 1080
const HEIGHT = 1350
const PAD = 88

// The app's tokens (index.css), so the card looks like the app it came from.
const C = { ground: '#000000', raised: '#2a2a2a', text: '#ffffff', muted: '#b4b4b4', faint: '#949494', accent: '#ff7a1a' }
const FONT = 'Inter, system-ui, sans-serif'

function font(weight: number, size: number) {
  return `${weight} ${size}px ${FONT}`
}

/** Shortens text with an ellipsis until it fits `maxWidth`. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let s = text
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1)
  return `${s.trimEnd()}…`
}

async function iconImage(type: ExperienceType, size: number, color: string): Promise<HTMLImageElement> {
  const svg = typeIconMarkup(type, size).replaceAll('currentColor', color)
  const img = new Image(size, size)
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await img.decode()
  return img
}

function drawBrandMark(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.strokeStyle = C.accent
  ctx.fillStyle = C.accent
  ctx.lineWidth = r * 0.18
  ctx.setLineDash([r * 0.36, r * 0.27])
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.arc(x, y, r * 0.4, 0, Math.PI * 2)
  ctx.fill()
}

/** Draws the Dex card and returns it as a PNG. */
export async function renderShareCard(stats: ShareStats): Promise<Blob> {
  // Canvas text uses whatever fonts are loaded right now: wait for Inter, or the card falls back.
  await Promise.all([document.fonts.load(font(400, 40)), document.fonts.load(font(600, 40))])

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')

  ctx.fillStyle = C.ground
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  ctx.textBaseline = 'alphabetic'

  // Brand
  drawBrandMark(ctx, PAD + 22, 132, 22)
  ctx.fillStyle = C.text
  ctx.font = font(600, 46)
  ctx.fillText('Spawn', PAD + 62, 148)

  // The headline figure: how many experiences caught
  ctx.fillStyle = C.muted
  ctx.font = font(500, 30)
  ctx.fillText('MONTRÉAL', PAD, 318)
  ctx.fillStyle = C.text
  ctx.font = font(600, 230)
  ctx.fillText(String(stats.caught), PAD - 8, 540)
  ctx.fillStyle = C.muted
  ctx.font = font(400, 42)
  ctx.fillText(stats.caught === 1 ? 'experience caught' : 'experiences caught', PAD, 612)
  ctx.fillStyle = C.text
  ctx.font = font(500, 42)
  ctx.fillText([`Level ${stats.level}`, favouriteLabel(stats)].filter(Boolean).join(' · '), PAD, 684)

  // Rarities, colour only on Legendary catches that exist
  const colW = (WIDTH - PAD * 2) / 4
  RARITY_ORDER.forEach((rarity, i) => {
    const x = PAD + colW * i
    const count = stats.rarities[rarity]
    ctx.fillStyle = rarity === 'legendary' && count > 0 ? C.accent : C.text
    ctx.font = font(600, 76)
    ctx.fillText(String(count), x, 840)
    ctx.fillStyle = C.faint
    ctx.font = font(400, 30)
    ctx.fillText(RARITIES[rarity].label, x, 888)
  })

  ctx.fillStyle = C.raised
  ctx.fillRect(PAD, 950, WIDTH - PAD * 2, 2)

  // The latest catches
  let y = 1040
  for (const r of stats.recent) {
    const icon = await iconImage(r.type, 44, C.muted)
    ctx.drawImage(icon, PAD, y - 38, 44, 44)
    ctx.font = font(400, 30)
    const rarityLabel = RARITIES[r.rarity].label
    const rarityWidth = ctx.measureText(rarityLabel).width
    ctx.fillStyle = r.rarity === 'legendary' ? C.accent : C.faint
    ctx.fillText(rarityLabel, WIDTH - PAD - rarityWidth, y)
    ctx.fillStyle = C.text
    ctx.font = font(500, 40)
    ctx.fillText(fit(ctx, r.title, WIDTH - PAD * 2 - 80 - rarityWidth - 40), PAD + 72, y)
    y += 78
  }

  ctx.fillStyle = C.faint
  ctx.font = font(400, 30)
  ctx.fillText('Real events around you, caught in person.', PAD, HEIGHT - PAD + 10)

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create the image'))), 'image/png'),
  )
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled'

/** Opens the phone's share sheet with the card; on desktop (no file sharing), downloads it instead. */
export async function shareDex(stats: ShareStats): Promise<ShareOutcome> {
  const blob = await renderShareCard(stats)
  const file = new File([blob], 'spawn-dex.png', { type: 'image/png' })
  const text = shareText(stats)

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      throw error
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
