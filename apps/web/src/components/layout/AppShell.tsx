"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  HiHome,
  HiLightningBolt,
  HiShoppingBag,
  HiUserGroup,
  HiVideoCamera,
} from "react-icons/hi";

import { ProfileProvider, useProfile } from "@/components/profile/ProfileProvider";
import { PrivsPanel } from "@/components/privs/PrivsPanel";
import { hasAcceptedCurrentLegalVersions } from "@/lib/services/legal.service";
import { createClient } from "@/lib/supabase/client";
import styles from "./AppShell.module.css";
import { MobileNav } from "./MobileNav";
import { MobileTopBar } from "./MobileTopBar";
import { RightSidebar } from "./RightSidebar";
import { Sidebar } from "./Sidebar";

type AppShellProps = {
  children: React.ReactNode;
};

function LegalGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const { user, profile, isLoading } = useProfile();
  const [isCheckingLegal, setIsCheckingLegal] = useState(true);

  useEffect(() => {
    if (isLoading) return;

    const timeoutId = window.setTimeout(() => {
      if (!user) {
        router.replace("/auth?mode=login");
        return;
      }

      hasAcceptedCurrentLegalVersions(supabase)
        .then((hasAccepted) => {
          if (!hasAccepted) {
            router.replace("/legal/accept");
            return;
          }

          if (
            profile &&
            (!profile.onboarding_completed || !profile.profile_required_completed)
          ) {
            router.replace("/onboarding");
            return;
          }

          setIsCheckingLegal(false);
        })
        .catch(() => {
          router.replace("/legal/accept");
        });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isLoading, pathname, profile, router, supabase, user]);

  if (isLoading || isCheckingLegal) {
    return <div className={styles.gateNotice}>Preparando sua entrada na Ocean...</div>;
  }

  return children;
}

export function AppShell({ children }: AppShellProps) {
  const [isPrivsOpen, setIsPrivsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const pathname = usePathname();

  const topItems = [
    { href: "/", label: "Home", icon: <HiHome /> },
    { href: "/moments", label: "Moments", icon: <HiLightningBolt /> },
    { href: "/stream", label: "Ao vivo", icon: <HiVideoCamera /> },
    { href: "/shop", label: "Shop", icon: <HiShoppingBag /> },
    { href: "/comunidades", label: "Comunidades", icon: <HiUserGroup /> },
  ];

  return (
    <ProfileProvider>
      <LegalGate>
        <MobileTopBar onTogglePrivs={() => setIsPrivsOpen((current) => !current)} />
        <MobileNav onOpenPrivs={() => setIsPrivsOpen(true)} />

        <main className={styles.app}>
          <Sidebar />

          <section className={styles.feed}>
            <nav className={styles.topMenu} aria-label="Menu rapido">
              {topItems.map((item) => {
                const isActive =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

                return (
                  <Link
                    className={isActive ? styles.topActive : ""}
                    href={item.href}
                    key={`${item.label}-${item.href}`}
                    title={item.label}
                  >
                    {item.icon}
                    <span className={styles.srOnly}>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {children}
          </section>

          <RightSidebar
            isNotificationsOpen={isNotificationsOpen}
            isPrivsOpen={isPrivsOpen}
            onCloseNotifications={() => setIsNotificationsOpen(false)}
            onClosePrivs={() => setIsPrivsOpen(false)}
            onToggleNotifications={() => {
              setIsNotificationsOpen((current) => !current);
              setIsPrivsOpen(false);
            }}
            onTogglePrivs={() => {
              setIsPrivsOpen((current) => !current);
              setIsNotificationsOpen(false);
            }}
          />
        </main>

        {isPrivsOpen && (
          <div className={styles.mobilePrivs}>
            <div className={styles.mobilePrivsInner}>
              <PrivsPanel onClose={() => setIsPrivsOpen(false)} />
            </div>
          </div>
        )}
      </LegalGate>
    </ProfileProvider>
  );
}
