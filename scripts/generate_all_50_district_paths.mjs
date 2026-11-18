import * as d3 from 'd3';
import fs from 'fs';

// Sutherland-Hodgman polygon clip against halfplane dot(p - m, normal) <= 0
function clipPolygon(points, m, normal) {
  const out = [];
  if (!points || points.length === 0) return out;
  
  function isInside(p) {
    const dx = p[0] - m[0];
    const dy = p[1] - m[1];
    return dx * normal[0] + dy * normal[1] <= 0;
  }
  
  function intersection(p1, p2) {
    const dx1 = p1[0] - m[0];
    const dy1 = p1[1] - m[1];
    const dx2 = p2[0] - m[0];
    const dy2 = p2[1] - m[1];
    const d1 = dx1 * normal[0] + dy1 * normal[1];
    const d2 = dx2 * normal[0] + dy2 * normal[1];
    const t = d1 / (d1 - d2);
    return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
  }

  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const prev = points[(i + points.length - 1) % points.length];
    const currIn = isInside(curr);
    const prevIn = isInside(prev);

    if (currIn) {
      if (!prevIn) out.push(intersection(prev, curr));
      out.push(curr);
    } else if (prevIn) {
      out.push(intersection(prev, curr));
    }
  }
  return out;
}

// Convert point array to SVG path 'M...L...Z'
function pointsToSvgPath(points) {
  if (!points || points.length < 3) return '';
  return 'M' + points.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z';
}

// Multi-polygon support: converts geojson geometry coordinates to array of projected point rings
function getRings(geometry, projection) {
  if (geometry.type === 'Polygon') {
    return [geometry.coordinates[0].map(projection)];
  } else if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map(poly => poly[0].map(projection));
  }
  return [];
}

function partitionRingsMulti(rings, seeds) {
  // seeds: array of { id, pt }
  // for each seed, clip against bisectors with all other seeds
  const result = {};
  seeds.forEach(s => { result[s.id] = []; });

  rings.forEach(ring => {
    seeds.forEach((s1, i) => {
      let poly = [...ring];
      seeds.forEach((s2, j) => {
        if (i === j) return;
        const m = [(s1.pt[0] + s2.pt[0]) / 2, (s1.pt[1] + s2.pt[1]) / 2];
        const normal = [s2.pt[0] - s1.pt[0], s2.pt[1] - s1.pt[1]];
        poly = clipPolygon(poly, m, normal);
      });
      if (poly.length >= 3) {
        result[s1.id].push(poly);
      }
    });
  });

  return result;
}

