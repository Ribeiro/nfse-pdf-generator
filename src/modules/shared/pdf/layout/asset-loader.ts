/* eslint-disable @typescript-eslint/no-unsafe-argument */
import * as fs from 'fs';
import * as path from 'path';
import * as fsp from 'fs/promises';
import {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';

export interface AssetLoader {
  preload(): Promise<void>;
  loadMunicipioLogoDataUrl(ibgeCode: string): string | undefined;
  loadBrandLogoDataUrl(): string | undefined;
  clearCache?(): void;
}

export interface IMunicipioResolver {
  preload(): Promise<void>;
  resolveName(codigo?: string | string[]): Promise<string>;
  clearCache?(): void;
}

type Mime =
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/gif'
  | 'image/svg+xml';
const EXT_MIME: Record<string, Mime> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

function guessMimeByFilename(filename: string): Mime {
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'png';
  return EXT_MIME[ext] ?? 'image/png';
}
function toDataUrl(buf: Buffer, mime: Mime): string {
  return `data:${mime};base64,${buf.toString('base64')}`;
}

const MUNICIPIO_IMG_REGEX =
  /^logo-prefeitura-(\d{1,10})\.(png|jpg|jpeg|webp|gif|svg)$/i;

export type FileSystemAssetLoaderOptions = {
  municipiosDirs?: string[];
  brandCandidates?: string[];
  municipioPattern?: RegExp;
};

export class FileSystemAssetLoader implements AssetLoader {
  private readonly municipiosDirs: string[];
  private readonly brandCandidates: string[];
  private readonly municipioPattern: RegExp;

  private brandDataUrl?: string;
  private municipios = new Map<string, string>();

  constructor(opts: FileSystemAssetLoaderOptions = {}) {
    this.municipioPattern = opts.municipioPattern ?? MUNICIPIO_IMG_REGEX;
    this.municipiosDirs = opts.municipiosDirs ?? [
      path.resolve(__dirname, '../../../../assets'),
      path.resolve(process.cwd(), 'dist/assets'),
      path.resolve(process.cwd(), 'assets'),
    ];
    this.brandCandidates = opts.brandCandidates ?? [
      path.resolve(__dirname, '../../../../assets/logo-raio.png'),
      path.resolve(process.cwd(), 'dist/assets/logo-raio.png'),
      path.resolve(process.cwd(), 'assets/logo-raio.png'),
    ];
  }

  async preload(): Promise<void> {
    for (const file of this.brandCandidates) {
      try {
        if (fs.existsSync(file)) {
          const mime = guessMimeByFilename(file);
          const buf = await fsp.readFile(file);
          this.brandDataUrl = toDataUrl(buf, mime);
          break;
        }
      } catch {
        /* ignore */
      }
    }

    for (const dir of this.municipiosDirs) {
      try {
        if (!fs.existsSync(dir)) continue;
        const files = await fsp.readdir(dir);
        for (const file of files) {
          const m = file.match(this.municipioPattern);
          if (!m) continue;
          const ibgeCode = m[1];
          if (this.municipios.has(ibgeCode)) continue;

          const abs = path.join(dir, file);
          try {
            const mime = guessMimeByFilename(file);
            const buf = await fsp.readFile(abs);
            this.municipios.set(ibgeCode, toDataUrl(buf, mime));
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  loadMunicipioLogoDataUrl(ibgeCode: string): string | undefined {
    return this.municipios.get(String(ibgeCode));
  }
  loadBrandLogoDataUrl(): string | undefined {
    return this.brandDataUrl;
  }
  clearCache(): void {
    this.brandDataUrl = undefined;
    this.municipios.clear();
  }
}

export type S3AssetLoaderOptions = {
  bucket: string;
  municipiosPrefix: string;
  brandKey: string;
  region?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  eager?: boolean; // true => baixa tudo no preload
};

export class S3AssetLoader implements AssetLoader {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly municipiosPrefix: string;
  private readonly brandKey: string;
  private readonly eager: boolean;

  private brandDataUrl?: string;
  private municipios = new Map<string, string>();
  private indexedKeys = new Map<string, string>();

  constructor(opts: S3AssetLoaderOptions) {
    this.bucket = opts.bucket;
    this.municipiosPrefix = opts.municipiosPrefix.replace(/^\/+/, '');
    this.brandKey = opts.brandKey.replace(/^\/+/, '');
    this.eager = opts.eager ?? true;

    this.client = new S3Client({
      region: opts.region ?? process.env.AWS_REGION ?? 'us-east-1',
      endpoint: opts.endpoint ?? process.env.S3_ENDPOINT,
      forcePathStyle:
        typeof opts.forcePathStyle === 'boolean'
          ? opts.forcePathStyle
          : process.env.S3_FORCE_PATH_STYLE === 'true'
            ? true
            : undefined,
    });
  }

  private async bodyToBuffer(body: unknown): Promise<Buffer> {
    const maybe = body as {
      transformToByteArray?: () => Promise<Uint8Array>;
      transformToString?: (enc?: BufferEncoding) => Promise<string>;
    };
    if (maybe?.transformToByteArray)
      return Buffer.from(await maybe.transformToByteArray());
    if (maybe?.transformToString)
      return Buffer.from(await maybe.transformToString('base64'), 'base64');

    return await new Promise<Buffer>((resolve, reject) => {
      const readable = body as NodeJS.ReadableStream;
      if (!readable || typeof readable.on !== 'function') {
        return reject(new Error('S3 Invalid Body'));
      }
      const chunks: Buffer[] = [];
      readable.on('data', (c) =>
        chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)),
      );
      readable.on('end', () => resolve(Buffer.concat(chunks)));
      readable.on('error', reject);
    });
  }

  private extractIbgeFromKey(key: string): string | null {
    const base = key.split('/').pop() ?? key;
    const m = base.match(MUNICIPIO_IMG_REGEX);
    return m ? m[1] : null;
  }

  private async getObjectDataUrl(key: string): Promise<string> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!res.Body) throw new Error(`S3 object ${key} has empty body`);
    const buf = await this.bodyToBuffer(res.Body);
    const mime = guessMimeByFilename(key);
    return toDataUrl(buf, mime);
  }

  async preload(): Promise<void> {
    // brand
    try {
      this.brandDataUrl = await this.getObjectDataUrl(this.brandKey);
    } catch {
      this.brandDataUrl = undefined;
    }

    // lista todos os logos
    let token: string | undefined;
    do {
      const out = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: this.municipiosPrefix,
          ContinuationToken: token,
          MaxKeys: 1000,
        }),
      );
      for (const obj of out.Contents ?? []) {
        if (!obj.Key) continue;
        const ibge = this.extractIbgeFromKey(obj.Key);
        if (ibge) this.indexedKeys.set(ibge, obj.Key);
      }
      token = out.IsTruncated ? out.NextContinuationToken : undefined;
    } while (token);

    // eager cache
    if (this.eager) {
      for (const [ibge, key] of this.indexedKeys.entries()) {
        try {
          this.municipios.set(ibge, await this.getObjectDataUrl(key));
        } catch {
          /* ignore */
        }
      }
    }
  }

  loadMunicipioLogoDataUrl(ibgeCode: string): string | undefined {
    return this.municipios.get(String(ibgeCode));
  }
  loadBrandLogoDataUrl(): string | undefined {
    return this.brandDataUrl;
  }
  clearCache(): void {
    this.brandDataUrl = undefined;
    this.municipios.clear();
  }
}

