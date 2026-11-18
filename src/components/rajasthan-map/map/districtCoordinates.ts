import { DISTRICT_CENTROIDS } from "../data/districtPaths";
import { RAJASTHAN_50_DISTRICTS } from "../data/districtsData";

export interface DistrictSvgNode {
  id: string;
  nameHindi: string;
  divisionId: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  shape?: "ellipse" | "polygon" | "round_rect";
  labelOffsetX?: number;
  labelOffsetY?: number;
}

export const DISTRICT_SVG_NODES: Record<string, DistrictSvgNode> = Object.fromEntries(
  Object.keys(DISTRICT_CENTROIDS).map(id => {
    const [cx, cy] = DISTRICT_CENTROIDS[id] || [480, 480];
    const district = RAJASTHAN_50_DISTRICTS[id];
    return [id, {
      id,
      nameHindi: district ? district.nameHindi : id,
      divisionId: district ? district.divisionId : "",
      cx,
      cy,
      rx: 32,
      ry: 24
    }];
  })
);
