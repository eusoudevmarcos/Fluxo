import Image from "next/image";

import styles from "./OceanLogo.module.css";

type OceanLogoProps = {
  variant?: "theme" | "yellow" | "blue" | "white";
  size?: "sm" | "md" | "lg";
};

const logoSrc = {
  yellow: "/brand/ocean-logo-yellow.svg",
  blue: "/brand/ocean-logo-blue.svg",
  white: "/brand/ocean-logo-yellow.svg",
} as const;

const logoSize = {
  sm: { width: 112, height: 28 },
  md: { width: 168, height: 42 },
  lg: { width: 232, height: 58 },
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
          alt="ocean"
          width={logoSize[size].width}
          height={logoSize[size].height}
          priority={size === "lg"}
        />
        <Image
          className={styles.blueImage}
          src={logoSrc.blue}
          alt="ocean"
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
        alt="ocean"
        width={logoSize[size].width}
        height={logoSize[size].height}
        priority={size === "lg"}
      />
    </span>
  );
}
