import os
import re
import json
from pathlib import Path
from collections import defaultdict

src = Path('/data/user/0/com.termux/files/home/Disha-/src')
server_file = Path('/data/user/0/com.termux/files/home/Disha-/server.ts')
files = list(src.glob('**/*.ts')) + list(src.glob('**/*.tsx')) + [server_file]

# Find collection and doc strings
col_pattern = re.compile(r'collection\s*\(\s*(?:db|firestore|getDb\(\)|adminDb)\s*,\s*[\'"]([a-zA-Z0-9_\-]+)[\'"]')
doc_pattern = re.compile(r'doc\s*\(\s*(?:db|firestore|getDb\(\)|adminDb)\s*,\s*[\'"]([a-zA-Z0-9_\-]+)[\'"]')

col_refs = defaultdict(set)
file_ops = defaultdict(lambda: defaultdict(list))

ops = {
    'getDoc': re.compile(r'\bgetDoc\s*\(([^;)]+)\)'),
    'getDocs': re.compile(r'\bgetDocs\s*\(([^;)]+)\)'),
    'onSnapshot': re.compile(r'\bonSnapshot\s*\(([^;)]+)\)'),
    'setDoc': re.compile(r'\bsetDoc\s*\(([^;)]+)\)'),
    'addDoc': re.compile(r'\baddDoc\s*\(([^;)]+)\)'),
    'updateDoc': re.compile(r'\bupdateDoc\s*\(([^;)]+)\)'),
    'deleteDoc': re.compile(r'\bdeleteDoc\s*\(([^;)]+)\)'),
    'writeBatch': re.compile(r'\bwriteBatch\s*\('),
    'runTransaction': re.compile(r'\brunTransaction\s*\('),
}

for f in files:
    if not f.exists(): continue
    try:
        content = f.read_text(encoding='utf-8', errors='ignore')
    except Exception:
        continue
    
    for m in col_pattern.finditer(content):
        col_refs[m.group(1)].add(str(f))
    for m in doc_pattern.finditer(content):
        col_refs[m.group(1)].add(str(f))

    for op_name, pat in ops.items():
        for m in pat.finditer(content):
            line_no = content[:m.start()].count('\n') + 1
            snippet = m.group(0)[:100].replace('\n', ' ')
            file_ops[str(f)][op_name].append((line_no, snippet))

print("=== COLLECTIONS REFERENCED IN CODE ===")
for col, flist in sorted(col_refs.items()):
    print(f"{col:25} -> {len(flist):2} files: {', '.join([Path(x).name for x in sorted(flist)[:5]])}")

print("\n=== FILES WITH FIRESTORE OPERATIONS ===")
for fpath, op_dict in sorted(file_ops.items()):
    summary = ", ".join([f"{k}: {len(v)}" for k, v in sorted(op_dict.items())])
    print(f"{Path(fpath).name:35} -> {summary}")

detailed = {
    'collections': {c: list(flist) for c, flist in col_refs.items()},
    'operations_by_file': {f: {op: locs for op, locs in op_dict.items()} for f, op_dict in file_ops.items()}
}
out_path = Path('/data/user/0/com.termux/files/home/Disha-/reports/firestore_audit_raw.json')
out_path.write_text(json.dumps(detailed, indent=2))
print("\nWrote reports/firestore_audit_raw.json")
