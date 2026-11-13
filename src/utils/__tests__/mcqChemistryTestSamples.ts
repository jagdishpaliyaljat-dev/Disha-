export interface ChemFixture {
  id: string;
  description: string;
  rawText: string;
  correctIndex: number;
  chemTopic: string;
  hasFormula: boolean;
}

export const MCQ_CHEMISTRY_TEST_SAMPLES: ChemFixture[] = [
  {
    id: "chem_atomic_1",
    description: "Atomic structure - isotope",
    rawText: "Q1. परमाणु के नाभिक में क्या होते हैं?\n(A) केवल प्रोटॉन\n(B) प्रोटॉन और न्यूट्रॉन\n(C) प्रोटॉन और इलेक्ट्रॉन\n(D) केवल न्यूट्रॉन\nAnswer: B",
    correctIndex: 1,
    chemTopic: "atomic_structure",
    hasFormula: false
  },
  {
    id: "chem_periodic_1",
    description: "Periodic table - Halogens",
    rawText: "Q2. आधुनिक आवर्त सारणी में हैलोजन किस समूह में हैं?\nA. समूह 1\nB. समूह 16\nC. समूह 17\nD. समूह 18\nAnswer: C",
    correctIndex: 2,
    chemTopic: "periodic_table",
    hasFormula: false
  },
  {
    id: "chem_formula_1",
    description: "Formula identification",
    rawText: "Q3. सोडियम क्लोराइड का रासायनिक सूत्र क्या है?\nA. NaOH\nB. NaCl\nC. Na2CO3\nD. NaHCO3\nAnswer: B",
    correctIndex: 1,
    chemTopic: "important_compounds",
    hasFormula: true
  },
  {
    id: "chem_reaction_1",
    description: "Reaction identification",
    rawText: "Q4. Fe + CuSO4 -> FeSO4 + Cu किस प्रकार की अभिक्रिया है?\nA. संयोजन\nB. वियोजन\nC. विस्थापन\nD. द्विविस्थापन\nAnswer: C",
    correctIndex: 2,
    chemTopic: "metals_nonmetals",
    hasFormula: true
  },
  {
    id: "chem_numerical_mole",
    description: "Numerical - Mole concept",
    rawText: "Q5. 18g H2O में कितने मोल होते हैं?\nA. 0.5 मोल\nB. 1 मोल\nC. 2 मोल\nD. 18 मोल\nAnswer: B",
    correctIndex: 1,
    chemTopic: "mole_concept_stoichiometry",
    hasFormula: true
  },
  {
    id: "chem_negative_1",
    description: "Negative question - NOT an acid",
    rawText: "Q6. निम्नलिखित में से कौन-सा एक प्रबल अम्ल नहीं है?\nA. HCl\nB. H2SO4\nC. CH3COOH\nD. HNO3\nAnswer: C",
    correctIndex: 2,
    chemTopic: "equilibrium_ph",
    hasFormula: true
  },
  {
    id: "chem_organic_1",
    description: "Organic - Methane",
    rawText: "Q7. मिथेन का सूत्र क्या है?\nA. CH4\nB. C2H6\nC. C3H8\nD. C4H10\nAnswer: A",
    correctIndex: 0,
    chemTopic: "organic_hydrocarbons",
    hasFormula: true
  },
  {
    id: "chem_bullet_safety",
    description: "Bullet safety with chemistry values",
    rawText: "Q8. जल के संभवन की ऊष्मा:\n- 285.8 kJ/mol\nअभिक्रिया: H2 + 1/2 O2 -> H2O\nयह किस प्रकार का परिवर्तन है?\nA. भौतिक\nB. रासायनिक\nC. दोनों\nD. कोई नहीं\nAnswer: B",
    correctIndex: 1,
    chemTopic: "thermodynamics",
    hasFormula: true
  },
  {
    id: "chem_ion_1",
    description: "Ion charge",
    rawText: "Q9. कार्बोनेट आयन (CO3^2-) पर आवेश है:\nA. +2\nB. -1\nC. -2\nD. 0\nAnswer: C",
    correctIndex: 2,
    chemTopic: "chemical_bonding",
    hasFormula: true
  },
  {
    id: "chem_everyday_1",
    description: "Everyday chemistry - Soap",
    rawText: "Q10. साबुन क्या है?\nA. भारी धातु का लवण\nB. उच्च वसा अम्लों का सोडियम लवण\nC. एस्टर\nD. एल्डिहाइड\nAnswer: B",
    correctIndex: 1,
    chemTopic: "everyday_chemistry",
    hasFormula: false
  },
  {
    id: "chem_statement_1",
    description: "Statement based - Equilibrium",
    rawText: "Q11. निम्नलिखित कथनों पर विचार कीजिए:\n1. साम्यावस्था पर अग्र और प्रतीप अभिक्रिया की दर बराबर होती है।\n2. उत्प्रेरक साम्य स्थिरांक को बदल देता है।\nउपर्युक्त में से कौन-सा कथन सही है?\nA. केवल 1\nB. केवल 2\nC. 1 और 2 दोनों\nD. न तो 1 और न ही 2\nAnswer: A",
    correctIndex: 0,
    chemTopic: "equilibrium_ph",
    hasFormula: false
  },
  {
    id: "chem_assertion_1",
    description: "Assertion-Reason - Bonding",
    rawText: "Q12. अभिकथन (A): हीरक विद्युत का कुचालक है।\nकारण (R): इसमें कोई मुक्त इलेक्ट्रॉन नहीं होता।\nकूट:\nA. A और R दोनों सही हैं, और R, A की सही व्याख्या है।\nB. A और R दोनों सही हैं, परन्तु R, A की सही व्याख्या नहीं है।\nC. A सही है, परन्तु R गलत है।\nD. A गलत है, परन्तु R सही है।\nAnswer: A",
    correctIndex: 0,
    chemTopic: "chemical_bonding",
    hasFormula: false
  },
  {
    id: "chem_match_1",
    description: "Match the following - Ores",
    rawText: "Q13. सूची-I को सूची-II से सुमेलित कीजिए:\n| सूची-I (अयस्क) | सूची-II (धातु) |\n|---|---|\n| 1. हेमाटाइट | A. एल्युमिनियम |\n| 2. बॉक्साइट | B. लोहा |\n| 3. सिनेबार | C. तांबा |\n| 4. क्यूप्राइट | D. पारा |\n\nकूट:\n(A) 1-B, 2-A, 3-D, 4-C\n(B) 1-A, 2-B, 3-C, 4-D\n(C) 1-B, 2-A, 3-C, 4-D\n(D) 1-A, 2-B, 3-D, 4-C\nAnswer: A",
    correctIndex: 0,
    chemTopic: "metallurgy",
    hasFormula: false
  },
  {
    id: "chem_numerical_ph",
    description: "Numerical - pH",
    rawText: "Q14. एक विलयन का [H+] = 10^-3 M है। इसका pH क्या होगा?\nA. 3\nB. 7\nC. 10\nD. 14\nAnswer: A",
    correctIndex: 0,
    chemTopic: "equilibrium_ph",
    hasFormula: true
  },
  {
    id: "chem_config_2",
    description: "Electronic configuration",
    rawText: "Q15. Mg^2+ का इलेक्ट्रॉनिक विन्यास क्या है?\nA. 1s^2 2s^2 2p^6\nB. 1s^2 2s^2 2p^6 3s^2\nC. 1s^2 2s^2 2p^6 3s^1\nD. 1s^2 2s^2 2p^4\nAnswer: A",
    correctIndex: 0,
    chemTopic: "atomic_structure",
    hasFormula: true
  },
  {
    id: "chem_organic_2",
    description: "Organic - IUPAC name",
    rawText: "Q16. CH3-CH2-OH का IUPAC नाम क्या है?\nA. मेथेनॉल\nB. एथेनॉल\nC. प्रोपेनॉल\nD. ब्यूटेनॉल\nAnswer: B",
    correctIndex: 1,
    chemTopic: "organic_hydrocarbons",
    hasFormula: true
  },
  {
    id: "chem_states_1",
    description: "States of matter",
    rawText: "Q17. किस ताप पर जल का घनत्व अधिकतम होता है?\nA. 0°C\nB. 4°C\nC. 100°C\nD. -4°C\nAnswer: B",
    correctIndex: 1,
    chemTopic: "states_of_matter",
    hasFormula: false
  },
  {
    id: "chem_kinetics_1",
    description: "Kinetics - Catalyst",
    rawText: "Q18. अभिक्रिया की दर को बढ़ाने वाला पदार्थ कहलाता है:\nA. अभिकारक\nB. उत्पाद\nC. उत्प्रेरक\nD. विलायक\nAnswer: C",
    correctIndex: 2,
    chemTopic: "kinetics",
    hasFormula: false
  },
  {
    id: "chem_solutions_1",
    description: "Solutions - Molarity",
    rawText: "Q19. मोलरता की इकाई क्या है?\nA. मोल/kg\nB. मोल/L\nC. g/L\nD. % w/w\nAnswer: B",
    correctIndex: 1,
    chemTopic: "solutions_electrochemistry",
    hasFormula: false
  },
  {
    id: "chem_biomolecules_1",
    description: "Polymers/Biomolecules",
    rawText: "Q20. सेल्युलोज क्या है?\nA. प्रोटीन\nB. वसा\nC. कार्बोहाइड्रेट\nD. विटामिन\nAnswer: C",
    correctIndex: 2,
    chemTopic: "polymers_biomolecules",
    hasFormula: false
  },
  {
    id: "chem_env_1",
    description: "Environmental chemistry",
    rawText: "Q21. ओजोन परत के क्षय के लिए मुख्य रूप से उत्तरदायी गैस है:\nA. CO2\nB. SO2\nC. CFC\nD. NO2\nAnswer: C",
    correctIndex: 2,
    chemTopic: "environmental_chemistry",
    hasFormula: false
  },
  {
    id: "chem_balancing_1",
    description: "Balancing equation",
    rawText: "Q22. समीकरण a H2 + b O2 -> c H2O में a, b, c के मान क्या होंगे?\nA. 1, 1, 1\nB. 2, 1, 2\nC. 1, 2, 1\nD. 2, 2, 2\nAnswer: B",
    correctIndex: 1,
    chemTopic: "mole_concept_stoichiometry",
    hasFormula: true
  },
  {
    id: "chem_isotopes_1",
    description: "Isotopes - Carbon",
    rawText: "Q23. ^14_6C में न्यूट्रॉनों की संख्या क्या है?\nA. 6\nB. 8\nC. 14\nD. 20\nAnswer: B",
    correctIndex: 1,
    chemTopic: "atomic_structure",
    hasFormula: true
  },
  {
    id: "chem_complex_1",
    description: "Complex formula with state symbols",
    rawText: "Q24. Ca(OH)2(aq) + CO2(g) -> CaCO3(s) + H2O(l) में कैल्शियम कार्बोनेट की अवस्था क्या है?\nA. जलीय\nB. गैस\nC. ठोस\nD. द्रव\nAnswer: C",
    correctIndex: 2,
    chemTopic: "equilibrium_ph",
    hasFormula: true
  },
  {
    id: "chem_everyday_2",
    description: "Everyday chemistry - Alloys",
    rawText: "Q25. पीतल (Brass) किन धातुओं का मिश्रण है?\nA. Cu + Sn\nB. Cu + Zn\nC. Fe + Ni\nD. Al + Mg\nAnswer: B",
    correctIndex: 1,
    chemTopic: "everyday_chemistry",
    hasFormula: true
  },
  {
    id: "chem_acids_1",
    description: "Acids Bases - pH range",
    rawText: "Q26. क्षारीय विलयन का pH मान होता है:\nA. 7 से कम\nB. 7 के बराबर\nC. 7 से अधिक\nD. 0\nAnswer: C",
    correctIndex: 2,
    chemTopic: "equilibrium_ph",
    hasFormula: false
  },
  {
    id: "chem_sequence_1",
    description: "Sequence - Reactivity series",
    rawText: "Q27. धातुओं की क्रियाशीलता का सही अवरोही क्रम क्या है?\nA. K > Na > Ca > Mg\nB. Mg > Ca > Na > K\nC. Na > K > Mg > Ca\nD. K > Ca > Na > Mg\nAnswer: A",
    correctIndex: 0,
    chemTopic: "mole_concept_stoichiometry",
    hasFormula: false
  },
  {
    id: "chem_diagram_1",
    description: "Diagram placeholder check",
    rawText: "Q28. चित्र में दिखाए गए उपकरण का नाम क्या है?\n[image: distillation apparatus]\nA. बीकर\nB. फ्लास्क\nC. आसवन उपकरण\nD. परखनली\nAnswer: C",
    correctIndex: 2,
    chemTopic: "metallurgy",
    hasFormula: false
  },
  {
    id: "chem_fill_blank_1",
    description: "Fill in the blank - Periodic trend",
    rawText: "Q29. आवर्त में बाएं से दाएं जाने पर परमाणु त्रिज्या __________ होती है।\nA. बढ़ती\nB. घटती\nC. समान रहती\nD. शून्य\nAnswer: B",
    correctIndex: 1,
    chemTopic: "periodic_table",
    hasFormula: false
  },
  {
    id: "chem_organic_3",
    description: "Organic - IUPAC with hyphens",
    rawText: "Q30. 2,3-dimethylbutane में कितने कार्बन परमाणु हैं?\nA. 4\nB. 5\nC. 6\nD. 7\nAnswer: C",
    correctIndex: 2,
    chemTopic: "organic_hydrocarbons",
    hasFormula: false
  },
  {
    id: "chem_complex_formula_2",
    description: "Ammonium sulfate option safety",
    rawText: "Q31. अमोनियम सल्फेट का सूत्र है:\nA. (NH4)2SO4\nB. NH4SO4\nC. (NH4)3SO4\nD. NH4(SO4)2\nAnswer: A",
    correctIndex: 0,
    chemTopic: "important_compounds",
    hasFormula: true
  },
  {
    id: "chem_bilingual_bracket",
    description: "Bracket formula not a bilingual signal",
    rawText: "Q32. सल्फ्यूरिक अम्ल (H2SO4) का उपयोग किसमें किया जाता है?\nA. उर्वरक\nB. बैटरी\nC. दोनों\nD. कोई नहीं\nAnswer: C",
    correctIndex: 2,
    chemTopic: "important_compounds",
    hasFormula: true
  },
  {
    id: "chem_odd_one_out",
    description: "Odd-one-out organic compounds",
    rawText: "Q33. निम्नलिखित में से विषम को चुनिए:\nA. मेथेन\nB. एथेन\nC. प्रोपेन\nD. एथीन\nAnswer: D",
    correctIndex: 3,
    chemTopic: "organic_hydrocarbons",
    hasFormula: false
  }
];
