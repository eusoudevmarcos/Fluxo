import { Image } from "react-native";

import type { VerifiedSeal } from "../lib/services/seals.service";

import sealAzul from "../../assets/selos/selo-azul.png";
import sealDiamante from "../../assets/selos/selo-diamante.png";
import sealDiamanteLaranja from "../../assets/selos/selo-diamante-laranja.png";
import sealFundador from "../../assets/selos/selo-fundador.png";
import sealGold from "../../assets/selos/selo-gold.png";
import sealMaster from "../../assets/selos/selo-master.png";
import sealRoxo from "../../assets/selos/selo-roxo.png";

// prime_user e prime_influencer ainda nao tem arte: ficam fora ate os PNGs chegarem em
// assets/selos (as campanhas deles tambem nascem desligadas no banco).
const SEAL_IMAGES: Partial<Record<VerifiedSeal, number>> = {
  azul: sealAzul,
  roxo: sealRoxo,
  gold: sealGold,
  diamante: sealDiamante,
  diamante_laranja: sealDiamanteLaranja,
  master: sealMaster,
  fundador: sealFundador,
};

export const SEAL_LABELS: Record<VerifiedSeal, string> = {
  prime_user: "Prime",
  azul: "Verificado",
  prime_influencer: "Prime Influencer",
  roxo: "Criador",
  gold: "Gold",
  diamante: "Diamante",
  diamante_laranja: "Diamante Laranja",
  master: "Master",
  fundador: "Fundador",
};

export function hasSealArt(seal?: VerifiedSeal | null) {
  return Boolean(seal && SEAL_IMAGES[seal]);
}

type SealBadgeProps = {
  seal?: VerifiedSeal | null;
  size?: number;
};

export function SealBadge({ seal, size = 16 }: SealBadgeProps) {
  // Selo sem arte no app nao renderiza.
  const source = seal ? SEAL_IMAGES[seal] : undefined;
  if (!source) return null;

  return <Image resizeMode="contain" source={source} style={{ height: size, width: size }} />;
}
