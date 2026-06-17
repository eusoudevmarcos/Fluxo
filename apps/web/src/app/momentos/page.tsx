"use client";

import { useState } from "react";
import {
  HiAdjustments,
  HiChatAlt2,
  HiLightningBolt,
  HiLocationMarker,
  HiMusicNote,
  HiOutlineBookmark,
  HiOutlineHeart,
  HiPlay,
  HiTrendingUp,
} from "react-icons/hi";

import { AppShell } from "@/components/layout/AppShell";
import styles from "./page.module.css";

const filters = [
  "Descubra",
  "Top do dia",
  "Top semanal",
  "Perto de mim",
  "Mais filtros...",
];

const extraFilters = [
  "Top mensal",
  "Meu estado",
  "Curtos",
  "Longos",
  "Reacts",
  "Games",
  "Humor",
  "Música",
  "Esportes",
];

const moments = [
  {
    title: "#VibesDoDia",
    author: "Marina Costa",
    meta: "2,4k presenças",
    tone: "surf",
    tag: "Top do dia",
    music: "Wave Beat - Sol alto",
    format: "vertical",
  },
  {
    title: "#SurfLife",
    author: "Lucas R.",
    meta: "1,8k presenças",
    tone: "sunset",
    tag: "Perto de você",
    music: "Maré aberta",
    format: "wide",
  },
  {
    title: "#MúsicaAoVivo",
    author: "Ana Clara",
    meta: "1,2k presenças",
    tone: "stage",
    tag: "Música",
    music: "Set autoral",
    format: "vertical",
  },
  {
    title: "#FutebolPaixão",
    author: "Pedro Alves",
    meta: "980 presenças",
    tone: "sport",
    tag: "Brasil",
    music: "Arquibancada",
    format: "wide",
  },
  {
    title: "#CidadeAcesa",
    author: "Rafa Souza",
    meta: "760 presenças",
    tone: "city",
    tag: "Meu estado",
    music: "Noite urbana",
    format: "square",
  },
];

export default function MomentsPage() {
  const [activeFilter, setActiveFilter] = useState(filters[0]);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const handleFilterClick = (filter: string) => {
    if (filter === "Mais filtros...") {
      setShowMoreFilters((current) => !current);
      return;
    }

    setActiveFilter(filter);
  };

  return (
    <AppShell>
      <section className={styles.page} aria-label="Moments">
        <header className={styles.hero}>
          <div>
            <span>Moments</span>
            <h1>Moments acontecendo agora</h1>
            <p>
              Vídeos curtos, reacts, análises e trends em movimento.
            </p>
          </div>
        </header>

        <div className={styles.filterRail} aria-label="Filtros de Moments">
          {filters.map((filter) => (
            <button
              className={
                filter === activeFilter || (filter === "Mais filtros..." && showMoreFilters)
                  ? styles.activeFilter
                  : ""
              }
              key={filter}
              onClick={() => handleFilterClick(filter)}
              type="button"
            >
              {filter === "Perto de mim" ? <HiLocationMarker /> : null}
              {filter === "Top do dia" || filter === "Top semanal" ? (
                <HiTrendingUp />
              ) : null}
              {filter === "Mais filtros..." ? <HiAdjustments /> : null}
              {filter}
            </button>
          ))}
        </div>

        {showMoreFilters && (
          <div className={styles.moreFilters} aria-label="Mais filtros de Moments">
            {extraFilters.map((filter) => (
              <button
                className={filter === activeFilter ? styles.activeFilter : ""}
                key={filter}
                onClick={() => setActiveFilter(filter)}
                type="button"
              >
                {filter === "Meu estado" ? <HiLocationMarker /> : null}
                {filter === "Top mensal" ? <HiTrendingUp /> : null}
                {filter === "Música" ? <HiMusicNote /> : null}
                {filter}
              </button>
            ))}
          </div>
        )}

        <div className={styles.momentsShell}>
          <div className={styles.reelFeed} aria-label="Feed de Moments">
            {moments.map((moment, index) => (
              <article className={styles.reelCard} key={moment.title}>
                <div className={`${styles.reelMedia} ${styles[moment.format]} ${styles[moment.tone]}`}>
                  <div className={styles.playBadge}>
                    <HiPlay />
                  </div>
                  <div className={styles.reelOverlay}>
                    <span>{moment.tag}</span>
                    <h2>{moment.title}</h2>
                    <p>{moment.author} · {moment.meta}</p>
                    <small>
                      <HiMusicNote />
                      {moment.music}
                    </small>
                  </div>
                </div>

                <aside className={styles.reelActions} aria-label={`Ações de ${moment.title}`}>
                  <button type="button" title="Dahora">
                    <HiOutlineHeart />
                    <span>{index === 0 ? "8,2k" : "Dahora"}</span>
                  </button>
                  <button type="button" title="Comentários">
                    <HiChatAlt2 />
                    <span>{index === 0 ? "342" : "Comentar"}</span>
                  </button>
                  <button type="button" title="Wave">
                    <HiLightningBolt />
                    <span>Wave</span>
                  </button>
                  <button type="button" title="Salvar">
                    <HiOutlineBookmark />
                    <span>Salvar</span>
                  </button>
                </aside>
              </article>
            ))}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
