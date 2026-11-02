# Validar com a HMH antes de publicar

Tudo abaixo foi tirado do hmhw.com, mas precisa de um "ok" de alguém da HMH (Marketing / Comunicação, e Engenharia de Produto para os itens técnicos).

## 1. Marca e imagens
- [ ] **Logo**: usado o arquivo oficial `Color-logo-white-background.jpg` do hmhw.com, apenas recortado e com o fundo branco removido (`assets/img/hmh-logo.png`). Não foi redesenhado. Confirmar se pode ser usado assim ou pedir o vetor (SVG) oficial.
- [ ] **Fotos de produto** (54 arquivos em `assets/fotos/`): baixadas das páginas de produto do hmhw.com, com o crédito "Foto: HMH · hmhw.com". Confirmar autorização de uso e, se possível, receber as originais em alta resolução.
- [ ] **Vídeos**: incorporados do YouTube (youtube-nocookie). Confirmar que todos os IDs são do canal oficial e estão atualizados.
- [ ] **Risco**: as fotos vieram do cache do tema do site (`/wp-content/themes/yootheme/cache/...`). Esses endereços mudam quando o site é atualizado; por isso as fotos já estão salvas localmente. Para atualizar, rodar `python tools/baixar_assets.py` e conferir.

## 2. Números e afirmações do ESG Point (`content/conteudo.json` → `esg`)
| Ponto | Afirmação no site | Fonte |
|---|---|---|
| ionic™ Electric BOP | Zero emissões no subsea; ≥ 75 t a menos de equipamento no topside | hmhw.com/service/all-electric-bop/ |
| BOP | Barreira de controle do poço | hmhw.com/sustainability/ |
| MPD | Até 65% menos tempo de rig-up | hmhw.com/service/mpd-system/ |
| DLS / SmartCert | Maior vida útil dos equipamentos | hmhw.com/.../hmh-drilling-optimization-services-dls/ |
| HSSE | Zero dano a pessoas e ao meio ambiente | hmhw.com/sustainability/hsse/ |
| Digitalização | beAware™ · DEAL™ | hmhw.com/sustainability/ |
| Cadeia de suprimentos | Código de Conduta aplicado a fornecedores | hmhw.com/sustainability/global-supply-chain/ |
| ODS | 5 · 8 · 12 · 13 | hmhw.com/sustainability/ |

- [ ] Confirmar cada número e se pode aparecer fora do contexto original.
- [ ] Confirmar se há dados mais recentes (relatório de sustentabilidade do ano).

## 3. Nomes de produtos e marcas registradas
- [ ] Grafia e símbolos (™ / ®): QTR™ 4000LS, QTR™ 3500, HMF™ Riser, Quick-Turn Riser Connector, HMH ionic™ Electric BOP, Hydril®, Wirth™, beAware™, DEAL™, SmartCert.
- [ ] Classificação de cada produto na seção certa da descida (sonda, tensionadores, riser, BOP, perfuração).
- [ ] Itens de contexto **sem** foto HMH (mostram modelo 3D ilustrativo): ROVs, revestimento, broca, reservatório. Confirmar que não devem ser apresentados como produtos HMH.

## 4. Textos
- [ ] Revisão do português e do inglês (`pt` / `en` em `content/conteudo.json`).
- [ ] Profundidades, pressões e temperaturas do medidor são **ilustrativas** (escala didática, não de um poço real). Avaliar se precisa de uma nota no site.

## 5. Técnica / publicação
- [ ] Domínio e hospedagem (o site é estático: qualquer servidor HTTP serve; abrir como arquivo mostra só a versão sem 3D).
- [x] `og:image` com URL absoluta (GitHub Pages). Atualizar se mudar de domínio.
- [ ] Rodar `python tools/gerar_html.py` depois de qualquer mudança no JSON (atualiza o conteúdo estático).
- [ ] Modelos CAD oficiais, se existirem: ver `assets/models/README.md`.
