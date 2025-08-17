export interface NfseData {
  Assinatura?: string;

  ChaveNFe?: {
    InscricaoPrestador?: string;
    NumeroNFe?: string;
    CodigoVerificacao?: string;
  };

  DataEmissaoNFe?: string;
  NumeroLote?: string;

  ChaveRPS?: {
    InscricaoPrestador?: string;
    SerieRPS?: string;
    NumeroRPS?: string;
  };

  TipoRPS?: string;
  DataEmissaoRPS?: string;

  CPFCNPJPrestador?: {
    CNPJ?: string;
    CPF?: string;
  };

  RazaoSocialPrestador?: string;

  EnderecoPrestador?: {
    TipoLogradouro?: string;
    Logradouro?: string;
    NumeroEndereco?: string;
    Bairro?: string;
    Cidade?: string; // código IBGE (ex.: "3550308")
    UF?: string; // ex.: "SP"
    CEP?: string;
  };

  EmailPrestador?: string;

  StatusNFe?: string; // ex.: "N"
  TributacaoNFe?: string; // ex.: "T"
  OpcaoSimples?: string; // "0" ou "1"

  ValorServicos?: string;
  CodigoServico?: string; // ex.: "3205"
  AliquotaServicos?: string; // ex.: "0.02"
  ValorISS?: string;
  ValorCredito?: string;
  ISSRetido?: string | boolean; // caso use valueProcessors pode virar boolean

  CPFCNPJTomador?: {
    CNPJ?: string;
    CPF?: string;
  };

  RazaoSocialTomador?: string;

  EnderecoTomador?: {
    TipoLogradouro?: string;
    Logradouro?: string;
    NumeroEndereco?: string;
    ComplementoEndereco?: string;
    Bairro?: string;
    Cidade?: string; // código IBGE (ex.: "4314902")
    UF?: string; // ex.: "RS"
    CEP?: string;
  };

  EmailTomador?: string;

  Discriminacao?: string;
  ValorTotalRecebido?: string;
}

export interface NfseParsed {
  NFe: NfseData | NfseData[];
}
