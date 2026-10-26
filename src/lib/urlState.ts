import { TYPES, type ExperienceType } from '../data/catalog'

export type Tab = 'map' | 'nearby' | 'dex'

/** The parts of the screen worth keeping in the URL, so a link reopens the same view. */
export interface UrlState {
  tab: Tab
  type: ExperienceType | null
  spawn: string | null
}

const TABS: readonly Tab[] = ['map', 'nearby', 'dex']
export const DEFAULT_URL_STATE: UrlState = { tab: 'map', type: null, spawn: null }

function isTab(value: string | null): value is Tab {
  return value !== null && (TABS as readonly string[]).includes(value)
}

function isType(value: string | null): value is ExperienceType {
  return value !== null && Object.hasOwn(TYPES, value)
}

/** Reads `?tab=nearby&type=music&spawn=<id>`. Unknown or malformed values fall back to the default. */
export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search)
  const tab = params.get('tab')
  const type = params.get('type')
  const spawn = params.get('spawn')?.trim()
  return {
    tab: isTab(tab) ? tab : DEFAULT_URL_STATE.tab,
    type: isType(type) ? type : null,
    spawn: spawn ? spawn : null,
  }
}

/** Writes only what differs from the default, so the plain app URL stays clean. */
export function toSearch(state: UrlState): string {
  const params = new URLSearchParams()
  if (state.tab !== DEFAULT_URL_STATE.tab) params.set('tab', state.tab)
  if (state.type) params.set('type', state.type)
  if (state.spawn) params.set('spawn', state.spawn)
  const query = params.toString()
  return query ? `?${query}` : ''
}
