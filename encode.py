#!/usr/bin/env python3
import base64
import zlib

with open('modules.zip', 'rb') as f:
    data = f.read()
    compressed = zlib.compress(data)
    encoded = base64.b64encode(compressed).decode('utf-8')
    
with open('encoded_modules.txt', 'w') as out:
    out.write(encoded)
    
print(f"Encoded data written to encoded_modules.txt (length: {len(encoded)})")
