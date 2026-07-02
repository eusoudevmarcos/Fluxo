import {
  BadgeCheck,
  BookOpen,
  Coins,
  Gamepad2,
  GraduationCap,
  HeartHandshake,
  Map,
  Radio,
  ShoppingBag,
  Sparkles,
  Users,
  Waves,
} from "lucide-react";

import styles from "./OceanEcosystem.module.css";

const ecosystemItems = [
  {
    title: "Wave Date",
    description: "Conexões com vibe, localização, segurança e compatibilidade social.",
    status: "Em breve",
    Icon: HeartHandshake,
  },
  {
    title: "Wave Shop",
    description: "Marketplace com reputação social, localização, reviews e integração futura com Wave Coin.",
    status: "Em breve",
    Icon: ShoppingBag,
  },
  {
    title: "Wave Stream",
    description: "Lives de jogos, música, dança, arte, lifestyle, eventos e conteúdo original.",
    status: "Em breve",
    Icon: Radio,
  },
  {
    title: "Wave Academy",
    description: "Cursos online por criadores, empresas, especialistas e comunidades.",
    status: "Em breve",
    Icon: GraduationCap,
  },
  {
    title: "Creator Economy",
    description: "Assinaturas, conteúdos exclusivos, eventos, doações, selos, temas e monetização para criadores.",
    status: "Preparando",
    Icon: Users,
  },
  {
    title: "Aura & Gamificação",
    description: "Conquistas, reputação visual, temas desbloqueáveis, bordas, selos e evolução do perfil.",
    status: "Em evolução",
    Icon: Gamepad2,
  },
  {
    title: "Wave Coin",
    description: "Visão futura para wallet, transações, marketplace, doações, recompensas e economia interna.",
    status: "Visão futura",
    Icon: Coins,
    note: "Sujeito a requisitos técnicos, legais e regulatórios. Não é uma moeda ativa nesta beta.",
  },
];

const innovationItems = [
  {
    title: "Presença Viva",
    description: "Conteúdos deixam de ser vistos sozinhos e viram espaços temporários de encontro.",
    Icon: Sparkles,
  },
  {
    title: "WaveMap",
    description: "A Wave mostra como uma ideia se espalha, quem impulsionou e por onde passou.",
    Icon: Map,
  },
  {
    title: "Maré da Wave",
    description: "Você escolhe a experiência que quer viver, em vez de ser refém do algoritmo.",
    Icon: Waves,
  },
  {
    title: "Perfil Vivo",
    description: "Perfis deixam de ser vitrines e viram territórios sociais.",
    Icon: BadgeCheck,
  },
  {
    title: "Aura Dinâmica",
    description: "Reputação vira identidade visual conquistada.",
    Icon: BookOpen,
  },
];

export function OceanEcosystem() {
  return (
    <div className={styles.ecosystem}>
      <section className={styles.hero}>
        <span>Mais</span>
        <h1>O Ecossistema Wave</h1>
        <p>
          A Wave está nascendo como uma rede social, mas foi pensada para crescer como
          um ecossistema de conteúdo, conexão, comércio, aprendizado e presença.
        </p>
      </section>

      <section className={styles.grid} aria-label="Recursos futuros da Wave">
        {ecosystemItems.map(({ title, description, status, Icon, note }) => (
          <article className={styles.card} key={title}>
            <div className={styles.iconBox}>
              <Icon aria-hidden="true" size={22} strokeWidth={2.2} />
            </div>
            <div>
              <div className={styles.cardHeader}>
                <h2>{title}</h2>
                <span>{status}</span>
              </div>
              <p>{description}</p>
              {note && <small>{note}</small>}
            </div>
            <button type="button" disabled>
              Em breve
            </button>
          </article>
        ))}
      </section>

      <section className={styles.innovation}>
        <div className={styles.sectionTitle}>
          <span>Visão de produto</span>
          <h2>O que torna a Wave diferente</h2>
        </div>

        <div className={styles.innovationGrid}>
          {innovationItems.map(({ title, description, Icon }) => (
            <article className={styles.miniCard} key={title}>
              <Icon aria-hidden="true" size={18} strokeWidth={2.3} />
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
