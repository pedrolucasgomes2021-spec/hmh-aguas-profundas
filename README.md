# HMH — Águas Profundas

Site interativo em 3D que desce, em linha reta, da sonda de perfuração na superfície até o reservatório, mostrando os equipamentos da HMH em cada etapa: topside, tensionadores, riser, BOP no leito marinho, perfuração do poço e reservatório.

## Como abrir

O site é estático, mas precisa ser servido por HTTP (aberto como arquivo, mostra só a versão sem 3D).

- **Windows:** dê dois cliques em `servir.bat` — abre `http://localhost:8765`.
- **Qualquer sistema:** `python -m http.server 8765` na pasta do projeto.

## O que tem

- Cena 3D em three.js (local, sem CDN), com câmera que só desce, oceano com ondas, peixes, iluminação HDR e sombras.
- Clique em um equipamento: painel com foto oficial, vídeo do YouTube e link para hmhw.com.
- **Catálogo completo da HMH** (77 itens, todas as páginas de produtos e serviços de hmhw.com): filtro por área (offshore, terra, serviços e digital, mineração e construção), por categoria e busca.
- **Qualidade** (botão à esquerda do indicador de seção, ou tecla `Q`): Automática, Baixa, Média, Alta (Full HD) e Ultra (4K). A automática escolhe pela placa de vídeo e sobe para o Ultra sozinha se houver folga. O menu mostra a resolução interna real e os quadros por segundo.
- **Zoom** (− / % / +, ao lado do indicador de seção): aproxima e afasta de 80% a 320%. Teclado: `+`, `-` e `0` (voltar a 100%). Com zoom, arraste para os lados (mouse ou deslizar na horizontal no toque) para percorrer a sonda.
- **ESG Point**, **Catálogo** com busca e filtro, tour **Como funciona**, **Visão geral**, modo noite e versão em inglês (PT/EN).
- Som ambiente gerado no navegador, suporte a toque (tablet) e links diretos por equipamento (ex.: `#bop/gxp`).
- Acessível (WCAG 2.1 AA): contraste conferido, navegação por teclado e leitor de tela, zoom de 200%.
- Versão estática completa no HTML (SEO e navegadores sem WebGL).

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `index.html` | Página (o conteúdo estático é gerado) |
| `content/conteudo.json` | **Todo o texto** em PT e EN: seções, produtos, ESG, tour |
| `assets/js/` | `app.js` (cena e interface), `kit.js` (materiais e geometria), `modelos.js` (equipamentos 3D), `detalhes3d.js` (peças extras: sonda, BOP, riser, fundo do mar, águas-vivas), `detalhe.js` (desgaste e sujeira), `ssao.js` (oclusão ambiente) |
| `assets/css/site.css` | Estilos |
| `assets/fotos/`, `assets/texturas/`, `assets/hdri/` | Fotos dos produtos, texturas e céu |
| `assets/models/` | Espaço para modelos 3D oficiais (GLB) — ver o README da pasta |
| `tools/` | `baixar_assets.py` (primeira carga de fotos e texturas), `montar_catalogo.py` + `dados_catalogo.py` (catálogo completo e fotos), `baixar_texturas_hd.py` (texturas PBR), `baixar_detalhes_ambientcg.py` (desgaste da tinta e do aço), `reduzir_hdri.py`, `gerar_html.py` |
| `versoes-antigas/` | Versões anteriores (2D e 3D v1/v2) |

## Editar o conteúdo

1. Edite `content/conteudo.json`.
2. Atualize o conteúdo estático do HTML:

```bash
python tools/gerar_html.py
```

## Direitos

