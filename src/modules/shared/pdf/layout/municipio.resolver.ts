import * as fs from 'fs';
import * as path from 'path';

type MapType = Record<string, { nome: string }>;

interface MunicipioItem {
  id: string | number;
  nome: string;
}

export class MunicipioResolver {
  private constructor() {}
  private static map: MapType | null = null;

  private static resolvePath(): string | null {
    const envPath = process.env.IBGE_MUNICIPIOS_PATH;
    if (envPath && fs.existsSync(envPath)) return envPath;

    const candidates = [
      path.join(process.cwd(), 'dist', 'assets', 'municipios-ibge.json'),
      path.join(process.cwd(), 'assets', 'municipios-ibge.json'),

      path.resolve(__dirname, '../../../../assets/municipios-ibge.json'),
      path.resolve(__dirname, '../../../../../assets/municipios-ibge.json'),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  private static loadIfNeeded(): void {
    if (this.map) return;

    const file = this.resolvePath();
    if (!file) {
      this.map = {};
      return;
    }

    const raw = fs.readFileSync(file, 'utf-8');
    const parsed: unknown = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      const arr = parsed as MunicipioItem[];
      this.map = arr.reduce<MapType>((acc, m) => {
        const codigo = String(m.id);
        acc[codigo] = { nome: m.nome };
        return acc;
      }, {});
    } else {
      this.map = parsed as MapType;
    }
  }

  static resolveName(codigo?: string | string[]): string {
    const cod = Array.isArray(codigo) ? codigo[0] : codigo;
    if (!cod) return 'Não informado';
    this.loadIfNeeded();
    const hit = this.map![String(cod)];
    return hit?.nome ?? 'Não informado';
  }
}
