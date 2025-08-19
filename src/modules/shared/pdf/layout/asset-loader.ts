import * as fs from 'fs';
import * as path from 'path';

export interface AssetLoader {
  loadMunicipioLogoDataUrl(ibgeCode: string): string | undefined;
  loadBrandLogoDataUrl(): string | undefined;
}

export class DefaultAssetLoader implements AssetLoader {
  loadMunicipioLogoDataUrl(ibgeCode: string): string | undefined {
    return this.loadFirst([
      path.resolve(
        __dirname,
        `../../../../assets/logo-prefeitura-${ibgeCode}.png`,
      ),
      path.resolve(
        process.cwd(),
        `dist/assets/logo-prefeitura-${ibgeCode}.png`,
      ),
      path.resolve(process.cwd(), `assets/logo-prefeitura-${ibgeCode}.png`),
    ]);
  }

  loadBrandLogoDataUrl(): string | undefined {
    return this.loadFirst([
      path.resolve(__dirname, '../../../../assets/logo-raio.png'),
      path.resolve(process.cwd(), 'dist/assets/logo-raio.png'),
      path.resolve(process.cwd(), 'assets/logo-raio.png'),
    ]);
  }

  private loadFirst(candidates: string[]): string | undefined {
    for (const filePath of candidates) {
      try {
        if (fs.existsSync(filePath)) {
          const base64 = fs.readFileSync(filePath).toString('base64');
          return `data:image/png;base64,${base64}`;
        }
      } catch {
        /* ignore */
      }
    }
    return undefined;
  }
}
