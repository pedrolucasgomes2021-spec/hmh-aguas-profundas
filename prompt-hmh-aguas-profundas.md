# Prompt: HMH "ÁGUAS PROFUNDAS" — descida interativa da sonda até o poço

> **Antes de colar no gerador:** (1) gere as 5 cenas, 4 faixas de junção e a folha de sprites usando os *prompts de imagem* da seção "Mídia" e cole as URLs resultantes nos campos `[URL_…]`; (2) a lista de equipamentos (seção "Equipamentos") foi extraída de hmhw.com (áreas *Drilling Equipment* offshore e *Offshore Pressure Control*); o site tem mais itens em outras páginas (ver "Equipamentos que faltam levantar") — edite o array `EQUIPAMENTOS`; (3) as cores da marca abaixo foram estimadas a partir do logo — troque pelos valores oficiais.

---

## O que é

Crie um site de página única, interativo, para a **HMH**, mostrando a **descida de uma sonda de perfuração (navio-sonda / plataforma semissubmersível) pelo mar até o fundo e para dentro do poço**. Use HTML, CSS e JavaScript puro em **um único arquivo**, sem bibliotecas. **Todo o texto do site em português do Brasil** (`<html lang="pt-BR">`).

**Estrutura.** A página é **uma única descida ilustrada contínua**: cinco cenas vetoriais planas em largura total, empilhadas verticalmente em uma imagem alta. Conforme o usuário rola, a "câmera" mergulha: a profundidade aumenta, a luz some, a pressão sobe.

| # | Cena | Profundidade | Âncora |
|---|---|---|---|
| 1 | **Superfície**: mar ao entardecer, sonda semissubmersível com torre (derrick), guindastes e heliponto; casco e linhas de ancoragem descem sob a linha d'água | 0 m | `#superficie` |
| 2 | **Coluna d'água**: riser de perfuração com módulos de flutuação, umbilical, riser flexível em catenária, boias, ROV inspecionando, cardume | 100 → 1.500 m | `#coluna` |
| 3 | **Leito marinho**: o conjunto de BOP submarino assentado na cabeça de poço (LMRP, BOP de gaveta, BOP anular, conectores H-4, controles), com sistema 20k ao lado, ROV e cardume. A HMH é fornecedora de perfuração: **não** desenhe árvore de natal, manifold de produção, PLET nem bombas submarinas | 2.200 m | `#leito` |
| 4 | **Subsolo**: corte geológico, condutor, revestimento de superfície, cimentação, sedimentos e rocha | 2.200 → 3.500 m | `#subsolo` |
| 5 | **O Poço / reservatório**: corte do poço com revestimento de produção, coluna de produção, packer, válvula de segurança (DHSV), canhoneado e o reservatório com óleo subindo | 3.500 → 5.000 m | `#poco` |

**As junções.** Entre cada par de cenas há uma **faixa ilustrada** (nunca gradiente): a de baixo da cena de cima encontra o topo da cena de baixo através de elementos reais desenhados.

| Junção | Entre | Conteúdo desenhado (parte de cima / parte de baixo) |
|---|---|---|
| S1 | Superfície → Coluna | Ondas e espuma vistas por baixo + casco/flutuadores da sonda / água azul-petróleo com raios de luz e primeiras partículas. Abertura no centro (47–53 %) por onde passa o riser |
| S2 | Coluna → Leito | Água escura com neve marinha densa, riser chegando / lama do leito marinho, ondulações no sedimento, rochas. Abertura em ~47–53 % onde o riser encontra a cabeça de poço |
| S3 | Leito → Subsolo | Sedimento superficial com conchas e tubo condutor entrando / camadas de argila e areia. Abertura de ~48–52 % (o poço) |
| S4 | Subsolo → Poço | Rocha-capa (folhelho) densa com estratos / topo do reservatório poroso com óleo. Abertura de ~48–52 % (o poço) |

**A arte.** Um só estilo: formas angulares com cortes em estilhaço, textura granulada, luz de contorno brilhante, **azul-abissal profundo → quase preto**, com **ciano "luz de ROV"**, **azul HMH** e acentos **vermelho HMH** nos equipamentos, **âmbar** nos refletores e no óleo. O **riser/poço** é o fio condutor vertical que atravessa todas as cenas, como a cachoeira no site original: no lugar da cachoeira de luz, **pulsos de luz ciano descem pelo riser** e **óleo âmbar sobe pela coluna de produção**.

**O movimento é todo em código:** pulsos de fluxo em canvas, neve marinha, bolhas, cáusticas de luz na superfície, ondas, luzes dos equipamentos piscando, cardumes e águas-vivas que fogem do cursor, ROV que patrulha e inspeciona, scroll com inércia, título que sobe letra a letra, textos que sobem linha a linha, régua de profundidade em tempo real, lanterna de ROV que segue o cursor, pings de sonar ao clicar.

---

## Interatividade (o que torna o site "vivo")

