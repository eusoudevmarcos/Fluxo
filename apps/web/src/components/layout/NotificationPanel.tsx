"use client";

import Link from "next/link";
import { HiBell, HiChatAlt2, HiFire, HiSparkles, HiUserGroup } from "react-icons/hi";

import styles from "./NotificationPanel.module.css";

const notifications = [
  {
    id: "1",
    title: "Gabriel deu Dahora",
    text: "Seu Flow recebeu uma nova reação.",
    time: "agora",
    icon: <HiFire />,
  },
  {
    id: "2",
    title: "Marina comentou",
    text: "Ela respondeu na sua criação.",
    time: "5 min",
    icon: <HiChatAlt2 />,
  },
  {
    id: "3",
    title: "Nova missão disponível",
    text: "Complete sua sequência e ganhe XP.",
    time: "hoje",
    icon: <HiSparkles />,
  },
  {
    id: "4",
    title: "Comunidade em alta",
    text: "Games está movimentada agora.",
    time: "1 h",
    icon: <HiUserGroup />,
  },
];

type NotificationPanelProps = {
  onClose: () => void;
};

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  return (
    <section className={styles.panel} aria-label="Notificações">
      <header className={styles.header}>
        <div>
          <strong>
            <HiBell />
            Notificações
          </strong>
          <span>O que mexeu com seu flow</span>
        </div>
        <button type="button" onClick={onClose}>
          Fechar
        </button>
      </header>

      <div className={styles.list}>
        {notifications.map((notification) => (
          <article className={styles.item} key={notification.id}>
            <span className={styles.icon}>{notification.icon}</span>
            <div>
              <strong>{notification.title}</strong>
              <p>{notification.text}</p>
            </div>
            <small>{notification.time}</small>
          </article>
        ))}
      </div>

      <Link className={styles.allLink} href="/notificacoes" onClick={onClose}>
        Ver todas
      </Link>
    </section>
  );
}
