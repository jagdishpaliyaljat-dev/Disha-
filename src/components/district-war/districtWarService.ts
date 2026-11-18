import { RAJASTHAN_50_DISTRICTS, RAJASTHAN_DISTRICTS_LIST } from "../rajasthan-map/data/districtsData";
import { DistrictWarScore, WarLeagueTab, DistrictWarEvent, UserDistrictAffiliation } from "./types";
import { triggerHaptic, playSuccessSound } from "../../utils/audioFeedback";

const USER_DISTRICT_KEY = "disha_user_home_district";
const USER_POINTS_KEY = "disha_user_district_points";
const WAR_SCORES_KEY = "disha_district_war_scores_v2";
const WAR_EVENTS_KEY = "disha_district_war_events_v2";

// Baseline seeds to ensure instant, vibrant competition across all 50 districts
const INITIAL_BASELINE_WEIGHTS: Record<string, { points: number; warriors: number }> = {
  sikar: { points: 54200, warriors: 1420 },
  jodhpur: { points: 51850, warriors: 1390 },
  jaipur: { points: 49900, warriors: 1540 },
  nagaur: { points: 48300, warriors: 1260 },
  alwar: { points: 44100, warriors: 1180 },
  bikaner: { points: 42500, warriors: 1090 },
  jhunjhunu: { points: 41200, warriors: 1040 },
  barmer: { points: 39800, warriors: 980 },
  ajmer: { points: 38400, warriors: 950 },
  kota: { points: 36700, warriors: 910 },
  churu: { points: 35200, warriors: 880 },
  udaipur: { points: 34100, warriors: 860 },
  bharatpur: { points: 32600, warriors: 820 },
  pali: { points: 31200, warriors: 790 },
  sri_ganganagar: { points: 30100, warriors: 760 },
  hanumangarh: { points: 29400, warriors: 740 },
  bhilwara: { points: 28300, warriors: 710 },
  didwana_kuchaman: { points: 27900, warriors: 680 },
  beawar: { points: 26500, warriors: 650 },
  anupgarh: { points: 25800, warriors: 480 }, // high efficiency
  balotra: { points: 25100, warriors: 510 },
  phalodi: { points: 24600, warriors: 490 },
  neem_ka_thana: { points: 24200, warriors: 530 },
  kotputli_behror: { points: 23800, warriors: 560 },
  deeg: { points: 22900, warriors: 470 },
  dudu: { points: 22400, warriors: 380 }, // top efficiency (avg points per warrior)
  khairthal_tijara: { points: 21800, warriors: 460 },
  sanchor: { points: 21200, warriors: 410 },
  salumbar: { points: 20600, warriors: 390 },
  shahpura: { points: 19800, warriors: 400 },
  gangapur_city: { points: 19400, warriors: 420 },
  kekri: { points: 18900, warriors: 390 },
  jodhpur_rural: { points: 18200, warriors: 450 },
  jaipur_rural: { points: 17900, warriors: 470 },
  dausa: { points: 17400, warriors: 440 },
  tonk: { points: 16800, warriors: 420 },
  sawai_madhopur: { points: 16200, warriors: 410 },
  karauli: { points: 15700, warriors: 390 },
  dholpur: { points: 15100, warriors: 380 },
  chittorgarh: { points: 14600, warriors: 370 },
  rajsamand: { points: 14100, warriors: 360 },
  bundi: { points: 13700, warriors: 350 },
  baran: { points: 13200, warriors: 340 },
  jhalawar: { points: 12800, warriors: 330 },
  jalore: { points: 12400, warriors: 320 },
  sirohi: { points: 11900, warriors: 310 },
  pratapgarh: { points: 11400, warriors: 300 },
  dungarpur: { points: 10900, warriors: 290 },
  banswara: { points: 10400, warriors: 280 },
  jaisalmer: { points: 9900, warriors: 270 },
};

