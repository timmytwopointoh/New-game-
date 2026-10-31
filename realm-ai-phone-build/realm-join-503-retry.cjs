'use strict'
// Retry ONLY transient HTTP 503 errors from the Minecraft Realms /worlds/{id}/join
// endpoint. The same Realm and cached Xbox authflow remain in use. No re-login.
const RETRY_DELAYS_MS = Object.freeze([1800, 3600, 7200])
function isJoinServiceUnavailable(err) {
  const code = Number(err?.response?.status ?? err?.response?.statusCode ?? err?.statusCode ?? err?.status ?? err?.cause?.status ?? 0)
  if (code === 503) return true
  if (code && code !== 503) return false
  const message = String(err?.message || '')
  return /(?:^|\D)503(?:\D|$)/.test(message) && /(?:service unavailable|http|retry again|response)/i.test(message)
}
async function joinRealmWithRetry(requestJoin, onRetry = () => {}, sleep = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  if (typeof requestJoin !== 'function') throw Error('A Realm join request function is required')
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await requestJoin()
    } catch (error) {
      if (!isJoinServiceUnavailable(error)) throw error
      if (attempt === RETRY_DELAYS_MS.length) {
        const unavailable = new Error('Minecraft Realms join service returned 503 after 4 attempts. Try again later.')
        unavailable.statusCode = 503
        throw unavailable
      }
      const delayMs = RETRY_DELAYS_MS[attempt]
      // Never pass an HTTP response, request headers, Realm ID or credentials to the UI callback.
      try { onRetry?.({ attempt: attempt + 1, totalAttempts: 4, delayMs }) } catch {}
      await sleep(delayMs)
    }
  }
}
module.exports = { joinRealmWithRetry, isJoinServiceUnavailable }
