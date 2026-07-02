"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { HiChatAlt2, HiHome, HiPlus, HiSearch, HiUser } from "react-icons/hi";

import { MobileCreateSheet } from "@/components/mobile/MobileCreateSheet";
import styles from "./MobileNav.module.css";

type MobileNavProps = {
  onOpenPrivs: () => void;
};

export function MobileNav({ onOpenPrivs }: MobileNavProps) {
  const pathname = usePathname();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const isHome = pathname === "/";
  const isSearch = pathname.startsWith("/discover");
  const isProfile = pathname.startsWith("/perfil");

  return (
    <>
      <nav className={styles.nav} aria-label="Navegação mobile">
        <Link
          href="/"
          className={isHome ? styles.active : ""}
          aria-label="Início"
          title="Início"
        >
          <HiHome />
          <span>Início</span>
        </Link>

        <Link
          href="/discover"
          className={isSearch ? styles.active : ""}
          aria-label="Buscar"
          title="Buscar"
        >
          <HiSearch />
          <span>Buscar</span>
        </Link>

        <button
          type="button"
          className={styles.createButton}
          aria-label="Criar"
          onClick={() => setIsCreateOpen(true)}
        >
          <HiPlus />
        </button>

        <button
          type="button"
          className={styles.navButton}
          aria-label="Privs"
          title="Privs"
          onClick={onOpenPrivs}
        >
          <HiChatAlt2 />
          <span>Mensagens</span>
        </button>

        <Link
          href="/perfil"
          className={isProfile ? styles.active : ""}
          aria-label="Perfil"
          title="Perfil"
        >
          <HiUser />
          <span>Perfil</span>
        </Link>
      </nav>

      <MobileCreateSheet isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </>
  );
}
