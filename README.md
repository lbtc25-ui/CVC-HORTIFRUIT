# CVC Hortifruit — Sistema de Gestão

Sistema da **CVC**, derivado do sistema da Distribuidora Carvalho Cruz (mesmos
módulos: vendas, clientes, compras, estoque, financeiro, fiscal, entregas,
promotores e folha), mas **separado**: banco Supabase, usuários e deploy próprios.

## Como a CVC se relaciona com a Carvalho Cruz

Enquanto a CVC é recém-criada, **todas as notas saem no CNPJ da Carvalho Cruz**,
pela conta Spedy da Carvalho (`SPEDY_API_KEY` na Vercel aponta para ela), inclusive
as vendas de produtos da CVC. Uma venda com produtos das duas empresas sai numa
nota só. Notas canceladas, XMLs, devoluções e o SPED dessas notas são da
Carvalho Cruz (o contador dela recebe tudo). O estoque e as despesas continuam
da CVC; o campo "Empresa que emite a nota" do produto fica só informativo até a
CVC ter emissor próprio (`emitenteDaVenda` em `src/lib/spedy.js`).

## Pendente (a combinar)

- Banco novo: rodar `supabase/instalar.sql` num projeto Supabase da CVC e
  **não** importar os dados da Carvalho (`importacao-*.sql`, `correcao-*.sql`).
- Rodar `supabase/migracao-68-cvc-empresa-padrao.sql` no banco da CVC (uma vez só).

---

# Base: Distribuidora Carvalho Cruz

Sistema de gestão empresarial da **Distribuidora Carvalho Cruz**, distribuidora de hortifrútis de **Aracaju-SE**.

Aplicação **React + Vite**, instalável como **PWA**, que **funciona sem internet** (IndexedDB + fila de sincronização) e guarda os dados no **Supabase**.

---

## ✅ Funcionalidades

### 📊 Painel
**Resultado** e margem no topo — não faturamento. Abaixo, o *Painel Gerencial*
da planilha calculado sozinho: receita, despesas, mercadoria, resultado, quilos
vendidos, preço médio e custo médio por quilo. Mais alerta de contas vencidas e
de estoque negativo.

### 🛒 Vendas
O pedido como na planilha: **rede → loja**, produto vendido em saco ou a
granel com a conversão em quilos calculada na hora (60 sacos × 2,5 kg = 150 kg),
**prazo** em dias que define o vencimento, e item marcado como **bonificação**
— que sai do estoque sem entrar no faturamento.

### 🔗 Link de pedido do cliente
Cada loja tem um **link próprio** (ficha da loja, em Clientes: *Copiar link*
ou *Enviar pelo WhatsApp*). O cliente abre no celular, **sem login**, põe a
quantidade de cada produto — ou toca em *Repetir o último pedido* — e envia.
O pedido cai direto em **Vendas**, marcado *Pedido do cliente · conferir*,
com o número na barra lateral. O cliente não vê preço: o pedido entra com o
preço da última venda do produto para aquela loja (ou rede) e o prazo de
sempre; quem confere ajusta o que precisar e toca em **Confirmar pedido**.
Até lá, a NF-e fica bloqueada. Se um link vazar, *Gerar novo link* derruba
o antigo na hora. **Quais produtos aparecem** no link se escolhe no cadastro
da rede (vale para todas as lojas dela — a PETROX sem abóbora, por exemplo)
e, se preciso, no da loja, que então usa a própria lista
([`migracao-23-produtos-por-cliente.sql`](supabase/migracao-23-produtos-por-cliente.sql)). Exige o Supabase e a
[`migracao-21-pedido-cliente.sql`](supabase/migracao-21-pedido-cliente.sql).

**Link da rede**, para o grupo de WhatsApp com os gerentes (ficha da rede, em
Clientes): uma página só com **todas as lojas ativas** da rede. O gerente
toca na loja, põe as quantidades (ou repete o último pedido *daquela* loja) e
pode fazer o mesmo em outras — *Petrox Praia*, *Petrox Aruana*… — antes de
enviar tudo de uma vez. Em **Vendas**, cada loja entra como um **pedido
separado**, com número, preço e prazo próprios. O envio é tudo ou nada: se
uma loja der erro, nenhuma grava. O link da rede e o de cada loja são
independentes (gerar um novo não derruba o outro). Exige a
[`migracao-26-pedido-rede.sql`](supabase/migracao-26-pedido-rede.sql).

**Link geral**, para a equipe (ex.: vendedor externo) — não é ficha de rede
nem de loja: fica no topo da aba **Clientes**, em *Link geral de pedidos*.
Uma página só com **todas as redes e lojas ativas**, com busca por nome; dá
para pedir para várias lojas de redes diferentes de uma vez, cada uma
virando um pedido separado, igual ao link da rede. Só existe **um** link
geral (não um por cliente): *Gerar novo link* troca esse token só, sem
mexer nos links de cada rede ou loja. Como ele mostra o nome de **todo
mundo cadastrado**, é para uso interno — não para repassar ao cliente. Exige
a [`migracao-35-pedido-geral.sql`](supabase/migracao-35-pedido-geral.sql).

**Nome de quem pede.** Nos dois links, a pessoa precisa informar o **nome**
no quadro **Responsável pelo pedido**, logo acima do botão Enviar — sem ele o
pedido não sai (o banco também confere). O nome
aparece em **Vendas**, embaixo do cliente ("Pedido por Maria"), na hora de
conferir e no aviso do celular. O aparelho lembra o último nome usado, para
não digitar de novo a cada pedido. Exige a
[`migracao-29-nome-pedido.sql`](supabase/migracao-29-nome-pedido.sql).

### 👥 Clientes
As redes com suas lojas, agrupadas e ordenadas pelo quanto já compraram. Busca
casa tanto o nome da rede quanto o da loja. Clicando na loja abre o
**histórico**: total comprado, ticket médio, quilos, a receber (com o vencido
em destaque), quebra por produto e a lista de pedidos — sem tabela própria,
é conta em cima das vendas já lançadas.

### 🔔 Previsão de Pedidos
O **ritmo de compra de cada cliente**, tirado das vendas dos últimos 120 dias
— sem tabela nova, é conta em cima dos pedidos. Para cada loja o app acha de
quantos em quantos dias ela pede (a mediana dos intervalos, então um pedido
fora de hora não estraga a conta) e se pede em **dia fixo da semana**
(*Toda quarta*, *Seg e qui*, *A cada ~10 dias*). Com isso prevê o próximo
pedido e o valor típico (a mediana dos últimos 5).

**Alerta de falta de pedido:** quem pede toda quarta e chegou a quinta sem
pedido aparece em vermelho (*Não pediu*, com os dias de atraso e um botão de
WhatsApp já com a mensagem); no próprio dia esperado, ainda sem pedido, fica
em amarelo (*Esperado hoje*). O número na barra lateral e a faixa no Painel
mostram quantos não pediram. **Pedido antecipado não gera alerta:** a
previsão parte sempre do último pedido, então quem pediu na segunda em vez da
quarta já cobriu a semana (aparece como *Antecipou*), e pedido já lançado
para frente conta como feito. Cliente parado há mais de 45 dias sai do alerta
diário e fica no filtro *Pararam*. Inclui a **agenda dos próximos 7 dias**:
quem deve pedir em cada dia e quanto isso soma. Todo dia às 7h45 chega
também **no celular** (ntfy) a lista de quem não pediu e de quem é esperado
hoje — veja [`migracao-55-avisos-celular.sql`](supabase/migracao-55-avisos-celular.sql).

**Sinalizar o alerta.** Em cada alerta (e em cada cliente da tabela), o botão
**Sinalizar** registra o que já foi feito: **Me lembre em…** (o alerta some e
volta no dia escolhido, com o motivo), **Ciente** (some até o próximo pedido)
ou **Parou de pedir** — com o **motivo** obrigatório e, se quiser, a data do
**alerta de reconquista**. Os que pararam (marcados ou sozinhos) ficam em
**Reconquistar clientes**, com o motivo, o último pedido, o pedido típico e o
WhatsApp com uma mensagem de reconquista; no dia marcado voltam aos alertas e
ao aviso do celular. Pedido novo do cliente encerra a sinalização sozinho, e
cada cliente guarda o histórico (quem marcou, quando e por quê). Exige a
[`migracao-56-sinalizacoes-clientes.sql`](supabase/migracao-56-sinalizacoes-clientes.sql).
Conta em
[`src/lib/previsaoPedidos.js`](src/lib/previsaoPedidos.js).

### 🛒 Compras
A mercadoria que entra, por **fruta** e fornecedor, com peso e preço do quilo.
É daqui que sai o **custo médio por quilo** — o número que diz se a venda deu
lucro. A média é ponderada pelo peso, não média de médias.

### 🚚 Fornecedores
Cadastro com produto principal e localidade, em cards, com status ativo/inativo.

### 📦 Estoque
O estoque não é digitado, é conta: **compras − vendas − perdas + acertos**, por fruta.
Cada fruta mostra a conta aberta, e o saldo negativo — saiu mais do que entrou —
aparece em vermelho, com alerta no painel. É aqui que a **perca** é registrada,
já com o custo médio de compra preenchido, e o **acerto de inventário**: você
conta o que existe no depósito e o sistema guarda o que a conta dizia, registrando
a diferença — o acerto fica explicado, em vez de o número simplesmente mudar.

**A venda baixa do estoque quando sai do depósito, não quando é lançada.**
Pedido lançado hoje para carregar amanhã continua no depósito: enquanto ele
estiver *Pendente* no Romaneio (nem escaneado no caminhão, nem marcado como
*Retirado no CD*), os quilos dele aparecem no cartão como **A sair** e
continuam contando no estoque — a contagem do fim do dia bate com o que está
no chão. Quando o QR é lido no carregamento, o pedido baixa. Pedido pendente
com data de antes de ontem é considerado já saído (ninguém escaneou), para o
histórico não inflar o estoque.

**A data do pedido é o dia da entrega.** Na Nova Venda o campo se chama
*Data de entrega*, com atalhos *Hoje* e *Amanhã*: pedido lançado hoje para
entregar amanhã leva a data de amanhã. É por ela que o gráfico de receita por
dia soma e que o Romaneio monta a rota do dia.

**Vendas hoje, no Painel, é o que saiu hoje** — pela confirmação do Romaneio:
QR lido no carregamento (ou rota iniciada hoje) ou pedido marcado como
*Retirado no CD* hoje. Pedido lançado que ainda não foi carregado não entra;
aparece à parte no mesmo cartão, como *a carregar*.

**Lembretes em pop-up, só para o Assistente Administrativo.** Três rotinas do
dia a dia — contagem de insumos, contagem de frutas e conferência de preços,
todas abaixo — não ficam só numa faixa no topo: quando alguma está pendente, o
Painel abre um **pop-up no meio da tela**, que só sai fechando no X ou no botão
*Entendi* (reabre a cada visita ao Painel enquanto continuar pendente). O
**sócio master** não vê esse pop-up — em vez disso, se o assistente não fizer a
tempo (a partir de terça para as rotinas semanais, ou com 1h30 de folga para a
diária), ele recebe o próprio pop-up, **"O assistente ainda não fez"**, com o
que ficou faltando.

