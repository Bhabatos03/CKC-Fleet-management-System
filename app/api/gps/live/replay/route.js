// DEPRECATED: Moved to app/api/gps/replay/route.js
// This file now re-exports the implementation from the new location so
// existing imports/paths continue to work while callers migrate.

export { GET, dynamic, maxDuration } from '../../replay/route.js'
