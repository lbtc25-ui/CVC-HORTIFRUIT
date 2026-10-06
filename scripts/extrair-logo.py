#!/usr/bin/env python3
"""
Extrai, do arquivo mestre `brand/logo.jpeg`, os PNGs de marca do app:

  public/logo-carvalho-cruz.png  — assinatura completa (símbolo + nome + selo)
  public/logo-simbolo.png        — só o símbolo (a laranja "C" com as folhas)
  brand/logo-simbolo.png         — o mesmo símbolo em alta, fonte dos ícones

Os dois de `public/` são servidos ao navegador e entram no cache offline do
service worker, então saem reduzidos e com paleta indexada. O de `brand/` fica
fora do bundle: existe só para `scripts/gerar-icones.mjs` ter pixels de sobra.

O fundo branco do JPEG vira transparência. A remoção é feita por preenchimento
a partir da borda — e não por "todo pixel branco" — para preservar os brancos
que fazem parte do desenho (os gomos internos da laranja e o miolo da folha).

Só precisa ser rodado de novo se a logo mestre mudar. Requer Pillow:
    python3 -m pip install --user Pillow
    python3 scripts/extrair-logo.py

Os ícones do PWA saem depois disso, com `npm run icones` (Node puro, sem deps).
"""

from collections import deque
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
MESTRE = RAIZ / "brand" / "logo.jpeg"

# Tolerância do "isto é fundo": o JPEG não tem branco perfeitamente uniforme.
TOLERANCIA = 26


def alpha_por_preenchimento(im: Image.Image) -> Image.Image:
    """Marca como transparente só o fundo conectado às bordas da imagem."""
    largura, altura = im.size
    px = im.load()
    fundo = px[0, 0]

    def e_fundo(c):
        return all(abs(c[i] - fundo[i]) <= TOLERANCIA for i in range(3))

    externo = bytearray(largura * altura)
    fila = deque()

    for x in range(largura):
        for y in (0, altura - 1):
            if not externo[y * largura + x] and e_fundo(px[x, y]):
                externo[y * largura + x] = 1
                fila.append((x, y))
    for y in range(altura):
        for x in (0, largura - 1):
            if not externo[y * largura + x] and e_fundo(px[x, y]):
                externo[y * largura + x] = 1
                fila.append((x, y))

    while fila:
        x, y = fila.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < largura and 0 <= ny < altura:
                i = ny * largura + nx
                if not externo[i] and e_fundo(px[nx, ny]):
                    externo[i] = 1
                    fila.append((nx, ny))

    mascara = Image.frombytes("L", (largura, altura), bytes(255 - v * 255 for v in externo))
    fora = im.copy()
    fora.putalpha(mascara)
    return fora


def recortar(im: Image.Image, caixa, altura_final: int, destino: Path, *, cores=None, indexado=True, margem: int = 6):
    """Recorta uma região, sobra uma margem, reduz com reamostragem e grava.

    Com `cores`, reduz a paleta: corta o peso do arquivo sem diferença visível
    num desenho de poucos tons como este. Em `indexado`, grava a paleta no
    próprio PNG; senão volta para RGBA — o arquivo fica maior, mas legível pelo
    decodificador enxuto do `gerar-icones.mjs`, e o ruído de JPEG some, o que
    faz os ícones gerados a partir dele comprimirem bem melhor.
    """
    x0, y0, x1, y1 = caixa
    pedaco = im.crop(
        (
            max(0, x0 - margem),
            max(0, y0 - margem),
            min(im.width, x1 + 1 + margem),
            min(im.height, y1 + 1 + margem),
        )
    )
    # A máscara binária vira borda suave justamente na redução.
    largura_final = round(pedaco.width * altura_final / pedaco.height)
    pedaco = pedaco.resize((largura_final, altura_final), Image.LANCZOS)
    if cores:
        pedaco = pedaco.quantize(colors=cores, method=Image.FASTOCTREE)
        if not indexado:
            pedaco = pedaco.convert("RGBA")
    destino.parent.mkdir(parents=True, exist_ok=True)
    pedaco.save(destino, "PNG", optimize=True)
    kb = destino.stat().st_size / 1024
    print(f"{destino.relative_to(RAIZ)}  {pedaco.width}x{pedaco.height}  {kb:.1f} KB")


def main():
    original = Image.open(MESTRE).convert("RGB")
    com_alpha = alpha_por_preenchimento(original)

    # Caixas medidas na logo mestre (1254x1254):
    #   símbolo (folhas + laranja "C") .... x 431..810, y 143..730
    #   assinatura inteira ................ x 225..1038, y 143..1083
    simbolo = (431, 143, 810, 730)
    assinatura = (225, 143, 1038, 1083)

    recortar(com_alpha, simbolo, 768, RAIZ / "brand" / "logo-simbolo.png", cores=128, indexado=False)
    recortar(com_alpha, simbolo, 288, RAIZ / "public" / "logo-simbolo.png", cores=128)
    recortar(com_alpha, assinatura, 384, RAIZ / "public" / "logo-carvalho-cruz.png", cores=128)


if __name__ == "__main__":
    main()