**Contagem diária de frutas.** Sem nenhum acerto registrado hoje, a partir das
16h30 o pop-up avisa que falta contar. Opcionalmente, um aviso no celular todo
dia às 16h30 (mesmo tópico ntfy da migração 20) lembra também — veja
[`migracao-32-lembrete-contagem-frutas.sql`](supabase/migracao-32-lembrete-contagem-frutas.sql).

No **Novo Produto** dá para escolher uma fruta que já existe ou cadastrar uma
**nova** na hora, e definir a **empresa** — *Carvalho Cruz* ou *CVC*. A receita
do produto conta para a empresa dele: no Painel e no Financeiro, o filtro de
empresa mostra receita e mercadoria só dela (despesas, combustível e folha são
gerais e ficam em *Todas as empresas*). Como o estoque é da fruta, uma fruta
pertence a uma empresa só: para vender a mesma fruta pelas duas, cadastre-a com
outro nome (ex.: *Laranja Pera revenda*). O lápis ao lado de cada produto abre a
**edição** (nome, fruta, empresa, saco/agranel); trocar a empresa de um produto
leva junto os outros produtos da mesma fruta. As frutas cadastradas depois das
três de sempre também podem ser **renomeadas** pelo lápis no cartão de estoque —
o nome muda em produtos, compras, perdas e acertos. O app cadastra só frutas para
venda — caixas, etiquetas e grampos vão direto no Spedy para fins de nota fiscal
(veja **Insumos de Produção**, abaixo, para o estoque deles). Só as frutas da
Carvalho Cruz têm estoque: as da CVC (revenda) ficam fora dos cartões, das compras,
das perdas e das contagens. Produto nunca vendido pode ser excluído pela edição. Cada produto tem os **dados da nota fiscal**
(NCM, CFOP, unidade, origem, CST de ICMS/PIS/COFINS); sem a tributação o app não
emite a nota, e a coluna *Nota fiscal* da lista mostra o que falta. O cadastro não tem preço:
ele varia muito e é digitado em cada venda. Exige a
[`migracao-27-empresa-produto.sql`](supabase/migracao-27-empresa-produto.sql).

**Insumos de Produção.** Redinha, grampo e etiqueta (2,5 kg, 3 kg, 5 kg e 10 kg) —
o que embala o sanquinho de laranja. Diferente da fruta, não tem compra/venda
lançada para virar conta: o saldo de cada item é a **última contagem física**
registrada. **Registrar Contagem** abre uma linha por item de uma vez, como se
faz no depósito — só o que tiver quantidade entra no histórico. Cada item tem um
**estoque mínimo** (editável no cartão, começa em 0 = sem alerta); abaixo dele o
item fica em vermelho e soma no número da aba Estoque na barra lateral, além de
entrar no pop-up. Sem contagem alguma desde a segunda-feira da semana (a partir
das 16h), o pop-up avisa que a contagem está pendente. Opcionalmente, um aviso
no celular toda segunda às 16h (mesmo tópico ntfy da migração 20) lembra de
contar. Exige a
[`migracao-31-insumos-producao.sql`](supabase/migracao-31-insumos-producao.sql).

**Preços da Semana.** A conferência de toda segunda-feira, **por produto** — o
agranel e cada saco (2,5 kg, 3 kg, 5 kg, 10 kg) têm preço próprio, não um preço
só por fruta. Não é o preço da venda (esse continua digitado em cada uma,
varia por cliente): é a referência que orienta quem vende. **Conferir Preços**
abre uma linha por produto de uma vez, já preenchida com o valor da última
conferência — deixe como está para **confirmar**, ou mude para **ajustar**; o
que não mudar continua valendo. Sem conferência alguma desde a segunda-feira
da semana (a partir das 7h), o pop-up avisa. Opcionalmente, um aviso no
celular toda segunda às 7h (mesmo tópico ntfy da migração 20) lembra de
conferir. Exige a
[`migracao-33-lembrete-preco-frutas.sql`](supabase/migracao-33-lembrete-preco-frutas.sql)
e, para o preço passar a ser por produto (agranel e sacos),
[`migracao-34-precos-por-produto.sql`](supabase/migracao-34-precos-por-produto.sql).

### 💸 Despesas
As oito categorias da aba NÃO MEXER numa lista só, com a categoria como campo.
Quanto saiu de cada uma, e quanto pesa no total.

**Comprovante de pagamento.** Cada despesa pode levar o PDF ou a foto que o
banco gerou. Ao anexar um PDF, o app lê **valor, data e favorecido** e
preenche o formulário; falta só escolher a categoria. Foto e print também são lidos
(OCR em português, no próprio aparelho; PDF escaneado idem). O leitor de imagens
(~5 MB, tesseract.js) só é baixado quando alguém anexa uma imagem; `scripts/copiar-ocr.mjs`
os copia para `public/ocr` antes do `dev` e do `build`. Se a leitura errar, a tela
mostra *Ver o texto que o app leu*. O arquivo fica num bucket privado e abre pelo link **Ver** na lista.
Exige a [`migracao-54-comprovante-despesa.sql`](supabase/migracao-54-comprovante-despesa.sql).

**A categoria escolhe onde o lançamento cai.** *Fretes, Manutenção, Investimentos,
Impostos* e *Outros* viram despesa. *Salários e diárias* grava um
pagamento da folha (funcionário) e *Compra de mercadoria* grava uma compra (fruta,
fornecedor, kg — o custo por kg sai do valor pago ÷ peso, e dá para corrigir).
Cada um entra uma vez só, na tabela dele, então o DRE não conta em dobro. Para o
comprovante ficar junto de compra, combustível e folha, rode também a
[`migracao-57-comprovante-outros-lancamentos.sql`](supabase/migracao-57-comprovante-outros-lancamentos.sql).

**Diesel: o comprovante quita abastecimentos, não cria outro.** O combustível é
lançado a cada abastecimento (aba *Combustível*) e o posto é pago de 15 em 15
dias. Por isso a categoria **Pagamento do posto (combustível)** mostra os
abastecimentos *em aberto*, marca sozinha a sequência cuja soma bate com o valor
pago e deixa você ajustar. Só registra se a soma fechar (diferença de até R$ 0,05).
Ao registrar, cada abastecimento marcado fica *pago* naquela data, com o
comprovante, e **nenhuma despesa nova entra** — o custo já está no resultado desde o
dia do abastecimento, então não há duplicidade; quitar duas vezes não é possível.
Na aba *Combustível* há a coluna **Posto** (em aberto / pago + comprovante), o
indicador **A pagar ao posto** e o link *desfazer*, que reabre a quinzena toda e
devolve o comprovante para a caixa de entrada. Para dar baixa no histórico que já
foi pago antes disto, veja o comentário da
[`migracao-57`](supabase/migracao-57-comprovante-outros-lancamentos.sql).

**Enviar pelo Atalho do iPhone.** O iPhone não deixa um PWA aparecer na folha
de compartilhar, então o caminho é um Atalho (app *Atalhos*) que aparece lá:
no app do banco, *Compartilhar → Enviar comprovante*. O arquivo cai na
**caixa de entrada** de Despesas ("Comprovantes recebidos"); você toca em
**Lançar**, confere o valor e escolhe a categoria. Nada vira despesa sozinho.

Configuração (uma vez):
1. Vercel → Environment Variables: `COMPROVANTE_TOKEN` (uma senha longa e
   aleatória), `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API
   Keys) e, se não houver, `SUPABASE_URL`. Sem prefixo `VITE_`. Faça um novo deploy.
2. Rode a migração 54.
3. No iPhone, app **Atalhos** → **+** novo atalho, nome *Enviar comprovante*:
   - Toque no **(i)** → ative **Mostrar na Folha de Compartilhamento** e, em
     *Tipos aceitos*, deixe só **Imagens** e **PDFs**.
   - Ação **Se** *Entrada compartilhada* **é** *Imagem*: dentro dela, ação
     **Converter Imagem** → **JPEG** (a foto do iPhone é HEIC, que o servidor recusa).
     Feche com **Fim do Se**.
   - Ação **Obter Conteúdo do URL**: URL `https://SEU-DOMINIO/api/comprovante`,
     Método **POST**, Cabeçalho `Authorization` = `Bearer SUA-SENHA`,
     Corpo da Solicitação **Arquivo** → a imagem convertida (ou a *Entrada
     compartilhada*, se for PDF).
   - Ação **Mostrar Notificação** com o *Conteúdo do URL* — mostra "ok" ou o erro.
4. No app do banco: **Compartilhar** → role até o fim da lista de ações →
   **Enviar comprovante**.

Limite de 4 MB por arquivo (limite da Vercel). Quem tiver a senha do Atalho
consegue mandar arquivos para a caixa — troque `COMPROVANTE_TOKEN` na Vercel
se o celular for perdido.

### ⛽ Combustível e Veículos
A aba DESPESAS → COMBUSTIVEIS da planilha, com a frota (Sprinter, Strada, HR)
cadastrada à parte. Cada abastecimento leva motorista, tipo de combustível,
litros, preço do litro e o **km atual do odômetro** — não a dupla KM INICIAL /
KM FINAL da planilha. O **km rodado** sai sozinho, da diferença para o
abastecimento anterior do mesmo veículo, e dele saem o **km/l** e o
**custo por km**. Entra no DRE como despesa, junto de "Despesas".

### 🧑‍🌾 Folha de Pagamento
As abas DIARISTAS e FUNCIONARIOS FIXOS da planilha, por nome — não mais uma
linha genérica de "Diaristas" ou "Funcionários" em Despesas. Cadastra-se a
pessoa (diarista, pago por dia/serviço, ou funcionário, registrado/fixo) e
lança-se o pagamento com data, descrição livre e valor. O ranking "Por
Pessoa" mostra quem mais recebeu no acumulado. Entra no DRE como despesa,
junto de "Despesas" e "Combustível".

### 💰 Financeiro
**Resultado por mês**: receita − despesas − mercadoria, com margem, quilos e
preço médio — o DRE da planilha. Mais recebido × a receber, vencido, ticket
médio e **contas a receber ordenadas por quem vence primeiro**. A mesma
tabela também em **gráfico**: receita, despesas e resultado numa linha por
mês, e quilos vendidos numa barra — SVG inline, sem biblioteca de gráfico,
com legenda e tooltip ao passar o mouse.

### 📞 Cobrança
Todo dia, as **vendas a prazo que venceram na véspera**, uma por linha, para
confirmar com o cliente: **Foi paga** baixa a venda; **Não foi paga** deixa
a venda pendente e marca a conta como conferida — ela passa a aparecer como
"cobrar". Dá para escolher outro dia de vencimento (na segunda, conferir o
que venceu no sábado), e o que venceu antes e ninguém conferiu aparece logo
abaixo, para não se perder. O número na barra lateral é o que falta conferir.

