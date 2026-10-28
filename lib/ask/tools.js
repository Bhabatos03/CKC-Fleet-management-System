// lib/ask/tools.js
//
// The read-only data tools behind Ask FleetPulse.
//
// The model never writes a database query. It fills in a small structured request (collection, filters, grouping) and this file
// checks every part of it, builds the real query itself, ALWAYS adds the user's showroom limit, and removes sensitive fields
// from whatever comes back. So the model cannot reach another showroom's data, a collection that is not listed, or a secret,
// whatever the user types or whatever text sits inside the records.

import { COLLECTIONS, DENIED_FIELD, LIMITS } from './config.js'

export class AskToolError extends Error {}

const FIELD_RE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+){0,3}$/
const OPS = ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'contains', 'exists']
const METRICS = ['count', 'sum', 'avg', 'min', 'max']
const BUCKETS = { year: 4, month: 7, day: 10 }
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const isDeniedField = (f) => String(f).split('.').some(seg => DENIED_FIELD.test(seg))

function cfgOf(name, ctx) {
  const key = String(name || '')
  const cfg = Object.prototype.hasOwnProperty.call(COLLECTIONS, key) ? COLLECTIONS[key] : null
  if (!cfg) throw new AskToolError(`"${key}" is not available. Use list_data to see what can be read.`)
  if (cfg.scope.adminOnly && ctx.role !== 'admin') throw new AskToolError(`"${key}" is available to Admin only`)
  return { name: key, ...cfg }
}

export function checkField(cfg, f) {
  const field = String(f ?? '')
  if (!FIELD_RE.test(field) || field.length > 60) throw new AskToolError(`"${field}" is not a valid field name`)
  if (isDeniedField(field)) throw new AskToolError(`"${field}" cannot be used`)
  if (cfg.allowFields && !cfg.allowFields.includes(field.split('.')[0])) throw new AskToolError(`"${field}" is not available in ${cfg.name}`)
  return field
}

function checkValue(v) {
  if (typeof v === 'string') { if (v.length > LIMITS.maxValueLength) throw new AskToolError('A filter value is too long'); return v }
  if (typeof v === 'number') { if (!Number.isFinite(v)) throw new AskToolError('A filter value is not a number'); return v }
  if (typeof v === 'boolean') return v
  throw new AskToolError('Filter values must be text, numbers or true/false')
}

// Filters the model asked for -> a Mongo filter. Nothing from the model is passed through as an operator.
export function buildMatch(cfg, filters) {
  const list = filters === undefined || filters === null ? [] : filters
  if (!Array.isArray(list)) throw new AskToolError('filters must be a list')
  if (list.length > LIMITS.maxFilters) throw new AskToolError(`Use at most ${LIMITS.maxFilters} filters`)
  const and = []
  for (const f of list) {
    if (!f || typeof f !== 'object') throw new AskToolError('Each filter needs field, op and value')
    const field = checkField(cfg, f.field)
    if (!OPS.includes(f.op)) throw new AskToolError(`op must be one of: ${OPS.join(', ')}`)
    if (f.op === 'in') {
      if (!Array.isArray(f.value) || !f.value.length || f.value.length > LIMITS.maxInList) throw new AskToolError(`"in" needs a list of 1 to ${LIMITS.maxInList} values`)
      and.push({ [field]: { $in: f.value.map(checkValue) } })
    } else if (f.op === 'exists') {
      and.push({ [field]: { $exists: f.value !== false } })
    } else if (f.op === 'contains') {
      const v = checkValue(f.value)
      and.push({ [field]: new RegExp(escapeRe(String(v)), 'i') })
    } else if (f.op === 'eq') {
      and.push({ [field]: checkValue(f.value) })
    } else {
      and.push({ [field]: { [`$${f.op}`]: checkValue(f.value) } })
    }
  }
  return and
}

// The showroom limit. Added by the server after the model's filters, as one more AND condition, so it cannot be widened.
export async function scopeClause(db, cfg, ctx) {
  if (ctx.role === 'admin') return null
  if (!ctx.storeId) throw new AskToolError('Your account is not linked to a showroom')
  const s = cfg.scope
  if (s.field) return { [s.field]: ctx.storeId }
  if (s.anyOf) return { $or: s.anyOf.map(f => ({ [f]: ctx.storeId })) }
  if (s.viaVehicle) {
    const vs = await db.collection('vehicles').find({ assignedLocation: ctx.storeId }).toArray()
    return { vehicleId: { $in: vs.map(v => v.id) } }
  }
  throw new AskToolError('This data is not available to you')
}

const fullMatch = async (db, cfg, ctx, filters) => {
  const and = buildMatch(cfg, filters)
  const scope = await scopeClause(db, cfg, ctx)
  if (scope) and.push(scope)
  return and.length ? { $and: and } : {}
}