Logo, fotos de produto, nomes de produtos e vídeos são da HMH (hmhw.com). O uso neste projeto ainda depende de validação com a HMH — veja [VALIDAR-COM-HMH.md](VALIDAR-COM-HMH.md). Texturas e céu: [Poly Haven](https://polyhaven.com) e [ambientCG](https://ambientcg.com) (ambos CC0). three.js: licença MIT.

## Desempenho

- Cena pronta em ~8 s num notebook com GPU integrada Intel UHD (era ~24 s); 45 a 58 quadros por segundo (eram 18).
- Antisserrilhado depois do tonemapping: SMAA (Média, Alta e Ultra) e FXAA (Baixa). O Ultra renderiza em 4K (com supersampling em telas Full HD). Não usamos MSAA: em buffer de ponto flutuante ele gerava pixels inválidos nas cenas submarinas.
- Os shaders são compilados em paralelo durante a abertura (botão "Iniciar" só libera quando a cena está pronta), contra o alvo de render real.
- A qualidade inicial depende da GPU (integrada: baixa; dedicada: máxima) e cai sozinha se o desempenho ficar abaixo de 38 quadros por segundo.
- Grupos grandes (sonda, BOPs, tensionadores, peixes) só são desenhados perto da vista.
- Texturas em dois níveis: base de 1024 px na abertura e **pacote HD** (`assets/texturas/hd`, ~5 MB) em segundo plano depois da entrada, só em desktop com boa GPU e sem "economia de dados".

### Opções na URL

| Opção | Efeito |
|---|---|
| `?q=0` … `?q=3` | Força o nível de qualidade (3 = Ultra 4K, sem queda automática) |
| `?hd` | Carrega o pacote HD mesmo em GPU/dispositivo que normalmente pularia |
| `?debug` | Expõe `window.__dbg` (renderer, cena) para medir desempenho |
| `?nogl` | Mostra só a versão estática |

### Atualizar o catálogo

1. Inclua o item em `tools/dados_catalogo.py` (id, área, categoria, nome, descrições EN/PT, imagens, YouTube).
2. `python tools/montar_catalogo.py` — mescla no JSON, baixa as fotos (WebP completo e miniatura) e é seguro rodar de novo.
3. `python tools/gerar_html.py` — atualiza o conteúdo estático.

## Realismo dos equipamentos

- **Camada de detalhe** (`assets/js/detalhe.js`): desgaste de tinta, relevo fino e aço castigado reais da ambientCG, projetados em 3D (triplanar), sem depender de UV, mais sujeira em grande escala, manchas verticais e incrustação marinha perto do fundo. Todos os materiais compartilham um único programa de shader. Para ajustar a intensidade, edite `PARAMETROS` no início do arquivo (`desgaste`, `sujeira`, `incrustacao`, `escala`). Para trocar as texturas, mude `SETS` em `tools/baixar_detalhes_ambientcg.py` e rode de novo.
- **Oclusão ambiente** (`assets/js/ssao.js`): escurece encaixes e contato entre peças usando a profundidade que a cena já gera (sem segunda renderização). Só na qualidade máxima (`?q=2`), e só na faixa de distância dos equipamentos, para não afetar o horizonte.

## Qualidade: Full HD e 4K

| Nível | Resolução interna | Sombras | Extras |
|---|---|---|---|
| Baixa | até ~2,4 Mpx | 512 | FXAA, sem oclusão ambiente |
| Média | até ~3,2 Mpx | 1024 | SMAA, bloom |
| Alta (Full HD) | nativa até 1440p | 2048 | + oclusão ambiente, pacote de detalhes 3D "A" (propulsores, defensas, âncoras, escadas, guarda-corpos, parafusos, linhas hidráulicas, módulos de flutuação, pedras, vermes tubulares, duto submarino, águas-vivas) |
| Ultra (4K) | 3840 px de largura (2x em telas Full HD, nativa em 4K); estratos em até 6144 px | 4096 | + pacote "B" (costuras do chapeamento, vigias, caixas de junção, mais pedras e corais) |

Os pacotes de detalhe ficam mesclados por material e desligados nos níveis menores, então máquinas modestas continuam leves.

## Versão dos arquivos (evita cache antigo)

Depois de editar qualquer JS, o CSS ou `content/conteudo.json`, rode:

```bash
python tools/versionar.py
```

Ela carimba uma versão nos endereços dos arquivos em `index.html`, então o navegador baixa de novo o que mudou (sem isso, um servidor simples pode misturar arquivos novos e antigos e a cena 3D não inicia). `servir.bat` já usa um servidor sem cache.
