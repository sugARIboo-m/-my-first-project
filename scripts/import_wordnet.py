"""Build letter shards from the unchanged, checksum-pinned official WordNet 3.0 archive.

Usage: python scripts/import_wordnet.py [/path/to/WordNet-3.0.tar.gz]
No personal learning materials are read. All dictionary records retain source IDs.
"""
from pathlib import Path
import collections
import hashlib
import json
import re
import sys
import tarfile
import urllib.request

URL = 'https://wordnetcode.princeton.edu/3.0/WordNet-3.0.tar.gz'
SHA256 = '640db279c949a88f61f851dd54ebbb22d003f8b90b85267042ef85a3781d3a52'
ROOT = Path(__file__).resolve().parents[1]

def build(archive):
    raw = archive.read_bytes()
    if hashlib.sha256(raw).hexdigest() != SHA256:
        raise ValueError('Official WordNet archive checksum does not match; refusing import.')
    entries, exceptions = {}, {}
    with tarfile.open(archive) as source:
        def read(name):
            return source.extractfile('WordNet-3.0/' + name).read().decode('utf-8')
        license_text = read('LICENSE')
        for part in ['noun', 'verb', 'adj', 'adv']:
            synsets = {}
            for line in read('dict/data.' + part).splitlines():
                if line.startswith(' ') or not line.strip():
                    continue
                left, gloss = line.split(' | ', 1)
                fields = left.split()
                count = int(fields[3], 16)
                synonyms = [re.sub(r'\((?:a|p|ip)\)$', '', fields[4 + 2*i]).replace('_', ' ') for i in range(count)]
                gloss = gloss.strip()
                # Preserve the original definition and quoted examples, without translations.
                pieces = re.split(r';\s*(?=")', gloss, maxsplit=1)
                definition = pieces[0]
                synsets[fields[0]] = {'id': fields[2] + ':' + fields[0], 'pos': fields[2],
                    'definition': definition, 'examples': re.findall(r'"([^"]*)"', pieces[1]) if len(pieces)>1 else [], 'synonyms': synonyms}
            for line in read('dict/index.' + part).splitlines():
                if line.startswith(' ') or not line.strip():
                    continue
                fields = line.split()
                lemma = fields[0].replace('_', ' ')
                senses = entries.setdefault(lemma, [])
                for offset in fields[6 + int(fields[3]):]:
                    senses.append(synsets[offset])
            for line in read('dict/' + part + '.exc').splitlines():
                form, *bases = [w.replace('_', ' ') for w in line.split()]
                exceptions[form] = sorted(set(exceptions.get(form, []) + bases))
    out = ROOT / 'dictionary'
    out.mkdir(exist_ok=True)
    shards = collections.defaultdict(dict)
    for lemma, senses in sorted(entries.items()):
        letter = lemma[0] if 'a' <= lemma[0] <= 'z' else '0'
        shards[letter][lemma] = senses
    for letter, records in shards.items():
        (out / (letter + '.json')).write_text(json.dumps({'_license': license_text, 'entries': records}, ensure_ascii=False, separators=(',', ':')) + '\n')
    (out / 'exceptions.json').write_text(json.dumps({'_license': license_text, 'forms': exceptions}, ensure_ascii=False, separators=(',', ':')) + '\n')
    (out / 'LICENSE.txt').write_text('\n'.join(line.rstrip() for line in license_text.splitlines()) + '\n')
    meta = {'name': 'WordNet', 'version': '3.0', 'entries': len(entries),
        'senses': sum(map(len, entries.values())), 'source': URL, 'sha256': SHA256,
        'copyright': 'WordNet 3.0 Copyright 2006 by Princeton University. All rights reserved.',
        'licenseUrl': 'https://wordnet.princeton.edu/license-and-commercial-use',
        'format': 'English glosses, examples and synonyms; semantic pointers omitted.',
        'shards': sorted(shards)}
    (out / 'meta.js').write_text('export const WORDNET = ' + json.dumps(meta, ensure_ascii=False, separators=(',', ':')) + ';\n')
    size = sum(p.stat().st_size for p in out.iterdir())
    print(f'Imported {len(entries):,} headwords/phrases, {meta["senses"]:,} word senses; {size/1024/1024:.1f} MiB, loaded by initial letter.')

if __name__ == '__main__':
    archive = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/tmp/wordlane-wordnet-3.0.tar.gz')
    if not archive.exists():
        with urllib.request.urlopen(URL, timeout=60) as response:
            archive.write_bytes(response.read())
    build(archive)
