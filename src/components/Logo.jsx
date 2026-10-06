import { COLORS } from "../lib/tema";

/**
 * A logo da Carvalho Cruz, nas duas formas em que ela existe no arquivo
 * original (brand/logo.jpeg):
 *
 *   "simbolo"     — a laranja "C" com as folhas, sozinha
 *   "assinatura"  — o conjunto: símbolo, o nome e "da nossa fazenda para sua mesa"
 *
 * Os arquivos vivem em `public/` e são recortados por `scripts/extrair-logo.py`.
 * As proporções abaixo acompanham os PNGs: passando só a altura, a largura sai
 * calculada e o `<img>` já reserva o espaço certo — o layout não pula enquanto
 * a imagem carrega.
 *
 * O desenho é laranja e verde-escuro sobre claro. Sobre o verde da barra
 * lateral as folhas sumiriam, então lá se usa `LogoSelo`, que apoia o símbolo
 * num ladrilho claro com o fio dourado da marca em volta.
 */
const ARTE = {
  simbolo: {
    arquivo: "logo-simbolo.png",
    proporcao: 437 / 384,
    alt: "CVC Agro",
  },
  assinatura: {
    arquivo: "logo-cvc.png",
    proporcao: 437 / 384,
    alt: "CVC Agro — produzir, abastecer, fazer crescer",
  },
};

export default function Logo({ variante = "simbolo", altura = 40, decorativa = false, style }) {
  const arte = ARTE[variante] ?? ARTE.simbolo;

  return (
    <img
      src={`${import.meta.env.BASE_URL}${arte.arquivo}`}
      width={Math.round(altura * arte.proporcao)}
      height={altura}
      // Decorativa quando o nome da empresa já está escrito ao lado: repetir
      // "Carvalho Cruz" no leitor de tela só atrapalha.
      alt={decorativa ? "" : arte.alt}
      draggable={false}
      style={{ display: "block", userSelect: "none", ...style }}
    />
  );
}

/** O símbolo num ladrilho claro — para usar sobre o verde da barra lateral. */
export function LogoSelo({ tamanho = 40, raio, style }) {
  return (
    <div
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: raio ?? Math.round(tamanho * 0.28),
        background: COLORS.branco,
        border: `1px solid ${COLORS.dourado}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...style,
      }}
    >
      <Logo altura={Math.round(tamanho * 0.66)} decorativa />
    </div>
  );
}
