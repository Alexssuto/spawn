import { Check } from 'lucide-react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ExperienceType } from '../data/catalog'
import { TypeIcon } from './Icons'

const markupCache = new Map<string, string>()

/** A type's icon as an SVG string, for Leaflet markers, which take HTML rather than React elements. */
export function typeIconMarkup(type: ExperienceType, size: number): string {
  const key = `${type}:${size}`
  let markup = markupCache.get(key)
  if (!markup) {
    markup = renderToStaticMarkup(<TypeIcon type={type} size={size} />)
    markupCache.set(key, markup)
  }
  return markup
}

/** The "caught" check for markers, same icon set as the rest of the app. */
export const checkMarkup = renderToStaticMarkup(<Check size={11} strokeWidth={3} aria-hidden="true" />)
