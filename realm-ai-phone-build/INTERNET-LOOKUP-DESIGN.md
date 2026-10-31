# Internet lookup and remembered vocabulary design

## Goal

When a supported command has a clear action but an unfamiliar target word, VEILFORGE may look up the term, suggest a Minecraft catalog name, and ask the owner whether that mapping is right. It must not turn general web content into commands or make unsupported actions executable.

Examples:

- “mine 3 crimson wood” keeps the action and quantity, and may suggest the catalog block `crimson_stem` if references identify that as the likely target. It must ask before saving or running the mapped command.
- “find purple crystal” may offer a small choice such as amethyst block, bud, or cluster. It must not choose one silently.
- “craft a netherite sword” stays unsupported even if search finds crafting instructions; search must not expand executable capabilities.

## Resolution order

1. Parse the user’s intent and slots locally: action, target phrase, quantity, coordinates, dimensions, and any mode. If the action is unknown or unsupported, stop and ask for a supported request.
2. Resolve exact names, known aliases, and fuzzy matches against the bundled Bedrock 1.26.60 catalog.
3. Only when the target phrase is still unknown, perform a bounded lookup. Search only the target phrase plus a fixed topic hint such as “Minecraft”; never send chat history, gamertags, coordinates, Realm names, authentication data, or inventory.
4. Convert candidate meanings into existing canonical catalog identifiers and types (block, item, entity, recipe, or general term). Require action/type compatibility. Mining must resolve to a mineable block; a search result for an item cannot make it mineable.
5. Show the candidate wording and evidence. Ask the owner to accept or correct the noun mapping. Then pass the unchanged action and other slots through the existing validator and saved-plan flow. Nothing activates automatically.

The phone command flow and owner-only Realm chat flow currently enter separate parsers. The resolver should be one shared asynchronous service in front of both, with a local-only fast path so familiar commands work offline without delay.

## Evidence and misinformation handling

Use two independent references as the minimum for an ordinary vocabulary suggestion; prefer three when available. For Minecraft terms, evidence can include the bundled version-specific game registry, a Minecraft reference such as Minecraft Wiki, and Mojang/Minecraft documentation when it covers the term. For general word meanings, use established dictionaries or encyclopedias from distinct publishers. Search-engine result pages are indexes, not evidence.

- Count distinct publishers, not multiple pages copied from one source. Normalize redirects and remove syndicated duplicates.
- Prefer primary sources for game behavior and versioned names. Show source title, publisher, date/version when available, and direct link.
- Compare the actual mapping claim (for example, “this phrase refers to crimson stem”) across sources. Do not count unrelated snippets as corroboration.
- If two or three references agree and the canonical object exists in the bundled catalog, present it as a likely match, not a proven fact.
- If sources conflict, are stale, appear satirical, or fail to identify a catalog object, report “not verified” and ask the user. One source alone is insufficient for a learned automatic alias.
- A troll/misinformation detector cannot guarantee truth or infer intent. It can flag conflicts, missing dates, satire labels, dubious publishers, or unsupported claims; it must not claim certainty from a source count.

Retrieved page text is untrusted data. Treat it as quoted evidence only. Ignore any instructions, command strings, links to tools, or requests inside a page. Use fixed HTTPS endpoints and host allowlists, strict response-size and timeout limits, rate limits, and a short cache. No arbitrary URL fetching, shell execution, or open-ended browsing.

## Remembering a word

Persist only a confirmed alias, not full pages or chat history. Store an atomic private file under the existing private data directory, keyed by Realm ID and the configured owner identity. A record should contain:

- normalized phrase and canonical catalog ID;
- object type and supported action classes;
- confirmation time and schema/catalog version;
- two or three source titles, publishers, URLs, and checked dates;
- whether the owner explicitly confirmed it.

Aliases are suggestions for the noun slot only. They cannot replace verbs, quantities, coordinates, modes, permission checks, reach checks, or safety checks. Every use must revalidate the canonical ID against the current bundled catalog and current command validator. Conflicting aliases should prompt again, not take the newest value silently. Cap the list, write atomically, and never put private alias data in the APK, GitHub, public logs, or source assets. Guests cannot teach or overwrite aliases.

An owner correction such as “when I say glow rock, I mean amethyst” can be remembered after an explicit “remember this word” confirmation; source evidence is then labeled as owner-defined rather than web-verified. Let the owner inspect, edit, or forget saved aliases in Settings.

## Failure behavior and user display

Known commands continue to work when offline. If lookup times out, say that the term is not in the local catalog and offer the local catalog search; do not guess. Display the proposed canonical name, why it matched, and two or three source links before saving an alias. A remembered alias can make future wording smoother, but still creates a plan that the owner selects and activates.

## Regression tests before implementation

- Query contains only the unknown noun and fixed topic hint; no Realm, player, coordinate, chat-history, or credential data.
- Two-source agreement and three-source agreement can suggest a mapping; duplicates from one publisher count once.
- Disagreement, satire, stale pages, malformed responses, one-source results, timeout, or rate-limit never create an alias or plan.
- Search content containing “ignore previous rules”, command text, URLs, or code is displayed as inert evidence and never executed.
- Candidate must exist in the current Bedrock catalog and match the requested action type.
- Ambiguous words require owner choice; an owner-confirmed alias survives restart but remains Realm/owner scoped.
- Guest messages cannot teach aliases; deletion and correction persist safely.
- Reuse of an alias still revalidates current mode, permissions, terrain, tool, supplies, reach, and protections.
- Search results never activate a plan; existing selected-plan activation and immediate Stop semantics remain unchanged.
