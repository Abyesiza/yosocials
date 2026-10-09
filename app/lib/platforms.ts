import type { IconType } from "react-icons";
import { SiInstagram, SiTiktok, SiWhatsapp, SiX  } from "react-icons/si";
import { FaLinkedin,  FaFacebook } from "react-icons/fa6";

export type PlatformKey = "instagram" | "x" | "whatsapp" | "tiktok" | "linkedin" | "facebook";

export const platforms: Record<
  PlatformKey,
  { label: string; Icon: IconType; color: string }
> = {
  instagram: { label: "Instagram", Icon: SiInstagram, color: "#FF0069" },
  x: { label: "X", Icon: SiX, color: "#000000" },
  whatsapp: { label: "WhatsApp", Icon: SiWhatsapp, color: "#25D366" },
  tiktok: { label: "TikTok", Icon: SiTiktok, color: "#000000" },
  linkedin: {label: "LinkedIn", Icon:FaLinkedin, color: "#0A66C2"},
  facebook: {label: "Facebook", Icon:FaFacebook, color: "#1877F2"}
};
