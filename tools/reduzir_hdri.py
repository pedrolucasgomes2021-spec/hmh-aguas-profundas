"""Reduz o HDRI do céu (assets/hdri/ceu.hdr) para 512x256 — suficiente para iluminação e reflexos (o three.js desfoca
o mapa em PMREM) e 3x menor. Lê/escreve Radiance RGBE. Rode uma vez; se o arquivo já tiver 512 px de largura, não faz nada.

  python tools/reduzir_hdri.py
"""
import pathlib, re, sys
import numpy as np

ALVO_W = 512
arq = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'hdri' / 'ceu.hdr'
raw = arq.read_bytes()

# --- cabeçalho
m = re.search(rb'\n\n(-Y (\d+) \+X (\d+))\n', raw)
if not m:
    sys.exit('formato .hdr não reconhecido')
h, w = int(m.group(2)), int(m.group(3))
if w <= ALVO_W:
    sys.exit(f'já está em {w}x{h}; nada a fazer')
pos = m.end()

# --- decodifica RGBE com RLE por canal
img = np.zeros((h, w, 4), np.uint8)
for y in range(h):
    assert raw[pos] == 2 and raw[pos + 1] == 2, 'esperava scanline RLE'
    pos += 4
    for c in range(4):
        x = 0
        while x < w:
            n = raw[pos]; pos += 1
            if n > 128:
                n -= 128
                img[y, x:x + n, c] = raw[pos]; pos += 1
            else:
                img[y, x:x + n, c] = np.frombuffer(raw, np.uint8, n, pos); pos += n
            x += n

# --- RGBE -> float linear, média em blocos, float -> RGBE
rgb = img[..., :3].astype(np.float32) * np.exp2(img[..., 3].astype(np.float32) - 136.0)[..., None]
rgb[img[..., 3] == 0] = 0
f = w // ALVO_W
nw, nh = w // f, h // f
rgb = rgb[:nh * f, :nw * f].reshape(nh, f, nw, f, 3).mean(axis=(1, 3))
v = rgb.max(axis=2)
mant, exp = np.frexp(np.maximum(v, 1e-32))
esc = np.where(v < 1e-32, 0, mant * 256.0 / np.maximum(v, 1e-32))
out = np.zeros((nh, nw, 4), np.uint8)
out[..., :3] = np.clip(rgb * esc[..., None], 0, 255).astype(np.uint8)
out[..., 3] = np.where(v < 1e-32, 0, exp + 128).astype(np.uint8)

# --- escreve com RLE simples (blocos literais de até 128 bytes por canal)
buf = bytearray(b'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n' + f'-Y {nh} +X {nw}\n'.encode())
for y in range(nh):
    buf += bytes([2, 2, nw >> 8, nw & 255])
    for c in range(4):
        ch = out[y, :, c].tobytes()
        for i in range(0, nw, 128):
            blk = ch[i:i + 128]
            buf += bytes([len(blk)]) + blk
arq.write_bytes(bytes(buf))
print(f'{w}x{h} ({len(raw) // 1024} KB) -> {nw}x{nh} ({len(buf) // 1024} KB)')
