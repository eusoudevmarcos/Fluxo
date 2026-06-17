import {
  LEGAL_COMMUNITY_VERSION,
  LEGAL_CONTENT_LICENSE_VERSION,
  LEGAL_PRIVACY_VERSION,
  LEGAL_TERMS_VERSION,
} from "./legal-versions";

export type LegalDocumentSlug = "termos" | "privacidade" | "diretrizes" | "conteudo-imagem";

export type LegalSection = {
  title: string;
  body: string[];
};

export type LegalDocument = {
  slug: LegalDocumentSlug;
  title: string;
  version: string;
  updatedAt: string;
  summary: string;
  sections: LegalSection[];
};

export const legalDocuments: Record<LegalDocumentSlug, LegalDocument> = {
  termos: {
    slug: "termos",
    title: "Termos de Uso",
    version: LEGAL_TERMS_VERSION,
    updatedAt: "17 de maio de 2026",
    summary:
      "Define as regras gerais para usar a Wave, criar conta, publicar conteudo, participar de comunidades e interagir com outras pessoas.",
    sections: [
      {
        title: "Aceitacao",
        body: [
          "Ao criar conta, entrar com Google, navegar logado ou usar recursos da Wave, voce declara que leu, entendeu e aceitou estes Termos de Uso e os demais documentos legais da plataforma.",
          "Se voce nao concordar com estes termos, nao deve criar conta nem utilizar a Wave.",
        ],
      },
      {
        title: "Conta e responsabilidade",
        body: [
          "Voce e responsavel pelas informacoes fornecidas, pela seguranca da sua conta e por toda atividade realizada a partir dela.",
          "A Wave pode exigir confirmacoes adicionais, limitar recursos ou suspender contas quando houver suspeita de abuso, fraude, violacao de regras ou exigencia legal.",
        ],
      },
      {
        title: "Idade e autorizacao",
        body: [
          "A Wave pode exigir idade minima, consentimento dos responsaveis ou verificacoes adicionais conforme a legislacao aplicavel e os recursos usados.",
          "Recursos futuros como Date, monetizacao, wallet, Wave Coin ou pagamentos poderao ter regras proprias e requisitos adicionais.",
        ],
      },
      {
        title: "Conteudo gerado pelo usuario",
        body: [
          "Voce e responsavel por Criações, Flow, Moments, comentarios, mensagens, comunidades, imagens, videos, voz, avatar, Flow ID e demais materiais que publicar ou enviar.",
          "Voce declara possuir direitos ou autorizacoes necessarias para publicar conteudo, imagem, voz, nome, marca, obra, musica ou dados de terceiros quando isso for exigivel.",
        ],
      },
      {
        title: "Licenca de uso do conteudo",
        body: [
          "Voce mantem a titularidade do seu conteudo, mas concede a Wave uma licenca nao exclusiva, mundial, gratuita, sublicenciavel e transferivel para hospedar, armazenar, reproduzir, exibir, adaptar tecnicamente, distribuir e divulgar o conteudo dentro da plataforma e em materiais relacionados a Wave.",
          "Essa licenca permite gerar miniaturas, previews, formatos tecnicos, cortes de compatibilidade, exibicao em feeds, comunidades, perfis, Discover e outras areas da Wave.",
        ],
      },
      {
        title: "Proibicoes",
        body: [
          "E proibido usar a Wave para atividades ilegais, golpes, spam, perfis falsos, venda ilegal, assedio, ameacas, discurso de odio, exploracao sexual, abuso infantil, exposicao indevida de dados pessoais ou uso indevido de imagem de terceiros.",
          "Tambem e proibido tentar burlar seguranca, RLS, sistemas de autenticacao, limites tecnicos, moderacao ou medidas antiabuso.",
        ],
      },
      {
        title: "Comunidades e Privs",
        body: [
          "Comunidades devem respeitar as Diretrizes da Comunidade e podem ter regras proprias complementares.",
          "Privs e mensagens privadas tambem estao sujeitos a seguranca, denuncia, moderacao e medidas de protecao quando necessario ou exigido por lei.",
        ],
      },
      {
        title: "Moderacao",
        body: [
          "A Wave pode remover conteudo, limitar alcance, bloquear recursos, suspender ou banir contas quando entender que ha violacao destes termos, das diretrizes, de direitos de terceiros ou da legislacao aplicavel.",
          "A Wave pode cooperar com autoridades quando exigido por lei.",
        ],
      },
      {
        title: "Propriedade intelectual da Wave",
        body: [
          "Nome, marca, identidade visual, interface, codigo, textos, organizacao, recursos e demais elementos da Wave pertencem a Wave ou a seus licenciadores.",
          "Nenhuma licenca sobre a marca Wave e concedida sem autorizacao expressa.",
        ],
      },
      {
        title: "Disponibilidade e limitacao de responsabilidade",
        body: [
          "A Wave esta em beta e pode conter instabilidades, indisponibilidades, mudancas, falhas ou recursos incompletos.",
          "Empregamos medidas razoaveis para manter a plataforma segura e funcional, mas nao prometemos disponibilidade continua, ausencia absoluta de erros ou seguranca perfeita.",
        ],
      },
      {
        title: "Alteracoes e contato",
        body: [
          "Estes termos podem ser atualizados. Quando houver mudancas relevantes, poderemos solicitar novo aceite.",
          "Contato: privacidade@ocean.app.br ou canal oficial que vier a ser informado pela Wave.",
        ],
      },
    ],
  },
  privacidade: {
    slug: "privacidade",
    title: "Politica de Privacidade",
    version: LEGAL_PRIVACY_VERSION,
    updatedAt: "17 de maio de 2026",
    summary:
      "Explica quais dados podem ser coletados, como sao usados e quais cuidados aplicamos na beta da Wave.",
    sections: [
      {
        title: "Dados que coletamos",
        body: [
          "Podemos coletar dados de cadastro, login, perfil, Flow ID, avatar, bio, cidade/estado, interesses, preferencias, interacoes, conteudo publicado, comentarios, comunidade, midia, dispositivo, logs tecnicos e dados de uso.",
          "Se voce enviar imagens, videos ou audio, poderemos tratar imagem, voz, aparencia e metadados tecnicos associados ao arquivo.",
        ],
      },
      {
        title: "Localizacao e perfil",
        body: [
          "Quando a Wave solicitar localizacao, cidade, estado, preferencias ou dados para experiencias futuras, explicaremos o uso esperado na interface sempre que adequado.",
          "Dados sensiveis nao devem ser exibidos publicamente sem necessidade. A Wave pode limitar exibicoes para proteger usuarios.",
        ],
      },
      {
        title: "Conteudo, interacoes e Privs",
        body: [
          "Conteudos publicos podem aparecer em feed, perfil, comunidades, Discover, buscas e outras areas publicas ou semipublicas da Wave.",
          "Privs e mensagens podem ser processados para entrega, seguranca, suporte, denuncia, prevencao de abuso e cumprimento legal. Nao prometemos criptografia ponta a ponta nesta beta.",
        ],
      },
      {
        title: "Cookies e armazenamento local",
        body: [
          "Podemos usar cookies, local storage e tecnologias semelhantes para login, sessao, preferencias, seguranca, metricas tecnicas e melhoria do produto.",
        ],
      },
      {
        title: "Finalidades e bases legais",
        body: [
          "Usamos dados para autenticar usuarios, operar a rede social, exibir conteudo, personalizar experiencia, manter seguranca, prevenir fraude, cumprir obrigacoes legais, melhorar recursos e comunicar atualizacoes relevantes.",
          "As bases legais podem incluir execucao de contrato, consentimento, legitimo interesse, cumprimento de obrigacao legal e exercicio regular de direitos, conforme aplicavel.",
        ],
      },
      {
        title: "Compartilhamento com provedores",
        body: [
          "Podemos compartilhar dados com provedores tecnicos necessarios, como infraestrutura, banco de dados, autenticacao, storage, analytics, email, monitoramento e seguranca.",
          "Nao devemos vender dados pessoais como produto. Recursos futuros de monetizacao terao termos e avisos proprios.",
        ],
      },
      {
        title: "Seguranca e retencao",
        body: [
          "Empregamos medidas razoaveis de seguranca, controle de acesso e boas praticas tecnicas, mas nenhum sistema e 100% seguro.",
          "Podemos manter dados enquanto a conta existir, enquanto forem necessarios para a finalidade, para cumprir lei, resolver disputas, prevenir abuso ou preservar registros de seguranca.",
        ],
      },
      {
        title: "Direitos do titular",
        body: [
          "Voce pode solicitar acesso, correcao, exclusao, portabilidade, informacoes sobre compartilhamento, revisao de decisoes e outros direitos previstos na legislacao aplicavel.",
          "Canal de privacidade: privacidade@ocean.app.br ou outro canal oficial informado pela Wave.",
        ],
      },
      {
        title: "Menores e transferencia internacional",
        body: [
          "Podemos restringir recursos para menores ou exigir autorizacao conforme a lei e a natureza do recurso.",
          "Como usamos provedores tecnicos, dados podem ser processados fora do Brasil, sempre buscando medidas compativeis com a legislacao aplicavel.",
        ],
      },
      {
        title: "Alteracoes",
        body: [
          "Esta politica pode ser atualizada. Mudancas relevantes poderao exigir novo aceite ou aviso dentro da plataforma.",
        ],
      },
    ],
  },
  diretrizes: {
    slug: "diretrizes",
    title: "Diretrizes da Comunidade",
    version: LEGAL_COMMUNITY_VERSION,
    updatedAt: "17 de maio de 2026",
    summary:
      "Define o comportamento esperado para manter Flow, Comunidades, comentarios e Privs seguros para a beta.",
    sections: [
      {
        title: "O que a Wave permite",
        body: [
          "Permitimos debate, humor sem ataque, opiniao, critica respeitosa, comunidades, conteudo criativo, relatos pessoais, cultura, esportes, tecnologia e conversas autenticas.",
          "Divergencias sao bem-vindas quando preservam respeito, seguranca e direitos de terceiros.",
        ],
      },
      {
        title: "Condutas proibidas",
        body: [
          "Nao permitimos racismo, xenofobia, homofobia, intolerancia religiosa, assedio, bullying, ameacas, incitacao a violencia, discurso de odio, difamacao, calunia ou exposicao de dados pessoais de terceiros.",
          "Nao permitimos exploracao sexual, nudez ou pornografia proibida, pedofilia, abuso infantil, aliciamento, conteudo sexual nao consensual ou qualquer conteudo que envolva menores de forma sexualizada.",
        ],
      },
      {
        title: "Seguranca e fraude",
        body: [
          "Nao permitimos spam, golpes, phishing, perfis falsos, venda ilegal, manipulacao de engajamento, malware, automacao abusiva ou tentativa de burlar sistemas da Wave.",
          "Nao use imagem, voz, nome, marca ou dados de terceiros de forma enganosa, ofensiva ou sem autorizacao quando exigivel.",
        ],
      },
      {
        title: "Comunidades",
        body: [
          "Comunidades podem ter regras proprias, mas nenhuma regra de comunidade pode contrariar estas Diretrizes.",
          "Dono, moderadores e membros devem preservar convivencia, seguranca e respeito.",
        ],
      },
      {
        title: "Consequencias",
        body: [
          "A Wave pode remover conteudo, restringir recursos, limitar alcance, bloquear comentarios, suspender conta, banir usuario ou preservar registros quando necessario.",
          "Podemos cooperar com autoridades quando exigido por lei.",
        ],
      },
      {
        title: "Denuncias",
        body: [
          "Recursos de denuncia e moderacao serao expandidos. Durante a beta, algumas acoes podem ser tratadas manualmente.",
          "Denuncias falsas, abusivas ou de ma-fe tambem podem gerar medidas contra o denunciante.",
        ],
      },
    ],
  },
  "conteudo-imagem": {
    slug: "conteudo-imagem",
    title: "Termo de Conteudo, Imagem e Voz",
    version: LEGAL_CONTENT_LICENSE_VERSION,
    updatedAt: "17 de maio de 2026",
    summary:
      "Explica como a Wave pode hospedar, exibir e adaptar tecnicamente conteudos, imagem, voz, avatar e Flow ID publicados voluntariamente.",
    sections: [
      {
        title: "Titularidade",
        body: [
          "Voce mantem a titularidade dos conteudos que cria, envia ou publica na Wave, observados direitos de terceiros e leis aplicaveis.",
          "Voce declara que possui direitos ou autorizacoes necessarias para publicar conteudos, imagem, voz, nome, avatar, marca, musica ou material de terceiros quando isso for exigivel.",
        ],
      },
      {
        title: "Licenca concedida a Wave",
        body: [
          "Ao publicar ou enviar conteudo, voce concede a Wave licenca nao exclusiva, mundial, gratuita, sublicenciavel, transferivel e pelo prazo necessario para hospedar, armazenar, reproduzir, exibir, adaptar tecnicamente, distribuir e divulgar esse conteudo dentro da plataforma e em materiais relacionados a Wave.",
          "A licenca inclui imagem, voz, nome de exibicao, Flow ID, avatar, aparencia e elementos publicados voluntariamente.",
        ],
      },
      {
        title: "Adaptacoes tecnicas",
        body: [
          "A Wave pode gerar thumbnails, previews, formatos adaptados, compressao, cortes tecnicos, transcodificacao e ajustes de exibicao para compatibilidade, seguranca, desempenho e experiencia do usuario.",
          "Recursos futuros com IA de cortes, edicao, filtros ou recomendacao deverao respeitar opcoes, direitos e controles do criador quando implementados.",
        ],
      },
      {
        title: "Terceiros",
        body: [
          "Nao publique imagem, voz, dados, obra, marca ou conteudo de terceiros sem autorizacao quando ela for exigivel.",
          "Conteudos denunciados ou potencialmente irregulares podem ser removidos, restringidos ou analisados pela Wave.",
        ],
      },
      {
        title: "Exclusao",
        body: [
          "A exclusao de conta ou conteudo pode remover exibicoes futuras, ressalvadas obrigacoes legais, backups tecnicos temporarios, registros de seguranca, disputas, auditorias e exigencias legais.",
          "Conteudos compartilhados, republicados ou capturados por terceiros podem continuar fora do controle tecnico da Wave.",
        ],
      },
    ],
  },
};

export const legalDocumentList = [
  legalDocuments.termos,
  legalDocuments.privacidade,
  legalDocuments.diretrizes,
  legalDocuments["conteudo-imagem"],
];
