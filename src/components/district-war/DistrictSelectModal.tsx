import React, { useState, useMemo } from "react";
import { X, Search, ShieldCheck, MapPin, Sparkles, Check } from "lucide-react";
import { RAJASTHAN_DISTRICTS_LIST, RAJASTHAN_50_DISTRICTS } from "../rajasthan-map/data/districtsData";
import { RAJASTHAN_DIVISIONS_LIST } from "../rajasthan-map/data/divisionsData";
import { districtWarService } from "./districtWarService";
import { triggerHaptic, playClickSound, playSuccessSound } from "../../utils/audioFeedback";

interface DistrictSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelected?: (districtId: string) => void;
}

export const DistrictSelectModal: React.FC<DistrictSelectModalProps> = ({
  isOpen,
  onClose,
  onSelected,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null);
  const [activeDistrictId, setActiveDistrictId] = useState<string | null>(() => {
    return districtWarService.getUserHomeDistrict();
  });

  const filteredDistricts = useMemo(() => {
    return RAJASTHAN_DISTRICTS_LIST.filter((d) => {
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        d.nameHindi.toLowerCase().includes(q) ||
        d.nameEnglish.toLowerCase().includes(q);
      const matchDivision = selectedDivision ? d.divisionId === selectedDivision : true;
      return matchSearch && matchDivision;
    });
  }, [searchQuery, selectedDivision]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!activeDistrictId) return;
    triggerHaptic("medium");
    playSuccessSound();
    districtWarService.setUserHomeDistrict(activeDistrictId);
    onSelected?.(activeDistrictId);
    onClose();
  };

  const selectedDistrictInfo = activeDistrictId ? RAJASTHAN_50_DISTRICTS[activeDistrictId] : null;

  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200 select-none">
      <div className="w-full sm:max-w-lg bg-white dark:bg-[#141622] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#C99A45]/30 overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[82vh]">
        {/* Mobile Drag Handle */}
        <div className="sm:hidden w-full flex justify-center pt-2 pb-1 bg-gradient-to-r from-[#800020] via-[#5A0016] to-[#F47B20]">
          <div className="w-10 h-1 rounded-full bg-white/40" />
        </div>

        {/* Header */}
        <div className="bg-gradient-to-r from-[#800020] via-[#5A0016] to-[#F47B20] text-white p-3.5 sm:p-4 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-amber-300 shadow-xs shrink-0">
              <ShieldCheck className="w-5 h-5 text-amber-300" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-sm sm:text-base leading-tight truncate">
                अपनी ज़िला सेना चुनें (Select Army)
              </h3>
              <p className="text-[10px] sm:text-[11px] text-amber-200/90 font-medium truncate">
                राजस्थान के 50 ज़िलों में से अपना गृह ज़िला चुनें • पाएं +50 वेलकम बोनस
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              playClickSound();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white/90 cursor-pointer active:scale-95 transition shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Search & Division Filters */}
        <div className="p-3 border-b border-stone-100 dark:border-stone-800 space-y-2 bg-stone-50 dark:bg-[#1A1D2A] shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="50 ज़िले खोजें (उदा. सीकर, जोधपुर, दूदू)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-2 bg-white dark:bg-[#11131C] text-xs sm:text-sm rounded-xl border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-white placeholder-stone-400 focus:outline-hidden focus:border-[#C99A45] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Division Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
            <button
              type="button"
              onClick={() => {
                triggerHaptic("light");
                playClickSound();
                setSelectedDivision(null);
              }}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black whitespace-nowrap transition cursor-pointer shrink-0 ${
                selectedDivision === null
                  ? "bg-[#800020] text-white shadow-xs"
                  : "bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700"
              }`}
            >
              सभी संभाग (50)
            </button>
            {RAJASTHAN_DIVISIONS_LIST.map((div) => {
              const isSelected = selectedDivision === div.id;
              return (
                <button
                  key={div.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic("light");
                    playClickSound();
                    setSelectedDivision(div.id);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black whitespace-nowrap transition cursor-pointer shrink-0 flex items-center gap-1 ${
                    isSelected
                      ? "bg-[#800020] text-white shadow-xs"
                      : "bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700"
                  }`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full inline-block"
                    style={{ backgroundColor: div.color }}
                  />
                  <span>{div.nameHindi}</span>
                  <span className="opacity-70 text-[9px]">({div.districtIds.length})</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 50 Districts List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-[240px] overscroll-contain">
          {filteredDistricts.length === 0 ? (
            <div className="py-12 text-center text-xs text-stone-400">
              कोई ज़िला नहीं मिला। अन्य शब्द खोजें।
            </div>
          ) : (
            filteredDistricts.map((dist) => {
              const isSelected = activeDistrictId === dist.id;
              return (
                <div
                  key={dist.id}
                  onClick={() => {
                    triggerHaptic("light");
                    playClickSound();
                    setActiveDistrictId(dist.id);
                  }}
                  className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left transition cursor-pointer group active:scale-[0.99] ${
                    isSelected
                      ? "bg-[#800020]/10 dark:bg-[#800020]/30 border-[#800020] dark:border-[#C99A45] shadow-xs ring-1 ring-[#800020]/30"
                      : "bg-white dark:bg-[#191C28] border-stone-150 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-[#800020] text-white shadow-xs"
                          : "bg-stone-100 dark:bg-stone-800 text-stone-500 group-hover:text-stone-800"
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-xs sm:text-sm text-stone-900 dark:text-white truncate">
                          {dist.nameHindi}
                        </span>
                        <span className="text-[10.5px] text-stone-500 dark:text-stone-400 font-medium">
                          ({dist.nameEnglish})
                        </span>
                        {dist.isNewDistrict && (
                          <span className="px-1.5 py-0.2 rounded-xs text-[8px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                            नवीन ज़िला
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                        {dist.tagline}
                      </p>
                    </div>
                  </div>

                  {isSelected ? (
                    <div className="w-6 h-6 rounded-full bg-[#800020] dark:bg-[#C99A45] text-white dark:text-stone-950 flex items-center justify-center shrink-0 shadow-xs">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-stone-300 dark:border-stone-700 shrink-0 group-hover:border-stone-400" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Confirmation */}
        <div className="p-3 sm:p-3.5 bg-stone-50 dark:bg-[#12141F] border-t border-stone-200 dark:border-stone-800 shrink-0 flex items-center justify-between gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="min-w-0 flex-1">
            <span className="text-[11px] text-stone-500 dark:text-stone-400 block truncate">
              चयनित सेना:{" "}
              <b className="text-stone-900 dark:text-white font-black">
                {selectedDistrictInfo
                  ? `${selectedDistrictInfo.nameHindi} (${selectedDistrictInfo.nameEnglish})`
                  : "कोई नहीं"}
              </b>
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3 inline text-amber-500" /> +50 स्वागत बोनस अंक मिलेंगे
            </span>
          </div>

          <button
            type="button"
            disabled={!activeDistrictId}
            onClick={handleConfirm}
            className={`px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm shadow-md transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
              activeDistrictId
                ? "bg-gradient-to-r from-[#800020] to-[#F47B20] text-white active:scale-95 hover:brightness-105"
                : "bg-stone-300 dark:bg-stone-800 text-stone-500 cursor-not-allowed"
            }`}
          >
            <span>सेना में शामिल हों (+50)</span>
            <span>⚔️</span>
          </button>
        </div>
      </div>
    </div>
  );
};
