'use strict'
// Verify the embedded Bedrock library delegates ALL pack responses to VEILFORGE.
// This test runs only after npm installs and patch_single_pack_owner_v099.py.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=path.resolve(process.argv[2]);
const library=fs.readFileSync(path.join(base,'bedrock-agent/node_modules/bedrock-protocol/src/createClient.js'),'utf8');
const ours=fs.readFileSync(path.join(base,'bedrock-agent/src/realm-packs.js'),'utf8');
assert(!library.includes('completeResourcePacks'),'Built-in completed response must be disabled');
assert.equal((library.match(/client.once\('resource_packs_info'/g)||[]).length,1,'Cache initialization should remain');
assert(library.includes("client.queue('client_cache_status', { enabled: false })"),'Cache init must remain');
assert(library.includes("client.queue('request_chunk_radius'"),'Chunk radius init must remain');
assert.equal((ours.match(/client.write\('resource_pack_client_response'/g)||[]).length,1,'Exactly one custom response writer');
assert(ours.includes("response('send_packs'"),'Custom downloader sends the request');
assert(ours.includes("response('have_all_packs'"),'Custom downloader confirms downloads');
assert(ours.includes("response('completed'"),'Custom downloader completes handshake');
console.log('PASS: no competing pack response; VEILFORGE owns Download & Join, Bedrock client initialization retained.');