async function main() {
  const res = await fetch('https://raw.githubusercontent.com/udit-001/india-maps-data/main/geojson/states/rajasthan.geojson');
  const geojson = await res.json();
  const width = 960;
  const height = 960;
  const projection = d3.geoMercator().fitExtent([[30, 30], [width - 30, height - 30]], geojson);

  const featMap = {};
  geojson.features.forEach(f => {
    featMap[f.properties.district] = f;
  });

  const districtSvgPaths = {};
  const districtCentroids = {};

  function addDistrict(id, rings, centroid) {
    const dStr = rings.map(pointsToSvgPath).join(' ');
    districtSvgPaths[id] = dStr;
    districtCentroids[id] = centroid;
  }

  // 1. Single / Undivided Districts
  const undivided = [
    { id: 'jaisalmer', key: 'Jaisalmer' },
    { id: 'hanumangarh', key: 'Hanumangarh' },
    { id: 'churu', key: 'Churu' },
    { id: 'dausa', key: 'Dausa' },
    { id: 'dholpur', key: 'Dholpur' },
    { id: 'karauli', key: 'Karauli' },
    { id: 'bundi', key: 'Bundi' },
    { id: 'kota', key: 'Kota' },
    { id: 'baran', key: 'Baran' },
    { id: 'jhalawar', key: 'Jhalawar' },
    { id: 'chittorgarh', key: 'Chittorgarh' },
    { id: 'pratapgarh', key: 'Pratapgarh' },
    { id: 'banswara', key: 'Banswara' },
    { id: 'dungarpur', key: 'Dungarpur' },
    { id: 'sirohi', key: 'Sirohi' },
    { id: 'rajsamand', key: 'Rajsamand' },
    { id: 'pali', key: 'Pali' },
    { id: 'tonk', key: 'Tonk' },
    { id: 'bikaner', key: 'Bikaner' }
  ];

  undivided.forEach(u => {
    const f = featMap[u.key];
    if (f) {
      const rings = getRings(f.geometry, projection);
      const c = projection(d3.geoCentroid(f)).map(Math.round);
      addDistrict(u.id, rings, c);
    }
  });

  // 2. Barmer -> Barmer & Balotra
  {
    const rings = getRings(featMap['Barmer'].geometry, projection);
    const parts = partitionRingsMulti(rings, [
      { id: 'barmer', pt: [175, 550] },
      { id: 'balotra', pt: [280, 520] }
    ]);
    addDistrict('barmer', parts['barmer'], [180, 545]);
    addDistrict('balotra', parts['balotra'], [280, 520]);
  }

  // 3. Ganganagar -> Sri Ganganagar & Anupgarh
  {
    const rings = getRings(featMap['Ganganagar'].geometry, projection);
    const parts = partitionRingsMulti(rings, [
      { id: 'sri_ganganagar', pt: [425, 120] },
      { id: 'anupgarh', pt: [375, 215] }
    ]);
    addDistrict('sri_ganganagar', parts['sri_ganganagar'], [425, 125]);
    addDistrict('anupgarh', parts['anupgarh'], [375, 215]);
  }

  // 4. Bharatpur -> Deeg & Bharatpur
  {
    const rings = getRings(featMap['Bharatpur'].geometry, projection);
    const parts = partitionRingsMulti(rings, [
      { id: 'deeg', pt: [765, 350] },
      { id: 'bharatpur', pt: [780, 400] }
    ]);
    addDistrict('deeg', parts['deeg'], [765, 350]);
    addDistrict('bharatpur', parts['bharatpur'], [780, 400]);
  }

  // 5. Jalore -> Jalore & Sanchor
  {
    const rings = getRings(featMap['Jalore'].geometry, projection);
    const parts = partitionRingsMulti(rings, [
      { id: 'jalore', pt: [295, 590] },
      { id: 'sanchor', pt: [265, 660] }
    ]);
    addDistrict('jalore', parts['jalore'], [295, 590]);
    addDistrict('sanchor', parts['sanchor'], [265, 660]);
  }

  // 6. Udaipur -> Udaipur & Salumbar
  {
    const rings = getRings(featMap['Udaipur'].geometry, projection);
    const parts = partitionRingsMulti(rings, [
      { id: 'udaipur', pt: [415, 675] },
      { id: 'salumbar', pt: [470, 720] }
    ]);
    addDistrict('udaipur', parts['udaipur'], [415, 675]);
    addDistrict('salumbar', parts['salumbar'], [470, 720]);
  }

  // 7. Bhilwara -> Bhilwara & Shahpura
  {
    const rings = getRings(featMap['Bhilwara'].geometry, projection);
    const parts = partitionRingsMulti(rings, [
      { id: 'bhilwara', pt: [535, 625] },
      { id: 'shahpura', pt: [585, 595] }
    ]);
    addDistrict('bhilwara', parts['bhilwara'], [535, 625]);
    addDistrict('shahpura', parts['shahpura'], [585, 595]);
  }

  // 8. Sawai Madhopur -> Sawai Madhopur & Gangapur City
  {
    const rings = getRings(featMap['Sawai Madhopur'].geometry, projection);
    const parts = partitionRingsMulti(rings, [
      { id: 'sawai_madhopur', pt: [735, 550] },
      { id: 'gangapur_city', pt: [755, 495] }
    ]);
    addDistrict('sawai_madhopur', parts['sawai_madhopur'], [735, 550]);
    addDistrict('gangapur_city', parts['gangapur_city'], [755, 495]);
  }

  // 9. Nagaur -> Nagaur & Didwana-Kuchaman
  {
    const rings = getRings(featMap['Nagaur'].geometry, projection);
    const parts = partitionRingsMulti(rings, [
      { id: 'nagaur', pt: [445, 410] },
      { id: 'didwana_kuchaman', pt: [515, 385] }
    ]);
    addDistrict('nagaur', parts['nagaur'], [445, 410]);
    addDistrict('didwana_kuchaman', parts['didwana_kuchaman'], [515, 385]);
  }

  // 10. Jodhpur -> Phalodi (north), Jodhpur Rural (surrounding), Jodhpur (urban)
  {
    const rings = getRings(featMap['Jodhpur'].geometry, projection);
    const parts = partitionRingsMulti(rings, [
      { id: 'phalodi', pt: [315, 370] },
      { id: 'jodhpur_rural', pt: [335, 480] },
      { id: 'jodhpur', pt: [355, 442] }
    ]);
    addDistrict('phalodi', parts['phalodi'], [315, 370]);
    addDistrict('jodhpur_rural', parts['jodhpur_rural'], [335, 480]);
    addDistrict('jodhpur', parts['jodhpur'], [355, 442]);
  }

  // 11. Ajmer -> Beawar (SW), Ajmer (Central), Kekri (SE)
  {
    const rings = getRings(featMap['Ajmer'].geometry, projection);
    const parts = partitionRingsMulti(rings, [
      { id: 'beawar', pt: [490, 525] },
      { id: 'ajmer', pt: [535, 475] },
      { id: 'kekri', pt: [575, 520] }
    ]);
    addDistrict('beawar', parts['beawar'], [490, 525]);
    addDistrict('ajmer', parts['ajmer'], [535, 475]);
    addDistrict('kekri', parts['kekri'], [575, 520]);
  }

  // 12. Jaipur -> Kotputli-Behror (North), Jaipur Rural (Outer), Jaipur (Urban), Dudu (SW)
  {
    const rings = getRings(featMap['Jaipur'].geometry, projection);
    const parts = partitionRingsMulti(rings, [
      { id: 'kotputli_behror', pt: [670, 365] },
      { id: 'jaipur', pt: [638, 415] },
      { id: 'jaipur_rural', pt: [675, 440] },
      { id: 'dudu', pt: [605, 465] }
    ]);
    addDistrict('kotputli_behror', parts['kotputli_behror'], [670, 365]);
    addDistrict('jaipur', parts['jaipur'], [638, 415]);
    addDistrict('jaipur_rural', parts['jaipur_rural'], [675, 440]);
    addDistrict('dudu', parts['dudu'], [605, 465]);
  }

  // 13. Alwar -> Khairthal-Tijara (North) & Alwar (South)
  {
    const rings = getRings(featMap['Alwar'].geometry, projection);
    const parts = partitionRingsMulti(rings, [
      { id: 'khairthal_tijara', pt: [720, 315] },
      { id: 'alwar', pt: [710, 370] }
    ]);
    addDistrict('khairthal_tijara', parts['khairthal_tijara'], [720, 315]);
    addDistrict('alwar', parts['alwar'], [710, 370]);
  }

  // 14. Sikar & Jhunjhunu -> Sikar, Jhunjhunu, Neem Ka Thana
  {
    const sikarRings = getRings(featMap['Sikar'].geometry, projection);
    const jhunjhunuRings = getRings(featMap['Jhunjhunu'].geometry, projection);
    
    const sParts = partitionRingsMulti(sikarRings, [
      { id: 'sikar', pt: [565, 360] },
      { id: 'neem_ka_thana_s', pt: [625, 340] }
    ]);
    const jParts = partitionRingsMulti(jhunjhunuRings, [
      { id: 'jhunjhunu', pt: [605, 290] },
      { id: 'neem_ka_thana_j', pt: [630, 320] }
    ]);

    addDistrict('sikar', sParts['sikar'], [565, 360]);
    addDistrict('jhunjhunu', jParts['jhunjhunu'], [605, 290]);
    // Combine both halves of Neem Ka Thana
    const nktRings = [...(sParts['neem_ka_thana_s'] || []), ...(jParts['neem_ka_thana_j'] || [])];
    addDistrict('neem_ka_thana', nktRings, [625, 330]);
  }

  console.log('Total 50-district paths generated:', Object.keys(districtSvgPaths).length);
  
  // Output JSON file with all SVG paths and centroids
  const outputData = {
    districtSvgPaths,
    districtCentroids
  };
  fs.writeFileSync('src/components/rajasthan-map/data/districtPaths.json', JSON.stringify(outputData, null, 2));
  console.log('Successfully written to src/components/rajasthan-map/data/districtPaths.json');
}

main().catch(console.error);
