import React, { useState, useMemo } from "react";
import { X, Search, ShieldCheck, MapPin, Sparkles, Check } from "lucide-react";
import { RAJASTHAN_DISTRICTS_LIST, RAJASTHAN_50_DISTRICTS } from "../rajasthan-map/data/districtsData";
import { RAJASTHAN_DIVISIONS_LIST } from "../rajasthan-map/data/divisionsData";
import { districtWarService } from "./districtWarService";
import { triggerHaptic, playClickSound } from "../../utils/audioFeedback";

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
      const matchSearch =
        d.nameHindi.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.nameEnglish.toLowerCase().includes(searchQuery.toLowerCase());
      const matchDivision = selectedDivision ? d.divisionId === selectedDivision : true;
      return matchSearch && matchDivision;
    });
  }, [searchQuery, selectedDivision]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!activeDistrictId) return;
    districtWarService.setUserHomeDistrict(activeDistrictId);
    onSelected?.(activeDistrictId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md bg-white dark:bg-[#161822] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#C99A45]/30 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#800020] via-[#5A0016] to-[#F47B20] text-white p-4 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-amber-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base leading-tight">
                Select Your District Army
              </h3>
              <p className="text-[11px] text-amber-200 font-medium">
                Which Rajasthan district do you represent?
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center text-white/90 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Division Filter */}
        <div className="p-3 border-b border-stone-100 dark:border-stone-800 space-y-2 bg-stone-50 dark:bg-[#1A1D2A] shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search 50 districts (e.g. Sikar, Nagaur)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#11131C] text-xs sm:text-sm rounded-xl border border-stone-200 dark:border-stone-700 focus:outline-hidden focus:border-[#C99A45]"
            />
          </div>

          {/* Division Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            <button
              type="button"
              onClick={() => setSelectedDivision(null)}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold whitespace-nowrap transition cursor-pointer ${
                selectedDivision === null
                  ? "bg-[#800020] text-white shadow-xs"
                  : "bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700"
              }`}
            >
              All Divisions
            </button>
            {RAJASTHAN_DIVISIONS_LIST.map((div) => (
              <button
                key={div.id}
                type="button"
                onClick={() => setSelectedDivision(div.id)}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold whitespace-nowrap transition cursor-pointer ${
                  selectedDivision === div.id
                    ? "bg-[#800020] text-white shadow-xs"
                    : "bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700"
                }`}
              >
                {div.nameEnglish || div.nameHindi}
              </button>
            ))}
          </div>
        </div>

        {/* Districts Grid */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-[220px]">
          {filteredDistricts.length === 0 ? (
            <div className="py-12 text-center text-xs text-stone-400">
              No districts found
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
                  className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left transition cursor-pointer ${
                    isSelected
                      ? "bg-[#800020]/10 dark:bg-[#800020]/30 border-[#800020] dark:border-[#C99A45] shadow-xs"
                      : "bg-white dark:bg-[#191C28] border-stone-150 dark:border-stone-800 hover:border-stone-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "bg-[#800020] text-white"
                          : "bg-stone-100 dark:bg-stone-800 text-stone-500"
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs sm:text-sm text-stone-900 dark:text-white truncate">
                          {dist.nameEnglish || dist.nameHindi}
                        </span>
                        {dist.isNewDistrict && (
                          <span className="px-1.5 py-0.2 rounded-xs text-[8px] font-black bg-amber-500/20 text-amber-600 dark:text-amber-400">
                            New District
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-stone-500 dark:text-stone-400">
                        {dist.tagline}
                      </p>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-[#800020] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Confirmation */}
        <div className="p-3 bg-stone-50 dark:bg-[#12141F] border-t border-stone-200 dark:border-stone-800 shrink-0 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-[11px] text-stone-500 dark:text-stone-400 block truncate">
              Selected:{" "}
              <b className="text-stone-900 dark:text-white">
                {activeDistrictId
                  ? RAJASTHAN_50_DISTRICTS[activeDistrictId]?.nameEnglish || RAJASTHAN_50_DISTRICTS[activeDistrictId]?.nameHindi
                  : "None"}
              </b>
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3 inline" /> +50 Welcome bonus points awarded
            </span>
          </div>

          <button
            type="button"
            disabled={!activeDistrictId}
            onClick={handleConfirm}
            className={`px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm shadow-md transition cursor-pointer shrink-0 ${
              activeDistrictId
                ? "bg-gradient-to-r from-[#800020] to-[#F47B20] text-white active:scale-95"
                : "bg-stone-300 text-stone-500 cursor-not-allowed"
            }`}
          >
            Join Army ⚔️
          </button>
        </div>
      </div>
    </div>
  );
};
