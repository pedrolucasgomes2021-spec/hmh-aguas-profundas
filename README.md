# HMH — Águas Profundas

Site interativo em 3D que desce, em linha reta, da sonda de perfuração na superfície até o reservatório, mostrando os equipamentos da HMH em cada etapa: topside, tensionadores, riser, BOP no leito marinho, perfuração do poço e reservatório.

## Como abrir

O site é estático, mas precisa ser servido por HTTP (aberto como arquivo, mostra só a versão sem 3D).

- **Windows:** dê dois cliques em `servir.bat` — abre `http://localhost:8765`.
- **Qualquer sistema:** `python -m http.server 8765` na pasta do projeto.

## O que tem

- Cena 3D em three.js (local, sem CDN), com câmera que só desce, oceano com ondas, peixes, iluminação HDR e sombras.
- Clique em um equipamento: painel com foto oficial, vídeo do YouTube e link para hmhw.com.
- **ESG Point**, **Catálogo** com busca e filtro, tour **Como funciona**, **Visão geral**, modo noite e versão em inglês (PT/EN).
- Som ambiente gerado no navegador, suporte a toque (tablet) e links diretos por equipamento (ex.: `#bop/gxp`).
- Acessível (WCAG 2.1 AA): contraste conferido, navegação por teclado e leitor de tela, zoom de 200%.
- Versão estática completa no HTML (SEO e navegadores sem WebGL).

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `index.html` | Página (o conteúdo estático é gerado) |
| `content/conteudo.json` | **Todo o texto** em PT e EN: seções, produtos, ESG, tour |
| `assets/js/` | `app.js` (cena e interface), `kit.js` (materiais e geometria), `modelos.js` (equipamentos 3D) |
| `assets/css/site.css` | Estilos |
| `assets/fotos/`, `assets/texturas/`, `assets/hdri/` | Fotos dos produtos, texturas e céu |
| `assets/models/` | Espaço para modelos 3D oficiais (GLB) — ver o README da pasta |
| `tools/` | `baixar_assets.py` (baixa fotos/texturas) e `gerar_html.py` |
| `versoes-antigas/` | Versões anteriores (2D e 3D v1/v2) |

## Editar o conteúdo

1. Edite `content/conteudo.json`.
2. Atualize o conteúdo estático do HTML:

```bash
python tools/gerar_html.py
```

## Direitos

Logo, fotos de produto, nomes de produtos e vídeos são da HMH (hmhw.com). O uso neste projeto ainda depende de validação com a HMH — veja [VALIDAR-COM-HMH.md](VALIDAR-COM-HMH.md). Texturas e céu: [Poly Haven](https://polyhaven.com) (CC0). three.js: licença MIT.
