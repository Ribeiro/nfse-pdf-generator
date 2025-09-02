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
    Cidade?: string;
    UF?: string;
    CEP?: string;
  };

  EmailPrestador?: string;

  StatusNFe?: string;
  TributacaoNFe?: string;
  OpcaoSimples?: string;

  ValorServicos?: string;
  CodigoServico?: string;
  AliquotaServicos?: string;
  ValorISS?: string;
  ValorCredito?: string;
  ISSRetido?: string | boolean;

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
    Cidade?: string;
    UF?: string;
    CEP?: string;
  };

  EmailTomador?: string;

  Discriminacao?: string;
  ValorTotalRecebido?: string;

  ValorINSS?: string;
  ValorIRRF?: string;
  ValorCSLL?: string;
  ValorCOFINS?: string;
  ValorPIS?: string;

  DiscriminacaoServico?: string;

  ValorDeducoes?: string;
  BaseCalculo?: string;

  MunicipioPrestacao?: string;
  NumeroInscricaoObra?: string;
  ValorAproximadoTributos?: string;
}

export interface NfseParsed {
  NFe: NfseData | NfseData[];
}
