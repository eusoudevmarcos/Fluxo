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
    updatedAt: "28 de setembro de 2026",
    summary:
      "Define as regras gerais para usar a Fluxo, criar conta, publicar conteúdo, participar de comunidades e interagir com outras pessoas.",
    sections: [
      {
        title: "Aceitação",
        body: [
          "Ao criar conta, entrar com Google, navegar logado ou usar recursos da Fluxo, você declara que leu, entendeu e aceitou estes Termos de Uso e os demais documentos legais da plataforma.",
          "Se você não concordar com estes termos, não deve criar conta nem utilizar a Fluxo.",
        ],
      },
      {
        title: "Conta e responsabilidade",
        body: [
          "Você é responsável pelas informações fornecidas, pela segurança da sua conta e por toda atividade realizada a partir dela.",
          "A Fluxo pode exigir confirmações adicionais, limitar recursos ou suspender contas quando houver suspeita de abuso, fraude, violação de regras ou exigência legal.",
        ],
      },
      {
        title: "Idade mínima e proteção de adolescentes",
        body: [
          "A Fluxo é para pessoas a partir de 14 anos. A data de nascimento é informada uma única vez no cadastro; contas de menores de 14 anos não são criadas. Informar data falsa pode levar ao cancelamento da conta.",
          "Contas de 14 a 17 anos têm proteções automáticas: não são sugeridas a adultos (de 14 e 15 anos, a ninguém), não aparecem na busca de adultos que elas não seguem, só recebem mensagens de quem seguem, não usam o recurso Pessoas Próximas, não recebem missões de sequência de dias e não recebem notificações entre 21h e 8h.",
          "Programa de criadores, monetização e recursos como Date, carteira ou pagamentos têm regras próprias e, nesta fase, são restritos a maiores de 18 anos.",
        ],
      },
      {
        title: "Convites, missões, selos e recompensas",
        body: [
          "Convites, missões, XP, auras, selos, temas e Fluxo Coin são recursos virtuais da plataforma, sem valor em dinheiro, não reembolsáveis e não transferíveis para fora da Fluxo.",
          "Campanhas como selos de pioneiro têm vagas limitadas e podem terminar a qualquer momento (por exemplo, quando a Fluxo atingir 100 mil usuários). Critérios, quantidades e recompensas podem mudar.",
          "Criar contas falsas ou múltiplas, trocar convites combinados, automatizar ações ou manipular missões e engajamento pode levar à perda das recompensas, remoção de alcance e suspensão da conta.",
        ],
      },
      {
        title: "Programa Prime Influencer",
        body: [
          "Criadores podem se inscrever informando rede social e número de seguidores. A aprovação é feita pela equipe da Fluxo, pode exigir prova de titularidade do perfil externo (código na bio) e pode ser recusada sem necessidade de justificativa detalhada.",
          "O selo e o tema exclusivo são concedidos aos primeiros aprovados enquanto houver vagas e podem ser retirados em caso de violação destes termos.",
        ],
      },
      {
        title: "Bloqueio e denúncia",
        body: [
          "Você pode bloquear qualquer pessoa: vocês deixam de se seguir e deixam de ver posts, comentários, perfis na busca e mensagens um do outro. A pessoa bloqueada não é avisada.",
          "Você pode denunciar posts, comentários, perfis e mensagens. Conteúdos com várias denúncias podem ser ocultados automaticamente até a revisão da equipe.",
        ],
      },
      {
        title: "Conteúdo gerado pelo usuário",
        body: [
          "Você é responsável por Drops, Flow, Vibes, comentários, mensagens, comunidades, imagens, vídeos, voz, avatar, Flow ID e demais materiais que publicar ou enviar.",
          "Você declara possuir direitos ou autorizações necessárias para publicar conteúdo, imagem, voz, nome, marca, obra, música ou dados de terceiros quando isso for exigível.",
        ],
      },
      {
        title: "Licença de uso do conteúdo",
        body: [
          "Você mantém a titularidade do seu conteúdo, mas concede à Fluxo uma licença não exclusiva, mundial, gratuita, sublicenciável e transferível para hospedar, armazenar, reproduzir, exibir, adaptar tecnicamente, distribuir e divulgar o conteúdo dentro da plataforma e em materiais relacionados à Fluxo.",
          "Essa licença permite gerar miniaturas, previews, formatos técnicos, cortes de compatibilidade, exibição na Fluxo, comunidades, perfis, Discover e outras áreas da plataforma.",
        ],
      },
      {
        title: "Proibições",
        body: [
          "É proibido usar a Fluxo para atividades ilegais, golpes, spam, perfis falsos, venda ilegal, assédio, ameaças, discurso de ódio, exploração sexual, abuso infantil, exposição indevida de dados pessoais ou uso indevido de imagem de terceiros.",
          "Também é proibido tentar burlar segurança, RLS, sistemas de autenticação, limites técnicos, moderação ou medidas antiabuso.",
        ],
      },
      {
        title: "Comunidades e Privs",
        body: [
          "Comunidades devem respeitar as Diretrizes da Comunidade e podem ter regras próprias complementares.",
          "Privs e mensagens privadas também estão sujeitos a segurança, denúncia, moderação e medidas de proteção quando necessário ou exigido por lei.",
        ],
      },
      {
        title: "Moderação",
        body: [
          "A Fluxo pode remover conteúdo, limitar alcance, bloquear recursos, suspender ou banir contas quando entender que há violação destes termos, das diretrizes, de direitos de terceiros ou da legislação aplicável.",
          "A Fluxo pode cooperar com autoridades quando exigido por lei.",
        ],
      },
      {
        title: "Propriedade intelectual da Fluxo",
        body: [
          "Nome, marca, identidade visual, interface, código, textos, organização, recursos e demais elementos da Fluxo pertencem à Fluxo ou a seus licenciadores.",
          "Nenhuma licença sobre a marca Fluxo é concedida sem autorização expressa.",
        ],
      },
      {
        title: "Disponibilidade e limitação de responsabilidade",
        body: [
          "A Fluxo está em versão de teste (beta) e pode conter instabilidades, indisponibilidades, mudanças, falhas ou recursos incompletos. Dados e recompensas da fase de testes podem ser ajustados antes do lançamento oficial.",
          "Durante a beta, relatórios de erro e feedbacks enviados pelo app são usados para corrigir problemas e melhorar a plataforma.",
          "Empregamos medidas razoáveis para manter a plataforma segura e funcional, mas não prometemos disponibilidade contínua, ausência absoluta de erros ou segurança perfeita.",
        ],
      },
      {
        title: "Alterações e contato",
        body: [
          "Estes termos podem ser atualizados. Quando houver mudanças relevantes, poderemos solicitar novo aceite.",
          "Contato: privacidade@ocean.app.br ou canal oficial que vier a ser informado pela Fluxo.",
        ],
      },
    ],
  },
  privacidade: {
    slug: "privacidade",
    title: "Política de Privacidade",
    version: LEGAL_PRIVACY_VERSION,
    updatedAt: "28 de setembro de 2026",
    summary:
      "Explica quais dados podem ser coletados, como são usados e quais cuidados aplicamos na beta da Fluxo.",
    sections: [
      {
        title: "Dados que coletamos",
        body: [
          "Podemos coletar dados de cadastro, login, perfil, Flow ID, avatar, bio, cidade/estado, interesses, preferências, interações, conteúdo publicado, comentários, comunidade, mídia, dispositivo, logs técnicos e dados de uso.",
          "Se você enviar imagens, vídeos ou áudio, poderemos tratar imagem, voz, aparência e metadados técnicos associados ao arquivo.",
          "Também tratamos: data de nascimento (para aplicar a idade mínima e as proteções de adolescentes), convites (quem convidou quem), progresso em missões e recompensas, token do aparelho para notificações, e feedbacks ou relatórios de erro enviados pelo app com informações técnicas do aparelho.",
        ],
      },
      {
        title: "Localização",
        body: [
          "A localização é opcional. Com sua permissão, usamos a posição do aparelho para sugerir comunidades e pessoas da sua região. Suas coordenadas nunca aparecem no perfil nem para outras pessoas.",
          "O recurso Pessoas Próximas só funciona se você ativá-lo, é exclusivo para maiores de 18 anos e mostra apenas faixas de distância aproximada (por exemplo, \"até 5 km\"), calculadas sobre posições arredondadas. Enquanto estiver ativo, a posição é atualizada no máximo a cada 10 minutos quando você usa o app. Você pode desativá-lo a qualquer momento.",
          "Sexo informado, data de nascimento e coordenadas são dados privados, visíveis apenas para você e usados internamente para segurança e personalização.",
        ],
      },
      {
        title: "Sugestões e alcance",
        body: [
          "As sugestões de quem seguir consideram amigos em comum, cidade, proximidade (quando ativada), novas contas e o alcance ganho ao cumprir missões. O alcance extra é temporário e diminui com o tempo.",
          "Não vendemos posição nas sugestões e não usamos dados de adolescentes para recomendá-los a adultos.",
        ],
      },
      {
        title: "Notificações",
        body: [
          "Com sua permissão, enviamos notificações no aparelho sobre interações, convites aceitos, missões e selos. Você pode desativá-las nas configurações do aparelho. Adolescentes não recebem notificações entre 21h e 8h.",
        ],
      },
      {
        title: "Conteúdo, interações e Privs",
        body: [
          "Conteúdos públicos podem aparecer na Fluxo, perfil, comunidades, Discover, buscas e outras áreas públicas ou semipúblicas da plataforma.",
          "Privs e mensagens podem ser processados para entrega, segurança, suporte, denúncia, prevenção de abuso e cumprimento legal. Não prometemos criptografia ponta a ponta nesta beta.",
        ],
      },
      {
        title: "Cookies e armazenamento local",
        body: [
          "Podemos usar cookies, local storage e tecnologias semelhantes para login, sessão, preferências, segurança, métricas técnicas e melhoria do produto.",
        ],
      },
      {
        title: "Finalidades e bases legais",
        body: [
          "Usamos dados para autenticar usuários, operar a rede social, exibir conteúdo, personalizar experiência, manter segurança, prevenir fraude, cumprir obrigações legais, melhorar recursos e comunicar atualizações relevantes.",
          "As bases legais podem incluir execução de contrato, consentimento, legítimo interesse, cumprimento de obrigação legal e exercício regular de direitos, conforme aplicável.",
        ],
      },
      {
        title: "Compartilhamento com provedores",
        body: [
          "Podemos compartilhar dados com provedores técnicos necessários, como infraestrutura, banco de dados, autenticação, storage, analytics, email, monitoramento e segurança.",
          "Não devemos vender dados pessoais como produto. Recursos futuros de monetização terão termos e avisos próprios.",
        ],
      },
      {
        title: "Segurança e retenção",
        body: [
          "Empregamos medidas razoáveis de segurança, controle de acesso e boas práticas técnicas, mas nenhum sistema é 100% seguro.",
          "Podemos manter dados enquanto a conta existir, enquanto forem necessários para a finalidade, para cumprir lei, resolver disputas, prevenir abuso ou preservar registros de segurança.",
        ],
      },
      {
        title: "Direitos do titular",
        body: [
          "Você pode solicitar acesso, correção, exclusão, portabilidade, informações sobre compartilhamento, revisão de decisões e outros direitos previstos na legislação aplicável.",
          "Canal de privacidade: privacidade@ocean.app.br ou outro canal oficial informado pela Fluxo.",
        ],
      },
      {
        title: "Menores e transferência internacional",
        body: [
          "A Fluxo aceita contas a partir de 14 anos e aplica proteções automáticas a contas de 14 a 17 anos, descritas nos Termos de Uso. Recursos adicionais podem exigir autorização dos responsáveis conforme a lei.",
          "Como usamos provedores técnicos, dados podem ser processados fora do Brasil, sempre buscando medidas compatíveis com a legislação aplicável.",
        ],
      },
      {
        title: "Alterações",
        body: [
          "Esta política pode ser atualizada. Mudanças relevantes poderão exigir novo aceite ou aviso dentro da plataforma.",
        ],
      },
    ],
  },
  diretrizes: {
    slug: "diretrizes",
    title: "Diretrizes da Comunidade",
    version: LEGAL_COMMUNITY_VERSION,
    updatedAt: "28 de setembro de 2026",
    summary:
      "Define o comportamento esperado para manter Flow, Comunidades, comentários e Privs seguros para a beta.",
    sections: [
      {
        title: "O que a Fluxo permite",
        body: [
          "Permitimos debate, humor sem ataque, opinião, crítica respeitosa, comunidades, conteúdo criativo, relatos pessoais, cultura, esportes, tecnologia e conversas autênticas.",
          "Divergências são bem-vindas quando preservam respeito, segurança e direitos de terceiros.",
        ],
      },
      {
        title: "Condutas proibidas",
        body: [
          "Não permitimos racismo, xenofobia, homofobia, intolerância religiosa, assédio, bullying, ameaças, incitação à violência, discurso de ódio, difamação, calúnia ou exposição de dados pessoais de terceiros.",
          "Não permitimos exploração sexual, nudez ou pornografia proibida, pedofilia, abuso infantil, aliciamento, conteúdo sexual não consensual ou qualquer conteúdo que envolva menores de forma sexualizada.",
        ],
      },
      {
        title: "Segurança e fraude",
        body: [
          "Não permitimos spam, golpes, phishing, perfis falsos, venda ilegal, manipulação de engajamento, malware, automação abusiva ou tentativa de burlar sistemas da Fluxo.",
          "Isso inclui criar contas para aceitar os próprios convites, trocar curtidas, comentários ou seguidores combinados só para cumprir missões, e qualquer forma de farmar recompensas.",
          "Não use imagem, voz, nome, marca ou dados de terceiros de forma enganosa, ofensiva ou sem autorização quando exigível.",
        ],
      },
      {
        title: "Comunidades",
        body: [
          "Comunidades podem ter regras próprias, mas nenhuma regra de comunidade pode contrariar estas Diretrizes.",
          "Dono, moderadores e membros devem preservar convivência, segurança e respeito.",
        ],
      },
      {
        title: "Consequências",
        body: [
          "A Fluxo pode remover conteúdo, restringir recursos, limitar alcance, bloquear comentários, suspender conta, banir usuário ou preservar registros quando necessário.",
          "Podemos cooperar com autoridades quando exigido por lei.",
        ],
      },
      {
        title: "Denúncias",
        body: [
          "Você pode denunciar posts, comentários, perfis e mensagens pelo menu \"⋯\" ou tocando e segurando o comentário, e pode bloquear qualquer perfil. Quem é denunciado não sabe quem denunciou.",
          "Posts com várias denúncias podem ser ocultados automaticamente até a revisão da equipe, que decide se o conteúdo volta ou é removido. Durante a beta, a revisão é manual.",
          "Denúncias falsas, abusivas ou de má-fé também podem gerar medidas contra o denunciante.",
        ],
      },
    ],
  },
  "conteudo-imagem": {
    slug: "conteudo-imagem",
    title: "Termo de Conteúdo, Imagem e Voz",
    version: LEGAL_CONTENT_LICENSE_VERSION,
    updatedAt: "28 de setembro de 2026",
    summary:
      "Explica como a Fluxo pode hospedar, exibir e adaptar tecnicamente conteúdos, imagem, voz, avatar e Flow ID publicados voluntariamente.",
    sections: [
      {
        title: "Titularidade",
        body: [
          "Você mantém a titularidade dos conteúdos que cria, envia ou publica na Fluxo, observados direitos de terceiros e leis aplicáveis.",
          "Você declara que possui direitos ou autorizações necessárias para publicar conteúdos, imagem, voz, nome, avatar, marca, música ou material de terceiros quando isso for exigível.",
        ],
      },
      {
        title: "Licença concedida à Fluxo",
        body: [
          "Ao publicar ou enviar conteúdo, você concede à Fluxo licença não exclusiva, mundial, gratuita, sublicenciável, transferível e pelo prazo necessário para hospedar, armazenar, reproduzir, exibir, adaptar tecnicamente, distribuir e divulgar esse conteúdo dentro da plataforma e em materiais relacionados à Fluxo.",
          "A licença inclui imagem, voz, nome de exibição, Flow ID, avatar, aparência e elementos publicados voluntariamente.",
        ],
      },
      {
        title: "Adaptações técnicas",
        body: [
          "A Fluxo pode gerar thumbnails, previews, formatos adaptados, compressão, cortes técnicos, transcodificação e ajustes de exibição para compatibilidade, segurança, desempenho e experiência do usuário.",
          "Recursos futuros com IA de cortes, edição, filtros ou recomendação deverão respeitar opções, direitos e controles do criador quando implementados.",
        ],
      },
      {
        title: "Terceiros",
        body: [
          "Não publique imagem, voz, dados, obra, marca ou conteúdo de terceiros sem autorização quando ela for exigível.",
          "Conteúdos denunciados ou potencialmente irregulares podem ser removidos, restringidos ou analisados pela Fluxo.",
        ],
      },
      {
        title: "Exclusão",
        body: [
          "A exclusão de conta ou conteúdo pode remover exibições futuras, ressalvadas obrigações legais, backups técnicos temporários, registros de segurança, disputas, auditorias e exigências legais.",
          "Conteúdos compartilhados, republicados ou capturados por terceiros podem continuar fora do controle técnico da Fluxo.",
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
