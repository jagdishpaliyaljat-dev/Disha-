export interface DistrictWarScore {
  districtId: string;
  nameHindi: string;
  divisionId: string;
  totalPoints: number;
  activeWarriors: number;
  avgScore: number;
  rank: number;
  prevRank?: number;
  isCrown?: boolean;
}

export interface UserDistrictAffiliation {
  districtId: string;
  districtNameHindi: string;
  joinedAt: string;
  userPointsEarned: number;
  userRankInDistrict: number;
}

export type WarLeagueTab = "total" | "efficiency";

export interface DistrictWarEvent {
  id: string;
  districtId: string;
  districtNameHindi: string;
  warriorName: string;
  pointsEarned: number;
  actionText: string;
  timestamp: number;
}
