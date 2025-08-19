/* eslint-disable @typescript-eslint/no-unsafe-call */
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
    readFileSync: jest.fn(),
  };
});

jest.mock('path', () => {
  const actual = jest.requireActual('path');
  return {
    __esModule: true,
    ...actual,
    resolve: jest.fn(),
  };
});

import * as fs from 'fs';
import * as path from 'path';
import { DefaultAssetLoader } from './asset-loader';

describe('DefaultAssetLoader', () => {
  const existsMock = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
  const readMock = fs.readFileSync as jest.MockedFunction<
    typeof fs.readFileSync
  >;
  const resolveMock = path.resolve as jest.MockedFunction<typeof path.resolve>;

  const IBGE = '3550308';
  const BASE64 = (s: string) =>
    `data:image/png;base64,${Buffer.from(s).toString('base64')}`;

  beforeEach(() => {
    jest.clearAllMocks();

    resolveMock.mockImplementation(
      (...args: Parameters<typeof path.resolve>) => {
        const last = args[args.length - 1];

        if (last === `../../../../assets/logo-prefeitura-${IBGE}.png`)
          return '/CAND1-MUNICIPIO';
        if (last === `dist/assets/logo-prefeitura-${IBGE}.png`)
          return '/CAND2-MUNICIPIO';
        if (last === `assets/logo-prefeitura-${IBGE}.png`)
          return '/CAND3-MUNICIPIO';

        if (last === '../../../../assets/logo-raio.png') return '/CAND1-BRAND';
        if (last === 'dist/assets/logo-raio.png') return '/CAND2-BRAND';
        if (last === 'assets/logo-raio.png') return '/CAND3-BRAND';

        const real = jest.requireActual('path').resolve;
        return real(...args);
      },
    );
  });

  it('returns municipio logo from the first existing candidate (prefers project assets near __dirname)', () => {
    existsMock.mockImplementation((p) => String(p) === '/CAND1-MUNICIPIO');
    readMock.mockImplementation((p) => {
      if (String(p) === '/CAND1-MUNICIPIO') return Buffer.from('PNG-A1');
      throw new Error('should not read other paths');
    });

    const loader = new DefaultAssetLoader();
    const out = loader.loadMunicipioLogoDataUrl(IBGE);
    expect(out).toBe(BASE64('PNG-A1'));
    expect(readMock).toHaveBeenCalledTimes(1);
    expect(readMock).toHaveBeenCalledWith('/CAND1-MUNICIPIO');
  });

  it('falls back to the second municipio candidate when the first does not exist', () => {
    existsMock.mockImplementation((p) => {
      const s = String(p);
      if (s === '/CAND1-MUNICIPIO') return false;
      if (s === '/CAND2-MUNICIPIO') return true;
      return false;
    });
    readMock.mockImplementation((p) => {
      if (String(p) === '/CAND2-MUNICIPIO') return Buffer.from('PNG-B2');
      throw new Error('unexpected read');
    });

    const loader = new DefaultAssetLoader();
    const out = loader.loadMunicipioLogoDataUrl(IBGE);
    expect(out).toBe(BASE64('PNG-B2'));
  });

  it('falls back to the third municipio candidate when the first two do not exist', () => {
    existsMock.mockImplementation((p) => String(p) === '/CAND3-MUNICIPIO');
    readMock.mockImplementation((p) => {
      if (String(p) === '/CAND3-MUNICIPIO') return Buffer.from('PNG-C3');
      throw new Error('unexpected read');
    });

    const loader = new DefaultAssetLoader();
    const out = loader.loadMunicipioLogoDataUrl(IBGE);
    expect(out).toBe(BASE64('PNG-C3'));
  });

  it('returns undefined for municipio logo when no candidate exists', () => {
    existsMock.mockReturnValue(false);
    const loader = new DefaultAssetLoader();
    const out = loader.loadMunicipioLogoDataUrl(IBGE);
    expect(out).toBeUndefined();
    expect(readMock).not.toHaveBeenCalled();
  });

  it('returns brand logo from the first available candidate', () => {
    existsMock.mockImplementation((p) => String(p) === '/CAND1-BRAND');
    readMock.mockImplementation((p) => {
      if (String(p) === '/CAND1-BRAND') return Buffer.from('BRAND-A1');
      throw new Error('unexpected read');
    });

    const loader = new DefaultAssetLoader();
    const out = loader.loadBrandLogoDataUrl();
    expect(out).toBe(BASE64('BRAND-A1'));
  });

  it('falls back for brand logo across second and third candidates', () => {
    existsMock.mockImplementation((p) => {
      const s = String(p);
      if (s === '/CAND1-BRAND') return false;
      if (s === '/CAND2-BRAND') return true;
      return false;
    });
    readMock.mockImplementation((p) => {
      if (String(p) === '/CAND2-BRAND') return Buffer.from('BRAND-B2');
      throw new Error('unexpected read');
    });

    const loader = new DefaultAssetLoader();
    const out = loader.loadBrandLogoDataUrl();
    expect(out).toBe(BASE64('BRAND-B2'));
  });

  it('ignores exceptions from existsSync and readFileSync and keeps trying next candidates (municipio)', () => {
    existsMock.mockImplementation((p) => {
      const s = String(p);
      if (s === '/CAND1-MUNICIPIO') throw new Error('exists failure');
      if (s === '/CAND2-MUNICIPIO') return true;
      if (s === '/CAND3-MUNICIPIO') return true;
      return false;
    });
    readMock.mockImplementation((p) => {
      const s = String(p);
      if (s === '/CAND2-MUNICIPIO') throw new Error('read failure');
      if (s === '/CAND3-MUNICIPIO') return Buffer.from('PNG-FALLBACK');
      throw new Error('unexpected read');
    });

    const loader = new DefaultAssetLoader();
    const out = loader.loadMunicipioLogoDataUrl(IBGE);
    expect(out).toBe(BASE64('PNG-FALLBACK'));
    expect(readMock).toHaveBeenCalledWith('/CAND3-MUNICIPIO');
  });

  it('returns undefined for brand logo when none of the candidates exist (and errors are swallowed)', () => {
    existsMock.mockImplementation(() => {
      throw new Error('exists error (should be swallowed)');
    });
    readMock.mockImplementation(() => {
      throw new Error('should not read');
    });

    const loader = new DefaultAssetLoader();
    const out = loader.loadBrandLogoDataUrl();
    expect(out).toBeUndefined();
  });
});
