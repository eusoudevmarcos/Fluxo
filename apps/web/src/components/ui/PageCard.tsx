import { ReactNode } from "react";
import styles from "./PageCard.module.css";

type PageCardProps = {
  children: ReactNode;
};

export function PageCard({ children }: PageCardProps) {
  return <section className={styles.card}>{children}</section>;
}