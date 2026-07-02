import Link from "next/link";
import { HiChatAlt2, HiUserAdd, HiUserGroup } from "react-icons/hi";

import styles from "./TrendWidget.module.css";

const activities = [
  { name: "Pedro Alves", action: "comentou no Flow de Lucas R.", time: "2 min atrás", icon: "comment", tone: "ocean" },
  { name: "Ana Clara", action: "deu Wave no Drop de Marina Costa", time: "15 min atrás", icon: "wave", tone: "rose" },
  { name: "Rafa Souza", action: "entrou na comunidade Surf & Nature", time: "1 h atrás", icon: "group", tone: "sun" },
  { name: "Beatriz Lima", action: "virou sua fã", time: "2 h atrás", icon: "follow", tone: "rose" },
];

export function TrendWidget() {
  return (
    <section className={styles.widget}>
      <div className={styles.widgetHeader}>
        <strong>Atividades recentes</strong>
        <Link href="/notificacoes">Ver todas</Link>
      </div>

      {activities.map((activity) => (
        <div className={styles.trend} key={`${activity.name}-${activity.time}`}>
          <span className={`${styles.avatar} ${styles[activity.tone]}`} aria-hidden="true">
            {activity.name.charAt(0).toUpperCase()}
            <i />
          </span>
          <span className={styles.copy}>
            <strong>{activity.name}</strong>
            <span>{activity.action}</span>
            <small>{activity.time}</small>
          </span>
          <i className={styles.actionIcon} aria-hidden="true" data-icon={activity.icon}>
            {activity.icon === "follow" && <HiUserAdd />}
            {activity.icon === "group" && <HiUserGroup />}
            {activity.icon === "comment" && <HiChatAlt2 />}
          </i>
        </div>
      ))}
    </section>
  );
}
