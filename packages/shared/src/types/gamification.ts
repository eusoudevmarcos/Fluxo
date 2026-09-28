import type {
  AURA_RARITIES,
  AURA_SOURCES,
  MISSION_CADENCES,
  MISSION_TYPES,
  STICKER_EMOTIONS,
} from "../constants/gamification";

export type AuraRarity = (typeof AURA_RARITIES)[number];
export type AuraSource = (typeof AURA_SOURCES)[number];
export type MissionType = (typeof MISSION_TYPES)[number];
export type MissionCadence = (typeof MISSION_CADENCES)[number];
export type StickerEmotion = (typeof STICKER_EMOTIONS)[number];

export type UserGamification = {
  id: string;
  user_id: string;
  level: number;
  xp_total: number;
  xp_current_level: number;
  xp_next_level: number;
  weekly_xp: number;
  monthly_xp: number;
  streak_days: number;
  last_active_date: string | null;
  is_founder: boolean;
  is_official_profile: boolean;
  has_all_auras: boolean;
  created_at: string;
  updated_at: string;
};

export type AuraDefinition = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  rarity: AuraRarity;
  color_primary: string | null;
  color_secondary: string | null;
  visual_config: Record<string, unknown>;
  xp_bonus_percent: number;
  level_min: number | null;
  level_max: number | null;
  unlock_type: "level" | "mission" | "monthly_drop" | "milestone" | "founder" | "gift" | "secret";
  unlock_condition: Record<string, unknown>;
  monthly_drop_limit: number | null;
  total_supply_limit: number | null;
  is_active: boolean;
  is_secret: boolean;
  created_at: string;
  updated_at: string;
};

export type UserAura = {
  id: string;
  user_id: string;
  aura_id: string;
  source: AuraSource;
  unlocked_at: string;
  equipped_at: string | null;
  is_equipped: boolean;
  grant_reason: string | null;
  granted_by: string | null;
  metadata: Record<string, unknown>;
  aura?: AuraDefinition;
};

export type MissionDefinition = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  mission_type: MissionType;
  cadence: MissionCadence;
  target_value: number;
  xp_reward: number;
  coin_reward: number;
  aura_reward_slug: string | null;
  sticker_pack_reward_slug: string | null;
  is_active: boolean;
  in_rotation?: boolean;
  audience?: "all" | "new" | "active" | "creator";
  invite_slot_reward?: number;
  starts_at: string | null;
  ends_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type UserMissionProgress = {
  id: string;
  user_id: string;
  mission_id: string;
  period_key: string;
  current_value: number;
  target_value: number;
  is_completed: boolean;
  completed_at: string | null;
  reward_claimed: boolean;
  reward_claimed_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
  mission?: MissionDefinition;
};

export type AuraDrop = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  drop_month: string;
  status: "scheduled" | "active" | "ended";
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

export type StickerPack = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  theme_slug: string | null;
  rarity: AuraRarity;
  is_active: boolean;
  created_at: string;
};

export type Sticker = {
  id: string;
  pack_id: string;
  slug: string;
  name: string;
  emotion: StickerEmotion;
  asset_url: string | null;
  sort_order: number;
  created_at: string;
};

export type OfficialAccount = {
  id: string;
  user_id: string;
  kind: "founder" | "company" | "updates";
  is_default_follow: boolean;
  is_founder: boolean;
  label: string | null;
  created_at: string;
};
