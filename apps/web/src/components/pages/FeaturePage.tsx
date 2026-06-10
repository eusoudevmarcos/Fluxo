"use client";

import { useState } from "react";

import styles from "./FeaturePage.module.css";

type FeatureItem = {
  title: string;
  meta: string;
  description: string;
  action?: string;
};

type FeatureStat = {
  label: string;
  value: string;
};

type FeaturePageProps = {
  eyebrow: string;
  title: string;
  description: string;
  stats?: FeatureStat[];
  items: FeatureItem[];
};

export function FeaturePage({
  eyebrow,
  title,
  description,
  stats = [],
  items,
}: FeaturePageProps) {
  const [notice, setNotice] = useState("");

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>

      {stats.length > 0 && (
        <section className={styles.stats} aria-label="Resumo">
          {stats.map((stat) => (
            <div key={stat.label}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </section>
      )}

      <section className={styles.grid}>
        {items.map((item) => (
          <article className={styles.item} key={item.title}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.meta}</span>
            </div>
            <p>{item.description}</p>
            {item.action && (
              <button
                type="button"
                onClick={() =>
                  setNotice(`${item.title}: função preparada para a próxima rodada da beta.`)
                }
              >
                {item.action}
              </button>
            )}
          </article>
        ))}
      </section>

      {notice && <p className={styles.notice}>{notice}</p>}
    </div>
  );
}
