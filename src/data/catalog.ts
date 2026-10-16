export type ExperienceType =
  | 'music'
  | 'food'
  | 'night'
  | 'culture'
  | 'sport'
  | 'nature'
  | 'social'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary'

export const TYPES: Record<ExperienceType, { label: string; icon: string; color: string }> = {
  music: { label: 'Music', icon: '🎵', color: '#f472b6' },
  food: { label: 'Food', icon: '🍜', color: '#fb923c' },
  night: { label: 'Night', icon: '🌙', color: '#818cf8' },
  culture: { label: 'Culture', icon: '🎭', color: '#facc15' },
  sport: { label: 'Sport', icon: '🏐', color: '#34d399' },
  nature: { label: 'Nature', icon: '🌿', color: '#4ade80' },
  social: { label: 'Social', icon: '🎉', color: '#22d3ee' },
}

export const RARITIES: Record<Rarity, { label: string; color: string; xp: number }> = {
  common: { label: 'Common', color: '#9ca3af', xp: 50 },
  uncommon: { label: 'Uncommon', color: '#4ade80', xp: 100 },
  rare: { label: 'Rare', color: '#60a5fa', xp: 250 },
  legendary: { label: 'Legendary', color: '#fbbf24', xp: 600 },
}

export const RARITY_ORDER: Rarity[] = ['legendary', 'rare', 'uncommon', 'common']
