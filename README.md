# NFSe PDF Generator (NestJS)

Gera PDF(s) de NFS-e a partir de um XML — com opção de:
- **um único PDF** contendo **várias páginas** (uma por nota), ou
- **um ZIP** contendo **um PDF por nota**.

Usa **NestJS**, **pdfmake** (server-side) e **JSZip**. O layout é montado por classes auxiliares (builder) para manter o código organizado e fácil de evoluir.

---

## ✨ Funcionalidades

- Recebe o **XML da NFS-e** (lote com uma ou várias `<InfNfse>`).
- **`mode: "single"`** → um PDF com N páginas.
- **`mode: "multiple"`** → ZIP com 1 PDF por nota.
- Suporte a **logo** no cabeçalho (arquivo local ou dataURL).
- Layout “Fortaleza-like”, modularizado no **`NfseLayoutBuilder`**.
- Tipagens separadas para **NFS-e** e **pdfmake**.

---

## 🧱 Stack

- **Node.js** 22+
- **NestJS**
- **pdfmake** (via `pdfmake/src/printer`)
- **xml2js**
- **JSZip**
- **TypeScript / ESLint**

---

## 📁 Estrutura (trecho relevante)

```
src/
  assets/
    logo-prefeitura.png
  modules/
    nfse/
      controller/nfse.controller.ts
      services/nfse.service.ts
      types/nfse.types.ts          // Tipos da NFS-e
      dto/nfse.dto.ts
    shared/
      pdf/
        pdf.service.ts             // Orquestra pdfmake + builder + zip
        layout/
          nfse-layout.builder.ts   // Monta o conteúdo/estilo do PDF
        types/
          pdfmake.types.ts         // Tipos do pdfmake (server-side)
```

---

## ⚙️ Instalação & Execução

```bash
# 1) Instale as dependências
npm i

# 2) Ambiente de dev
npm run start:dev

# 3) Build
npm run build

# 4) Produção
npm run start:prod
```

---

## 🖼️ Configurando a logo (assets)

Coloque sua logo em `src/assets/logo-prefeitura.png` (ou outro nome/caminho de sua preferência).

Garanta que os **assets** sejam copiados para `dist/` durante o build:

**`nest-cli.json`**
```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true,
    "assets": [
      { "include": "assets/**/*", "outDir": "dist" }
    ],
    "watchAssets": true
  }
}

```

> Em runtime, o serviço resolve o caminho de `assets` tanto em **dev** (`src/assets/...`) quanto em **prod** (`dist/assets/...`). Se preferir, você pode enviar um **dataURL** no lugar do caminho de arquivo.

---

## 🌐 API

### Endpoint
```
POST /nfse/gerar-pdf
Content-Type: application/json
```

### Body

```ts
type BodyWithOptions = {
  xml: string;                 // XML bruto com <Nfse>...</Nfse>
  mode?: "single" | "multiple"; // default: "single"
  zipName?: string;             // nome do arquivo .zip (quando mode="multiple")
}
```

### Respostas

- `mode = "single"`  
  - `200 OK`  
  - `Content-Type: application/pdf`  
  - `Content-Disposition: inline; filename="notas.pdf"`

- `mode = "multiple"`  
  - `200 OK`  
  - `Content-Type: application/zip`  
  - `Content-Disposition: attachment; filename="<zipName>"`

---

## 🧪 Exemplos com cURL

> **Dica:** Como o XML vai dentro de uma *string JSON*, **escape** as aspas duplas (`\"`) — ou use um arquivo `payload.json` + `--data-binary`.

### 1) Um único PDF (várias páginas) — `mode: "single"`
```bash
curl -X POST   http://localhost:3000/nfse/gerar-pdf   -H "Content-Type: application/json"   -d '{
    "xml": "<Nfse>...</Nfse>",
    "mode": "single"
  }'   -o notas.pdf
```

### 2) Um ZIP com 1 PDF por nota — `mode: "multiple"`
```bash
curl -X POST   http://localhost:3000/nfse/gerar-pdf   -H "Content-Type: application/json"   -d '{
    "xml": "<Nfse>...</Nfse>",
    "mode": "multiple",
    "zipName": "lote-notas.zip"
  }'   -o lote-notas.zip
```

### Alternativa com `payload.json`
Salve um arquivo `payload.json`:
```json
{
  "xml": "<Nfse>...</Nfse>",
  "mode": "single"
}
```

E envie com:
```bash
curl -X POST http://localhost:3000/nfse/gerar-pdf   -H "Content-Type: application/json"   --data-binary @payload.json   -o notas.pdf
```

---

## 🧩 Internals (resumo)

- **`NfseService`**  
  Faz o parse do XML (xml2js), normaliza a lista de notas e chama o `PdfService`.

- **`PdfService`**  
  Inicializa o pdfmake, monta o **docDefinition** via `NfseLayoutBuilder` e:
  - em **`mode: "single"`**: retorna 1 **Buffer** de PDF;
  - em **`mode: "multiple"`**: gera vários PDFs e devolve um **ZIP (Buffer)** com todos os arquivos (JSZip).

- **`NfseLayoutBuilder`**  
  Responsável por **layout/estilos** e conteúdo.

---

## 🛠️ Lint/Format

```bash
npm run lint
npm run format
```

---

## ❗ Troubleshooting

- **`ENOENT: no such file or directory, open '.../dist/assets/logo-prefeitura.png'`**  
  Garanta que:
  - o arquivo existe em `src/assets/logo-prefeitura.png`;
  - o `nest-cli.json` tem a configuração de **assets** (vide acima);
  - em produção, o caminho resolvido aponte para `dist/assets/...`.

- **JSON com XML**  
  Se der erro de parsing por causa de aspas, prefira o **`payload.json`** + `--data-binary` ou escape todas as aspas duplas (`\"`) no XML.

---

## 📄 Licença

MIT — sinta-se à vontade para usar e adaptar.
