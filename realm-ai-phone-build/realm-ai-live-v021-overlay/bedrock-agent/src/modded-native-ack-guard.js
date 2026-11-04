// Narrow compatibility guard for bedrock-protocol 3.61.0.
// Its built-in createClient() writes 'completed' on both resource_packs_info
// and resource_pack_stack, even when a modded Realm still requires downloads.
// Suppress ONLY those premature legacy ACKs on a server-announced NONEMPTY
// pack stack. The app's verified modern sendBuffer(2,3,4) path remains intact.
// Empty/unmodded worlds keep their native write function unchanged.
export function installModdedNativeAckGuard(client) {
  if (!client || typeof client.prependListener !== 'function' || typeof client.write !== 'function') {
    throw Error('Modded pack ACK guard requires a live Bedrock client')
  }
  const nativeWrite=client.write
  let guardWrite=null
  let active=false,blocked=0
  const onInfo=packet=>{
    if(active)return
    const textures=packet?.texture_packs??packet?.resource_packs??[]
    const behavior=packet?.behavior_packs??[]
    if(!Array.isArray(textures)||!Array.isArray(behavior)||textures.length+behavior.length===0)return
    active=true
    guardWrite=function(name,params,...args) {
      if(name==='resource_pack_client_response' && params?.response_status==='completed') {
        blocked++
        return
      }
      return nativeWrite.call(this,name,params,...args)
    }
    client.write=guardWrite
  }
  // Must run BEFORE the bundled bedrock-protocol automatic info listener.
  client.prependListener('resource_packs_info',onInfo)
  return {
    snapshot:()=>({moddedNativeAckGuardActive:active,moddedLegacyCompletionsBlocked:blocked}),
    cleanup(){
      client.off('resource_packs_info',onInfo)
      if(guardWrite && client.write===guardWrite)client.write=nativeWrite
    }
  }
}
