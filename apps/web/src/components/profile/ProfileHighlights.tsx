"use client";

import { useState } from "react";
import { HiPlus } from "react-icons/hi";

import styles from "./ProfileHighlights.module.css";

const highlights = [
  { label: "Viagens", tone: "travel" },
  { label: "Dia a dia", tone: "daily" },
  { label: "Academia", tone: "gym" },
  { label: "Moods", tone: "mood" },
  { label: "Comidas", tone: "food" },
  { label: "Lugares", tone: "places" },
];

export function ProfileHighlights() {
  const [notice, setNotice] = useState("");

  function handleHighlight(label: string) {
    setNotice(
      label === "Novo"
        ? "Criacao de novos Destaques entra na proxima rodada."
        : `Destaque ${label} preparado para receber seus Flows fixados.`,
    );
  }

  return (
    <section className={styles.highlights} aria-label="Destaques">
      <header>
        <h2>Destaques</h2>
        <button type="button" onClick={() => setNotice("Todos os Destaques aparecem aqui em breve.")}>
          Ver todos
        </button>
      </header>

      <div className={styles.track}>
        <button className={styles.item} type="button" onClick={() => handleHighlight("Novo")}>
          <span className={styles.newThumb}>
            <HiPlus />
          </span>
          <strong>Novo</strong>
        </button>

        {highlights.map((highlight) => (
          <button
            className={styles.item}
            key={highlight.label}
            type="button"
            onClick={() => handleHighlight(highlight.label)}
          >
            <span className={`${styles.thumb} ${styles[highlight.tone]}`} />
            <strong>{highlight.label}</strong>
          </button>
        ))}
      </div>

      {notice && <p className={styles.notice}>{notice}</p>}
    </section>
  );
}
