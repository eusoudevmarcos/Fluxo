import { Image } from "react-native";

import type { VerifiedSeal } from "../lib/services/seals.service";

import sealAzul from "../../assets/selos/selo-azul.png";
import sealDiamante from "../../assets/selos/selo-diamante.png";
import sealDiamanteLaranja from "../../assets/selos/selo-diamante-laranja.png";
import sealFundador from "../../assets/selos/selo-fundador.png";
import sealGold from "../../assets/selos/selo-gold.png";
import sealMaster from "../../assets/selos/selo-master.png";
import sealRoxo from "../../assets/selos/selo-roxo.png";

const SEAL_IMAGES: Record<VerifiedSeal, number> = {
  azul: sealAzul,
  roxo: sealRoxo,
  gold: sealGold,
  diamante: sealDiamante,
  diamante_laranja: sealDiamanteLaranja,
  master: sealMaster,
  fundador: sealFundador,
};

export const SEAL_LABELS: Record<VerifiedSeal, string> = {
  azul: "Verificado",
  roxo: "Criador",
  gold: "Gold",
  diamante: "Diamante",
  diamante_laranja: "Diamante Laranja",
  master: "Master",
  fundador: "Fundador",
};

type SealBadgeProps = {
  seal?: VerifiedSeal | null;
  size?: number;
};

export function SealBadge({ seal, size = 16 }: SealBadgeProps) {
  if (!seal) return null;

  return (
    <Image
      resizeMode="contain"
      source={SEAL_IMAGES[seal]}
      style={{ height: size, width: size }}
    />
  );
}
