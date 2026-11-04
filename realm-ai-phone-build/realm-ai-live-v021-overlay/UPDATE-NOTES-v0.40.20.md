# v0.40.20 — one stable pack-wire candidate

Base source: v0.40.19 commit `384199be7c6b9a1b00acbff857eb5718ef69a31f`.
Package `com.veilforge.realmagent.live`; code 200049. Preserve the permanent
77694D4F certificate, Nintendo Switch identity and saved Microsoft session.

## Narrow change

The modded-only writer reinterpreted Mojang's separately documented enum values
1..4 as the packet's leading oneOf alternative tag, then capitalized its response
string. The protocol-2225 Gophertunnel implementation uses tags 0..3 and lowercase
strings. The original no-pack branch already used that stable form.

For `send_packs`, the failing candidate was `08 02 0b 44 ...` (tag2, `Downloading`),
while the frozen stable fixture is `08 01 0b 64 ...` (tag1, `downloading`). Only those
two bytes differ for this request; its pack-ID list is unchanged. Restore the
stable form for all four modded pack responses and keep the original reliable,
encrypted sendBuffer path. No cache/radius timing, authentication, gameplay,
Microsoft UI, Realm-selection, native-runtime or unmodded-path edits in this patch.

## Independent contract evidence

- Gophertunnel commit `0e179fc4bb082c13e946c7d81ab1cf9f623d942c`,
  [version](https://github.com/Sandertv/gophertunnel/blob/0e179fc4bb082c13e946c7d81ab1cf9f623d942c/minecraft/protocol/info.go)
  and [packet writer](https://github.com/Sandertv/gophertunnel/blob/0e179fc4bb082c13e946c7d81ab1cf9f623d942c/minecraft/protocol/packet/resource_pack_client_response.go).
- Mojang docs commit `0879ab5c4c70be1bd520e32a8c49ea4a155616d6`, protocol2225:
  [oneOf payload](https://github.com/Mojang/bedrock-protocol-docs/blob/0879ab5c4c70be1bd520e32a8c49ea4a155616d6/json/ResourcePackClientResponsePacketPayload.json)
  and [lowercase alternative constant](https://github.com/Mojang/bedrock-protocol-docs/blob/0879ab5c4c70be1bd520e32a8c49ea4a155616d6/json/Resource_Pack_Client_Response_-_Downloading.json).
  Do not confuse the standalone ResourcePackResponse enum with the oneOf wire tag.

## Validation and limits

Five new frozen-byte/list regressions failed against the unchanged v0419 writer
and pass with this patch. The complete Node suite passes 499 tests. Android Java
unit tests pass 58 tests. Existing tests that mirrored the incorrect 1..4/capitalized
wire assumption were corrected using the frozen external contract; no gameplay
assertions were weakened.

The actual PC listener ran VF-0017 and independently parsed the two synthetic
25-byte frames: offsets1/3 differ, all pack-list bytes match, and Python exited0.
Its external source verifier still reports the pre-existing unrelated VF-0011
scope mismatch. The PC did not build this APK or perform a live Realm join.

This candidate is assembled by local Android Gradle directly from the source,
using original dependencies and native runtime extracted from the SHA/certificate-
verified public v0.40.19 APK as build INPUTS. No output APK ZIP repacking or code
substitution. Runtime dependencies/native inputs are not committed. Android
release lint could not finish resolving its tooling download; that release-lint
task is omitted, while compilation and the Java/Node tests run normally. No
emulator is available here. Record final APK/package/signature/source verification
in the release artifact report. No GitHub Actions or new signing key.

Live modded Realm acceptance is UNVERIFIED. Install in place, stop/start the bot,
and try the intended modded Realm once. A useful next observation is whether pack
headers/chunks finally arrive with `packWireCode: 1` and lowercase `downloading`.
If still rejected, collect the existing read-only handshake/connection report;
do not change more variables or keep issuing blind rebuilds. Preserve v0419 as
the rollback reference (Android downgrade itself may need a separate procedure;
never uninstall or clear app data just to roll back).