function getInitialScores(): Record<string, { points: number; warriors: number }> {
  try {
    const raw = localStorage.getItem(WAR_SCORES_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to load stored district war scores", e);
  }
  return { ...INITIAL_BASELINE_WEIGHTS };
}

function saveScores(scores: Record<string, { points: number; warriors: number }>) {
  try {
    localStorage.setItem(WAR_SCORES_KEY, JSON.stringify(scores));
  } catch (e) {
    console.error("Failed to persist district war scores", e);
  }
}

export const districtWarService = {
  // ================= USER DISTRICT AFFILIATION =================
  getUserHomeDistrict(): string | null {
    try {
      return localStorage.getItem(USER_DISTRICT_KEY);
    } catch {
      return null;
    }
  },

  setUserHomeDistrict(districtId: string): void {
    try {
      localStorage.setItem(USER_DISTRICT_KEY, districtId);
      // Give 50 initial enrollment bonus points to the district
      this.addDistrictWarPoints(50, "नया योद्धा सेना में शामिल हुआ!");
      triggerHaptic("medium");
      playSuccessSound();
      window.dispatchEvent(new CustomEvent("disha:district-war-updated"));
    } catch (e) {
      console.error("Failed to set user home district", e);
    }
  },

  getUserContribution(): UserDistrictAffiliation | null {
    const districtId = this.getUserHomeDistrict();
    if (!districtId) return null;
    const district = RAJASTHAN_50_DISTRICTS[districtId];
    if (!district) return null;

    let points = 50;
    try {
      const stored = localStorage.getItem(USER_POINTS_KEY);
      if (stored) points = Math.max(parseInt(stored, 10), 50);
    } catch {}

    return {
      districtId,
      districtNameHindi: district.nameHindi,
      joinedAt: "आज",
      userPointsEarned: points,
      userRankInDistrict: Math.max(1, Math.floor(1000 / (points / 10 + 1))),
    };
  },

  // ================= LEADERBOARD QUERIES =================
  getLeaderboard(league: WarLeagueTab = "total"): DistrictWarScore[] {
    const rawScores = getInitialScores();

    const list: DistrictWarScore[] = RAJASTHAN_DISTRICTS_LIST.map((district) => {
      const data = rawScores[district.id] || { points: 8000, warriors: 200 };
      const avg = Number((data.points / Math.max(data.warriors, 1)).toFixed(1));

      return {
        districtId: district.id,
        nameHindi: district.nameHindi,
        divisionId: district.divisionId,
        totalPoints: data.points,
        activeWarriors: data.warriors,
        avgScore: avg,
        rank: 1,
      };
    });

    // Sort according to active league
    if (league === "efficiency") {
      list.sort((a, b) => b.avgScore - a.avgScore || b.totalPoints - a.totalPoints);
    } else {
      list.sort((a, b) => b.totalPoints - a.totalPoints || b.avgScore - a.avgScore);
    }

    // Assign 1-indexed ranks and crown to #1
    list.forEach((item, index) => {
      item.rank = index + 1;
      item.isCrown = index === 0;
    });

    return list;
  },

  getDistrictRank(districtId: string, league: WarLeagueTab = "total"): number {
    const board = this.getLeaderboard(league);
    const found = board.find((b) => b.districtId === districtId);
    return found ? found.rank : 50;
  },

  getTopThree(league: WarLeagueTab = "total"): DistrictWarScore[] {
    return this.getLeaderboard(league).slice(0, 3);
  },

  // ================= ADD WAR POINTS =================
  addDistrictWarPoints(points: number, actionText: string): void {
    if (points <= 0) return;
    const districtId = this.getUserHomeDistrict();
    if (!districtId) return;

    const district = RAJASTHAN_50_DISTRICTS[districtId];
    if (!district) return;

    // 1. Update District Score
    const scores = getInitialScores();
    if (!scores[districtId]) {
      scores[districtId] = { points: 10000, warriors: 250 };
    }
    scores[districtId].points += points;
    saveScores(scores);

    // 2. Update User Contribution
    try {
      const current = parseInt(localStorage.getItem(USER_POINTS_KEY) || "50", 10);
      localStorage.setItem(USER_POINTS_KEY, String(current + points));
    } catch {}

    // 3. Add to Live Events
    this.addLiveEvent({
      id: `evt_${Date.now()}`,
      districtId,
      districtNameHindi: district.nameHindi,
      warriorName: "आप (सैनिक)",
      pointsEarned: points,
      actionText,
      timestamp: Date.now(),
    });

    // 4. Notify app listeners
    window.dispatchEvent(
      new CustomEvent("disha:district-war-updated", {
        detail: { districtId, points, actionText },
      })
    );
  },

  // ================= LIVE WAR EVENTS =================
  getLiveEvents(): DistrictWarEvent[] {
    try {
      const raw = localStorage.getItem(WAR_EVENTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}

    // Realistic default events
    return [
      {
        id: "e1",
        districtId: "sikar",
        districtNameHindi: "सीकर",
        warriorName: "मुकेश चौधरी",
        pointsEarned: 50,
        actionText: "1v1 लाइव बैटल में जयपुर के छात्र को हराया",
        timestamp: Date.now() - 1000 * 60 * 2,
      },
      {
        id: "e2",
        districtId: "nagaur",
        districtNameHindi: "नागौर",
        warriorName: "राकेश बिश्नोई",
        pointsEarned: 20,
        actionText: "राजस्थान 50-ज़िला नक्शा क्विज़ 100% सही हल किया",
        timestamp: Date.now() - 1000 * 60 * 5,
      },
      {
        id: "e3",
        districtId: "jodhpur",
        districtNameHindi: "जोधपुर",
        warriorName: "सुनीता राठौड़",
        pointsEarned: 100,
        actionText: "5-दिवसीय डेली स्ट्रीक पूर्ण की",
        timestamp: Date.now() - 1000 * 60 * 9,
      },
      {
        id: "e4",
        districtId: "dudu",
        districtNameHindi: "दूदू",
        warriorName: "सुरेश वर्मा",
        pointsEarned: 30,
        actionText: "REET PYQ टेस्ट में 20/20 अंक प्राप्त किए",
        timestamp: Date.now() - 1000 * 60 * 14,
      },
    ];
  },

  addLiveEvent(event: DistrictWarEvent): void {
    try {
      const events = this.getLiveEvents();
      events.unshift(event);
      if (events.length > 20) events.pop();
      localStorage.setItem(WAR_EVENTS_KEY, JSON.stringify(events));
    } catch {}
  },

  // ================= VIRAL WHATSAPP SHARE GENERATOR =================
  getWhatsAppShareUrl(targetDistrictId?: string): string {
    const districtId = targetDistrictId || this.getUserHomeDistrict() || "sikar";
    const district = RAJASTHAN_50_DISTRICTS[districtId];
    const distName = district ? district.nameHindi : "राजस्थान";
    const rank = this.getDistrictRank(districtId, "total");

    let message = "";
    if (rank <= 3) {
      message = `👑 *गर्व की बात! हमारा ${distName} ज़िला आज राजस्थान में #${rank} पर है!* 🚩\n\n` +
        `⚔️ *दिशा 20-20 ऐप के 'राजस्थान 50 ज़िला महासंग्राम' में ${distName} की सेना ने झंडा गाड़ दिया है!*\n\n` +
        `भाइयों, अपनी बढ़त बनाए रखने और ज़िले को हमेशा नंबर-1 रखने के लिए अभी जुड़ें और अभ्यास करें:\n` +
        `👉 https://disha2020.app/war?district=${districtId}\n\n` +
        `#Disha2020 #${distName}Warriors #RajasthanGK`;
    } else {
      message = `🚨 *चेतावनी! हमारा ${distName} ज़िला अभी #${rank} रैंक पर चल रहा है!* ⚔️\n\n` +
        `शीर्ष पर आने के लिए हमें और योद्धाओं की ज़रूरत है!\n` +
        `सभी ${distName} वाले साथी तुरंत 'दिशा 20-20' ऐप खोलें और राजस्थान GK क्विज़ खेलकर अपने ज़िले को #1 बनाएँ!\n\n` +
        `सेना में अभी शामिल हों:\n` +
        `👉 https://disha2020.app/war?district=${districtId}\n\n` +
        `#MissionNumber1 #${distName}`;
    }

    return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  },
};
