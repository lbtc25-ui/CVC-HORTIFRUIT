// Gera supabase/seed.sql a partir de src/lib/seed.js, para os dois não saírem de sincronia.
import { writeFileSync } from "node:fs";
import { dadosIniciais } from "../src/lib/seed.js";

const texto = (v) => (v === null || v === undefined || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const numero = (v) => String(Number(v) || 0);

const linhas = [];
const p = (s = "") => linhas.push(s);

const bloco = (tabela, colunas, itens, valores) => {
  if (!itens.length) return;
  p(`insert into public.${tabela} (${colunas}) values`);
  p(itens.map(valores).join(",\n") + "\non conflict (id) do nothing;");
  p();
};

p("-- ============================================================================");
p("--  Carteira inicial — gerado por scripts/gerar-seed-sql.mjs");
p("--  NÃO edite à mão: edite src/lib/seed.js e rode `npm run seed:sql`.");
p("--");
p("--  São as redes, lojas e produtos reais da distribuidora, extraídos da");
p("--  TABELA COMPRADORES da planilha de gestão. Rode uma vez, depois de");
p("--  schema.sql, para o app na nuvem já abrir sabendo para quem vende.");
p("--");
p("--  `on conflict do nothing` em tudo: rodar de novo não duplica nem");
p("--  sobrescreve o que você já alterou pelo app.");
p("-- ============================================================================");
p();

bloco("redes", "id, nome, telefone, status, criado_em", dadosIniciais.redes, (r) =>
  `  (${texto(r.id)}, ${texto(r.nome)}, ${texto(r.telefone)}, ${texto(r.status)}, ${texto(r.criadoEm)})`
);

bloco("lojas", "id, rede_id, nome, cidade, telefone, status, criado_em", dadosIniciais.lojas, (l) =>
  `  (${texto(l.id)}, ${texto(l.redeId)}, ${texto(l.nome)}, ${texto(l.cidade)}, ${texto(l.telefone)}, ${texto(l.status)}, ${texto(l.criadoEm)})`
);

bloco("fornecedores", "id, nome, telefone, produto, cidade, status, criado_em", dadosIniciais.fornecedores, (f) =>
  `  (${texto(f.id)}, ${texto(f.nome)}, ${texto(f.telefone)}, ${texto(f.produto)}, ${texto(f.cidade)}, ${texto(f.status)}, ${texto(f.criadoEm)})`
);

bloco("produtos", "id, nome, fruta, unidade_venda, kg_por_unidade, preco, estoque, estoque_min, criado_em", dadosIniciais.produtos, (x) =>
  `  (${texto(x.id)}, ${texto(x.nome)}, ${texto(x.fruta)}, ${texto(x.unidadeVenda)}, ${numero(x.kgPorUnidade)}, ${numero(x.preco)}, ${numero(x.estoque)}, ${numero(x.estoqueMin)}, ${texto(x.criadoEm)})`
);

bloco("veiculos", "id, nome, placa, modelo, status, criado_em", dadosIniciais.veiculos, (v) =>
  `  (${texto(v.id)}, ${texto(v.nome)}, ${texto(v.placa)}, ${texto(v.modelo)}, ${texto(v.status)}, ${texto(v.criadoEm)})`
);

bloco("funcionarios", "id, nome, tipo, status, criado_em", dadosIniciais.funcionarios, (f) =>
  `  (${texto(f.id)}, ${texto(f.nome)}, ${texto(f.tipo)}, ${texto(f.status)}, ${texto(f.criadoEm)})`
);

writeFileSync("supabase/seed.sql", linhas.join("\n"));
console.log(
  `supabase/seed.sql gerado — ${dadosIniciais.redes.length} redes, ` +
  `${dadosIniciais.lojas.length} lojas, ${dadosIniciais.produtos.length} produtos, ` +
  `${dadosIniciais.veiculos.length} veículos, ${dadosIniciais.funcionarios.length} funcionários`
);