### 📤 Exportação de Relatórios
Vendas e o Financeiro (Resultado por Mês + Contas a Receber) exportam para
**.xlsx** e **PDF** com um clique — o que está na tela vira arquivo, com o
mesmo filtro aplicado. As bibliotecas (xlsx, jsPDF) só entram no download do
navegador quando alguém exporta: não pesam no app instalado nem no cache
offline do PWA.

### 🔄 Sincronização
Estado da conexão, fila de envio, operações que falharam (com o erro) e ações
de sincronizar, reenviar e recarregar da nuvem.

### 📍 Promotores
Os promotores organizam o expositor de laranja loja a loja, e a aba dá ao
gestor visão em tempo real de onde cada um está. Um sócio master ou
assistente monta a **rota** do dia: escolhe o promotor, e os
estabelecimentos — puxados do cadastro de lojas, digitados livres, ou
sugeridos pelas **lojas com venda nos últimos dias** (3 a 30, ajustável, um
clique adiciona) — na ordem da visita, marcando os que forem **prioridade**
com a estrela. No aparelho do promotor, a aba **Minha Rota** mostra o botão
**Iniciar rota**; em cada parada, a sequência é sempre a mesma — **foto da
fachada** (libera o início do trabalho ali), **foto de antes** e **foto de
depois** — e só com as três enviadas o próximo destino aparece: até lá, ele
some da lista, reduzido a "Parada 3 de 6 — revelada ao concluir a atual".
A aba **Promotores**, do lado do gestor, atualiza sozinha conforme cada foto
sobe (Supabase Realtime): status de cada parada, horário de chegada e de
saída, quanto tempo ficou em cada loja e quanto levou de deslocamento até a
próxima, e as fotos, uma a uma. Exige o Supabase configurado — é ele que
guarda as fotos e distribui as atualizações; sem ele, as duas telas mostram
um aviso em vez de travar. Veja
[`supabase/migracao-08-promotores.sql`](supabase/migracao-08-promotores.sql)
e [`supabase/migracao-09-promotores-prioridade.sql`](supabase/migracao-09-promotores-prioridade.sql).

### 🔐 Login e acesso
Tela de entrada com e-mail e senha; três papéis — **Sócio Master** (acesso
total, inclusive compra, venda e o cadastro de usuários; travado aos e-mails
dos sócios), **Assistente Administrativo** (vendas, clientes, fornecedores,
estoque, financeiro e as rotas de promotor, sem excluir registros nem
gerenciar usuários) e **Promotor** (só a própria rota de visitas, sem acesso
a venda, cliente, estoque ou financeiro); cadastro e desativação de contas
pela aba **Usuários** (só sócio master); troca da própria senha pelo menu do
topo. Com o Supabase configurado, a senha é verificada pelo Supabase Auth e
o acesso aos dados é reforçado por RLS no Postgres — veja
[`supabase/auth.sql`](supabase/auth.sql). Sem o Supabase, as contas ficam no
IndexedDB do aparelho.

---

## 🛠️ Tecnologias

| Tecnologia | Uso |
|---|---|
| React 19 + Vite | Base da aplicação |
| Supabase (PostgreSQL) | Banco de dados na nuvem |
| IndexedDB | Banco local — o app abre e opera sem internet |
| vite-plugin-pwa + Workbox | Instalação no celular e cache do app |
| CSS-in-JS (estilos inline) | Estilização com tokens de cor |
| SVG inline | Ícones e gráficos, sem biblioteca de gráfico |
| xlsx (SheetJS) + jsPDF | Exportação de relatórios — carregadas só ao clicar em "Exportar" |
| Vercel | Hospedagem |

---

## 📁 Estrutura

```
api/               Vercel Functions — comprovante.js (recebe o comprovante do Atalho do iPhone), spedy.js (NF-e emitidas, em uso), sefaz.js (NF-e recebidas,
                   direto na SEFAZ com o certificado A1; peças puras em _lib/dfe.js),
                   omie.js (integração anterior, mantida só de referência)
src/
├─ components/     UI reutilizável (ui.jsx), status de sync, instalar, erros, MenuUsuario,
│                  LeitorQR (câmera do escaneio, aba Romaneio)
├─ contexts/       AuthProvider — sessão de quem está logado
├─ pages/          Login, Usuarios (cadastro de acesso), Sincronizacao,
│                  Promotores (rotas, visão do gestor), MinhaRota (promotor),
│                  PedidoCliente (página pública do link de pedido, /pedido/<token>),
│                  PedidoRede (link da rede, /pedido/rede/<token>: várias lojas, um pedido por loja),
│                  PedidoGeral (link geral, /pedido/geral/<token>: todas as redes e lojas, um pedido por loja),
│                  NotasFiscais (Emitidas) + NotasRecebidas + Devolucoes
├─ hooks/          useDados (dados + offline), useSyncStatus, useOnlineStatus, useLeitorQR (câmera)
├─ lib/            supabase, db (IndexedDB), sync, mappers, seed, tema, datas, auth,
│                  permissoes, senha, promotores (rotas — fala direto com o Supabase),
│                  qr (geração do QR da nota)
├─ distribuidora-carvalho-cruz.jsx   Os módulos de tela
├─ App.jsx         Casca: PWA, proteção contra erros e o portão de login
└─ main.jsx
supabase/
├─ schema.sql                  Tabelas, índices e políticas de acesso
├─ migracao-01-redes-lojas.sql  clientes → rede/loja, prazo, vencimento
├─ migracao-02-compras.sql      views de custo médio e estoque por fruta
├─ migracao-03-perdas-estoque.sql  perdas e o estoque como conta
├─ migracao-04-despesas-dre.sql    despesas e as views do DRE
├─ migracao-05-acertos.sql        acerto de inventário no saldo
├─ migracao-06-combustivel.sql    km rodado, km/l e custo/km por veículo
├─ migracao-07-folha-pagamento.sql  folha de diaristas e funcionários por nome
├─ migracao-08-nfe.sql            CNPJ/endereço do destinatário, NCM e status da NF-e
├─ migracao-09-omie-ids.sql       Códigos internos do Omie (cliente, produto, CFOP)
├─ auth.sql                    Login por e-mail e senha: tabela de perfis, papéis e RLS
├─ migracao-08-promotores.sql  Rotas de promotor: tabelas, fotos (storage) e tempo real
├─ migracao-11-cadastro-clientes.sql  Ficha do cliente: razão social, CNPJ, IE, endereço (usa cnpj_cpf/ie da NF-e)
├─ migracao-12-cobranca.sql     Conferência de cobrança: marca a venda vencida já conferida
├─ migracao-13-salario-funcionarios.sql  Salário (ou valor da diária) no cadastro de cada pessoa da folha
├─ migracao-14-romaneio.sql    romaneio: veículo, motorista e status da entrega em vendas
├─ migracao-15-historico-folha.sql  Nome de quem recebeu guardado no pagamento (histórico de removidos) e horas extras
├─ migracao-16-funcoes-usuarios.sql  Função (Gerente, Administrativo, Serviços Gerais, Motorista) e usuário do sistema de cada pessoa da folha
├─ migracao-17-acesso-usuarios.sql  Abas e exclusão por usuário, e excluir usuário pela aba Usuários
├─ migracao-18-romaneio-prioridade.sql  Prioridade, retirada no CD e o dia da viagem separado do dia do pedido
├─ migracao-19-motorista.sql   Papel Motorista: as próprias entregas do romaneio, Maps e leitura do QR
├─ migracao-20-notificacao-pedidos.sql  Aviso no celular (app ntfy) a cada pedido novo
├─ migracao-21-pedido-cliente.sql  Link de pedido do cliente: token por loja e as funções públicas
├─ migracao-22-geolocalizacao-lojas.sql  Latitude/longitude da loja, pro romaneio ordenar por proximidade e desenhar o mapa
├─ migracao-23-produtos-por-cliente.sql  Quais produtos aparecem no link de cada rede/loja
├─ migracao-24-senha-usuarios.sql  Sócio master define a senha de outra conta pela aba Usuários
├─ migracao-25-notas-entrada.sql  NF-e recebidas com entrada dada e notas de devolução
├─ migracao-26-pedido-rede.sql  Link de pedido da rede: todas as lojas num link, um pedido por loja
├─ migracao-27-empresa-produto.sql  Empresa do produto (Carvalho Cruz / CVC) e frutas novas
├─ migracao-28-produtos-cvc-fiscal.sql  Tributação por produto e as frutas do Omie (CVC)
├─ tributacao-cvc-omie.sql      CFOP/CST das frutas da CVC, tirados das NF-e que o Omie já emitiu
├─ migracao-29-nome-pedido.sql   Nome obrigatório de quem faz o pedido pelo link
├─ correcao-2026-09-26-tangerina-pokan.sql  Junta a "TANGERINA POKAN" repetida na Tangerina Ponkan
├─ migracao-30-nfe-recebidas-sefaz.sql  NF-e recebidas trazidas direto da SEFAZ (nfe_recebidas)
├─ migracao-31-insumos-producao.sql  Estoque de redinha, grampo e etiquetas por contagem física, com aviso semanal opcional
├─ migracao-32-lembrete-contagem-frutas.sql  Aviso diário (16h30) opcional para contar o estoque de frutas
├─ migracao-33-lembrete-preco-frutas.sql  Conferência semanal de preços, com aviso opcional (segunda 7h)
├─ migracao-34-precos-por-produto.sql  A conferência de preços vira por produto — agranel e cada saco, não só por fruta
├─ migracao-35-pedido-geral.sql  Link geral de pedidos: um token só, com todas as redes e lojas ativas
├─ migracao-36-carregamento-completo.sql  Entrega só depois da viagem inteira carregada
├─ migracao-36-desfazer-escaneio.sql  Motorista desfaz um escaneio errado, voltando um passo
├─ migracao-37-iniciar-rota.sql  Botão "Iniciar rota": separa carregar de sair do CD
├─ migracao-38-desfazer-carregando.sql  Desfazer escaneio ajustado ao status "carregando" da 37
├─ migracao-39-viagem-rota.sql  2ª viagem do mesmo veículo no mesmo dia (viagem_rota), sem trocar de veículo pra escalar uma 2ª saída
├─ migracao-40-iniciar-rota-por-viagem.sql  "Iniciar rota" (da 37) passa a ser por veículo+viagem, não mais o dia inteiro do motorista
├─ migracao-41-notificacao-entrega.sql  Aviso no celular (ntfy) a cada escaneio: saiu para entrega / entrega realizada
├─ migracao-42-arquivar-rota.sql  Botão "Arquivar rota" no Romaneio: some da tela uma rota com tudo entregue, sem apagar nada
├─ migracao-43-observacao-nf.sql  Campo "Observação" da Nova Venda, que sai nas informações complementares da NF-e
├─ migracao-44-metas.sql         Aba Metas (só sócio master): metas diária, semanal, mensal e anual de faturamento, kg e sacos, no geral e por fruta
├─ migracao-45-unidades-insumos.sql  Insumos contados na unidade de compra: redinha em rolos de 1.000 m, grampo e etiquetas em milheiros
├─ migracao-46-continuar-rota.sql  "Continuar hoje": rota que o motorista não terminou passa as entregas que sobraram para o dia seguinte
├─ migracao-47-metas-por-empresa.sql  Metas separadas por empresa: Carvalho Cruz e CVC têm metas próprias
├─ migracao-48-arquivar-rota-promotor.sql  Botão "Arquivar" nas rotas de promotor concluídas
├─ migracao-55-avisos-celular.sql  Painel dos avisos no celular, aviso diário de falta de pedido e lembretes que só tocam quando falta
├─ migracao-56-sinalizacoes-clientes.sql  "Me lembre", "ciente" e "parou de pedir" (com motivo e reconquista) na Previsão de Pedidos
├─ migracao-58-acoes-promotor.sql  "Ações" lançadas para o promotor (evento em loja, divulgação) com foto e observação ao concluir
├─ migracao-59-aviso-rota-promotor.sql  Aviso no celular (ntfy) quando um promotor inicia a rota
├─ seed.sql                     Carteira inicial: 21 redes, 63 lojas (gerado)
├─ historico-compras.sql        As 6 compras de ago/set da planilha
├─ importacao-clientes-omie.sql   Cadastro de clientes vindo do Omie (gerado)
scripts/           Geradores de ícones, do seed.sql e das importações
```

