/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as fs from 'fs';
import * as path from 'path';

export type MunicipioMap = Record<string, { nome: string }>;

export interface MunicipioItem {
  id: string | number;
  nome: string;
}

export interface MunicipioSource {
  loadMap(): Promise<MunicipioMap>;
}

export type FileSystemMunicipioSourceOptions = {
  explicitPath?: string;
};

export class FileSystemMunicipioSource implements MunicipioSource {
  constructor(private readonly opts: FileSystemMunicipioSourceOptions = {}) {}

  private resolvePath(): string | null {
    const envPath = process.env.IBGE_MUNICIPIOS_PATH ?? this.opts.explicitPath;
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

  private parse(raw: string): MunicipioMap {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return (parsed as MunicipioItem[]).reduce<MunicipioMap>((acc, m) => {
        acc[String(m.id)] = { nome: m.nome };
        return acc;
      }, {});
    }
    return parsed as MunicipioMap;
  }

  async loadMap(): Promise<MunicipioMap> {
    const file = this.resolvePath();
    if (!file) return {};
    const raw = await fs.promises.readFile(file, 'utf-8');
    return this.parse(raw);
  }
}

export type MongoMunicipioSourceOptions = {
  uri: string;
  dbName: string;
  collection: string;
  idField?: string;
  nameField?: string;
  query?: Record<string, unknown>;
};

function toStringSafe(v: unknown): string {
  return typeof v === 'string' || typeof v === 'number' ? String(v) : '';
}

type DocShape = Record<string, unknown>;

export class MongoMunicipioSource implements MunicipioSource {
  private readonly idField: string;
  private readonly nameField: string;

  constructor(private readonly opts: MongoMunicipioSourceOptions) {
    this.idField = opts.idField ?? 'id';
    this.nameField = opts.nameField ?? 'nome';
  }

  async loadMap(): Promise<MunicipioMap> {
    const mod = (await import('mongodb')) as typeof import('mongodb');

    const client = new mod.MongoClient(this.opts.uri, {
      serverSelectionTimeoutMS: 10_000,
    });

    try {
      await client.connect();

      const col = client
        .db(this.opts.dbName)
        .collection<DocShape>(this.opts.collection);

      const projection: Record<string, 0 | 1> = {
        _id: 0,
        [this.idField]: 1,
        [this.nameField]: 1,
      };

      const docs = await col
        .find(this.opts.query ?? {}, { projection })
        .toArray();

      return docs.reduce<MunicipioMap>((acc, doc) => {
        const code = toStringSafe(doc[this.idField]);
        const nome = toStringSafe(doc[this.nameField]);
        if (code) acc[code] = { nome };
        return acc;
      }, {} as MunicipioMap);
    } finally {
      await client.close().catch(() => undefined);
    }
  }
}

export class MunicipioResolver {
  private map: MunicipioMap | null = null;
  constructor(private readonly source: MunicipioSource) {}

  async preload(): Promise<void> {
    if (!this.map) this.map = await this.source.loadMap();
  }

  clearCache(): void {
    this.map = null;
  }

  async resolveName(codigo?: string | string[]): Promise<string> {
    const cod = Array.isArray(codigo) ? codigo[0] : codigo;
    if (!cod) return 'Não informado';
    await this.preload();
    const hit = this.map![String(cod)];
    return hit?.nome ?? 'Não informado';
  }

  static fromEnv(): MunicipioResolver {
    const mode = (process.env.MUNICIPIO_SOURCE ?? 'file').toLowerCase();
    if (mode === 'mongo') {
      const required = (name: string) => {
        const v = process.env[name];
        if (!v) throw new Error(`Missing environment variable: ${name}`);
        return v;
      };
      const source = new MongoMunicipioSource({
        uri: required('MONGO_URI'),
        dbName: required('MONGO_DB'),
        collection: required('MONGO_COLLECTION'),
        idField: process.env.MONGO_ID_FIELD ?? 'id',
        nameField: process.env.MONGO_NAME_FIELD ?? 'nome',
      });
      return new MunicipioResolver(source);
    }
    const source = new FileSystemMunicipioSource({
      explicitPath: process.env.IBGE_MUNICIPIOS_PATH,
    });
    return new MunicipioResolver(source);
  }
}