export class DefaultAssetLoader extends FileSystemAssetLoader {}

export function assetLoaderFromEnv(): AssetLoader {
  const mode = (process.env.ASSET_SOURCE ?? 'assets').toLowerCase();
  if (mode === 's3') {
    const required = (n: string) => {
      const v = process.env[n];
      if (!v) throw new Error(`Missing environment variable: ${n}`);
      return v;
    };
    return new S3AssetLoader({
      bucket: required('ASSETS_S3_BUCKET'),
      municipiosPrefix: required('ASSETS_S3_MUNICIPIOS_PREFIX'),
      brandKey: required('ASSETS_S3_BRAND_KEY'),
      region: process.env.AWS_REGION,
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      eager: (process.env.ASSETS_S3_EAGER ?? 'true').toLowerCase() !== 'false',
    });
  }
  return new FileSystemAssetLoader();
}
export async function createAssetLoaderAndPreloadFromEnv(): Promise<AssetLoader> {
  const loader = assetLoaderFromEnv();
  await loader.preload();
  return loader;
}

export type MunicipioMap = Record<string, { nome: string }>;

export interface MunicipioItem {
  id: string | number;
  nome: string;
}
export interface MunicipioSource {
  loadMap(): Promise<MunicipioMap>;
}

export type FileSystemMunicipioSourceOptions = { explicitPath?: string };
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
    for (const p of candidates) if (fs.existsSync(p)) return p;
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
    const raw = await fsp.readFile(file, 'utf-8');
    return this.parse(raw);
  }
}