// Remove _id, secrets and (for restricted collections) everything outside the allowed fields. Works through nested values.
export function sanitize(value, cfg, top = true) {
  if (Array.isArray(value)) return value.map(v => sanitize(v, cfg, false))
  if (value && typeof value === 'object') {
    if (value instanceof Date) return value.toISOString()
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      if (k === '_id' || DENIED_FIELD.test(k)) continue
      if (top && cfg?.allowFields && !cfg.allowFields.includes(k)) continue
      out[k] = sanitize(v, cfg, false)
    }
    return out
  }
  return value
}

// Keep the answer inside the size the model can handle, and say so when rows were dropped
function fit(payload, listKey) {
  let rows = payload[listKey]
  let text = JSON.stringify({ ...payload, [listKey]: rows })
  if (text.length <= LIMITS.resultChars) return payload
  while (rows.length > 1 && text.length > LIMITS.resultChars) {
    rows = rows.slice(0, Math.ceil(rows.length * 0.8))
    text = JSON.stringify({ ...payload, [listKey]: rows })
  }
  return { ...payload, [listKey]: rows, returned: rows.length, note: 'Result was too large and was cut short. Ask for fewer fields, add filters, or use summarize.' }
}

// ---------- the three tools ----------
async function listData(db, ctx) {
  const out = []
  for (const [name, cfg0] of Object.entries(COLLECTIONS)) {
    if (cfg0.scope.adminOnly && ctx.role !== 'admin') continue
    const cfg = { name, ...cfg0 }
    const match = await fullMatch(db, cfg, ctx, [])
    const records = await db.collection(name).countDocuments(match, { maxTimeMS: LIMITS.queryMs })
    const sample = await db.collection(name).find(match).limit(20).toArray()
    const fields = new Set()
    for (const d of sample) for (const k of Object.keys(sanitize(d, cfg))) fields.add(k)
    out.push({ collection: name, description: cfg0.description, records, fields: [...fields].sort() })
  }
  const note = 'Dates are mostly ISO text (YYYY-MM-DD...), so compare dates with gte / lte on text like "2026-10-01". Field lists come from sample records, so a rarely used field may be missing.'
  return { collections: out, note }
}

async function findRecords(db, input, ctx) {
  const cfg = cfgOf(input.collection, ctx)
  const match = await fullMatch(db, cfg, ctx, input.filters)
  const limit = Math.min(Math.max(parseInt(input.limit, 10) || LIMITS.findDefault, 1), LIMITS.findMax)
  let fields = null
  if (input.fields !== undefined && input.fields !== null) {
    if (!Array.isArray(input.fields) || input.fields.length > LIMITS.maxFields) throw new AskToolError(`fields must be a list of at most ${LIMITS.maxFields} names`)
    fields = input.fields.map(f => checkField(cfg, f))
  }
  const sortField = input.sort_by ? checkField(cfg, input.sort_by) : cfg.defaultSort
  const dir = input.sort_dir === 'desc' ? -1 : 1
  let cur = db.collection(cfg.name).find(match)
  if (fields) cur = cur.project(Object.fromEntries(fields.map(f => [f, 1])))
  if (sortField) cur = cur.sort({ [sortField]: dir })
  const rows = (await cur.limit(limit).toArray()).map(d => sanitize(d, cfg))
  const total = await db.collection(cfg.name).countDocuments(match, { maxTimeMS: LIMITS.queryMs })
  return fit({ collection: cfg.name, total, returned: rows.length, records: rows }, 'records')
}

// Pipeline for grouping and totals. Exported so it can be tested without a database.
export function buildPipeline(cfg, input, match) {
  const metrics = input.metrics === undefined || input.metrics === null ? [] : input.metrics
  if (!Array.isArray(metrics) || metrics.length > LIMITS.maxMetrics) throw new AskToolError(`Use at most ${LIMITS.maxMetrics} metrics`)
  const group = { count: { $sum: 1 } }
  const aliases = ['count']
  for (const m of metrics) {
    if (!m || !METRICS.includes(m.op)) throw new AskToolError(`metric op must be one of: ${METRICS.join(', ')}`)
    if (m.op === 'count') continue
    const field = checkField(cfg, m.field)
    const alias = `${m.op}_${field.replace(/\./g, '_')}`
    const ref = `$${field}`
    // sum / avg: text that holds a number is converted; anything that is not a number counts as 0
    const num = { $convert: { input: ref, to: 'double', onError: 0, onNull: 0 } }
    group[alias] = m.op === 'sum' ? { $sum: num } : m.op === 'avg' ? { $avg: num } : m.op === 'min' ? { $min: ref } : { $max: ref }
    aliases.push(alias)
  }
  let groupId = null
  if (input.group_by) {
    const f = checkField(cfg, input.group_by)
    if (input.bucket !== undefined && input.bucket !== null && !BUCKETS[input.bucket]) throw new AskToolError('bucket must be year, month or day')
    groupId = input.bucket ? { $substrCP: [{ $toString: `$${f}` }, 0, BUCKETS[input.bucket]] } : `$${f}`
  }
  const limit = Math.min(Math.max(parseInt(input.limit, 10) || LIMITS.groupDefault, 1), LIMITS.groupMax)
  const sortKey = input.sort_by === 'group' || !input.sort_by ? (groupId ? '_id' : 'count') : input.sort_by
  if (sortKey !== '_id' && !aliases.includes(sortKey)) throw new AskToolError(`sort_by must be "group" or one of: ${aliases.join(', ')}`)
  const dir = input.sort_dir === 'desc' ? -1 : 1
  return {
    aliases,
    pipeline: [{ $match: match }, { $group: { _id: groupId, ...group } }, { $sort: { [sortKey]: dir } }, { $limit: limit }],
  }
}

