"use client";

import Link from "next/link";
import { HiBell, HiChatAlt2, HiSearch, HiUser } from "react-icons/hi";

import { OceanLogo } from "@/components/brand/OceanLogo";
import { useProfile } from "@/components/profile/ProfileProvider";
import styles from "./MobileTopBar.module.css";

type MobileTopBarProps = {
  onTogglePrivs: () => void;
};

function getInitial(name?: string | null) {
  return (name || "Fluxo").trim().charAt(0).toUpperCase() || "W";
}

export function MobileTopBar({ onTogglePrivs }: MobileTopBarProps) {
  const { profile } = useProfile();

  return (
    <header className={styles.topbar}>
      <Link href="/" className={styles.logo} aria-label="Fluxo Home">
        <OceanLogo size="sm" />
      </Link>

      <div className={styles.actions}>
        <Link href="/discover" aria-label="Buscar pessoas">
          <HiSearch />
        </Link>
        <Link href="/notificacoes" aria-label="Notificações">
          <HiBell />
        </Link>
        <button type="button" aria-label="Privs" onClick={onTogglePrivs}>
          <HiChatAlt2 />
        </button>
        <Link className={styles.avatar} href="/perfil" aria-label="Perfil">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" />
          ) : (
            <span>{profile ? getInitial(profile.display_name) : <HiUser />}</span>
          )}
        </Link>
      </div>
    </header>
  );
}
