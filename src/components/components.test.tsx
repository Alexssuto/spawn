// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadSpawns, type Spawn } from '../data/spawns'
import type { Catch } from '../hooks/useCollection'
import { viewSpawn } from '../lib/spawnView'
import { CatchOverlay } from './CatchOverlay'
import { DexView } from './DexView'
import { SpawnSheet } from './SpawnSheet'

const NOW = Date.UTC(2026, 9, 26, 18)
const spawns = loadSpawns(NOW)
const live = spawns.find((s) => !s.hidden && s.startsAt <= NOW && s.endsAt > NOW)!

function catchOf(s: Spawn): Catch {
  return { spawnId: s.id, title: s.title, type: s.type, rarity: s.rarity, place: s.place, caughtAt: NOW }
}

afterEach(cleanup)

describe('DexView reset', () => {
  it('asks for confirmation before erasing the collection', () => {
    const onReset = vi.fn()
    render(<DexView catches={[catchOf(live)]} spawns={spawns} onReset={onReset} />)

    fireEvent.click(screen.getByRole('button', { name: 'Reset collection' }))
    expect(onReset).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('Erase all 1 catch?')

    fireEvent.click(screen.getByRole('button', { name: 'Erase Everything' }))
    expect(onReset).toHaveBeenCalledOnce()
  })

  it('can back out of the confirmation', () => {
    const onReset = vi.fn()
    render(<DexView catches={[catchOf(live)]} spawns={spawns} onReset={onReset} />)

    fireEvent.click(screen.getByRole('button', { name: 'Reset collection' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep My Dex' }))

    expect(onReset).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('exposes level progress to assistive technology', () => {
    render(<DexView catches={[catchOf(live)]} spawns={spawns} onReset={() => {}} />)
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).not.toBeNull()
  })
})

describe('SpawnSheet', () => {
  const far = { lat: live.lat + 0.05, lng: live.lng }

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<SpawnSheet view={viewSpawn(live, far, NOW, false)} now={NOW} onClose={onClose} onCatch={() => {}} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('is a labelled dialog that takes focus when it opens', () => {
    render(<SpawnSheet view={viewSpawn(live, far, NOW, false)} now={NOW} onClose={() => {}} onCatch={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: live.title })
    expect(document.activeElement).toBe(dialog)
  })

  it('explains why the catch button is disabled', () => {
    render(<SpawnSheet view={viewSpawn(live, far, NOW, false)} now={NOW} onClose={() => {}} onCatch={() => {}} />)
    const button = screen.getByRole('button', { name: /Catch It/ }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    const hint = document.getElementById(button.getAttribute('aria-describedby')!)
    expect(hint?.textContent).toMatch(/Get within 150 m/)
  })

  it('has no explanation to point at when the spawn can be caught', () => {
    const here = { lat: live.lat, lng: live.lng }
    render(<SpawnSheet view={viewSpawn(live, here, NOW, false)} now={NOW} onClose={() => {}} onCatch={() => {}} />)
    const button = screen.getByRole('button', { name: /Catch It/ }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
    expect(button.hasAttribute('aria-describedby')).toBe(false)
  })
})

describe('CatchOverlay', () => {
  it('is a modal dialog with its button focused', () => {
    render(<CatchOverlay spawn={live} dexNumber={1} onDone={() => {}} />)
    expect(screen.getByRole('dialog', { name: live.title }).getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Keep Exploring' }))
  })

  it('closes with the button, Escape, or a click on the backdrop, but not on the content', () => {
    const onDone = vi.fn()
    render(<CatchOverlay spawn={live} dexNumber={1} onDone={onDone} />)

    fireEvent.click(screen.getByRole('heading', { name: live.title }))
    expect(onDone).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Keep Exploring' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('dialog'))
    expect(onDone).toHaveBeenCalledTimes(3)
  })
})

describe('DexView sharing', () => {
  it('has no share button with an empty collection', () => {
    render(<DexView catches={[]} spawns={spawns} onReset={() => {}} />)
    expect(screen.queryByRole('button', { name: /Share My Dex/ })).toBeNull()
  })

  it('shares the stats computed from the collection and confirms', async () => {
    const share = vi.fn().mockResolvedValue('downloaded')
    render(<DexView catches={[catchOf(live)]} spawns={spawns} onReset={() => {}} share={share} />)

    fireEvent.click(screen.getByRole('button', { name: /Share My Dex/ }))

    expect(await screen.findByText(/Saved spawn-dex.png/)).toBeTruthy()
    expect(share).toHaveBeenCalledOnce()
    expect(share.mock.calls[0][0]).toMatchObject({ caught: 1, recent: [{ title: live.title }] })
  })

  it('says so when the image cannot be created', async () => {
    const share = vi.fn().mockRejectedValue(new Error('no canvas'))
    render(<DexView catches={[catchOf(live)]} spawns={spawns} onReset={() => {}} share={share} />)

    fireEvent.click(screen.getByRole('button', { name: /Share My Dex/ }))

    expect(await screen.findByText(/Couldn't create the image/)).toBeTruthy()
    expect((screen.getByRole('button', { name: /Share My Dex/ }) as HTMLButtonElement).disabled).toBe(false)
  })
})