async function summarize(db, input, ctx) {
  const cfg = cfgOf(input.collection, ctx)
  const match = await fullMatch(db, cfg, ctx, input.filters)
  const { aliases, pipeline } = buildPipeline(cfg, input, match)
  const rows = await db.collection(cfg.name).aggregate(pipeline, { maxTimeMS: LIMITS.queryMs }).toArray()
  const out = rows.map(r => {
    const o = input.group_by ? { group: r._id ?? '(blank)' } : {}
    for (const a of aliases) o[a] = typeof r[a] === 'number' ? Math.round(r[a] * 100) / 100 : r[a]
    return o
  })
  return fit({ collection: cfg.name, grouped_by: input.group_by || null, rows: sanitize(out, null), returned: out.length }, 'rows')
}

export async function runTool(db, name, input, ctx) {
  try {
    const args = input && typeof input === 'object' ? input : {}
    if (name === 'list_data') return await listData(db, ctx)
    if (name === 'find_records') return await findRecords(db, args, ctx)
    if (name === 'summarize') return await summarize(db, args, ctx)
    return { error: 'Unknown tool' }
  } catch (e) {
    if (e instanceof AskToolError) return { error: e.message }   // the model can correct itself
    console.error('Ask tool error:', name, e?.name, e?.code || '')
    return { error: 'That lookup failed. Try a simpler request.' }
  }
}

const filterSchema = {
  type: 'array', description: `Conditions that must all be true (max ${LIMITS.maxFilters}).`,
  items: {
    type: 'object', required: ['field', 'op', 'value'],
    properties: {
      field: { type: 'string', description: 'Field name, nested with dots, for example trip.travelDate' },
      op: { type: 'string', enum: OPS, description: 'contains = text contains (any case). in = value is a list. exists = value true/false.' },
      value: { description: 'Text, number, true/false, or a list for "in"' },
    },
  },
}

export const TOOL_DEFS = [
  {
    name: 'list_data',
    description: 'Shows which data collections can be read, how many records the user can see in each, and their field names. Call this first when unsure which collection or field to use.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'find_records',
    description: 'Returns individual records from one collection, with filters, sorting and a limit. Use for lists, lookups of one vehicle / driver / booking, and "show me" questions. The result says how many records match in total.',
    input_schema: {
      type: 'object', required: ['collection'],
      properties: {
        collection: { type: 'string', enum: Object.keys(COLLECTIONS) },
        filters: filterSchema,
        fields: { type: 'array', items: { type: 'string' }, description: 'Only return these fields (recommended: smaller and faster)' },
        sort_by: { type: 'string' }, sort_dir: { type: 'string', enum: ['asc', 'desc'] },
        limit: { type: 'number', description: `Default ${LIMITS.findDefault}, max ${LIMITS.findMax}` },
      },
    },
  },
  {
    name: 'summarize',
    description: 'Counts and totals over a collection, optionally grouped (by a field, or by year / month / day of a date field). Use for how many, total cost, average, highest / lowest, per-vehicle or per-month questions. Always prefer this to adding up records yourself.',
    input_schema: {
      type: 'object', required: ['collection'],
      properties: {
        collection: { type: 'string', enum: Object.keys(COLLECTIONS) },
        filters: filterSchema,
        group_by: { type: 'string', description: 'Field to group by. Omit for one overall result.' },
        bucket: { type: 'string', enum: Object.keys(BUCKETS), description: 'With a date field in group_by: group by year, month or day' },
        metrics: {
          type: 'array', description: 'count is always included. Add sum / avg / min / max of a numeric field.',
          items: { type: 'object', required: ['op'], properties: { op: { type: 'string', enum: METRICS }, field: { type: 'string' } } },
        },
        sort_by: { type: 'string', description: '"group", "count", or a metric name like sum_cost' },
        sort_dir: { type: 'string', enum: ['asc', 'desc'] },
        limit: { type: 'number' },
      },
    },
  },
]
