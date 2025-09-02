export class ValueFormat {
  static readonly CEP = /^(\d{2})(\d{3})(\d{3})$/;
  static readonly ONLY_DIGIT = /\D/g;
  static readonly CPF = /^(\d{3})(\d{3})(\d{3})(\d{2})$/;
  static readonly CNPJ = /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/;

  static first(value?: string): string {
    const v = (value ?? '').toString().trim();
    return v.length > 0 ? v : 'Não informado';
  }

  static digits(v: string | number): string {
    return String(v).replace(this.ONLY_DIGIT, '');
  }

  static formatCep(v: string | number): string {
    const cep = this.digits(v).padStart(8, '0');
    return cep.replace(this.CEP, '$1.$2-$3');
  }

  static formatCpfCnpj(v: string | number): string {
    const d = this.digits(v);
    if (d.length === 11) return d.replace(this.CPF, '$1.$2.$3-$4');
    if (d.length === 14) return d.replace(this.CNPJ, '$1.$2.$3/$4-$5');
    return String(v);
  }

  static formatDate(value?: string): string {
    if (!value) return '—';
    const dt = new Date(value);
    const date = dt.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const time = dt.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${date} ${time}`;
  }

  static normalizeB64(s: string): string {
    let t = s.replace(/-/g, '+').replace(/_/g, '/');
    const pad = t.length % 4;
    if (pad) t += '='.repeat(4 - pad);
    return t;
  }

  static decodeBase64ToUtf8(b64: string): string {
    const g = globalThis as unknown as {
      Buffer?: typeof import('buffer').Buffer;
      atob?: (x: string) => string;
    };
    try {
      if (g.Buffer)
        return g.Buffer.from(this.normalizeB64(b64), 'base64').toString(
          'utf-8',
        );
    } catch {
      /* ignore */
    }
    try {
      if (typeof g.atob === 'function') {
        const bin = g.atob(this.normalizeB64(b64));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return typeof TextDecoder !== 'undefined'
          ? new TextDecoder('utf-8').decode(bytes)
          : bin;
      }
    } catch {
      /* ignore */
    }
    return b64;
  }

  static formatDecimal(value?: string | number, decimals = 2): string {
    if (value == null || value === '') return '0,00';

    const num = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(num)) return '0,00';

    return num.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
}
