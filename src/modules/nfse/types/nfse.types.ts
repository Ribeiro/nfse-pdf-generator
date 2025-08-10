export interface NfseData {
  Numero: string | string[];
  CodigoVerificacao: string | string[];
  DataEmissao: string | string[];
  Competencia?: string | string[];

  IdentificacaoRps?:
    | {
        Numero?: string | string[];
        Serie?: string | string[];
        Tipo?: string | string[];
      }
    | Array<{ Numero?: string[]; Serie?: string[]; Tipo?: string[] }>;

  OrgaoGerador?:
    | { CodigoMunicipio?: string | string[]; Uf?: string | string[] }
    | Array<{ CodigoMunicipio?: string[]; Uf?: string[] }>;

  PrestadorServico:
    | {
        RazaoSocial: string | string[];
        NomeFantasia?: string | string[];
        Endereco?: string | string[];
        Contato?: { Email?: string | string[] };
        IdentificacaoPrestador?: {
          Cnpj?: string | string[];
          InscricaoMunicipal?: string | string[];
        };
      }
    | Array<{
        RazaoSocial: string[];
        NomeFantasia?: string[];
        Endereco?: string[];
        Contato?: Array<{ Email?: string[] }>;
        IdentificacaoPrestador?: Array<{
          Cnpj?: string[];
          InscricaoMunicipal?: string[];
        }>;
      }>;

  TomadorServico:
    | {
        RazaoSocial: string | string[];
        Endereco?: {
          Endereco?: string | string[];
          Numero?: string | string[];
          Complemento?: string | string[];
          Bairro?: string | string[];
          CodigoMunicipio?: string | string[];
          Uf?: string | string[];
          Cep?: string | string[];
        };
        Contato?: { Telefone?: string | string[]; Email?: string | string[] };
        IdentificacaoTomador?: {
          CpfCnpj?: { Cnpj?: string | string[]; Cpf?: string | string[] };
          InscricaoMunicipal?: string | string[];
        };
      }
    | Array<{
        RazaoSocial: string[];
        Endereco?: Array<{
          Endereco?: string[];
          Numero?: string[];
          Complemento?: string[];
          Bairro?: string[];
          CodigoMunicipio?: string[];
          Uf?: string[];
          Cep?: string[];
        }>;
        Contato?: Array<{ Telefone?: string[]; Email?: string[] }>;
        IdentificacaoTomador?: Array<{
          CpfCnpj?: Array<{ Cnpj?: string[]; Cpf?: string[] }>;
          InscricaoMunicipal?: string[];
        }>;
      }>;

  Servico:
    | {
        Valores: {
          ValorServicos?: string | string[];
          ValorDeducoes?: string | string[];
          ValorPis?: string | string[];
          ValorCofins?: string | string[];
          ValorInss?: string | string[];
          ValorIr?: string | string[];
          ValorCsll?: string | string[];
          IssRetido?: string | string[];
          ValorIss?: string | string[];
          OutrasRetencoes?: string | string[];
          BaseCalculo?: string | string[];
          Aliquota?: string | string[];
          ValorLiquidoNfse?: string | string[];
          ValorIssRetido?: string | string[];
          DescontoCondicionado?: string | string[];
          DescontoIncondicionado?: string | string[];
        };
        ItemListaServico?: string | string[];
        CodigoCnae?: string | string[];
        CodigoTributacaoMunicipio?: string | string[];
        Discriminacao?: string | string[];
        CodigoMunicipio?: string | string[];
      }
    | Array<{
        Valores: Array<{
          ValorServicos?: string[];
          ValorDeducoes?: string[];
          ValorPis?: string[];
          ValorCofins?: string[];
          ValorInss?: string[];
          ValorIr?: string[];
          ValorCsll?: string[];
          IssRetido?: string[];
          ValorIss?: string[];
          OutrasRetencoes?: string[];
          BaseCalculo?: string[];
          Aliquota?: string[];
          ValorLiquidoNfse?: string[];
          ValorIssRetido?: string[];
          DescontoCondicionado?: string[];
          DescontoIncondicionado?: string[];
        }>;
        ItemListaServico?: string[];
        CodigoCnae?: string[];
        CodigoTributacaoMunicipio?: string[];
        Discriminacao?: string[];
        CodigoMunicipio?: string[];
      }>;
}

export interface NfseParsed {
  Nfse: {
    InfNfse: NfseData[] | NfseData;
  };
}
