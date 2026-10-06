import { useEffect, useRef, useState } from "react";

import { modoSupabase } from "../lib/auth";
import { listarPromotores } from "../lib/promotores";
import { supabase } from "../lib/supabase";
import { COLORS } from "../lib/tema";
import { Btn, Icon } from "./ui";

const JANELA_MS = 2 * 60 * 1000;

const horaCurta = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";

/**
 * Aviso no painel do gestor quando um promotor inicia a rota. Escuta o
 * Realtime de `rotas_promotor` e mostra um cartão com o nome do promotor e o
 * horário de início, que fica na tela até ser dispensado. Só vale para início
 * recente (`iniciada_em` dentro de 2 min), para uma edição qualquer da rota
 * não parecer um início novo.
 */
export default function AvisoRotaIniciada({ aoVer }) {
  const [avisos, setAvisos] = useState([]);
  const nomes = useRef(null);
  const vistos = useRef(new Set());

  useEffect(() => {
    if (!modoSupabase) return undefined;
    let ativo = true;
    listarPromotores()
      .then((lista) => { if (ativo) nomes.current = Object.fromEntries(lista.map((p) => [p.id, p.nome])); })
      .catch(() => {});

    const canal = supabase
      .channel("aviso-rota-iniciada")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rotas_promotor" }, ({ new: r }) => {
        if (!r || r.status !== "em_andamento" || !r.iniciada_em) return;
        if (Date.now() - new Date(r.iniciada_em).getTime() > JANELA_MS) return;
        const chave = `${r.id}|${r.iniciada_em}`;
        if (vistos.current.has(chave)) return;
        vistos.current.add(chave);
        setAvisos((atual) => [
          ...atual,
          { chave, promotor: nomes.current?.[r.promotor_id] ?? "Um promotor", rota: r.nome, hora: horaCurta(r.iniciada_em) },
        ]);
      })
      .subscribe();

    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, []);

  if (!avisos.length) return null;
  const dispensar = (chave) => setAvisos((atual) => atual.filter((a) => a.chave !== chave));

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ position: "fixed", top: "calc(12px + env(safe-area-inset-top))", right: 12, left: 12, zIndex: 300, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end", pointerEvents: "none" }}
    >
      {avisos.map((a) => (
        <div
          key={a.chave}
          style={{ pointerEvents: "auto", width: "min(380px, 100%)", background: COLORS.branco, borderLeft: `4px solid ${COLORS.verde}`, borderRadius: 10, boxShadow: "0 6px 24px rgba(0,0,0,0.18)", padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}
        >
          <Icon name="rota" size={20} color={COLORS.verde} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.cinzaEscuro }}>
              {a.promotor} iniciou a rota às {a.hora}
            </div>
            {a.rota && <div style={{ fontSize: 12.5, color: COLORS.cinza, marginTop: 2 }}>{a.rota}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <Btn style={{ padding: "5px 12px", fontSize: 12.5 }} onClick={() => { aoVer(); dispensar(a.chave); }}>Ver rota</Btn>
              <Btn variant="secondary" style={{ padding: "5px 12px", fontSize: 12.5 }} onClick={() => dispensar(a.chave)}>Dispensar</Btn>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