export type S3MunicipioSourceOptions = {
  bucket: string;
  key: string;
  region?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
};
export class S3MunicipioSource implements MunicipioSource {
  private readonly client: S3Client;
  constructor(private readonly opts: S3MunicipioSourceOptions) {
    this.client = new S3Client({
      region: opts.region ?? process.env.AWS_REGION ?? 'us-east-1',
      endpoint: opts.endpoint ?? process.env.S3_ENDPOINT,
      forcePathStyle:
        typeof opts.forcePathStyle === 'boolean'
          ? opts.forcePathStyle
          : process.env.S3_FORCE_PATH_STYLE === 'true'
            ? true
            : undefined,
    });
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
  private async bodyToString(body: unknown): Promise<string> {
    const maybe = body as {
      transformToString?: (enc?: BufferEncoding) => Promise<string>;
    };
    if (maybe && typeof maybe.transformToString === 'function') {
      return maybe.transformToString('utf-8');
    }
    return await new Promise<string>((resolve, reject) => {
      const readable = body as NodeJS.ReadableStream;
      if (!readable || typeof readable.on !== 'function') {
        return reject(
          new Error('S3 Invalid Body (no stream/transformToString)'),
        );
      }
      const chunks: Buffer[] = [];
      readable.on('data', (c) =>
        chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)),
      );
      readable.on('end', () =>
        resolve(Buffer.concat(chunks).toString('utf-8')),
      );
      readable.on('error', reject);
    });
  }
  async loadMap(): Promise<MunicipioMap> {
    const { bucket, key } = this.opts;
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    if (!res.Body) return {};
    const raw = await this.bodyToString(res.Body);
    return this.parse(raw);
  }
}

export class MunicipioResolver implements IMunicipioResolver {
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
    if (mode === 's3') {
      const required = (n: string) => {
        const v = process.env[n];
        if (!v) throw new Error(`Missing environment variable: ${n}`);
        return v;
      };
      const source = new S3MunicipioSource({
        bucket: required('MUNICIPIOS_S3_BUCKET'),
        key: required('MUNICIPIOS_S3_KEY'),
        region: process.env.AWS_REGION,
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
      });
      return new MunicipioResolver(source);
    }
    const source = new FileSystemMunicipioSource({
      explicitPath: process.env.IBGE_MUNICIPIOS_PATH,
    });
    return new MunicipioResolver(source);
  }
}
export async function createMunicipioResolverAndPreloadFromEnv(): Promise<MunicipioResolver> {
  const resolver = MunicipioResolver.fromEnv();
  await resolver.preload();
  return resolver;
}

export type NfseInfra = {
  assets: AssetLoader;
  municipios: MunicipioResolver;
};

export async function createNfseInfraFromEnv(): Promise<NfseInfra> {
  const [assets, municipios] = await Promise.all([
    (async () => {
      const l = assetLoaderFromEnv();
      await l.preload();
      return l;
    })(),
    (async () => {
      const r = MunicipioResolver.fromEnv();
      await r.preload();
      return r;
    })(),
  ]);
  return { assets, municipios };
}

export type CreateNfseInfraFromS3Params = {
  assets: S3AssetLoaderOptions;
  municipios: S3MunicipioSourceOptions;
};

export async function createNfseInfraFromS3(
  params: CreateNfseInfraFromS3Params,
): Promise<NfseInfra> {
  const assets = new S3AssetLoader(params.assets);
  const municipios = new MunicipioResolver(
    new S3MunicipioSource(params.municipios),
  );
  await Promise.all([assets.preload(), municipios.preload()]);
  return { assets, municipios };
}
