# 0010: Events at the same point share one venue pin, grouped in our own code

**Status:** Accepted (2026-10-27). Numbered 0010 because 0009 is taken by the open container-image PR (#14).

## Context

The city's events mostly happen in libraries and cultural centres, and most have no venue name, only the venue's coordinates. On 2026-10-27 the app showed 290 events on 99 distinct points, with up to 26 on one point. One marker per event stacked them: only the top one could be tapped, so about 190 events were unreachable from the map.

## Decision

- A pure function, `groupByVenue` in `src/lib/venues.ts`, groups the visible spawns by coordinates rounded to five decimals (about 1 m) and orders each group: live first, not-yet-caught first, rarer first, then earliest.
- The map draws one pin per group. It looks like the group's first spawn (live ring, rarity) and shows a count when there are several. A single-event pin opens the event as before; a group opens a list (`VenueSheet`), and each row opens the usual details sheet. Closing the details returns to the list.
- Type filters apply before grouping, so a pin's count is what you'd find there with the current filter.

## Alternatives considered

- **Leaflet.markercluster**: clusters nearby markers by zoom level. It solves a different problem (density when zoomed out), not identical coordinates: at any zoom, 26 events on one point are still one cluster that "spiderfies" into a ring of 26 tiny pins on a phone. It would also add a dependency and a second rendering path outside React.
- **Offsetting stacked markers slightly**: makes every event visible but places them at false locations, which matters in an app where being within 150 m is the rule.
- **Grouping on the server** (a venues endpoint): right once venues have names and ids (roadmap P1-3), but not needed to fix reachability, and the API contract stays unchanged for now.

## Consequences

- Every event in the Nearby list can be reached from the map (checked on real data: 99 pins whose counts add up to 290).
- Grouping is exact-point only. Two entrances of the same building 20 m apart stay two pins. If that proves annoying, a distance-based grouping can replace `venueKey` without touching the components.
- The list says "5 events here" with the borough, because the data has no venue names yet. Roadmap item P1-3 adds them.
