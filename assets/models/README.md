# Modelos oficiais (GLB)

O site usa modelos 3D procedurais. Quando a HMH fornecer modelos oficiais (CAD exportado em glTF binário), basta:

1. Exportar cada equipamento como `.glb` (Y para cima, unidades em metros; até ~5 MB cada, de preferência com compressão Draco/Meshopt desligada ou com o decoder adicionado).
2. Copiar os arquivos para esta pasta.
3. Mapear no `modelos.json` a chave do equipamento para o arquivo:

```json
{ "bop": "hydril-gx-bop.glb", "ebop": "ionic-electric-bop.glb", "ship": "sonda.glb", "rov": "rov.glb", "k20": "bop-k20.glb" }
```

Chaves usadas na cena: `ship`, `bop`, `ebop`, `k20`, `rov`. Chaves usadas na aba "Modelo 3D" do painel: as mesmas do campo `m` de cada item em `content/conteudo.json` (por exemplo `topdrive`, `drawworks`, `riser`, `bit`).

O modelo oficial é centralizado e escalado para ocupar o mesmo volume do procedural; os pontos clicáveis continuam no mesmo lugar. Arquivo ausente ou com erro: o site mantém o procedural.
