#!/usr/bin/env python3
"""Rebuild the bundled 5,000-word offline glossary from pinned public datasets.

Sources are downloaded only when --download is supplied. Generated output is
deterministic and contains the 5,000 highest-frequency alphabetic words with
at least one Open English WordNet sense, drawn from wordfreq's large English
frequency list. The result remains fully offline at runtime.
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
WORK = ROOT / "lexicon-work"
OUT = ROOT / "v020-overlay/bedrock-agent/src/lexicon/english-5000.json.gz"
ATTR = ROOT / "v020-overlay/bedrock-agent/src/lexicon/ATTRIBUTION.txt"
WORD_LIST_URL = "https://raw.githubusercontent.com/rspeer/wordfreq/912caf64b657478d1dff1138efdc078947d54bb1/wordfreq/data/large_en.msgpack.gz"
OEWN_URL = "https://github.com/globalwordnet/english-wordnet/releases/download/2025-edition/english-wordnet-2025.zip"
WORD_RE = re.compile(r"[a-z]+(?:'[a-z]+)?\Z")
# Function words are frequent but their standalone WordNet senses are usually
# misleading (for example, "in" as a chemical element), so keep the 5,000
# defined content words useful for questions and command clarification.
SKIP_WORDS = set("a an the and but or nor so yet for to of in on at by with from into onto over under through across after before during while until if unless because although though as than that which who whom whose what when where why how whether either neither each every all any some no not be been being is am are was were do does did done have has had having can could may might must shall should will would it its he she they we you i me my mine your yours our ours their his her them us this these those there here then also very just so up out off own same more most less least such both per via against about among between as into down beside beyond within without upon toward towards one two three " .split())
POS_NAMES = {"n": "noun", "v": "verb", "a": "adjective", "s": "adjective", "r": "adverb"}
POS_FILES = {"n": "noun", "v": "verb", "a": "adj", "s": "adj", "r": "adv"}


def fetch(url: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"User-Agent": "VEILFORGE-Realm-AI-lexicon-builder/1"})
    with urllib.request.urlopen(request, timeout=90) as response, path.open("wb") as target:
        while chunk := response.read(1024 * 1024):
            target.write(chunk)


def load_sources(download: bool) -> tuple[Path, Path]:
    freq = WORK / "large_en.msgpack.gz"
    archive = WORK / "english-wordnet-2025.zip"
    if download:
        fetch(WORD_LIST_URL, freq)
        fetch(OEWN_URL, archive)
    if not freq.is_file() or not archive.is_file():
        raise SystemExit("Missing source files; rerun with --download.")
    return freq, archive


def wordnet_senses(archive: Path) -> dict[str, list[dict[str, str]]]:
    out: dict[str, list[dict[str, str]]] = {}
    with zipfile.ZipFile(archive) as zf:
        glosses: dict[tuple[str, str], str] = {}
        for pos in ("noun", "verb", "adj", "adv"):
            filename = f"oewn2025/data.{pos}"
            for line in zf.read(filename).decode("utf-8").splitlines():
                if not line or line.startswith("  ") or "|" not in line:
                    continue
                left, gloss = line.split("|", 1)
                fields = left.split()
                if len(fields) >= 4:
                    glosses[(pos, fields[0])] = " ".join(gloss.strip().split())[:360]

        for pos_code, pos_file in POS_FILES.items():
            filename = f"oewn2025/index.sense"
            for line in zf.read(filename).decode("utf-8").splitlines():
                fields = line.split()
                if len(fields) < 4:
                    continue
                key, offset, sense_number, _tag_count = fields[:4]
                try:
                    lemma, marker = key.rsplit("%", 1)
                    key_pos = marker.split(":", 1)[0]
                    sense_pos = {"1": "n", "2": "v", "3": "a", "4": "r"}.get(key_pos)
                    if sense_pos != pos_code:
                        continue
                    lemma = lemma.replace("_", " ").lower()
                    if not WORD_RE.fullmatch(lemma):
                        continue
                    gloss = glosses.get((pos_file, offset))
                    if gloss:
                        out.setdefault(lemma, []).append({"p": POS_NAMES[pos_code], "d": gloss, "s": int(sense_number)})
                except (ValueError, IndexError):
                    continue
    for senses in out.values():
        senses.sort(key=lambda sense: (sense["s"], sense["p"], sense["d"]))
    return out


def ranked_words(freq_path: Path) -> list[str]:
    try:
        import msgpack
    except ImportError as exc:
        raise SystemExit("Install Python msgpack to generate this asset (pip install msgpack).") from exc
    with gzip.open(freq_path, "rb") as stream:
        data = msgpack.unpackb(stream.read(), raw=False)
    if not data or data[0] != {"format": "cB", "version": 1}:
        raise SystemExit("Unexpected wordfreq cBpack format.")
    seen: set[str] = set()
    words: list[str] = []
    for bucket in data[1:]:
        for word in bucket:
            word = word.lower()
            if WORD_RE.fullmatch(word) and len(word) > 1 and word not in seen:
                seen.add(word)
                words.append(word)
    return words


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--download", action="store_true", help="fetch the pinned wordfreq and Open English WordNet sources")
    args = parser.parse_args()
    freq, archive = load_sources(args.download)
    senses = wordnet_senses(archive)
    selected = []
    for rank, word in enumerate(ranked_words(freq), 1):
        if word in SKIP_WORDS or word not in senses:
            continue
        selected.append({"w": word, "r": rank, "s": [{"p": x["p"], "d": x["d"]} for x in senses[word][:2]]})
        if len(selected) == 5000:
            break
    if len(selected) != 5000:
        raise SystemExit(f"Only found {len(selected)} definable words in the top 10,000; expected 5,000.")
    payload = json.dumps({"version": 1, "words": selected}, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("wb") as stream:
        with gzip.GzipFile(filename="", mode="wb", fileobj=stream, mtime=0, compresslevel=9) as gz:
            gz.write(payload)
    ATTR.write_text(
        "Offline English glossary attribution\n"
        "\n"
        "Word frequency ordering: wordfreq, by Robyn Speer, Apache-2.0 code; "
        "included corpus-derived data under CC BY-SA 4.0. Source: "
        "https://github.com/rspeer/wordfreq (commit 912caf64b657478d1dff1138efdc078947d54bb1).\n"
        "\n"
        "Definitions: Open English WordNet 2025, based on Princeton WordNet; "
        "Open English WordNet data CC BY 4.0 and Princeton WordNet License. "
        "Source: https://github.com/globalwordnet/english-wordnet (release 2025-edition, "
        "commit dc343f2683279ecbb13fab4e2fd778d7b162d287).\n"
        "\n"
        "The application uses this data offline. Word senses are ranked lexical "
        "descriptions, not authoritative Minecraft instructions; action routing "
        "uses a separate, limited, explicit set of supported terms.\n",
        encoding="utf-8",
    )
    print(f"words={len(selected)} source-rank={selected[-1]['r']} raw={len(payload)} compressed={OUT.stat().st_size}")
    print(f"sha256={hashlib.sha256(OUT.read_bytes()).hexdigest()}")


if __name__ == "__main__":
    main()
