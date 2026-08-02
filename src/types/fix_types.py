import re

path = r"C:\Users\huawe\Documents\Kimi\Workspaces\CRF设计\crf-designer\src\types\index.ts"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace the closing of Project interface to add crfPublished fields
old = "  // CRF 设计\n  visits: Visit[]\n  crfModules: CRFModule[]\n}"
new = "  // CRF 设计\n  visits: Visit[]\n  crfModules: CRFModule[]\n  crfPublished?: boolean\n  crfPublishedAt?: string\n}"

if old in content:
    content = content.replace(old, new)
    print("Replaced successfully")
else:
    # Try with \r\n
    old_crlf = old.replace("\n", "\r\n")
    if old_crlf in content:
        content = content.replace(old_crlf, new.replace("\n", "\r\n"))
        print("Replaced with CRLF")
    else:
        print("Pattern not found, showing context around crfModules:")
        idx = content.find("crfModules")
        if idx >= 0:
            print(repr(content[idx-30:idx+60]))
        else:
            print("crfModules not found")
        exit(1)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
