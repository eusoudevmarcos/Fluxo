"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  HiBell,
  HiAcademicCap,
  HiCurrencyDollar,
  HiHeart,
  HiHome,
  HiLightningBolt,
  HiPlay,
  HiShoppingBag,
  HiSparkles,
  HiUser,
  HiUserGroup,
  HiVideoCamera,
  HiViewGrid,
} from "react-icons/hi";

import { OceanLogo } from "@/components/brand/OceanLogo";
import styles from "./Sidebar.module.css";

const menuItems = [
  { id: "home", href: "/", label: "Início", icon: <HiHome /> },
  { id: "moments", href: "/moments", label: "Moments", icon: <HiLightningBolt /> },
  { id: "flows", href: "/flows", label: "Flows", icon: <HiPlay /> },
  { id: "communities", href: "/comunidades", label: "Comunidades", icon: <HiUserGroup /> },
  { id: "stream", href: "/stream", label: "Ocean Stream", icon: <HiVideoCamera /> },
  { id: "academy", href: "/academy", label: "Ocean Academy", icon: <HiAcademicCap /> },
  { id: "shop", href: "/shop", label: "Ocean Shop", icon: <HiShoppingBag /> },
  { id: "coin", href: "/mais", label: "Ocean Coin", icon: <HiCurrencyDollar /> },
  { id: "date", href: "/date", label: "Date", icon: <HiHeart /> },
  { id: "notifications", href: "/notificacoes", label: "Notificações", icon: <HiBell /> },
  { id: "badges", href: "/selos", label: "Selos", icon: <HiSparkles /> },
  { id: "profile", href: "/perfil", label: "Perfil", icon: <HiUser /> },
  { id: "more", href: "/mais", label: "Mais", icon: <HiViewGrid /> },
];

const suggestions = [
  { name: "Lucas Nunes", username: "lucasnunes" },
  { name: "Marina Souza", username: "marinasouza" },
  { name: "Gabriel Lima", username: "gabriellima" },
  { name: "Carol Oliveira", username: "carololiveira" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState("");

  function toggleFollow(username: string) {
    setFollowing((current) => {
      const next = new Set(current);
      if (next.has(username)) {
        next.delete(username);
        setNotice(`Você deixou de seguir @${username}.`);
      } else {
        next.add(username);
        setNotice(`Você começou a seguir @${username}.`);
      }
      return next;
    });
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <OceanLogo />
      </div>

      <div className={styles.search}>
        <input placeholder="Buscar na Ocean" />
      </div>

      <nav className={styles.menu} aria-label="Menu principal">
        {menuItems.map((item) => {
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <Link
              key={item.id}
              href={item.href}
              className={isActive ? styles.active : ""}
            >
              <span className={styles.menuIcon}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <section className={styles.followBox}>
        <div className={styles.followHeader}>
          <strong>Quem seguir</strong>
          <Link href="/discover">Ver todos</Link>
        </div>

        {suggestions.map((person) => (
          <div className={styles.followItem} key={person.username}>
            <div className={styles.avatar}></div>

            <div>
              <strong>{person.name}</strong>
              <span>@{person.username}</span>
            </div>

            <button type="button" onClick={() => toggleFollow(person.username)}>
              {following.has(person.username) ? "Seguindo" : "Seguir"}
            </button>
          </div>
        ))}
        {notice && <p className={styles.notice}>{notice}</p>}
      </section>
    </aside>
  );
}

