from pathlib import Path

path = Path(r"C:\Users\Cristian\Documents\imo-deus\src\lib\contracts.ts")
lines = path.read_text(encoding="utf-8").splitlines()
for start, end in ((330, 460),):
    print(f"--- {start}-{end}")
    for i in range(start - 1, min(end, len(lines))):
        print(f"{i+1}:{lines[i]}")
