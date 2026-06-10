import Link from "next/link";
import { HiChevronRight, HiTrendingUp } from "react-icons/hi";

import styles from "./MomentWidget.module.css";

const moments = [
  { title: "Para você", tone: "surf", icon: <HiTrendingUp /> },
  { title: "Brasil 🔥", tone: "sunset" },
  { title: "Música 🎵", tone: "stage" },
  { title: "Esportes ⚽", tone: "sport" },
];

export function MomentWidget() {
  return (
    <section className={styles.widget}>
      <div className={styles.widgetHeader}>
        <div>
          <strong>Moments</strong>
          <span>O que está dando o que falar</span>
        </div>
        <Link href="/momentos">Ver tudo</Link>
      </div>

      <div className={styles.track}>
        {moments.map((moment, index) => (
          <Link
            className={`${styles.momentCard} ${index === 0 ? styles.active : ""}`}
            href={`/momentos?filtro=${encodeURIComponent(moment.title)}`}
            key={moment.title}
          >
            <span className={`${styles.art} ${styles[moment.tone]}`}>
              {moment.icon && <i>{moment.icon}</i>}
            </span>
            <strong>{moment.title}</strong>
          </Link>
        ))}
        <Link className={styles.next} href="/momentos" aria-label="Ver mais Moments">
          <HiChevronRight />
        </Link>
      </div>
    </section>
  );
}