1. **Régua de profundidade fixa** à direita (desktop) / faixa fina no topo (mobile): trilho vertical com marcas a cada cena, marcador que acompanha o scroll e **painel digital** com:
   - Profundidade (m), Pressão (bar = `1 + prof/10`), Temperatura (°C), Luz (%).
   - Valores interpolados linearmente por trechos entre as âncoras de cada cena:

| Progresso | Prof. (m) | Temp. (°C) | Luz (%) |
|---|---|---|---|
| Topo da cena 1 | 0 | 28 | 100 |
| Fim da cena 1 | 0 | 27 | 100 |
| Fim da cena 2 | 1.500 | 4 | 0 |
| Cena 3 (centro) | 2.200 | 3 | 0 |
| Fim da cena 4 | 3.500 | 45 | 0 |
| Fim da cena 5 | 5.000 | 95 | 0 |

   - Clicar em uma marca da régua rola até a cena (`scrollTo`, a inércia faz o resto).
2. **Hotspots de equipamento:** cada equipamento tem um botão-anel de 28 px (`<button>`, `aria-label`), pulsando suavemente em azul HMH. Hover/foco mostra rótulo flutuante; clique abre a **ficha técnica** (painel lateral de 360 px no desktop, folha inferior no mobile) com: nome, categoria, profundidade típica, descrição de 2–3 linhas e 3 itens de especificação (valores-modelo editáveis). `Esc` fecha. O painel **não bloqueia o scroll**. Abrir uma ficha faz o ROV se mover até o hotspot.
3. **Catálogo HMH:** botão "Catálogo" no menu abre um painel com **todos os equipamentos agrupados por categoria**, chips de filtro (Superfície · Coluna d'água · Leito marinho · Subsolo · Poço). Clicar em um item rola até a cena, centraliza o hotspot e abre a ficha.
4. **Lanterna do ROV:** círculo fixo de 520 px que segue o cursor (suavização `1 − e^(−10·dt)`), `mix-blend-mode: screen`, gradiente `rgba(190,240,255,A) → rgba(120,200,255,A·.35) 55% → transparente`. **A intensidade `A` sobe com a profundidade** (de .06 na superfície a .34 no abismo), controlada pela variável CSS `--lamp-a`. Só em ponteiro fino.
5. **Sonar:** clique em qualquer lugar vazio dispara um anel de sonar (círculo que expande de 0 a 220 px em 900 ms, borda 1,5 px ciano, opacidade 1→0) e faz os hotspots a até 220 px "acenderem" por 600 ms.
6. **Teclado:** `Tab` percorre hotspots na ordem das cenas; `Enter` abre; `J`/`K` ou `↓`/`↑` pulam de cena em cena.
7. **Modo calibração `?debug=1`:** mostra a grade em % sobre cada `.art` e, ao clicar, copia `left / top` em % para a área de transferência (para ajustar hotspots às imagens geradas).

---

## Mídia: o que gerar e onde colar

As imagens de Halloween do prompt original **não servem aqui**. Gere as imagens abaixo (Higgsfield ou outro gerador) no **mesmo estilo**: vetor plano, formas angulares tipo estilhaço, textura granulada, luz de contorno, paleta azul-abissal + ciano + azul/vermelho HMH + âmbar. **Todas as cenas: 2688 × 1520; faixas: 2688 × 1152 com fundo transparente** (remover fundo); borda superior e inferior de cada cena em `#04101F`. Se usar um redimensionador, peça webp, `w=2400`, `q=85`.

| Ativo | Campo | Prompt de imagem |
|---|---|---|
| Cena 1 | `[URL_CENA_1]` | Sonda semissubmersível em mar aberto ao entardecer, céu laranja-violeta, derrick central alto, guindaste à direita, heliponto à esquerda, casco e colunas parcialmente submersos, linhas de ancoragem descendo em diagonal; metade inferior mostra a água em corte, azul-petróleo, com o riser descendo ao centro (x≈50 %). Linha d'água em y≈58 %. |
| Cena 2 | `[URL_CENA_2]` | Coluna d'água profunda, azul-escuro a preto, riser vertical ao centro com módulos de flutuação amarelos, umbilical paralelo, riser flexível em catenária à direita, boias de sub-superfície à esquerda, ROV com refletores à esquerda, raios de luz fracos no alto. |
| Cena 3 | `[URL_CENA_3]` | Leito marinho escuro com o conjunto de BOP submarino empilhado ao centro (x≈50 %): LMRP e diverter no topo, BOP anular, dois BOPs de gaveta, conector H-4 assentado na cabeça de poço; à direita um sistema 20k e um BOP elétrico compacto; à esquerda válvulas/manifold do stack e painel de controle; ROV com refletores e luzes âmbar pequenas. Sem árvore de natal, PLET ou bombas. |
| Cena 4 | `[URL_CENA_4]` | Corte geológico do subsolo marinho, camadas de sedimento/argila/areia/rocha em tons indigo-violeta, tubo condutor e revestimento de superfície ao centro com cimentação visível, cota de profundidade discreta. |
| Cena 5 | `[URL_CENA_5]` | Corte técnico do poço em perfuração: revestimento, coluna de perfuração ao centro, broca/BHA no fundo e reservatório poroso dourado com óleo. |
| Junção S1 | `[URL_S1]` | Faixa transparente: ondas e espuma vistas de baixo + casco/flutuadores em cima; água azul-petróleo com raios de luz embaixo; abertura central 47–53 %. |
| Junção S2 | `[URL_S2]` | Faixa transparente: água escura com neve marinha em cima; lama do leito com ondulações e rochas embaixo; abertura 47–53 % (cabeça de poço). |
| Junção S3 | `[URL_S3]` | Faixa transparente: sedimento superficial com conchas e condutor em cima; camadas de argila/areia embaixo; abertura 48–52 %. |
| Junção S4 | `[URL_S4]` | Faixa transparente: folhelho denso com estratos em cima; topo poroso do reservatório com óleo embaixo; abertura 48–52 %. |
| Folha de sprites | `[URL_SPRITES]` | 1024 × 688, transparente. Linha de cima: 4 criaturas (cardume pequeno, peixe-lanterna, água-viva, peixe grande). Linha de baixo: **ROV** (frame 1: propulsores ligados; frame 2: apenas frente) e **cauda para cima/baixo** de peixe. Meça os recortes `[x, y, w, h]` depois de gerada. |

**Uso das cenas:** cada cena é o `background` de uma caixa `.art` (`center / 100% 100% no-repeat`) via variável `--img`. Dentro de `style` inline use `url('…')` com aspas simples. Enquanto a URL não existir, use um fundo de substituição sólido (`#04101F`) para o layout funcionar.

**Uso dos sprites:** igual ao original. Para um recorte `[x, y, w, h]` numa folha de 1024 × 688: `background-size = (1024/w × 100)% (688/h × 100)%`, `background-position = (x/(1024−w) × 100)% (y/(688−h) × 100)%`, `aspect-ratio = w/h`. Criaturas recebem `filter: drop-shadow(0 0 10px rgba(120,220,255,.45))`.

---

## Fontes

Embutidas como base64 WOFF2 (subconjunto latino **com acentos do português**: á à â ã é ê í ó ô õ ú ç):
- **Oswald** (variável 200–700): título e subtítulo do herói, números da régua.
- **Inter** (variável 100–900): menu, títulos, texto, botões, fichas.

## Tokens

| Token | Valor |
|---|---|
| `--abismo` (fundo e theme-color) | `#04101F` |
| `--ink` | `#EAF6FF` |
| `--soft` (texto) | `rgba(220,238,250,.78)` |
| `--azul-hmh` | `#1496C8` (estimado do logo; trocar pelo oficial) |
| `--vermelho-hmh` | `#E1333F` (estimado do logo; trocar pelo oficial) |
| `--ambar` (hover, refletores, óleo) | `#FFB347` |
| `--ease` | `cubic-bezier(.2,.8,.2,1)` |
| `--artH` | `calc(100vw × 1520 / 2688)` |

## Estrutura da página

- `<header class="nav">` fixo, `z-index 50`. `<aside class="regua">` fixo (`z-index 40`). `<aside class="ficha">` e `<aside class="catalogo">` (`z-index 60`). `.lanterna` fixa (`pointer-events:none`).
- `#scroller`: `position: fixed; top: 0; width: 100%`, movido por `translate3d`. Contém as 5 `<section class="scene">` com um `<div class="seam">` entre cada par. **Sem rodapé.** A altura do `body` é definida por JS = altura do scroller.
- `.scene`: `position: relative; height: var(--artH); overflow-x: clip`. A cena 1 tem `overflow: clip` nos dois eixos.
- `.art`: `position:absolute; top:0; left:0; width:100vw; height:var(--artH)`; contém `.bg` e **todas as camadas animadas e hotspots posicionados em % da ilustração**.
- `.seam`: `position:relative; height:0; z-index:10; pointer-events:none`. `.band` dentro: `position:absolute; left:0; top:0; width:100vw; aspect-ratio:2688/1152; transform:translateY(−50%)`; `<img>` da faixa (`z-index 1`) e, atrás, o canvas de fluxo (`z-index 0`). Os hotspots e botões têm `pointer-events:auto`.

### Menu

- Barra de 64 px, padding `0 2.2vw`, grid `1fr auto 1fr`, gradiente de cima para baixo `rgba(4,16,31,.6) → transparente`. Inter 500, 12 px, links `rgba(234,246,255,.85)` → branco no hover.
- **Esquerda:** "A Descida", "Equipamentos", "O Poço".
- **Centro, logo HMH:** use o arquivo do logo fornecido (letras **H** azul, **M** vermelho em forma de onda senoidal contínua, **H** azul), de preferência como SVG inline; altura 24 px. Se só houver PNG, recrie o logo em SVG: dois "H" de traço arredondado em `--azul-hmh` e um "M" em onda em `--vermelho-hmh`.
- **Direita:** "Catálogo" (abre o painel), "Contato" e o botão "Fale com a HMH" (borda 1 px `rgba(234,246,255,.6)`, padding `9px 14px`, raio 2 px; preenche de branco com texto `--abismo` no hover).
- **Carregamento:** menu desliza de `translateY(−100%)` em 900 ms, atraso 500 ms.

---

## Cenas, com todas as camadas

> Posições `left / top` em % da `.art`; larguras em % da largura. Todo `.glow`, `.mist` e `.raio` é centrado com `translate(−50%,−50%)`. Os valores abaixo são **alvos de composição** (os prompts de imagem pedem esses lugares); ajuste com `?debug=1` depois de gerar as imagens.

### 1. Superfície (`#superficie`, focus 50)

- **Camadas:** `.raio-sol` (halo quente) em 18 / 20, largura 14 %, respirando 6 s; **ondas** (canvas, ver "Partículas") na faixa y 58–62 %; **cáustica** (shimmer) em x 0–100 %, y 59–75 %; **luzes piscantes âmbar** (`.glow`) na sonda: 50 / 12 (2,4), 62 / 28 (2,2), 36 / 26 (2,2), 50 / 52 (3); **canvas de fluxo (luz ciano)** descendo pelo riser: 48,6 / 62, 2,8 × 38, velocidade 1; **bolhas** perto do casco; **cardume** (3 sprites) em y 70–85 %; **2 gaivotas** opcionais cruzando o céu 8 %–30 % (usar sprite de ave se gerado; senão omitir).
- **Hotspots (HMH):** Top Drive (50, 14) · Estruturas / mastro e subestrutura (50, 24) · Mesa rotativa (50, 36) · Roughneck (44, 40) · Guincho / Drawworks (58, 34) · Bombas de lama (70, 44) · Sistemas de lama (30, 44) · Guindastes e equipamentos de manuseio (66, 28) · Sistema de compensação de movimento (50, 50) · Divertor (50, 54). **Contexto (sem ficha HMH, hotspot cinza):** Heliponto (34, 27), Linhas de ancoragem (30, 72) e (70, 72).
- **Texto do herói** centrado em `top: artH × .085`, `z-index 6`:
  - `h1`: **"ÁGUAS PROFUNDAS"**, uma `<span>` por letra, Oswald 500, `clamp(40px, 5.6vw, 108px)`, line-height 1, `letter-spacing: calc(var(--ls,.3em) + var(--lsx,0em))`, padding-left igual a `--ls`, `overflow:hidden`, sombra `0 0 40px rgba(20,150,200,.5)`.
  - `.sub`: **"UMA DESCIDA ATÉ O POÇO"**, Oswald 500, `clamp(12px, 1.18vw, 22px)`, tracking .62em, branco, em `top: artH × .335` dentro do bloco (sobre o céu escuro, não sobre o sol).
  - Abaixo, dica "Role para mergulhar ↓" (Inter 500, 12 px, com seta que oscila 8 px em 1,8 s).

### 2. A Coluna d'Água (`#coluna`, focus 50)

- **Camadas:** canvas de fluxo (luz) 47,6 / 0, 4,8 × 100, vel. .9; **neve marinha** (canvas, 80 partículas); **raios de luz** fracos no alto (`.raio`, 3, em 30/6, 50/4, 70/8, opacidade .12, respirando); **luzes âmbar do ROV** (`.glow` 2): 28 / 52 e 30 / 55; luzes vermelhas de aviso nas boias: 22 / 40 e 76 / 44 (`.glow`, 1,6); **cardume** e **água-viva** (sprites, repelidos pelo cursor); **ROV** (sprite) em 28 / 55 que patrulha.
- **Hotspots:** Risers de perfuração (50, 50) · Sistema MPD, perfuração com pressão controlada (62, 20) · **Contexto (cinza):** Módulos de flutuação (50, 28), Umbilical (57, 62), ROV (28, 55), Boias (22, 40).
- **Texto** à esquerda, `left 6,5 %`, `top 26 %`, largura 31 %:
  - `h2`: "A Coluna d'Água"
  - Parágrafo: "Entre a sonda e o leito marinho, quilômetros de água separam a superfície do poço. Aqui o riser, o umbilical e as linhas fazem a ponte: levam fluido, energia e controle até o fundo."
  - Parágrafo: "A cada cem metros a luz diminui, a pressão sobe e o trabalho fica mais preciso. É a hora de os ROVs entrarem em ação."
  - Botão: "Ver equipamentos desta zona" (abre o catálogo filtrado).

### 3. O Leito Marinho (`#leito`, focus 50)

- **Camadas:** **canvas de fluxo (luz)** descendo até o conjunto de BOP: 49 / 0, 3,6 × 40; luzes âmbar piscantes (`.glow` 2,2–3,4) no BOP 50 / 46, no conector H-4 50 / 66 e no sistema 20k 76 / 52; **luzes frias** (`.glow.cold`, 6) nos refletores; **neve marinha** (60); **lama levantada** (canvas `poeira` perto do ROV); **bolhas** nos controles; **ROV** em 30 / 40; **2 peixes de profundidade**.
- **Hotspots (HMH):** Diverter / LMRP (50, 26) · BOP anular Hydril e GX (50, 38) · BOP de gaveta Hydril, blocos de gaveta (50, 50) · Conector Vetco H-4 e gaxetas (50, 62) · BOP elétrico (66, 44) · Sistema submarino 20k (78, 52) · Controles e análises de BOP (84, 30) · Válvulas e manifolds (24, 60) · Subsea stack test valve, SSTV (24, 46). **Contexto (cinza):** Cabeça de poço (50, 72).
- **Texto** à direita, `left 55 %`, `top 24 %`, largura 40 %:
  - `h2`: "O Leito Marinho"
  - `h3`: "Segurança em primeiro lugar."
  - Parágrafo: "O conjunto de BOP é a última barreira do poço: se a pressão sair do controle, as gavetas e o anular fecham. É aqui que o controle de pressão da HMH trabalha."
  - `h3`: "Comandado do convés."
  - Parágrafo: "Controles e análises acompanham cada função do BOP, a mais de dois quilômetros de distância, e o sistema 20k leva a perfuração a pressões ainda mais altas."

### 4. O Subsolo (`#subsolo`, focus 48)

- **Camadas:** **canvas de fluxo (luz)** pelo poço: 47,2 / 0, 5,6 × 100, vel. .8; **grãos/partículas de rocha** (canvas `poeira`, 40); **linhas de cota** (régua de profundidade desenhada em SVG, pequenas marcas a cada 250 m); **luzes âmbar** no cimento: 54 / 50 (2,4).
- **Hotspots (todos de contexto, cinza, sem ficha HMH):** Condutor 30″ (50, 18) · Revestimento de superfície 20″ (50, 38) · Cimentação (54, 52) · Sapata do revestimento (50, 70) · Camadas geológicas (20, 60).
- **Texto** à esquerda, `left 6,5 %`, `top 25 %`, largura 40 %:
  - `h2`: "O Subsolo"
  - Parágrafo: "O poço é construído em camadas: cada coluna de aço, cimentada na rocha, isola o caminho do óleo e protege o meio ambiente."
  - Parágrafo: "Condutor, revestimento de superfície e cimentação formam a base de tudo o que vem depois."

### 5. O Poço (`#poco`, focus 50)

- **Camadas:** **canvas de fluxo (óleo, âmbar, direção ascendente)**: 48 / 15, 4 × 75, vel. .6, e canal lateral no reservatório 20 / 70, 60 × 10 (fluxo horizontal lento); **bolhas de gás** subindo (30); **brilho do reservatório** (`.glow` âmbar, 20 × 10 em 50 / 85); **canhoneado** (faíscas curtas, `shimmer` em x 44–56 %, y 66–74 %); **mote** de partículas em x 30–70 %.
- **Hotspots (contexto, cinza, sem ficha HMH):** Revestimento de produção (50, 25) · Coluna de perfuração (50, 45) · Broca / BHA (50, 80) · Reservatório (50, 88). Troque "coluna de produção", packer, DHSV e canhoneado por esses itens de perfuração, já que não constam no portfólio HMH. No texto-legenda do poço, diga que o poço é o destino do trabalho que o equipamento HMH torna seguro.
- **Texto** centrado, `left: 50%; translateX(−50%); top: 20%; width: 60%`:
  - `h2`: "Chegamos ao reservatório."
  - Parágrafo: "Cinco mil metros abaixo da sonda, o óleo encontra o caminho até a superfície."
  - Botões: "Falar com a HMH" (branco) e "Ver todo o catálogo" (fantasma, borda 1 px `rgba(234,246,255,.6)`). **Sem rodapé:** a página termina aqui.

---

## Equipamentos (fonte: hmhw.com, áreas Drilling Equipment offshore e Pressure Control offshore)

Implemente como array `EQUIPAMENTOS = [{id, nome, categoria, cena, x, y, prof, desc, specs:[[rótulo,valor],…], hmh:true|false, url}]`. `hmh:true` = produto HMH (hotspot azul, abre ficha com link "Ver no site da HMH" para `url`); `hmh:false` = elemento de contexto (hotspot cinza, ficha curta explicativa, sem link). Os `specs` são "a definir" salvo onde o site traz o dado. Os nomes dos produtos ficam em inglês (marcas/nomes próprios); descrições em português.

| Cena | Produto HMH (`hmh:true`) | Link |
|---|---|---|
| 1 Superfície | MH Top Drives | hmhw.com/service/top-drives-offshore/ |
| | MH Roughnecks | hmhw.com/service/roughnecks-2/ |
| | Wirth Drawworks | hmhw.com/service/drawworks-2/ |
| | Wirth Rotary Tables | hmhw.com/service/rotary-tables-2/ |
| | Wirth Mud Pumps | hmhw.com/service/wirth-offshore-mud-pumps/ |
| | HMH Mud Systems | hmhw.com/service/mh-mud-systems/ |
| | Handling Equipment and Cranes | hmhw.com/service/handling-equipment-and-cranes/ |
| | Structures (mastro/subestrutura) | hmhw.com/service/ramrig/ |
| | Motion Compensation System | hmhw.com/service/motion-compensation-systems/ |
| | Diverters | hmhw.com/service/diverters/ |
| 2 Coluna d'água | Drilling Risers | hmhw.com/service/drilling-risers/ |
| | MPD System | hmhw.com/service/mpd-system/ |
| 3 Leito marinho | Hydril Annular BOP · GX™ Annular BOP · Hydril Annular Packing Elements | hmhw.com/service/bop-annulars-2/ · …/annular-packing-elements-2/ |
| | Hydril RAM BOPs · Hydril RAM Blocks · 18¾" Compact™ RAM BOP (15.000 psi, 30–500 °F, 10.000+ pés) · SSTV | hmhw.com/service/bop-rams-2/ · …/ram-blocks-2/ |
| | Vetco H-4 Connectors and Gaskets | hmhw.com/service/h4-connector/ |
| | Electric BOP | hmhw.com/service/all-electric-bop/ |
| | 20k Subsea Drilling System | hmhw.com/service/20k-subsea-drilling-system/ |
| | BOP Controls and Analytics | hmhw.com/service/bop-control-and-analytics/ |
| | Valves & Manifolds (XTRM/TM gate valves) | hmhw.com/service/xtrm-tm-gate-valves/ |
| Digital (HUD) | beAware™ (digitalização) · DEAL™ & CADS (automação) · Drilling Lifecycle Services | ver `business_area` no site |

**Contexto (`hmh:false`):** Heliponto, Linhas de ancoragem, Módulos de flutuação, Umbilical, ROV, Boias, Cabeça de poço, Condutor 30″, Revestimento de superfície 20″, Cimentação, Sapata, Camadas geológicas, Revestimento, Coluna de perfuração, Broca/BHA, Reservatório.

**Equipamentos que faltam levantar** (o site lista mais itens em outras páginas): Wear resilient rotating control device (RCD, citado sem link), "Other Offshore Rig Equipment", "Other Pressure Control Equipment", a versão **onshore** (Rig Equipment e Pressure Control Equipment) e as áreas **Mining Equipment**, **Construction Equipment**, **Manufacturing** e **Training**. Sugestão: **beAware™ e DEAL™/CADS** viram um selo "Camada digital" no HUD (leitura de dados da sonda) e as áreas de mineração/construção entram numa 6ª cena opcional ou numa seção final de "Outras frentes HMH".

---

## Tipografia dos textos

| Elemento | Estilo |
|---|---|
| `h2` | Inter 600, `clamp(30px, 3.4vw, 60px)`, line-height 1.04, tracking −.025em |
| `.regra` | 150 × 1 px, `rgba(234,246,255,.45)`, margens `20px 0 22px`, `transform-origin:left` |
| `h3` | Inter 600, 15 px, 22 px acima / 8 px abaixo (sem margem logo depois da regra) |
| Parágrafo | Inter 400, 14 px, line-height 1,55, `--soft`, máx. 52ch, 10 px entre parágrafos |
| `.btn` | altura 38 px, padding `0 18px`, fundo branco, texto `--abismo`, Inter 600 12,5 px, raio 2 px, 22 px acima |
| Bloco de texto | `max-width: 520px`, `z-index 6`; sem linhas de "eyebrow" |

Hover do botão: fundo `--ambar`, texto `#1A0B05`, sobe 2 px (`--ease`); cor em .3 s.

---

## Renderizador de fluxo (`canvas.fluxo`)

- `mix-blend-mode: screen`; **máscara dupla intersectada** (`mask-composite: intersect`, `-webkit-mask-composite: source-in`): horizontal transparente → preto 22 % → preto 78 % → transparente; vertical transparente → preto 12 % → preto 82 % → transparente.
- **Sprites de traço**, 2 por tipo, canvases fora da tela de 8 × 160 com gradiente vertical:

| Tipo | Sprite A | Sprite B |
|---|---|---|
| `luz` (riser, coluna) | `rgba(190,240,255,0)` → `rgba(210,248,255,.95)` a 35 % → `rgba(120,200,255,0)` | `rgba(120,190,255,0)` → `rgba(140,215,255,.8)` a 50 % → `rgba(90,150,255,0)` |
| `oleo` (poço) | `rgba(255,190,80,0)` → `rgba(255,236,150,1)` a 40 % → `rgba(255,120,30,0)` | `rgba(255,120,30,0)` → `rgba(255,150,50,.9)` a 50 % → `rgba(255,80,20,0)` |

- **Dimensionamento** (carga e resize): ler `offsetWidth/offsetHeight` (ignoram transform); DPR máx. 1,5.
- **Traços por canvas:** `luz`: `round(w/2.2) × 2`, x em toda a largura, espessura .8–4 px, comprimento 60–280 px, velocidade 420–760 px/s × `data-speed`, opacidade .18–.73. `oleo`: `round(w/3) × 3`, x nos 50 % centrais, espessura 1–3,2 px, comprimento 30–100 px, velocidade 195–350 px/s × `data-speed`.
- **Por quadro:** limpa, `globalCompositeOperation='lighter'`; `y = ((t·v·speed + fase) mod (h+len)) − len` (para `data-dir="up"`, inverta: `y = h − …`); desenha o sprite em (x, y) e uma altura acima para o loop contínuo; traços de `luz` esmaecem nas bordas por `1 − (|x/w − .5|·2)² × .6`; só desenha canvases a menos de 50 px da viewport.
- **Canvases em junções** preenchem primeiro um corpo d'água horizontal: gradiente `rgba(20,110,170,0)` nas bordas → `rgba(30,150,210,.7)` a 18 % e 82 % → `rgba(150,230,255,.9)` ao centro, para que o fluxo seja opaco o bastante e continue o do cenário.

## Canvases de partículas (`canvas.part`)

Cada canvas cobre toda a arte (`mix-blend-mode: screen`); partículas com `u, v, r, fase, vel .4–1,2`; caixa opcional `data-x/w/y/h` em %; desenhado só quando visível.

| Tipo | Comportamento |
|---|---|
| `neve` (coluna, leito) | Cai muito devagar (`.012 × vel` da altura/s), volta ao topo, oscila ±2 %, raio .6–2,2 px, opacidade .25–.7, cor `rgb(190,225,245)` |
| `bolha` | `vida = (t·vel·.16 + fase) mod 1`; sobe da base ao topo da caixa com oscilação `sin(1,4t)` × 3 %, raio (2–9 px) × largura/1440; gradiente radial `rgba(220,245,255,a) → rgba(120,200,255,.5a) → transparente`, brilho deslocado; `a = sin(vida·π)·.9` |
| `onda` (superfície) | Linhas senoidais empilhadas (4) com amplitude 3–8 px, comprimento de onda 120–260 px, deslocamento horizontal contínuo, cor `rgba(190,235,255,.25)`, espuma em picos |
| `caustica` (superfície) | Reflexos de luz em losango de 12–40 px, `a = max(0, sin(t·(1,2+2r) + fase))·.7`, cor `rgb(220,250,255)` |
| `poeira` (leito, subsolo) | Partículas curtas de 1–2 px que derivam lateralmente com `sin(t)`, cor `rgb(200,215,230)` |
| `mote`, `brilho` (poço) | `mote`: sobe devagar, oscila ±2 %, raio .6–2 px, cor `rgb(255,210,140)`; `brilho`: faíscas horizontais de 12–32 px × 1,2 px, `a = max(0, sin(t·(1,2+2r)+fase))·.8` |

## Brilhos CSS

| Classe | Visual | Animação |
|---|---|---|
| `.glow` (âmbar) | `radial-gradient(closest-side, rgba(255,170,70,.7), rgba(255,120,40,.22) 50%, transparent)`, `mix-blend-mode:screen` | `pisca` 2,8 s `steps(1,end)` infinito (opacidade 1 → .78 → 1 → .86 → 1 → .7 → .95 → .82) |
| `.glow.cold` | Ciano `rgba(150,235,255,.6)` / `rgba(110,190,255,.2)` | `respira` 3,8 s |
| `.raio` | Cone de luz, `linear-gradient` estreito, `blur(6px)`, opacidade .12 | `respira` 7 s |
| `.mist` / `.bruma` | Elíptico `rgba(120,200,240,.4)` → transparente | `respira` 4,6 s |

`respira`: centraliza e escala 1 → 1,08 → 1, brilho 1 → 1,25 → 1, ease-in-out.

## Criaturas e ROV em movimento

- **Cardumes, águas-vivas, peixes:** posição inicial por `translate3d` na âncora em %; deriva `x += sin(.35t+fase)·1,2 %` da largura, `y += sin(.9t+fase)·1,4 %` da altura; rotação `sin(.7t+fase)·6° + offsetX·.05`. **Repulsão do cursor:** a menos de 260 px, empurrados para longe até `(1 − d/260)^1.5 × 90` px, com suavização `1 − e^(−3dt)`.
- **Cardume cruzando:** cada peixe nada de `x: −8 % → 108 %` em 9–16 s em loop, `y = y0 + sin(p·9 + deslocamento·6)·(1–4) %`, largura 1,6–3,2 % da arte; a cauda alterna entre dois frames 8–12 vezes por segundo (classe `.baixo`).
- **ROV:** um por cena 2 e 3; patrulha em oito suave (`x += sin(.3t)·3 %`, `y += sin(.5t)·2 %`), refletor aceso (`.glow` ligado à posição) e, quando uma ficha é aberta, **desliza até o hotspot** em 1,2 s (`--ease`) e fica a 4 % do alvo balançando.

## Sistema de movimento

- **Scroll suave:** a cada quadro `cur += (scrollY − cur)·(1 − e^(−7.5·dt))`, com snap a menos de .05 px; `#scroller` recebe `translate3d(0, −cur px, 0)`. Âncoras saltam com scroll nativo e a inércia faz o deslize.
- **Paralaxe do herói:** `.art` da cena 1 translada `+cur·.32`; `.hero-copy` translada `+cur·.55`. `--lsx` do título vai de 0 a .18em com `hp = clamp(cur / alturaHeroi, 0, 1)`.
- **Introdução (Web Animations, todos com `--ease`):** letras sobem `translateY(110%) → 0` em 1200 ms, início 250 ms, 70 ms entre letras; subtítulo em 1600 ms a partir de 900 ms (letter-spacing 1,4em → .62em, `translateY(14px) → 0`, `clip-path: inset(0 50% 0 50%) → inset(0)`); `.art` do herói `scale(1,09) → 1` em 2600 ms (composite "add"); menu desliza em 900 ms.
- **Reveals de texto:** na 1ª vez que o topo do bloco passar de 80 % da viewport, cada `.ln > span` sobe `translateY(105%) → 0` em 1000 ms, 80 ms de intervalo; a `.regra` escala X 0 → 1 em 1100 ms após 160 ms. **Nenhum fade de opacidade.**
- **Profundidade:** a cada quadro calcule a profundidade pelo `cur` e atualize régua, `--lamp-a`, texto numérico (com `font-variant-numeric: tabular-nums`) e marca ativa.

## Responsivo (≤ 767 px)

- `--artH: max(100vw × 1520/2688, 92svh)`; `.art` alarga para `artH × 2688/1520` e desliza para centrar o `--focus` da cena: `left = 50vw − focus × larguraArte / 100` (focus: 50, 50, 50, 48, 50). As faixas seguem o `--focus` da cena de baixo.
- Menu de 56 px: só logo (esquerda) e botão "Fale com a HMH" (direita); o "Catálogo" vira botão flutuante inferior.
- Régua vira barra fina horizontal no topo (4 px) com leitura compacta "1.250 m · 125 bar". Fichas viram folha inferior de 60 svh.
- Texto do herói em `artH × .11`, título 8,2vw com `--ls:.1em`, subtítulo 11 px com tracking .42em em `top: artH × .305`. Texto das seções em largura total (20 px laterais, `top 24 %`) sobre painel `linear-gradient(rgba(4,16,31,.8), rgba(4,16,31,.5))` com `backdrop-filter: blur(2px)` e padding 18 px; `h2` 30 px, parágrafos 13,5 px. Cena 5 sem painel.
- Hotspots: alvo de toque mínimo de 44 px (área transparente maior que o anel).

## Movimento reduzido

`prefers-reduced-motion`: glows, brumas e raios param; textos aparecem sem subir; scroll sem inércia; canvases desenham um único quadro (t = 0); ROV e criaturas ficam parados; ping de sonar vira um destaque estático; hotspots não pulsam.

## Acessibilidade

Contraste mínimo AA nas fichas e no texto; foco visível (anel 2 px `--ambar`); `aria-live="polite"` na leitura de profundidade (atualiza a cada 100 m); `aria-label` em todos os hotspots; ficha com `role="dialog"` não modal e retorno de foco ao hotspot ao fechar.

## Checklist de aceitação

1. **Carga:** a 1440 × 810 a sonda ocupa a tela; "ÁGUAS PROFUNDAS" sobe letra a letra, o subtítulo abre do centro, o riser já exibe pulsos de luz descendo.
2. **Cursor:** a lanterna do ROV segue o mouse; peixes e águas-vivas fogem dele; clicar dispara um sonar.
3. **Descida:** o scroll desliza com inércia; a régua mostra profundidade, pressão, temperatura e luz coerentes com a tabela; em cada junção uma faixa ilustrada liga as cenas e o fluxo atravessa a abertura como uma linha contínua; **sem gradientes de transição**.
4. **Equipamentos:** todos os produtos HMH da tabela têm hotspot azul com link para o site da HMH; elementos de contexto têm hotspot cinza; clicar abre a ficha e o ROV vai até ele; o catálogo lista tudo, filtra por categoria e leva até a cena.
5. **O poço:** na cena 5 o óleo âmbar sobe ao lado da coluna de perfuração, a broca faísca e o reservatório brilha; a página termina ali, sem rodapé.
6. **Idioma:** 100 % do texto visível em português do Brasil, com acentos corretos.
