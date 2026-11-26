# Sistema de design das telas de demonstração

Vale para as duas páginas (Deep Water, `index.html`, e Mineração, `mineracao.html`). Os estilos novos ficam em `assets/css/componentes.css` (carregado depois de `site.css`); `mina.css` só tem o layout da página de Mineração. Depois de editar CSS ou JS, rode `python tools/versionar.py`.

## Tokens

| Grupo | Tokens | Regra |
|---|---|---|
| Tipografia | `--fs-1` 11 · `--fs-2` 12 · `--fs-3` 14 · `--fs-4` 16 · `--fs-5` 22 · `--fs-6` 28 | Só esses seis tamanhos nos componentes novos. Títulos em Oswald, caixa-alta. |
| Espaço | `--sp-1` 4 · `--sp-2` 8 · `--sp-3` 12 · `--sp-4` 16 · `--sp-5` 24 | Padding e `gap` usam só esta escala. |
| Cantos | `--r-1` 10 · `--r-2` 16 · `--r-3` 24 · `--r-pill` | Cartões e janelas `--r-3`, blocos internos `--r-2`, itens de lista `--r-1`. |
| Elevação | `--sh-1` (cartão) · `--sh-2` (alerta) | |
| Camadas | `--z-scene` 15 · `--z-hud` 20 · `--z-alert` 57 · `--z-modal` 76 | A barra é 60, o véu 70 e o catálogo 75 (de `site.css`). |
| Superfícies | `--surf-dark` · `--surf-modal` · `--line-dark` · `--line-light` | Deep Water usa cartões escuros (`.dw`); Mineração usa o vidro claro (`.glass`). |
| Semânticas | `--c-alert` · `--c-ok` · `--c-media` | Alerta e sucesso do cenário de kick; fundo de mídia. |

## Componentes

| Componente | Classe / seletor | Estados |
|---|---|---|
| Cartão flutuante | `.mcard` (+ `.dw` escuro, `.min` minimizado) | padrão, minimizado (`.mbody` some) |
| Botão de ícone (minimizar, fechar) | `.mn`, `.x2`, `.x`, `.xb` | normal, hover; 32 px |
| Pílula (chips, abas, ações) | `.chips button`, `.ksc button`, `.kct button`, `.mtabs button`, `.mpanel .lk a`, `.zoomOut`, `#intro .alt` | normal, hover, `aria-pressed="true"` |
| Marcador na cena | `.mhp`, `.mhp.ctx`, `.mhp.op`, `.mhp.off` | produto, contexto, operação, oculto |
| Janela | `.mpanel`, `.eqlist` | fechada, `.on` |
| Legenda | `.mudLeg`, `.flowLeg` | oculta (`hidden`) |
| Banner do kick | `.kick` (+ `.safe`, `.min`) | alerta, controlado, minimizado |
| Menu de operações | `.opsMenu` | fechado (`hidden`), aberto |
| Cartão de clima | `.wxp` (+ `.wxBan` faixa de WOW) | fechado, aberto, minimizado |
| Modo Cinema | `.cine` (`.cineTop`, `.cineCap` legenda, `.cineBar` controles, `.cineEnd` cartão final) | reproduzindo, pausado, controles ocultos (`.bare`), fim |
| Cenário interno | `.scn` (`.scnTop`, `.scnL`, `.scnR`, `.scnBar`, `.scl` rótulos 3D) | carregando (`.scnFade`), aberto; no celular `.showR` alterna Etapas/Dados |

## Regras de uso

- Cartão novo = `.mcard` + `.glass` (claro) ou `.glass.dw` (escuro) + `.mbody` para o que some ao minimizar + botão `.mn`.
- Não escreva tamanhos de fonte, cantos, `z-index` ou cores soltos nos componentes novos: use os tokens.
- Botões de ícone têm no mínimo 32 px; textos pequenos sobre fundo escuro ficam em opacidade 0,7 ou mais.
- Os componentes originais do site (`site.css`) não foram padronizados: têm 23 tamanhos de fonte e 122 cores soltas. Se quiser, esse é o próximo passo.
