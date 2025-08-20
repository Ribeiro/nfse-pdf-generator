/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    __esModule: true,
    ...actual,
    existsSync: jest.fn(),
  };
});

jest.mock('fs/promises', () => ({
  __esModule: true,
  readFile: jest.fn(),
  readdir: jest.fn(),
}));

jest.mock('path', () => {
  const actual = jest.requireActual('path');
  return {
    __esModule: true,
    ...actual,
    resolve: jest.fn(),
  };
});

import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { DefaultAssetLoader } from './asset-loader';

describe('DefaultAssetLoader', () => {
  const existsMock = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
  const readFileMock = fsp.readFile as jest.MockedFunction<typeof fsp.readFile>;
  const readdirMock = fsp.readdir as jest.MockedFunction<typeof fsp.readdir>;
  const resolveMock = path.resolve as jest.MockedFunction<typeof path.resolve>;

  const IBGE = '3550308';
  const MUNICIPIO_FILE = `logo-prefeitura-${IBGE}.png`;
  const BRAND_FILE = 'logo-raio.png';

  const BASE64 = (s: string) =>
    `data:image/png;base64,${Buffer.from(s).toString('base64')}`;

  const endsWithArgs = (args: unknown[], ...suffix: string[]) =>
    suffix.every((seg, i) => args[args.length - suffix.length + i] === seg);

  beforeEach(() => {
    jest.clearAllMocks();

    existsMock.mockImplementation((_p: unknown) => false);
    readdirMock.mockImplementation((_p: unknown) =>
      Promise.resolve([] as unknown as any),
    );
    readFileMock.mockImplementation((_p: unknown) =>
      Promise.reject(new Error('unexpected read')),
    );

    resolveMock.mockImplementation(
      (...args: Parameters<typeof path.resolve>) => {
        if (endsWithArgs(args, '../../../../assets')) return '/DIR1';
        if (endsWithArgs(args, 'dist/assets')) return '/DIR2';
        if (endsWithArgs(args, 'assets')) return '/DIR3';

        if (endsWithArgs(args, `../../../../assets/${BRAND_FILE}`))
          return '/CAND1-BRAND';
        if (endsWithArgs(args, `dist/assets/${BRAND_FILE}`))
          return '/CAND2-BRAND';
        if (endsWithArgs(args, `assets/${BRAND_FILE}`)) return '/CAND3-BRAND';

        const real = jest.requireActual('path').resolve as typeof path.resolve;
        return real(...args);
      },
    );
  });

  it('returns municipio logo from the first existing candidate (prefers project assets near __dirname)', async () => {
    existsMock.mockImplementation((p: unknown) => p === '/DIR1');
    readdirMock.mockImplementation((p: unknown) => {
      if (p === '/DIR1') return Promise.resolve([MUNICIPIO_FILE] as any);
      return Promise.resolve([] as any);
    });
    readFileMock.mockImplementation((p: unknown) => {
      if (p === `/DIR1/${MUNICIPIO_FILE}`) {
        return Promise.resolve(Buffer.from('PNG-A1'));
      }
      return Promise.reject(new Error('unexpected read'));
    });

    const loader = new DefaultAssetLoader();
    await loader.preload();
    const out = loader.loadMunicipioLogoDataUrl(IBGE);
    expect(out).toBe(BASE64('PNG-A1'));
    expect(readFileMock).toHaveBeenCalledWith(`/DIR1/${MUNICIPIO_FILE}`);
  });

  it('falls back to the second municipio candidate when the first does not exist', async () => {
    existsMock.mockImplementation((p: unknown) => p === '/DIR2');
    readdirMock.mockImplementation((p: unknown) => {
      if (p === '/DIR2') return Promise.resolve([MUNICIPIO_FILE] as any);
      return Promise.resolve([] as any);
    });
    readFileMock.mockImplementation((p: unknown) => {
      if (p === `/DIR2/${MUNICIPIO_FILE}`) {
        return Promise.resolve(Buffer.from('PNG-B2'));
      }
      return Promise.reject(new Error('unexpected read'));
    });

    const loader = new DefaultAssetLoader();
    await loader.preload();
    const out = loader.loadMunicipioLogoDataUrl(IBGE);
    expect(out).toBe(BASE64('PNG-B2'));
  });

  it('falls back to the third municipio candidate when the first two do not exist', async () => {
    existsMock.mockImplementation((p: unknown) => p === '/DIR3');
    readdirMock.mockImplementation((p: unknown) => {
      if (p === '/DIR3') return Promise.resolve([MUNICIPIO_FILE] as any);
      return Promise.resolve([] as any);
    });
    readFileMock.mockImplementation((p: unknown) => {
      if (p === `/DIR3/${MUNICIPIO_FILE}`) {
        return Promise.resolve(Buffer.from('PNG-C3'));
      }
      return Promise.reject(new Error('unexpected read'));
    });

    const loader = new DefaultAssetLoader();
    await loader.preload();
    const out = loader.loadMunicipioLogoDataUrl(IBGE);
    expect(out).toBe(BASE64('PNG-C3'));
  });

  it('returns undefined for municipio logo when no candidate exists', async () => {
    existsMock.mockImplementation((_p: unknown) => false);

    const loader = new DefaultAssetLoader();
    await loader.preload();
    const out = loader.loadMunicipioLogoDataUrl(IBGE);
    expect(out).toBeUndefined();
    expect(readFileMock).not.toHaveBeenCalled();
  });

  it('returns brand logo from the first available candidate', async () => {
    existsMock.mockImplementation((p: unknown) => p === '/CAND1-BRAND');
    readFileMock.mockImplementation((p: unknown) => {
      if (p === '/CAND1-BRAND') {
        return Promise.resolve(Buffer.from('BRAND-A1'));
      }
      return Promise.reject(new Error('unexpected read'));
    });

    const loader = new DefaultAssetLoader();
    await loader.preload();
    const out = loader.loadBrandLogoDataUrl();
    expect(out).toBe(BASE64('BRAND-A1'));
    expect(readFileMock).toHaveBeenCalledWith('/CAND1-BRAND');
  });

  it('falls back for brand logo across second and third candidates', async () => {
    existsMock.mockImplementation((p: unknown) => {
      if (p === '/CAND1-BRAND') return false;
      if (p === '/CAND2-BRAND') return true;
      return false;
    });
    readFileMock.mockImplementation((p: unknown) => {
      if (p === '/CAND2-BRAND') {
        return Promise.resolve(Buffer.from('BRAND-B2'));
      }
      return Promise.reject(new Error('unexpected read'));
    });

    const loader = new DefaultAssetLoader();
    await loader.preload();
    const out = loader.loadBrandLogoDataUrl();
    expect(out).toBe(BASE64('BRAND-B2'));
  });

  it('ignores exceptions from existsSync and readFile (municipio) e continua tentando os próximos', async () => {
    existsMock.mockImplementation((p: unknown) => {
      if (p === '/DIR1') throw new Error('exists failure');
      if (p === '/DIR2') return true;
      if (p === '/DIR3') return true;
      return false;
    });
    readdirMock.mockImplementation((p: unknown) => {
      if (p === '/DIR2') return Promise.resolve([MUNICIPIO_FILE] as any);
      if (p === '/DIR3') return Promise.resolve([MUNICIPIO_FILE] as any);
      return Promise.resolve([] as any);
    });
    readFileMock.mockImplementation((p: unknown) => {
      if (p === `/DIR2/${MUNICIPIO_FILE}`) {
        return Promise.reject(new Error('read failure'));
      }
      if (p === `/DIR3/${MUNICIPIO_FILE}`) {
        return Promise.resolve(Buffer.from('PNG-FALLBACK'));
      }
      return Promise.reject(new Error('unexpected read'));
    });

    const loader = new DefaultAssetLoader();
    await loader.preload();
    const out = loader.loadMunicipioLogoDataUrl(IBGE);
    expect(out).toBe(BASE64('PNG-FALLBACK'));
    expect(readFileMock).toHaveBeenCalledWith(`/DIR3/${MUNICIPIO_FILE}`);
  });

  it('returns undefined for brand logo when none of the candidates exist (and errors are swallowed)', async () => {
    existsMock.mockImplementation((_p: unknown) => {
      throw new Error('exists error (should be swallowed)');
    });
    readFileMock.mockImplementation((_p: unknown) =>
      Promise.reject(new Error('should not read')),
    );

    const loader = new DefaultAssetLoader();
    await loader.preload();
    const out = loader.loadBrandLogoDataUrl();
    expect(out).toBeUndefined();
  });
});
