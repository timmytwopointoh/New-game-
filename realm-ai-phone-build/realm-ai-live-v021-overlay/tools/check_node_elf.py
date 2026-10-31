#!/usr/bin/env python3
"""No-dependency Android ARM64 native ELF page-alignment gate.
Run against *actual* libnode.so. Absence or alignment <16 KB is a hard error.
"""
import struct
import sys
from pathlib import Path

def get_load_alignment(path: Path):
    b = path.read_bytes()
    if b[:4] != b'\x7fELF' or b[4] != 2 or b[5] != 1:
        raise ValueError('Expected little-endian ELF64 (ARM64)')
    if struct.unpack_from('<H',b,18)[0] != 183:
        raise ValueError('Expected AArch64 architecture')
    phoff = struct.unpack_from('<Q',b,32)[0]
    phentsize = struct.unpack_from('<H',b,54)[0]
    phnum = struct.unpack_from('<H',b,56)[0]
    if not phnum or phentsize < 56 or phoff + phnum*phentsize > len(b):
        raise ValueError('Invalid ELF program header table')
    alignments=[]
    for i in range(phnum):
        at=phoff+i*phentsize
        ptype=struct.unpack_from('<I',b,at)[0]
        if ptype==1: # PT_LOAD
            alignments.append(struct.unpack_from('<Q',b,at+48)[0])
    if not alignments:
        raise ValueError('No PT_LOAD segments present')
    return alignments

if __name__ == '__main__':
    if len(sys.argv)!=2:
        raise SystemExit('Usage: python tools/check_node_elf.py path/to/arm64-v8a/libnode.so')
    target=Path(sys.argv[1]); print('Checking',target)
    if not target.is_file():raise SystemExit('FAIL: Missing Android ARM64 Node.js native runtime')
    try: aligns=get_load_alignment(target)
    except (ValueError,OSError,struct.error) as e:raise SystemExit(f'FAIL: {e}')
    print('PT_LOAD page alignments:',[hex(a) for a in aligns])
    if min(aligns)<16384:raise SystemExit('FAIL: libnode.so is not 16 KB compatible')
    print('PASS: ELF segment page alignment is >=16 KB (device install still needs validation)')
