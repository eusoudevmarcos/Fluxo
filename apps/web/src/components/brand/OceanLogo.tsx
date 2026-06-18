import Image from "next/image";

import styles from "./OceanLogo.module.css";

type OceanLogoProps = {
  variant?: "theme" | "yellow" | "blue" | "white";
  size?: "sm" | "md" | "lg";
};

const logoSrc = {
  yellow: "/brand/wave-icon-transparent.png",
  blue: "/brand/wave-icon-transparent.png",
  white: "/brand/wave-icon-transparent.png",
} as const;

const logoSize = {
  sm: { width: 28, height: 28 },
  md: { width: 38, height: 38 },
  lg: { width: 48, height: 48 },
} as const;

export function OceanLogo({
  variant = "theme",
  size = "md",
}: OceanLogoProps) {
  if (variant === "theme") {
    return (
      <span className={`${styles.logo} ${styles.theme} ${styles[size]}`}>
        <Image
          className={styles.yellowImage}
          src={logoSrc.yellow}
          alt=""
          width={logoSize[size].width}
          height={logoSize[size].height}
          priority={size === "lg"}
        />
        <Image
          className={styles.blueImage}
          src={logoSrc.blue}
          alt=""
          width={logoSize[size].width}
          height={logoSize[size].height}
          priority={size === "lg"}
        />
        <span className={styles.wordmark}>wave</span>
      </span>
    );
  }

  return (
    <span className={`${styles.logo} ${styles[variant]} ${styles[size]}`}>
      <Image
        src={logoSrc[variant]}
        alt=""
        width={logoSize[size].width}
        height={logoSize[size].height}
        priority={size === "lg"}
      />
      <span className={styles.wordmark}>wave</span>
    </span>
  );
}
