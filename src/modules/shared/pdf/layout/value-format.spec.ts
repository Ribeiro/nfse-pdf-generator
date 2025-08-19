import { ValueFormat } from './value-format';

describe('ValueFormat', () => {
  describe('first', () => {
    it('returns the trimmed string when non-empty', () => {
      expect(ValueFormat.first('  hello  ')).toBe('hello');
    });

    it('returns "Não informado" for undefined or empty/whitespace', () => {
      expect(ValueFormat.first(undefined)).toBe('Não informado');
      expect(ValueFormat.first('')).toBe('Não informado');
      expect(ValueFormat.first('   ')).toBe('Não informado');
    });
  });

  describe('digits', () => {
    it('keeps only digits from string input', () => {
      expect(ValueFormat.digits('12.345-6a')).toBe('123456');
    });

    it('keeps only digits from number input', () => {
      expect(ValueFormat.digits(12_345)).toBe('12345');
    });
  });

  describe('formatCep', () => {
    it('formats an 8-digit string as 00.000-000', () => {
      expect(ValueFormat.formatCep('80000000')).toBe('80.000-000');
    });

    it('strips non-digits and formats', () => {
      expect(ValueFormat.formatCep('80000-000')).toBe('80.000-000');
    });

    it('pads to 8 digits if shorter (number input)', () => {
      expect(ValueFormat.formatCep(1234567)).toBe('01.234-567');
    });
  });

  describe('formatCpfCnpj', () => {
    it('formats CPF (11 digits) as 000.000.000-00', () => {
      expect(ValueFormat.formatCpfCnpj('12345678901')).toBe('123.456.789-01');
    });

    it('formats CNPJ (14 digits) as 00.000.000/0000-00', () => {
      expect(ValueFormat.formatCpfCnpj('11222333000144')).toBe(
        '11.222.333/0001-44',
      );
    });

    it('returns original input when not 11 or 14 digits', () => {
      expect(ValueFormat.formatCpfCnpj('abc')).toBe('abc');
      expect(ValueFormat.formatCpfCnpj('1234')).toBe('1234');
    });
  });

  describe('formatDate', () => {
    afterEach(() => {
      jest.restoreAllMocks(); // restores the spied prototype methods
    });

    it('returns formatted "pt-BR" date and time', () => {
      const iso = '2024-01-02T03:04:00.000Z';

      jest
        .spyOn(Date.prototype, 'toLocaleDateString')
        .mockReturnValue('02/01/2024');
      jest.spyOn(Date.prototype, 'toLocaleTimeString').mockReturnValue('03:04');

      expect(ValueFormat.formatDate(iso)).toBe('02/01/2024 03:04');
    });

    it('returns "—" when value is falsy', () => {
      expect(ValueFormat.formatDate(undefined)).toBe('—');
      expect(ValueFormat.formatDate('')).toBe('—');
    });
  });

  describe('normalizeB64', () => {
    it('replaces URL-safe chars and pads to multiple of 4', () => {
      expect(ValueFormat.normalizeB64('T2zDoQ')).toBe('T2zDoQ==');
      expect(ValueFormat.normalizeB64('YWJj-_')).toBe('YWJj+/==');
    });

    it('leaves already-normal base64 intact (except ensuring padding)', () => {
      expect(ValueFormat.normalizeB64('YWJjZA==')).toBe('YWJjZA==');
    });
  });

  describe('decodeBase64ToUtf8', () => {
    const g = globalThis as unknown as {
      Buffer?: typeof import('buffer').Buffer;
      atob?: (x: string) => string;
    };
    const origBuffer = g.Buffer;
    const origAtob = g.atob;

    afterEach(() => {
      g.Buffer = origBuffer;
      g.atob = origAtob;
    });

    it('decodes via Node Buffer (normal case)', () => {
      const urlSafe = 'T2zDoQ';
      expect(ValueFormat.decodeBase64ToUtf8(urlSafe)).toBe('Olá');
    });

    it('decodes via window.atob path when Buffer is not available', () => {
      const BufferRef = g.Buffer;
      g.Buffer = undefined;

      g.atob = (b64: string) => {
        const bin = BufferRef!.from(b64, 'base64').toString('binary');
        return bin;
      };

      expect(ValueFormat.decodeBase64ToUtf8('T2zDoQ')).toBe('Olá');
    });

    it('returns the original string when neither Buffer nor atob is available', () => {
      g.Buffer = undefined;
      g.atob = undefined;

      const garbage = '#not-base64#';
      expect(ValueFormat.decodeBase64ToUtf8(garbage)).toBe(garbage);
    });
  });
});
