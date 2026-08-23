import Image from "next/image";

import styles from "./OceanLogo.module.css";

type OceanLogoProps = {
  variant?: "theme" | "yellow" | "blue" | "white";
  size?: "sm" | "md" | "lg";
};

const logoSrc = {
  yellow: "/brand/fluxo-logo-horizontal.png",
  blue: "/brand/fluxo-logo-horizontal.png",
  white: "/brand/fluxo-logo-horizontal.png",
} as const;

const logoSize = {
  sm: { width: 92, height: 31 },
  md: { width: 126, height: 42 },
  lg: { width: 164, height: 55 },
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
          alt="Fluxo"
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
      </span>
    );
  }

  return (
    <span className={`${styles.logo} ${styles[variant]} ${styles[size]}`}>
      <Image
        src={logoSrc[variant]}
        alt="Fluxo"
        width={logoSize[size].width}
        height={logoSize[size].height}
        priority={size === "lg"}
      />
    </span>
  );
}
