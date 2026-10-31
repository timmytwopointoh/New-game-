// Server-authoritative inventory diagnostics. Never create, move, or remove game items locally.
export const playerInventoryWindow = id => id === 0 || id === 'inventory' || id === '0'
export function stackIdentity(item) {
  const id = Number(item?.network_id), count = Number(item?.count)
  if (!Number.isSafeInteger(id) || !Number.isSafeInteger(count) || id <= 0 || count <= 0) return null
  return {id, count}
}
export function inventoryItemName(item, registryItems = {}) {
  const stack = stackIdentity(item)
  return stack ? (registryItems?.[stack.id]?.name || 'unmapped_item_' + stack.id) : 'empty'
}
export function inventoryTotals(inventory, registryItems = {}) {
  const total = new Map()
  for (const item of inventory.values()) {
    const stack = stackIdentity(item)
    if (!stack) continue
    const name = inventoryItemName(item, registryItems)
    total.set(name, (total.get(name) || 0) + stack.count)
  }
  return Object.fromEntries(total)
}
export function inventorySlotChanges(previous, current, registryItems = {}, limit = 8) {
  const changes = []
  const slots = new Set([...previous.keys(), ...current.keys()])
  for (const slot of [...slots].sort((a, b) => a - b)) {
    const old = stackIdentity(previous.get(slot)), now = stackIdentity(current.get(slot))
    if (old?.id === now?.id && old?.count === now?.count) continue
    changes.push({slot, before: inventoryItemName(previous.get(slot), registryItems), after: inventoryItemName(current.get(slot), registryItems), beforeCount: old?.count || 0, afterCount: now?.count || 0})
    if (changes.length >= limit) break
  }
  return changes
}
export function assessHotbarSelection(inventory, slot) {
  if (!Number.isSafeInteger(slot) || slot < 0 || slot > 8) return {ok: false, reason: 'Hotbar slot is outside 1–9.'}
  if (!inventory.has(slot)) return {ok: false, reason: 'This hotbar slot has not been reported by the server.'}
  const item = inventory.get(slot)
  if (!item || typeof item !== 'object') return {ok: false, reason: 'Server did not supply a valid item descriptor.'}
  const id = Number(item.network_id), count = Number(item.count)
  if (!Number.isSafeInteger(id) || id < 0 || !Number.isSafeInteger(count) || count < 0 || (id > 0 && count === 0)) return {ok: false, reason: 'Server inventory descriptor is inconsistent; refusing equipment write.'}
  return {ok: true, item}
}
export function damageDiagnosis(mode, abilities) {
  const flags = abilities?.effective || {}
  const invulnerability = flags.invulnerable === true ? 'enabled' : flags.invulnerable === false ? 'disabled' : 'not reported'
  const active = (abilities?.active || []).join(', ') || 'none reported'
  return 'Own mode: ' + (mode || 'unknown') + '; invulnerability: ' + invulnerability + '; active special abilities: ' + active + '. PvP permissions and spawn protection must be checked on the Realm; a missed hit alone does not prove Creative mode.'
}