---

## 🚀 Como rodar

```bash
npm install
cp .env.example .env.local   # preencha com os dados do seu projeto Supabase
npm run dev
```

O app abre em `http://localhost:5173`. **Sem o `.env.local` ele roda em modo local**: tudo funciona, com dados de demonstração salvos apenas no navegador.

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (acessível pelo IP na rede local) |
| `npm run build` | Build de produção em `dist/` |
| `npm run preview` | Serve o build — é aqui que o service worker do PWA funciona |
| `npm run lint` | ESLint |
| `npm run icones` | Regera os ícones PNG do PWA |
| `npm run seed:sql` | Regera `supabase/seed.sql` a partir de `src/lib/seed.js` |
| `python3 scripts/importar-planilha.py <arquivo.xlsx>` | Lê a planilha e gera `supabase/importacao-planilha.sql` (precisa de `pip3 install openpyxl`) |
| `python3 scripts/importar-clientes-omie.py <arquivo.csv>` | Lê o cadastro de clientes exportado do Omie e gera `supabase/importacao-clientes-omie.sql` |

---

## 🗄️ Configurar o Supabase

No painel do Supabase, abra **SQL Editor → New query** e rode os arquivos
**nesta ordem**, um de cada vez. A ordem importa: cada um usa colunas que o
anterior cria.

