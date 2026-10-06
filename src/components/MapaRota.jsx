import { useEffect, useRef, useState } from "react";
import { rotaPorRuas } from "../lib/geo";
import { COLORS } from "../lib/tema";

/**
 * Mapa da rota: o CD e as paradas numeradas na ordem escalada. A linha tenta
 * seguir as ruas de verdade (OSRM, demo pública, gratuita e sem chave); se o
 * serviço falhar ou não achar caminho, cai pra uma linha reta entre os
 * pontos, deixando isso claro na legenda. Leaflet + OpenStreetMap são
 * carregados sob demanda (só quando o mapa é aberto), do mesmo jeito que
 * jsPDF/xlsx no resto do app.
 */
export default function MapaRota({ origem, paradas }) {
  const divRef = useRef(null);
  const mapaRef = useRef(null);
  const [erro, setErro] = useState(null);
  const [porRuas, setPorRuas] = useState(false);

  const semLocalizacao = paradas.filter((p) => p?.lat == null);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const [L] = await Promise.all([
          import("leaflet").then((m) => m.default ?? m),
          import("leaflet/dist/leaflet.css"),
        ]);
        if (cancelado || !divRef.current) return;

        const pontos = [origem, ...paradas].filter((p) => p?.lat != null && p?.lng != null);
        if (pontos.length === 0) {
          setErro("Nenhuma parada com localização calculada ainda.");
          return;
        }

        const mapa = L.map(divRef.current, { scrollWheelZoom: false });
        mapaRef.current = mapa;
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 19,
        }).addTo(mapa);

        const iconeNumerado = (texto, cor) => L.divIcon({
          className: "",
          html: `<div style="background:${cor};color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">${texto}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });

        if (origem?.lat != null) {
          L.marker([origem.lat, origem.lng], { icon: iconeNumerado("CD", COLORS.cinzaEscuro) })
            .addTo(mapa)
            .bindPopup(origem.label ?? "Centro de Distribuição");
        }
        paradas.forEach((p, i) => {
          if (p?.lat == null) return;
          L.marker([p.lat, p.lng], { icon: iconeNumerado(String(i + 1), COLORS.verde) })
            .addTo(mapa)
            .bindPopup(`${i + 1}. ${p.label ?? ""}`);
        });

        const linhaReta = pontos.map((p) => [p.lat, p.lng]);
        let linhaRuas = null;
        try {
          linhaRuas = await rotaPorRuas(pontos);
        } catch {
          linhaRuas = null;
        }
        if (cancelado) return;

        const usaRuas = Boolean(linhaRuas?.length);
        const linhaFinal = usaRuas ? linhaRuas : linhaReta;
        setPorRuas(usaRuas);

        if (linhaReta.length > 1) {
          L.polyline(linhaFinal, { color: COLORS.laranjaEscuro, weight: 4, opacity: usaRuas ? 0.85 : 0.7, dashArray: usaRuas ? null : "6 6" }).addTo(mapa);
          mapa.fitBounds(L.latLngBounds([...linhaReta, ...linhaFinal]), { padding: [30, 30] });
        } else {
          mapa.setView(linhaReta[0], 14);
        }
        requestAnimationFrame(() => mapa.invalidateSize());
      } catch {
        if (!cancelado) setErro("Não foi possível carregar o mapa agora. Verifique a internet e tente de novo.");
      }
    })();

    return () => {
      cancelado = true;
      mapaRef.current?.remove();
      mapaRef.current = null;
    };
  }, [origem, paradas]);

  return (
    <div>
      <div ref={divRef} style={{ width: "100%", height: 360, borderRadius: 12, background: COLORS.creme }} />
      {erro && <div style={{ marginTop: 8, fontSize: 12.5, color: COLORS.cinza }}>{erro}</div>}
      {semLocalizacao.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: COLORS.laranjaEscuro }}>
          Não foi possível localizar no mapa: {semLocalizacao.map((p) => p.label).filter(Boolean).join(", ")}.
          Confira o endereço no cadastro da loja.
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 12, color: COLORS.cinza }}>
        {porRuas
          ? "Traçado estimado pelas ruas (OSRM/OpenStreetMap) — confirme sempre no app de navegação antes de sair."
          : "As linhas são retas, só pra conferir se a ordem faz sentido — não é o trajeto real pelas ruas."} Pra navegar de verdade, use "Abrir no Maps".
      </div>
    </div>
  );
}
