export type ExperienceType =
  | 'music'
  | 'food'
  | 'night'
  | 'culture'
  | 'sport'
  | 'nature'
  | 'social'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary'

// Types are told apart by their icon (components/Icons.tsx), not by colour: colour is kept for
// what's live and what's rare (see index.css), so the map isn't a seven-colour rainbow.
export const TYPES: Record<ExperienceType, { label: string }> = {
  music: { label: 'Music' },
  food: { label: 'Food' },
  night: { label: 'Night' },
  culture: { label: 'Culture' },
  sport: { label: 'Sport' },
  nature: { label: 'Nature' },
  social: { label: 'Social' },
}

export const RARITIES: Record<Rarity, { label: string; xp: number }> = {
  common: { label: 'Common', xp: 50 },
  uncommon: { label: 'Uncommon', xp: 100 },
  rare: { label: 'Rare', xp: 250 },
  legendary: { label: 'Legendary', xp: 600 },
}

export const RARITY_ORDER: Rarity[] = ['legendary', 'rare', 'uncommon', 'common']
