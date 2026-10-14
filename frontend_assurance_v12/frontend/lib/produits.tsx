import {
  Car,
  Home,
  HeartPulse,
  Landmark,
  Scale,
  HeadphonesIcon,
  Sprout,
  ShieldCheck,
  GlassWater,
  Droplets,
  Pill,
  UserRound,
} from "lucide-react";

export const NOMS_PRODUITS: Record<string, string> = {
  "672": "TD Emprunteur Individuelle",
  "608": "Epargne - Retraite - Motivation Collectif",
  "6081": "Epargne - Retraite - Motivation",
  "671": "TD Prévoyance Individuelle",
  "601": "TD Emprunteur Collectif",
  "6011": "TD Emprunteur",
  "602": "TD Prévoyance Collectif",
  "6021": "TD Prévoyance",
  "691": "Avenir Jeunesse",
  "609": "IDR",
  "6091": "Indemnité de départ à la retraite",
  "688": "Longue vie",
  "618": "Vie Nouvelle",
  "685": "Epargne 7ayya",
  "603": "TD Engagement Collectif",
  "6031": "TD Engagement",
  "692": "Avenir Jeunesse",
  "673": "Homme clé",
  "693": "E-Avenir Jeunesse",
  "687": "E-7ayya",
  "686": "Epargne 7ayya QNB",
};

export const SOUS_TITRES_PRODUITS: Record<string, string> = {
  "672": "Prévoyance emprunteur",
  "608": "Epargne retraite collective",
  "6081": "Epargne retraite",
  "671": "Prévoyance individuelle",
  "601": "Prévoyance emprunteur collective",
  "6011": "Prévoyance emprunteur",
  "602": "Prévoyance collective",
  "6021": "Prévoyance",
  "691": "Epargne jeunesse",
  "609": "Départ à la retraite",
  "6091": "Départ à la retraite",
  "688": "Epargne vie",
  "618": "Assurance vie",
  "685": "Epargne",
  "603": "Engagement collectif",
  "6031": "Engagement",
  "692": "Epargne jeunesse",
  "673": "Protection homme clé",
  "693": "Epargne jeunesse digitale",
  "687": "Epargne digitale",
  "686": "Epargne",
};

const ICONES_PRODUITS: Record<string, { icon: React.ElementType; couleur: string }> = {
  AUTO_TOUS_RISQUES: { icon: Car, couleur: "#2563eb" },
  AUTO_TIER: { icon: Car, couleur: "#2563eb" },
  HABITATION: { icon: Home, couleur: "#7c3aed" },
  SANTE: { icon: HeartPulse, couleur: "#e11d48" },
  VIE: { icon: Sprout, couleur: "#16a34a" },
  PREVOYANCE: { icon: Landmark, couleur: "#7c3aed" },
  PROTECTION_JURIDIQUE: { icon: Scale, couleur: "#2563eb" },
  ASSISTANCE_PREMIUM: { icon: HeadphonesIcon, couleur: "#f97316" },
  BRIS_DE_GLACE: { icon: GlassWater, couleur: "#0ea5e9" },
  CONDUCTEUR: { icon: UserRound, couleur: "#14b8a6" },
  DEGATS_DES_EAUX: { icon: Droplets, couleur: "#06b6d4" },
  SANTE_DENTAIRE: { icon: Pill, couleur: "#f43f5e" },
};

export function IconeProduit({ code, size = 20, boxSize = 40 }: { code: string; size?: number; boxSize?: number }) {
  const config = ICONES_PRODUITS[code] || { icon: ShieldCheck, couleur: "#64748b" };
  const Icon = config.icon;
  return (
    <div
      className="rounded-xl flex items-center justify-center shrink-0"
      style={{ backgroundColor: config.couleur + "1a", color: config.couleur, width: boxSize, height: boxSize }}
    >
      <Icon size={size} strokeWidth={2} />
    </div>
  );
}