| # | Arquivo | O que faz |
|---|---|---|
| 1 | [`schema.sql`](supabase/schema.sql) | Cria as tabelas. Idempotente. |
| 2 | [`migracao-01-redes-lojas.sql`](supabase/migracao-01-redes-lojas.sql) | Move `clientes` para rede/loja, acrescenta prazo e vencimento, cria as views de venda. |
| 3 | [`migracao-02-compras.sql`](supabase/migracao-02-compras.sql) | Views de custo médio e estoque por fruta. |
| 4 | [`migracao-03-perdas-estoque.sql`](supabase/migracao-03-perdas-estoque.sql) | Perdas, e o estoque virando conta. |
| 5 | [`migracao-04-despesas-dre.sql`](supabase/migracao-04-despesas-dre.sql) | Despesas e as views do DRE. |
| 5b | [`migracao-05-acertos.sql`](supabase/migracao-05-acertos.sql) | Acerto de inventário entrando no saldo. |
| 5c | [`migracao-06-combustivel.sql`](supabase/migracao-06-combustivel.sql) | Km rodado, km/l e custo/km por veículo; combustível somado ao DRE. |
| 5d | [`migracao-07-folha-pagamento.sql`](supabase/migracao-07-folha-pagamento.sql) | Folha de diaristas e funcionários por nome, somada ao DRE. |
| 5e | [`migracao-08-nfe.sql`](supabase/migracao-08-nfe.sql) | CNPJ/IE/endereço nas lojas, NCM nos produtos, status da NF-e nas vendas. |
| 5f | [`migracao-09-omie-ids.sql`](supabase/migracao-09-omie-ids.sql) | Código de cliente/produto do Omie, CFOP e unidade por produto. |
| 6 | [`auth.sql`](supabase/auth.sql) | Liga o login por e-mail/senha e troca as políticas abertas por RLS baseado em papel — veja [Sobre segurança](#-sobre-segurança). |
| 6b | [`migracao-08-promotores.sql`](supabase/migracao-08-promotores.sql) | Rotas de promotor: tabelas, bucket de fotos e tempo real. Precisa rodar depois do `auth.sql` — usa o papel "promotor" que ele cria. |
| 6c | [`migracao-11-cadastro-clientes.sql`](supabase/migracao-11-cadastro-clientes.sql) | Ficha cadastral de redes e lojas: razão social, CNPJ/CPF (mesmas colunas `cnpj_cpf`/`ie` da NF-e), inscrição estadual, contato, e-mail e endereço completo. Rode antes de publicar a versão do app que traz a ficha — sem as colunas, as gravações de rede e loja ficam presas na fila de Sincronização. |
| 6d | [`migracao-12-cobranca.sql`](supabase/migracao-12-cobranca.sql) | Coluna `cobranca_conferida_em` nas vendas, usada pela aba Cobrança para lembrar que uma conta vencida já foi conferida. Rode antes de publicar a versão do app que traz a aba — sem a coluna, as gravações de venda ficam presas na fila de Sincronização. |
| 6e | [`migracao-14-romaneio.sql`](supabase/migracao-14-romaneio.sql) | Romaneio: veículo, motorista, status e horários da entrega em `vendas`. |
| 6f | [`migracao-13-salario-funcionarios.sql`](supabase/migracao-13-salario-funcionarios.sql) | Salário (ou valor da diária) no cadastro de cada pessoa da folha. |
| 6g | [`migracao-15-historico-folha.sql`](supabase/migracao-15-historico-folha.sql) | Nome e tipo de quem recebeu guardados em cada pagamento (o histórico mantém quem foi removido) e horas extras separadas do salário. Rode antes de publicar a versão do app que traz o histórico — sem as colunas, os pagamentos ficam presos na fila de Sincronização. |
| 6h | [`migracao-16-funcoes-usuarios.sql`](supabase/migracao-16-funcoes-usuarios.sql) | Função de cada pessoa da folha (o romaneio oferece só quem é Motorista) e o vínculo com a conta de acesso (`perfis`). Depois do `auth.sql`. Rode antes de publicar a versão do app que traz os campos. |
| 6i | [`migracao-17-acesso-usuarios.sql`](supabase/migracao-17-acesso-usuarios.sql) | Ajuste de acesso por pessoa (abas que o assistente vê e se ele exclui registros, com a exclusão conferida também no RLS) e a função `excluir_usuario`, que apaga a conta do Auth pela aba Usuários. Depois do `auth.sql` — e rode de novo se rodar o `auth.sql` outra vez, porque ele recria as políticas de exclusão só para o sócio master. |
| 6j | [`migracao-18-romaneio-prioridade.sql`](supabase/migracao-18-romaneio-prioridade.sql) | Prioridade fixa no topo da rota, retirada no CD (sem veículo) e o dia da viagem (`rota_data`) separado do dia do pedido — resolve pedido de ontem que só sai hoje. Rode antes de publicar; sem as colunas, as gravações de venda ficam presas na fila de Sincronização. |
| 6k | [`migracao-09-promotores-prioridade.sql`](supabase/migracao-09-promotores-prioridade.sql) | Acrescenta a marcação de prioridade nas paradas da rota do promotor. |
| 6l | [`migracao-19-motorista.sql`](supabase/migracao-19-motorista.sql) | Papel Motorista. Ele não lê as tabelas do negócio: as funções `minhas_entregas(dia)` e `registrar_escaneio(venda)` devolvem e atualizam só as vendas em que ele foi escalado (pela pessoa da folha ligada à conta), pelo dia da viagem e com as prioritárias no topo. Depois do `auth.sql`, da 14, da 16 e da 18. |
| 6m | [`migracao-20-notificacao-pedidos.sql`](supabase/migracao-20-notificacao-pedidos.sql) | Aviso no celular a cada pedido novo, pelo app gratuito **ntfy**: um gatilho em `vendas` avisa número, cliente, valor, quilos e quem lançou. Só pedidos que entram pelo app — importações rodadas no SQL Editor e edições não avisam. Depois de rodar, grave o tópico com o `update` do cabeçalho do arquivo e se inscreva nele no ntfy. Opcional, e roda em qualquer ordem depois do `schema.sql`. |
| 6n | [`migracao-21-pedido-cliente.sql`](supabase/migracao-21-pedido-cliente.sql) | Link de pedido do cliente: token por loja (`lojas.token_pedido`), `origem`/`observacao`/`aguardando_conferencia` em `vendas` e as funções `pedido_cliente_abrir`, `pedido_cliente_enviar` (liberadas para a chave anon — é só por elas que o cliente entra) e `renovar_link_pedido`. Depois do `auth.sql`. Rode antes de publicar a versão do app que traz o link — sem as colunas, as gravações de venda ficam presas na fila de Sincronização. Se usa a 20, rode-a de novo depois para o aviso dizer "Pedido do cliente". |
| 6o | [`migracao-22-geolocalizacao-lojas.sql`](supabase/migracao-22-geolocalizacao-lojas.sql) | `lat`/`lng` em `lojas`, geocodificados uma vez a partir do endereço (Nominatim/OpenStreetMap) e guardados — o romaneio usa pra ordenar por proximidade do CD e desenhar o mapa da rota. Rode antes de publicar a versão do app que traz isso; sem as colunas, as gravações de loja ficam presas na fila de Sincronização. |
| 6p | [`migracao-23-produtos-por-cliente.sql`](supabase/migracao-23-produtos-por-cliente.sql) | Produtos que aparecem no link de pedido: `produtos_pedido` em `redes` (vazio = todos) e em `lojas` (vazio = os da rede), e as funções do link respeitando a lista. Depois da 21. Rode antes de publicar a versão do app que traz a escolha — sem as colunas, as gravações de rede e loja ficam presas na fila de Sincronização. |
| 6q | [`migracao-24-senha-usuarios.sql`](supabase/migracao-24-senha-usuarios.sql) | A função `definir_senha_usuario`, que deixa o sócio master gravar uma senha nova para outra conta pela aba Usuários (botão **Senha**), sem depender de e-mail. Depois do `auth.sql`. |
| 6r | [`migracao-25-notas-entrada.sql`](supabase/migracao-25-notas-entrada.sql) | Tabela `notas_entrada`: as NF-e recebidas às quais se deu entrada (compra, devolução de cliente ligada à venda, outra) e as notas de devolução emitidas pela distribuidora — veja [Notas recebidas e devoluções](#-notas-recebidas-e-devoluções). Funciona com ou sem o `auth.sql`. Rode antes de publicar a versão do app que traz as abas Recebidas/Devoluções — sem a tabela, as entradas ficam presas na fila de Sincronização. |
| 6s | [`migracao-26-pedido-rede.sql`](supabase/migracao-26-pedido-rede.sql) | Link de pedido da rede: token por rede (`redes.token_pedido`) e as funções `pedido_rede_abrir` / `pedido_rede_enviar` (liberadas para a chave anon), que gravam um pedido separado para cada loja ativa da rede, e `renovar_link_pedido_rede`. Também passa o link da loja a usar as mesmas peças internas, sem mudar o comportamento (inclusive o filtro de produtos da 23). Depois da 21 e da 23. |
| 6t | [`migracao-27-empresa-produto.sql`](supabase/migracao-27-empresa-produto.sql) | Empresa do produto: `produtos.empresa` (`carvalho_cruz`, o padrão, ou `cvc`), para a receita da revenda não se misturar com a da produção própria. Tira a lista fixa de frutas (Laranja Pera, Laranja Lima, Abóbora) de produtos, compras, perdas e acertos — a fruta nova nasce no cadastro de produto —, refaz a `vw_estoque_fruta` para listar toda fruta do banco e cria a `vw_receita_empresa_mes` (receita e mercadoria por empresa, mês a mês). Rode antes de publicar a versão do app que traz o campo Empresa — sem a coluna, as gravações de produto ficam presas na fila de Sincronização. |
| 6u | [`migracao-28-produtos-cvc-fiscal.sql`](supabase/migracao-28-produtos-cvc-fiscal.sql) | Tributação por produto (`origem`, `icms_cst`, `pis_cst`, `cofins_cst`, `cest`, `ean`, `codigo` do Omie). Os produtos de hoje ficam com a tributação de sempre (CST 40 / 07 / 07). Cadastra as 26 frutas do Omie que faltavam como CVC, com NCM e CFOP 5.102 — a tributação delas fica em branco até o contador confirmar, e o app não emite nota de produto da CVC sem tributação. O que não é fruta (caixas, etiquetas, grampos) não entra no app: é cadastrado direto no Spedy. Depois da 27. |
| 6v | [`tributacao-cvc-omie.sql`](supabase/tributacao-cvc-omie.sql) | Preenche CFOP e CSTs das frutas da CVC com o que o Omie usou nas NF-e de 2026: ICMS 40 e PIS/COFINS 07 na maioria; ICMS 00 a 19% em ameixa, kiwi, coco, maçã e peras. Quem não saiu em nota segue o produto de mesmo NCM (Milho Verde fica em branco). Depois da 28. |
| 6w | [`migracao-29-nome-pedido.sql`](supabase/migracao-29-nome-pedido.sql) | Nome de quem faz o pedido pelo link (da loja e da rede): coluna `vendas.pedido_por` e as funções `pedido_cliente_enviar` / `pedido_rede_enviar` passam a exigir o nome — sem ele o pedido não grava. Depois da 26. Rode **antes** de publicar a versão do app que traz o campo *Responsável pelo pedido* — a página nova manda o nome, e a função antiga não o aceita. Se usa a 20, rode-a de novo depois para o aviso no celular dizer quem pediu. |
| 6x | [`migracao-30-nfe-recebidas-sefaz.sql`](supabase/migracao-30-nfe-recebidas-sefaz.sql) | Tabelas `nfe_recebidas` (as NF-e emitidas contra o CNPJ, com o XML completo quando a SEFAZ libera) e `sefaz_dfe_estado` (último NSU lido e a espera da SEFAZ). Só a função `api/sefaz.js` grava; o app só lê (gestor, com o `auth.sql`). Rode antes de publicar a versão do app que busca as notas recebidas direto na SEFAZ — veja [Notas recebidas e devoluções](#-notas-recebidas-e-devoluções). |
| 6y | [`migracao-31-insumos-producao.sql`](supabase/migracao-31-insumos-producao.sql) | Tabelas `insumos_itens` (cadastro fixo — redinha, grampo, 4 etiquetas — com o estoque mínimo de cada) e `contagens_insumos` (a contagem física, virando saldo). Tenta agendar pelo pg_cron, se disponível, um aviso semanal (segunda às 16h) pelo mesmo ntfy da migração 20 — se não der, roda igual, só sem o agendamento. Rode antes de publicar a versão do app que traz a aba de insumos — sem as tabelas, as contagens ficam presas na fila de Sincronização. |
| 6z | [`migracao-32-lembrete-contagem-frutas.sql`](supabase/migracao-32-lembrete-contagem-frutas.sql) | Só o agendamento (pg_cron, se disponível): um aviso todo dia às 16h30 pelo mesmo ntfy, lembrando de contar o estoque de frutas. Não cria tabela — a contagem de fruta já existe (Acertos de Inventário). Roda em qualquer ordem depois da migracao-20. |
| 6zz | [`migracao-33-lembrete-preco-frutas.sql`](supabase/migracao-33-lembrete-preco-frutas.sql) | Tabela `precos_frutas` (a conferência semanal de preço, confirma ou ajusta) e o agendamento, pelo pg_cron se disponível, do aviso toda segunda às 7h pelo mesmo ntfy — se não der, roda igual, só sem o agendamento. Rode antes de publicar a versão do app que traz a conferência de preços. |
| 6zzz | [`migracao-34-precos-por-produto.sql`](supabase/migracao-34-precos-por-produto.sql) | Renomeia `precos_frutas` para `precos_produtos` (coluna `fruta` → `produto`) sem perder linha nenhuma — a conferência passa a ser por produto: o agranel e cada saco (2,5 kg, 3 kg, 5 kg, 10 kg) têm preço próprio. Funciona também numa instalação nova, sem a 33 antes. Rode antes de publicar a versão do app que traz a conferência por produto — sem a coluna nova, as gravações ficam presas na fila de Sincronização. |
| 6zzzz | [`migracao-35-pedido-geral.sql`](supabase/migracao-35-pedido-geral.sql) | Link de pedido GERAL: tabela `pedido_geral_config` com um token só, e as funções `pedido_geral_abrir` / `pedido_geral_enviar` (liberadas para a chave anon), que reúnem todas as redes e lojas ativas numa página só e gravam um pedido separado por loja escolhida, e `renovar_link_pedido_geral`. Depois da 21, da 23 e da 29 (usa o nome de quem pediu). Rode antes de publicar a versão do app que traz o link geral. |
| 6zzzzz | [`migracao-36-desfazer-escaneio.sql`](supabase/migracao-36-desfazer-escaneio.sql) | Função `desfazer_escaneio(venda)`: o passo inverso de `registrar_escaneio`, para quando o motorista lê o QR errado e confirma — entregue → em rota, em rota → pendente. Depois da 19. Rode antes de publicar a versão do app que traz o "Desfazer leitura" em Minhas Entregas. Redefinida pela 38 (veja abaixo). |
| 6zzzzzz | [`migracao-36-carregamento-completo.sql`](supabase/migracao-36-carregamento-completo.sql) | A 2ª leitura do QR (entrega) passa a exigir a viagem inteira já carregada — bloqueia ler de novo um pedido em rota antes de carregar o resto. Depois da 19. Superada em parte pela 37 (veja abaixo). |
| 6zzzzzzz | [`migracao-37-iniciar-rota.sql`](supabase/migracao-37-iniciar-rota.sql) | Separa "carregar" de "sair do CD": a 1ª leitura do QR passa a marcar o pedido como `carregando` (não mais `em_rota`), e um novo status, o botão **Iniciar rota** na tela do motorista, e a função `iniciar_rota(dia)`, que só libera com a viagem inteira carregada, viram o passo que grava `saida_cd_em` e faz o Painel TV mostrar "Em deslocamento". Sem isto, carregar o 1º pedido da rota já fazia a TV mostrar saída antes da hora. Depois da 19 e da 36. Assinatura de `iniciar_rota` redefinida pela 40 (veja abaixo). |
| 6zzzzzzzz | [`migracao-38-desfazer-carregando.sql`](supabase/migracao-38-desfazer-carregando.sql) | Redefine `desfazer_escaneio` para o status `carregando` que a 37 introduziu: entregue → em rota (sem mudança), carregando → pendente (era em_rota → pendente). "Em rota" deixou de vir de escaneio — vem do botão "Iniciar rota" — então não tem mais desfazer por aqui. Depois da 36-desfazer-escaneio e da 37. |
| 6zzzzzzzzz | [`migracao-39-viagem-rota.sql`](supabase/migracao-39-viagem-rota.sql) | Coluna `vendas.viagem_rota` (2ª, 3ª... viagem do MESMO veículo no MESMO dia — sem isso o app juntava as duas como se fossem uma rota só). Reescreve `minhas_entregas` para trazer a coluna nova (e `veiculo_id`, usado pela 40). Depois da 19. Rode antes de publicar a versão do app que traz "2ª viagem" no Romaneio. |
| 6zzzzzzzzzz | [`migracao-40-iniciar-rota-por-viagem.sql`](supabase/migracao-40-iniciar-rota-por-viagem.sql) | A 37 fez `iniciar_rota(dia)` liberar (e disparar) por todo o dia do motorista — quebrava a 2ª viagem da 39: exigia a 2ª viagem carregada pra liberar a 1ª, e vice-versa. Redefine para `iniciar_rota(dia, veiculo, viagem)`, escopado por veículo + viagem, não mais o motorista o dia inteiro. Depois da 37 e da 39. Rode junto com a versão do app que traz "2ª viagem" — o app novo já chama a função com os 3 argumentos. |
| 6zzzzzzzzzzz | [`migracao-41-notificacao-entrega.sql`](supabase/migracao-41-notificacao-entrega.sql) | Traz para o controle de versão o gatilho `vendas_avisar_entrega_motorista` (avisa pelo mesmo ntfy da migração 20 a cada mudança de status_entrega: "Saiu para entrega" quando vira `em_rota` — hoje só pelo botão "Iniciar rota" da 37 — e "Entrega realizada" quando vira `entregue`), que já rodava no banco fora de qualquer migração. O bug de aviso de "entregue" ao escanear só o carregamento era uma corrida em `MinhasEntregas.jsx` (corrigida junto), não nesta função — hoje também travada pela 37, que recusa reler um pedido já `carregando`. Depois da 19, da 20 e da 37. |
| 6zzzzzzzzzzzz | [`migracao-42-arquivar-rota.sql`](supabase/migracao-42-arquivar-rota.sql) | Coluna `vendas.rota_arquivada`: o botão **Arquivar rota** (só aparece com a viagem inteira `entregue`) some com o card da tela principal do Romaneio e do Painel TV sem apagar nada — os pedidos ficam intactos, e dá pra desarquivar pelo card "Rotas arquivadas" que aparece embaixo. Rode antes de publicar a versão do app que traz o botão — sem a coluna, as gravações de venda ficam presas na fila de Sincronização. |
| 6zzzzzzzzzzzzz | [`migracao-45-unidades-insumos.sql`](supabase/migracao-45-unidades-insumos.sql) | Troca a unidade dos insumos de produção de "unidade" para a unidade de compra: Redinha em **rolo (1.000 m)** — 1 m faz 3 sacos de 2,5 kg, ~3.000 sacos por rolo — e Grampo e Etiquetas em **milheiro**. Só altera itens ainda em "unidade". Contagens antigas mantêm o número digitado: confira e registre uma contagem nova. Depois da 31. |
| 6zzzzzzzzzzzzzz | [`migracao-46-continuar-rota.sql`](supabase/migracao-46-continuar-rota.sql) | Funções `rotas_nao_concluidas(hoje)` e `continuar_rota(dia, veiculo, viagem, hoje)`: em **Minhas Entregas**, o motorista vê as rotas dos últimos 7 dias que não terminou e, com **Continuar hoje**, traz os pedidos não entregues para hoje, como a próxima viagem livre do mesmo veículo (o status de cada pedido não muda; o que já foi entregue fica no dia original). O Romaneio faz o mesmo pelo card "Rotas de dias anteriores não concluídas", sem precisar da migração. Para promotor não há migração: o botão **Continuar hoje** (em Minha Rota e no painel de Promotores) só muda a data da rota. Depois da 42 (independe da 43 a 45). |
| 6zzzzzzzzzzzzzzz | [`migracao-47-metas-por-empresa.sql`](supabase/migracao-47-metas-por-empresa.sql) | Coluna `metas.empresa` (`carvalho_cruz` ou `cvc`): a aba **Metas** passa a ter metas próprias para cada empresa, com o realizado contando só os produtos dela, e uma visão **Consolidado** que soma as duas. Metas já gravadas ficam na Carvalho Cruz. Depois da 44. |
| 6zzzzzzzzzzzzzzzz | [`migracao-48-arquivar-rota-promotor.sql`](supabase/migracao-48-arquivar-rota-promotor.sql) | Coluna `rotas_promotor.arquivada`: na aba **Promotores**, rota concluída ganha o botão **Arquivar**, que tira o card da lista sem apagar paradas, fotos e horários; o botão **Rotas arquivadas** abaixo da lista mostra as arquivadas, com **Desarquivar**. Depois da 08. |
| 6-55 | [`migracao-55-avisos-celular.sql`](supabase/migracao-55-avisos-celular.sql) | **Conserta os avisos no celular** e acrescenta o de **falta de pedido**. No banco novo o tópico do ntfy nasce vazio e nenhum aviso sai — esta migração cria o painel **Sincronização → Avisos no celular** (só sócio master) para ver o que está ligado, gravar o tópico, enviar teste e religar os agendamentos. Agenda pelo pg_cron: falta de pedido todo dia 7h45 (mesma conta da aba Previsão de Pedidos), contagem de frutas 16h30 (calada se já houve acerto hoje), insumos segunda 16h (calado se já contou na semana) e preços segunda 7h. Os avisos de **Saiu para entrega / Entrega realizada** (migracao-41) passam a ser **um por rota iniciada e um por parada** — antes era um por pedido, o que estourava o limite do ntfy.sh — e o *Desfazer escaneio* não manda mais um "Saiu para entrega" falso. Também garante o tempo real da aba Promotores no banco novo. Tocar no aviso abre o app na aba certa. Depois da 20, da 41 e do `auth.sql`. |
| 6-56 | [`migracao-56-sinalizacoes-clientes.sql`](supabase/migracao-56-sinalizacoes-clientes.sql) | Tabela `sinalizacoes_clientes`: o que se marcou num alerta da Previsão de Pedidos — *me lembre em*, *ciente* ou *parou de pedir*, com motivo e data do alerta de reconquista. O aviso diário no celular passa a respeitar isso (não repete quem foi sinalizado; traz os lembretes e reconquistas do dia). Rode antes de publicar a versão do app que traz as sinalizações — sem a tabela, elas ficam presas na fila de Sincronização. Depois do `auth.sql` e da 55. |
| 6-58 | [`migracao-58-acoes-promotor.sql`](supabase/migracao-58-acoes-promotor.sql) | Tabela `acoes_promotor`: além das rotas de arrumação, o gestor lança **ações** para o promotor (evento em loja para divulgação, degustação etc.) na aba Promotores; o promotor vê em *Minha Rota* e conclui com foto e observação. Depois da 08 e do `auth.sql`. |
| 6-59 | [`migracao-59-aviso-rota-promotor.sql`](supabase/migracao-59-aviso-rota-promotor.sql) | **Aviso no celular quando o promotor inicia a rota**: "Fulano iniciou a rota às 08:12" (hora de Aracaju), via ntfy, no mesmo tópico dos outros avisos. Tocar no aviso abre a aba Promotores. Depois da 55. |
| 7 | [`seed.sql`](supabase/seed.sql) | A carteira: 21 redes, 63 lojas, 7 produtos, 3 veículos, 17 funcionários. |
| 8 | [`historico-compras.sql`](supabase/historico-compras.sql) | As compras de agosto e setembro. Opcional. |
| 9 | [`historico-despesas.sql`](supabase/historico-despesas.sql) | As despesas de agosto e setembro. Opcional — o passo 10 substitui isto pelo detalhe. |
| 10 | [`importacao-planilha.sql`](supabase/importacao-planilha.sql) | Vendas e despesas vindas do `.xlsx`. Gerado pelo script; reimportar atualiza em vez de duplicar. |
| 11 | [`importacao-clientes-omie.sql`](supabase/importacao-clientes-omie.sql) | Cadastro de clientes vindo do Omie: completa telefone das redes já existentes e cadastra as empresas novas com suas lojas. Gerado pelo script; reimportar atualiza em vez de duplicar. |
| 12 | [`importacao-fiscal-lojas.sql`](supabase/importacao-fiscal-lojas.sql) | CNPJ/IE/endereço das lojas que já vendem (conferido loja a loja com a distribuidora, não dá pra automatizar só pelo CSV). Gerado pelo script; reimportar nunca sobrescreve o que já foi preenchido. |
| 13 | [`importacao-fiscal-produtos.sql`](supabase/importacao-fiscal-produtos.sql) | NCM, unidade do Omie e CFOP (5.101, produção própria) dos 7 produtos. Gerado pelo script; reimportar nunca sobrescreve o que já foi preenchido. |
| 6-60 | [`migracao-60-acoes-horario.sql`](supabase/migracao-60-acoes-horario.sql) | Colunas `hora` e `duracao_min` em `acoes_promotor`: horário e duração da degustação/ação; o app do promotor avisa 30 min antes e na hora. Depois da 58. |
| 6-61 | [`migracao-61-aviso-acao-celular.sql`](supabase/migracao-61-aviso-acao-celular.sql) | Aviso da ação no celular do promotor **com o app fechado**: pg_cron a cada minuto manda, pelo ntfy, o aviso 30 min antes e na hora. Cada promotor tem um tópico próprio (Minha Rota → Configurar avisos). Depois da 55, 58 e 60. |

> ⚠️ **O SQL vai antes do deploy.** O app lê e escreve todas as tabelas em toda
> sincronização; se uma delas ainda não existir na nuvem, a sincronização
> inteira para e o erro aparece na tela **Sincronização**. O app continua
> funcionando offline, mas nada sobe até o banco estar em dia.

Depois, em **Project Settings → Data API** copie a **URL**; em **API Keys** copie
a chave **anon**.
Preencha o `.env.local`:

   ```bash
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-anon
   ```

5. Reinicie o `npm run dev`. O indicador no topo deve sair de **Modo local**
   para **Sincronizado**.

### ⚠️ Sobre segurança

A chave `anon` fica embutida no JavaScript que vai para o navegador — qualquer
pessoa com o link do app consegue lê-la. Recém-aplicado, `schema.sql` libera
leitura e escrita para essa chave: **funciona, mas quem tiver a chave acessa
todos os dados da distribuidora**. Serve para testar e colocar o app no ar
rapidamente.

Para uso com dados reais de clientes e faturamento, rode também
[`supabase/auth.sql`](supabase/auth.sql) — ele liga o login por e-mail e
senha (a tela já existe no app), cria a tabela `perfis` com os dois papéis e
troca as políticas do `schema.sql` por regras de RLS que barram quem não
entrou. O passo a passo para criar o primeiro sócio master está no fim
daquele arquivo.

**Sobre o `xlsx` (SheetJS) na exportação de relatórios**: o `npm audit`
acusa uma vulnerabilidade alta sem correção publicada (ReDoS e "prototype
pollution"). Os dois problemas vivem no caminho de **leitura** de um arquivo
(`XLSX.read`/`readFile`), que este app nunca chama — aqui só se **gera**
planilha a partir de dados do próprio app, nunca se abre um `.xlsx` de fora.
Decisão registrada em [`src/lib/exportar.js`](src/lib/exportar.js);
revisitar se o pacote publicar correção.

---

## 🆘 Banco perdido: recuperar pelos aparelhos

Cada aparelho que usa o sistema guarda uma cópia completa dos dados. Se o
projeto do Supabase se perder (apagado, sem acesso), é daí que o sistema volta.
**A ordem importa** — trocar o banco antes de salvar as cópias faria os
aparelhos seguirem o banco novo, vazio.

1. **Salvar as cópias.** Em cada computador e celular, abra o endereço do
   sistema com **/resgate** no fim (ou o link *Salvar cópia dos dados deste
   aparelho*, na tela de login) e toque em **Baixar cópia deste aparelho**.
   Funciona sem login e sem internet. Mande os arquivos para o sócio master.
2. **Banco novo.** No Supabase, crie o projeto (de preferência numa
   organização paga, que não pausa) e rode
   [`supabase/instalar.sql`](supabase/instalar.sql) inteiro, **uma vez só**, no
   SQL Editor. Ele junta schema, `auth.sql` e todas as migrações, na ordem de
   [`scripts/ordem-instalacao.txt`](scripts/ordem-instalacao.txt), e não traz
   dados. Depois siga o *passo a passo do primeiro sócio master* no fim do
   `auth.sql` (Confirm email desligado, criar o usuário).
3. **Trocar o banco na Vercel.** *Settings → Environment Variables*:
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` do projeto novo; depois
   *Deployments → Redeploy*.
4. **Restaurar.** O sócio master entra no sistema, abre **/resgate** e, em
   *Restaurar no banco novo*, escolhe todos os arquivos juntos e toca em
   **Enviar**. Vale a cópia do aparelho que sincronizou por último, mais o que
   cada um ainda não tinha enviado. Reenviar não duplica.
5. **Liberar os aparelhos.** Enquanto não for liberado, um aparelho cuja
   cópia veio do banco antigo não envia nem apaga nada (a tela de
   Sincronização avisa). Em cada um: **/resgate → Usar o banco novo**.
6. **Refazer o que não fica no aparelho:** contas da equipe (aba Usuários) e
   o vínculo de cada pessoa da folha com a conta; o link de pedido **geral**
   (gera outro); rotas e fotos dos promotores; o tópico do aviso no celular
   (**Sincronização → Avisos no celular → Gravar tópico → Enviar teste**; sem
   ele nenhum aviso sai); as notas recebidas da SEFAZ voltam sozinhas na próxima
   busca. Os links de pedido de cada loja e rede voltam iguais.

---

## 🗄️ Arquivo morto por trimestre

Aba **Arquivo morto** (só sócio master). A cada trimestre, no computador, escolha
o trimestre encerrado (ex.: *Primeiro Trimestre 2026*), toque em **Conferir o que
entra** e depois em **Escolher a pasta do Drive e salvar** (Chrome/Edge grava
direto na pasta; nos outros navegadores sai em ZIPs de ~150 MB). Fica assim:

```
Primeiro Trimestre 2026/
  Comprovantes/<Despesas|Compras|Combustivel|Folha|Caixa-sem-lancamento>/<AAAA-MM>/
  Fotos-Promotores/<promotor>/<AAAA-MM-DD>/<ordem-loja>/chegada|antes|depois
  Notas-Fiscais/Emitidas|Recebidas/<AAAA-MM>/*.xml
  Horarios/horarios-promotores.csv, horarios-motoristas.csv
  indice.csv (cada arquivo, tamanho e SHA-256)   LEIA-ME.txt
```

**Etapa 1 (esta): só gera o arquivo — nada é apagado do sistema.** Cada arquivo é
conferido (tamanho gravado no disco, SHA-256 no `indice.csv`); se algum falhar, o
`LEIA-ME.txt` diz *INCOMPLETO* e a tela lista o que faltou. Os números (vendas,
compras, despesas, folha, horários e GPS das rotas) ficam sempre no banco. A
**Etapa 2** (apagar do sistema só o que foi arquivado e conferido) ainda não existe.
Guarde a pasta em dois lugares; o XML fiscal tem guarda obrigatória de 5 anos.

---

## 📴 Como funciona o offline

1. Toda alteração é gravada **primeiro no IndexedDB** e a tela responde na hora.
2. Em paralelo, a operação entra numa **fila** (`upsert` ou `delete`).
3. A fila é enviada ao Supabase **na ordem em que foi criada** — um cliente
   cadastrado na rua sobe antes da venda que o referencia.
4. Depois do envio, o app **baixa o estado completo** das tabelas. Como o envio
   vem antes, a alteração feita no aparelho vence em caso de conflito.
5. Sem conexão, a fila apenas espera. Ela é reenviada quando a internet volta,
   quando o app volta ao primeiro plano e a cada minuto.
6. Uma operação que falha 5 vezes sai da fila ativa e aparece na tela
   **Sincronização** com o erro, para não travar as demais.

Os `id` são **UUID gerados no aparelho**, para que um pedido criado offline
tenha identidade definitiva sem depender do servidor. O número do pedido
(`#7`) é um campo separado, pensado para leitura humana.

---

## 📱 Instalar no celular

Com o app publicado (ou rodando via `npm run preview`):

- **Android/Chrome:** aparece o botão **⬇ Instalar** no topo, ou use o menu
  ⋮ → *Instalar aplicativo*.
- **iPhone/Safari:** botão **Compartilhar** → *Adicionar à Tela de Início*.

Depois de instalado, o app abre em tela cheia e funciona sem internet.

---

## ☁️ Publicar no Vercel

1. Suba o projeto para o GitHub.
2. No Vercel: **Add New → Project** e importe o repositório (o preset Vite é
   detectado automaticamente; `vercel.json` já traz build, rotas e cabeçalhos).
3. Em **Settings → Environment Variables**, cadastre `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY` para *Production*, *Preview* e *Development*.
4. **Deploy**. Cada push na branch principal publica uma nova versão.

> Variáveis de ambiente do Vite são lidas **no build**. Ao alterá-las no Vercel,
> refaça o deploy para que valham.

---

## 🧾 Emitir NF-e

O app emite NF-e (nota de mercadoria, não de serviço) pela API da **Spedy**
(spedy.com.br). Ela cuida do certificado digital e da comunicação com a
SEFAZ; o app nunca fala com a SEFAZ direto.

> **Histórico:** a primeira versão dessa integração usava o **Omie**
> (`api/omie.js`, `src/lib/omie.js` — ainda no repo só de referência). A
> chamada de faturamento (`IncluirPedido`) voltava HTTP 500 sem diagnóstico
> claro, e a Spedy saiu mais barata e sem OAuth pra manter vivo — por isso a
> troca. O cadastro fiscal (CNPJ/IE/endereço das lojas, NCM dos produtos)
> é genérico e continua valendo; só o código que fala com o emissor mudou.

**Por que passa por `api/` e não direto do navegador:** o app é uma SPA
(Vite) — tudo que começa com `VITE_` vai embutido no JavaScript que qualquer
visitante baixa. A `SPEDY_API_KEY` não pode estar aí, ou qualquer um com o
DevTools aberto teria acesso de emissão da conta inteira. Por isso existe a
[Vercel Function](https://vercel.com/docs/functions) `api/spedy.js`, que
segura a chave no servidor (`SPEDY_API_KEY`/`SPEDY_BASE_URL`, cadastradas em
**Vercel → Settings → Environment Variables**, sem prefixo `VITE_`) e repassa
a chamada — `{ path, method, body }` via `POST`, ou `?path=...` via `GET`
(usado pro link do DANFE, que é um arquivo binário, não JSON).

> `npm run dev` não roda as funções de `api/` — isso é um servidor Vite puro.
> Para testar a emissão localmente, use `vercel dev` (`npm i -g vercel`, depois
> `vercel dev`) com `SPEDY_API_KEY`/`SPEDY_BASE_URL` num `.env.local` — ele
> não vai para o Git.

**O fluxo** (a partir da documentação oficial + uma NF-e real já emitida pela
distribuidora, usada pra confirmar CST/CFOP/isenção — não é suposição):

1. `POST /v1/product-invoices` — cria a nota e já enfileira pra SEFAZ
   (`status: "enqueued"`), sem passo de faturamento separado.
2. A emissão é **sempre assíncrona**: o `2xx` do passo 1 confirma só que foi
   aceita, não que foi autorizada. `aguardarAutorizacao` consulta
   `GET /v1/product-invoices/{id}` de novo a cada 2s até virar `authorized`
   ou `rejected` (o motivo da rejeição vem em `processingDetail`).
3. `GET /v1/product-invoices/{id}/pdf` — link do DANFE (usado direto como
   `href`, sem JS, via `?path=` no proxy).
4. `POST /v1/orders` — depois da autorização, a venda é registrada na aba
   **Vendas** do painel da Spedy (status "Concluído"), com
   `transactionId` = id da venda no app. Vai com `autoIssueMode: "disabled"`:
   a nota já saiu no passo 1, e sem isso a Spedy emitiria uma **segunda**
   nota com a tributação do backoffice. Ao cancelar a NF-e, a venda é
   cancelada lá também (`DELETE /v1/orders/{id}/cancel`, achada pelo
   `transactionId`; se a nota é de antes dessa integração, a venda é criada
   e cancelada na hora). Se essa parte falhar, a NF-e continua valendo — o
   app só avisa.

**Regime tributário: Lucro Presumido** (confirmado com a Carvalho Cruz) — os
itens usam `cst`, não `csosn` (que é só pra Simples Nacional). A NF-e real
usada de referência mostrou **CST 40 (isenta)** pros 7 produtos de produção
própria (laranja em várias embalagens + abóbora, todos CFOP 5.101) — Sergipe
isenta hortifrutigranjeiro in natura (RICMS/SE, Anexo I, Tabela I, item 23,
inciso I, alínea "e"), texto incluído automaticamente como observação fiscal
da nota.

**Está pronto no código, mas não testado contra a API de verdade ainda** —
alguns campos foram um palpite razoável a partir da doc + da nota de
referência, e podem precisar de ajuste no primeiro teste no sandbox:
- Nome do campo de Inscrição Estadual do destinatário (`stateTaxNumber`).
- CST de PIS/COFINS pra item isento de ICMS (`"07"`).
- Nomes dos campos da nota autorizada (`number`, `series`, `accessKey`).

**O que falta preencher (não é código, é cadastro na Spedy):**
- [ ] Criar/logar em spedy.com.br — a empresa titular já vem pronta,
      **sem precisar criar empresa nenhuma** (só usam uma).
- [ ] Enviar o certificado digital A1 (`POST /v1/companies/{id}/certificates`,
      `.pfx` + senha, `multipart/form-data`).
- [ ] Configurar `productInvoice.series`/`nextNumber`
      (`PUT /v1/companies/{id}/settings`) — **usar uma série diferente da 3**
      (a última nota do Omie foi Série 3, Nº 1.404) pra não arriscar colidir
      numeração entre os dois emissores.
- [ ] `SPEDY_API_KEY`/`SPEDY_BASE_URL` no Vercel — é uma API só
      (`https://api.spedy.com.br/v1`), não precisa trocar de URL pra testar.
      Quem decide se a nota é de teste ou de verdade é o campo **"Ambiente"**
      nas configurações da empresa no painel do Spedy (deixe em
      "Homologação" até validar a emissão de ponta a ponta).

## 🗂️ Arquivos fiscais (SPED e Sintegra)

**Notas Fiscais → Arquivos fiscais** gera, para o mês escolhido, os arquivos que o
contador pede — a partir do **XML** das NF-e: as emitidas pelo app (baixadas da Spedy),
as notas de entrada emitidas pelo app (devolução de venda) e as recebidas da SEFAZ
(`nfe_recebidas`, só as com XML completo; nota não reconhecida — desconhecimento ou
operação não realizada — fica de fora). Cancelada entra como cancelada.

| Arquivo | O que leva |
|---|---|
| **SPED Fiscal** (EFD ICMS/IPI) | Arquivo *auxiliar*: blocos 0 (0000, 0005, 0150, 0190, 0200), C (C100, C170, C190) e 9 |
| **SPED Contribuições** (EFD PIS/COFINS) | Arquivo *auxiliar*: blocos 0 (0000, 0140, 0150, 0190, 0200), C (C010, C100, C170) e 9. Saídas e devoluções; compras só se marcar a opção |
| **Sintegra** | Registros 10, 11, 50, 54, 75 e 90, linhas de 126 posições |

Os dois SPED são auxiliares: o programa do contador importa e completa com a apuração
(blocos E e M), o inventário (H), o regime e os dados dele (0100/0110). Os dados da
empresa vêm do próprio XML (emitente das notas emitidas). Código em `src/lib/sped/`
(`npm test` roda a verificação de layout). Pontos a conferir com o contador/PVA:
o código de versão do leiaute (`versaoLeiauteFiscal`, `VERSAO_LEIAUTE_CONTRIBUICOES`) e o
tratamento do PIS/COFINS de entrada e devolução.

## 💸 Taxas e custos das redes grandes

Redes como o Atakarejo cobram da distribuidora **caixas IFCO, taxa de CD e
taxa de antecipação**. No cadastro da **rede** (e, se preciso, da **loja**),
em *Taxas e custos deste cliente*, adicione cada taxa: o **tipo** (IFCO, CD,
antecipação ou *outra* com nome livre) e como cobra — **% da venda** ou **R$
por pedido**.

- A taxa da rede vale para todas as lojas dela. A da loja vale **no lugar** da
  da rede para o mesmo tipo; valor **0** desliga a taxa da rede só naquela loja.
- O percentual incide sobre a receita do pedido **já líquida de devolução** e
  sem bonificação. O valor por pedido é cobrado uma vez em cada pedido.
- As taxas saem do **resultado**: Painel (*Taxas dos clientes*, coluna **Taxas** no
  ranking por rede/cliente e no resultado após operação) e Financeiro (entram
  em *Saídas* e têm coluna própria no DRE). Não entram quando o filtro é por
  fruta ou produto. Contam no dia do pedido.
- Vale só daqui para a frente do cadastro: o app calcula na hora, então
  cadastrar a taxa também recalcula os pedidos antigos do cliente.
- **Caixas IFCO:** cadastre a taxa como **R$ por caixa IFCO**. Nos clientes que têm
  essa taxa, o pedido (Vendas → Nova venda) mostra o campo *Caixas IFCO neste
  pedido* — digite a quantidade; deixe vazio ou 0 quando a fruta não foi em
  IFCO. A taxa do pedido é valor × caixas. Exige a
  [`migracao-63-caixas-ifco-pedido.sql`](supabase/migracao-63-caixas-ifco-pedido.sql).
  **Pedido que já tem NF-e** continua travado nos itens e preços, mas as caixas
  IFCO se lançam ou corrigem a qualquer hora: toque na linha do pedido (abre o
  detalhe), ajuste *Caixas IFCO* e **Salvar** — a nota não muda.

Exige a [`migracao-62-taxas-clientes.sql`](supabase/migracao-62-taxas-clientes.sql)
(colunas `taxas` em `redes` e `lojas`) antes de publicar o app.

## 📥 Notas recebidas e devoluções

A aba **Notas Fiscais** tem três partes: **Emitidas** (as notas de venda,
acima), **Recebidas** e **Devoluções**.

**Recebidas — as notas emitidas contra o nosso CNPJ, direto da SEFAZ.**
O app consulta o serviço de **Distribuição DF-e** do Ambiente Nacional com o
**certificado A1** da empresa e guarda toda NF-e em que a Carvalho Cruz
aparece como destinatária — compra de fornecedor, devolução de cliente,
remessa — na tabela `nfe_recebidas`. Quem fala com a SEFAZ é a Vercel
Function `api/sefaz.js`: o certificado e a senha ficam só no servidor. (Antes
isso passava pela Spedy, mas o recurso "notas recebidas" não estava no plano.)

- **A busca** acontece sozinha ao abrir a aba Recebidas, uma vez por dia pelo
  cron da Vercel, e no botão **Buscar na SEFAZ agora**. A primeira traz os
  últimos ~90 dias. A SEFAZ bloqueia por uma hora o CNPJ que consulta sem ter
  nada novo (rejeição 656), então o app guarda o último NSU lido e a hora em
  que pode consultar de novo (`sefaz_dfe_estado`) e não pede antes disso.
- A nota chega primeiro como **resumo** (emitente, valor, chave). O **XML
  completo** só é liberado pela SEFAZ depois da **manifestação** — *Dar
  ciência* basta e não é definitiva. Depois de manifestar, **Buscar XML** na
  linha da nota pede a nota pela chave (a liberação leva alguns minutos).
- **PDF** gera um espelho da nota a partir do XML, para conferir e arquivar —
  não é o DANFE oficial; o documento fiscal que vale é o XML.
- A manifestação é assinada no servidor com o certificado (XMLDSig
  RSA-SHA1, como pede o manual da NF-e) e enviada ao Ambiente Nacional.
- A tela avisa quando faltam 30 dias ou menos para o certificado vencer.
- **Outro sistema já baixa as notas deste CNPJ** (o do contador, um ERP)? Na
  primeira busca a SEFAZ responde 656 (*consumo indevido*) e diz de que NSU
  seguir; o app grava esse NSU e, depois da hora de espera, continua dali — as
  notas novas chegam normalmente. As mais antigas que esse sistema já baixou
  não vêm mais pela busca normal: use **Buscar pela chave** (a chave de 44
  números do DANFE).
- **Dar entrada** registra a nota em `notas_entrada` e, por padrão, manifesta
  **Confirmação da operação** (definitiva). Pelo XML, o app já sugere o que a
  nota é: se o emitente é uma loja cliente ou a finalidade é devolução, vira
  **devolução de cliente**, ligada à venda cuja chave a nota referencia; senão,
  **compra**. Por padrão a nota **não** entra em **Compras** (a compra já foi
  lançada à mão, então não duplica estoque nem custo); se precisar, marque
  "Lançar também em Compras" (fruta, peso e valor pré-preenchidos pelos itens).
- **Recusar** manifesta *Operação não realizada* ou *Desconhecimento* (com
  justificativa de 15 a 255 caracteres) — para nota que não é nossa ou
  mercadoria recusada.
- **Baixar XMLs (.zip)** junta os XMLs completos do mês, para o contador.
- Se a nota for cancelada pelo emitente depois, o cancelamento também chega
  pela distribuição e a nota muda para *Cancelada pelo emitente*.

**Devoluções.** Quando o cliente devolve mercadoria:
1. Se ele tem inscrição estadual, **quem emite a nota de devolução é ele**.
   Ela chega em Recebidas; ao dar entrada como devolução, aparece aqui ligada
   à venda.
2. Se ele não emite (sem IE, produtor, pessoa física — ou por orientação do
   contador), a distribuidora emite a **nota de devolução de entrada**: botão
   *Emitir nota de devolução* (ou *Devolução* na linha da nota em Emitidas).
   Escolhe-se a venda e quanto voltou de cada item; sai uma NF-e com
   `operationType: "incoming"`, `purposeType: "devolution"`, a chave da nota
   de venda em `referencedDocuments`, CFOP de entrada (5.101 → 1.201,
   5.102 → 1.202, 6.xxx → 2.xxx), a mesma tributação e preço da venda e
   pagamento `noPayment`. O app não deixa devolver mais do que foi vendido.

O valor devolvido aparece embaixo da nota da venda em Emitidas.

**Efeito no faturamento e no estoque.** A devolução com nota (a do cliente, depois
de dar entrada, ou a nossa, depois de autorizada) mexe sozinha em duas contas:
- **Faturamento:** o valor devolvido sai da receita *do pedido que foi devolvido*
  (mesma data, cliente, rede, produto e empresa da venda) — Painel, Análise,
  Financeiro e histórico da loja. O pedido original continua lá, com o valor
  cheio; o que voltou aparece como abatimento, então o faturamento não fica
  maquiado nem a venda some. Devolução de nota cancelada ou recusada não conta.
- **Estoque:** os quilos devolvidos **entram de novo** na fruta do produto.
  Marque *Mercadoria avariada / sem qualidade* e eles **não voltam** — o valor
  ainda sai do faturamento, mas o estoque fica como estava. (Para registrar o
  custo da perda, lance em Estoque → Perdas, motivo *Devolução de cliente*.)
- Na nota do cliente os itens vêm do XML e são casados com o pedido pelo nome
  do produto; o que não casar abate só o valor, sem mexer em quilos.
- Não mexe no valor *a receber* do pedido: acerte com o cliente pelo abatimento
  na cobrança.

**Para ligar (uma vez só):**
- [ ] Rodar `migracao-25-notas-entrada.sql` e `migracao-30-nfe-recebidas-sefaz.sql`.
- [ ] Na Vercel → Settings → Environment Variables (sem prefixo `VITE_`):
  - `SEFAZ_CERT_PFX_BASE64` — o arquivo `.pfx` do certificado A1 em base64.
    No Windows (PowerShell):
    `[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\caminho\certificado.pfx")) | Set-Clipboard`
    e cole o valor; no Mac/Linux: `base64 -i certificado.pfx | tr -d '\n'`.
  - `SEFAZ_CERT_SENHA` — a senha do `.pfx`.
  - `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Project Settings → API →
    `service_role` (é ela que grava as notas; **nunca** use com `VITE_`).
  - `CRON_SECRET` — qualquer texto longo e aleatório; a Vercel manda ele no
    cron diário e a função só aceita o cron com ele.
  - Opcionais: `SEFAZ_AMBIENTE=homologacao` para testar (o padrão é
    produção); `SEFAZ_CNPJ` com o CNPJ que recebe as notas, quando não é o
    do certificado — ex.: a filial usando o certificado da matriz (a raiz, os
    8 primeiros dígitos, tem que ser a mesma; o padrão é o CNPJ do certificado);
    `SEFAZ_CA_PEM` com a cadeia ICP-Brasil em PEM para a função conferir o
    certificado do servidor da SEFAZ (sem ela, a conexão segue sem essa
    conferência, como nas bibliotecas de NF-e em geral).
- [ ] Publicar e abrir Notas Fiscais → Recebidas: a primeira busca sai sozinha.
- [ ] Todo ano, ao renovar o certificado, trocar `SEFAZ_CERT_PFX_BASE64` e
      `SEFAZ_CERT_SENHA` na Vercel e publicar de novo.

**Ainda não testado contra a SEFAZ de verdade** (feito pelo manual e pelas
notas técnicas, e testado contra um servidor falso): a busca na Distribuição
DF-e e a manifestação — confira no primeiro uso que a lista enche e que a
*Ciência* é aceita. **Nem contra a Spedy de verdade:** a nota de devolução de
entrada — confirme no primeiro uso, em Homologação, que a SEFAZ aceita o
CFOP 1.201 com CST 40 e o pagamento `noPayment`.

## 📌 Próximos passos

- [ ] Realtime do Supabase (SQL já preparado no `schema.sql`)

---

## 👤 Sobre

Desenvolvido para uso interno da **Distribuidora Carvalho Cruz**.
Aracaju — Sergipe — Brasil 🇧🇷

*Iniciado em setembro de 2026 · Desenvolvido com assistência do Claude (Anthropic)*
