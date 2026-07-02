import Link from "next/link";
import { HiChevronRight, HiTrendingUp } from "react-icons/hi";

import styles from "./MomentWidget.module.css";

const vibes = [
  { title: "Para você", tone: "surf", icon: <HiTrendingUp /> },
  { title: "Brasil em alta", tone: "sunset" },
  { title: "Música", tone: "stage" },
  { title: "Esportes", tone: "sport" },
];

export function MomentWidget() {
  return (
    <section className={styles.widget}>
      <div className={styles.widgetHeader}>
        <div>
          <strong>Vibes</strong>
          <span>O que está dando o que falar</span>
        </div>
        <Link href="/moments">Ver tudo</Link>
      </div>

      <div className={styles.track}>
        {vibes.map((vibe, index) => (
          <Link
            className={`${styles.momentCard} ${index === 0 ? styles.active : ""}`}
            href={`/moments?filtro=${encodeURIComponent(vibe.title)}`}
            key={vibe.title}
          >
            <span className={`${styles.art} ${styles[vibe.tone]}`}>
              {vibe.icon && <i>{vibe.icon}</i>}
            </span>
            <strong>{vibe.title}</strong>
          </Link>
        ))}
        <Link className={styles.next} href="/moments" aria-label="Ver mais Vibes">
          <HiChevronRight />
        </Link>
      </div>
    </section>
  );
}
