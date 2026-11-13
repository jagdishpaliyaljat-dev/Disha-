/**
 * 30+ Comprehensive MCQ Parser Test Samples
 * Covers all question styles, types, and edge cases:
 * - Simple direct MCQs with various numbering formats
 * - Chemical & Mathematical LaTeX equations (e.g. Fe + CuSO4)
 * - Option lines without dots (e.g. "A विस्थापन")
 * - Statement-based questions (कथन I, II)
 * - Match the following (सूची-I / सूची-II)
 * - Assertion-Reason (अभिकथन A / कारण R)
 * - Fill in the blank (____)
 * - True / False (2 options)
 * - Passage-based questions
 * - Inline options on single line
 * - Separate Answer Key / उत्तरमाला at text bottom
 * - Bilingual questions
 * - Image references
 * - Metadata headers (Subject, Exam, Year)
 * - Bullets & checkmark correct hints (✓, **)
 */

export interface ParserTestSample {
  id: string;
  category: string;
  name: string;
  rawText: string;
  expectedType: string;
  expectedCorrectIndex: number;
  expectedOptionCount: number;
  verifyFn?: (q: any) => boolean;
}

export const MCQ_TEST_SAMPLES: ParserTestSample[] = [
  // ─────────────────────────────────────────────────────────────
  // 1. CHEMISTRY & LATEX FORMULAS (User's Exact Critical Case)
  // ─────────────────────────────────────────────────────────────
  {
    id: "chem-latex-user-exact",
    category: "Chemical / LaTeX",
    name: "User Exact Chemistry Reaction (Fe + CuSO4)",
    rawText: `Q25. अभिक्रिया के प्रकार की पहचान कीजिए :
\\text{Fe} + \\text{CuSO}_{4} \\rightarrow \\text{FeSO}_{4} + \\text{Cu}
A विस्थापन और रेडॉक्स
B संयोजन
C दोहरा विस्थापन
D अपघटन
Answer: A`,
    expectedType: "simple",
    expectedCorrectIndex: 0,
    expectedOptionCount: 4,
    verifyFn: (q) => {
      // Must have converted LaTeX to clean Unicode or readable formula
      const hasCleanFormula = q.question.includes("Fe") && q.question.includes("CuSO₄") && q.question.includes("→");
      const hasCleanOptions = q.options[0].includes("विस्थापन और रेडॉक्स");
      return hasCleanFormula && hasCleanOptions;
    }
  },
  {
    id: "math-trig-latex",
    category: "Chemical / LaTeX",
    name: "Math Trigonometry LaTeX with superscripts & degree",
    rawText: `Q4. नीचे दो कथन दिए गए हैं :
कथन (I) : \\sec^{2}A - \\tan^{2}A = 1, 0^{\\circ} \\le A < 90^{\\circ} के लिए सत्य है।
कथन (II) : \\theta के 0^{\\circ} से 90^{\\circ} बढ़ने पर \\cos\\theta का मान बढ़ता है।
उपर्युक्त कथनों के आलोक में, नीचे दिए गए विकल्पों में से सबसे उपयुक्त उत्तर चुनें :
A कथन (I) और कथन (II) दोनों ही सत्य हैं।
B कथन (I) और कथन (II) दोनों ही गलत हैं।
C कथन (I) सही है लेकिन कथन (II) गलत है।
D कथन (I) गलत है लेकिन कथन (II) सत्य है।
Answer: C`,
    expectedType: "statement_based",
    expectedCorrectIndex: 2,
    expectedOptionCount: 4,
    verifyFn: (q) => q.question.includes("sec") || Boolean(q.statements?.some((s: string) => s.includes("sec")))
  },
  {
    id: "math-centroid-fraction",
    category: "Chemical / LaTeX",
    name: "Coordinate Geometry Centroid with \\frac and sub/superscripts",
    rawText: `Q6. A(x_{1}, y_{1}), B(x_{2}, y_{2}) और C(x_{3}, y_{3}) शीर्षों वाले त्रिभुज पर विचार करें।
नीचे दो कथन दिए गए हैं :
कथन (I) : त्रिभुज का केंद्रक प्रत्येक माध्यिका को आंतरिक रूप से 2 : 1 के अनुपात में विभाजित करता है।
कथन (II) : केंद्रक के निर्देशांक \\left(\\frac{x_{1}+x_{2}+x_{3}}{3}, \\frac{y_{1}+y_{2}+y_{3}}{3}\\right) द्वारा प्रदत्त हैं।
A कथन (I) और कथन (II) दोनों ही सत्य हैं।
B कथन (I) और कथन (II) दोनों ही असत्य हैं।
C कथन (I) सत्य है लेकिन कथन (II) असत्य है।
D कथन (I) असत्य है लेकिन कथन (II) सत्य है।
Answer: A`,
    expectedType: "statement_based",
    expectedCorrectIndex: 0,
    expectedOptionCount: 4
  },
  {
    id: "chem-water-electrolysis",
    category: "Chemical / LaTeX",
    name: "Chemistry Water Electrolysis Decomposition",
    rawText: `Q26. जल का विद्युत अपघटन (2\\text{H}_2\\text{O} \\rightarrow 2\\text{H}_2 + \\text{O}_2) किस प्रकार की अभिक्रिया है ?
A संयोजन अभिक्रिया
B वियोजन (अपघटन) अभिक्रिया
C विस्थापन अभिक्रिया
D द्विविस्थापन अभिक्रिया
Answer: B`,
    expectedType: "simple",
    expectedCorrectIndex: 1,
    expectedOptionCount: 4
  },

  // ─────────────────────────────────────────────────────────────
  // 2. SIMPLE & DIRECT FORMAT VARIATIONS
  // ─────────────────────────────────────────────────────────────
  {
    id: "simple-dotted-options",
    category: "Simple Direct",
    name: "Standard 1. with A. B. C. D. options",
    rawText: `1. राजस्थान का राज्य पशु कौन सा है?
A. चिंकारा
B. बाघ
C. शेर
D. हाथी
Answer: A
Explanation: चिंकारा को 1981 में राजस्थान का राज्य पशु घोषित किया गया था।`,
    expectedType: "simple",
    expectedCorrectIndex: 0,
    expectedOptionCount: 4,
    verifyFn: (q) => q.explanation.includes("चिंकारा")
  },
  {
    id: "simple-parentheses-options",
    category: "Simple Direct",
    name: "Parenthesized numbering (1) and options (a) (b) (c) (d)",
    rawText: `(1) भारत की राजधानी क्या है?
(a) मुम्बई
(b) नई दिल्ली
(c) कोलकाता
(d) चेन्नई
Ans: (b)`,
    expectedType: "simple",
    expectedCorrectIndex: 1,
    expectedOptionCount: 4
  },
  {
    id: "simple-hindi-options",
    category: "Simple Direct",
    name: "Hindi markers (क, ख, ग, घ) with 'उत्तर: ख'",
    rawText: `प्रश्न 3: सूर्य के सबसे निकट ग्रह कौन सा है?
क) मंगल
ख) बुध
ग) शुक्र
घ) पृथ्वी
उत्तर: ख`,
    expectedType: "simple",
    expectedCorrectIndex: 1,
    expectedOptionCount: 4
  },
  {
    id: "simple-numeric-options",
    category: "Simple Direct",
    name: "Options marked with 1) 2) 3) 4)",
    rawText: `Q12. हड़प्पा सभ्यता की खोज किस वर्ष हुई थी?
1) 1920
2) 1921
3) 1922
4) 1925
Answer: Option 2`,
    expectedType: "simple",
    expectedCorrectIndex: 1,
    expectedOptionCount: 4
  },

  // ─────────────────────────────────────────────────────────────
  // 3. STATEMENT-BASED MCQS
  // ─────────────────────────────────────────────────────────────
  {
    id: "statement-roman-numerals",
    category: "Statement Based",
    name: "Roman numeral statements (I, II) with evaluation",
    rawText: `Q7. नीचे दो कथन दिए गए हैं:
कथन (I) : एक त्रिभुज का बहिष्कोण दो अंतःसम्मुख कोणों के योग के बराबर होता है।
कथन (II) : त्रिभुज की किन्हीं भी दो भुजाओं की लंबाइयों के बीच का अंतर सदैव तीसरी भुजा की लंबाई से अधिक होता है।
उपर्युक्त कथनों के आलोक में, नीचे दिए गए विकल्पों में से सबसे उपयुक्त उत्तर चुनें :
A कथन (I) और कथन (II) दोनों ही सत्य हैं।
B कथन (I) और कथन (II) दोनों ही असत्य हैं।
C कथन (I) सत्य है लेकिन कथन (II) असत्य है।
D कथन (I) असत्य है लेकिन कथन (II) सत्य है।
Answer: C`,
    expectedType: "statement_based",
    expectedCorrectIndex: 2,
    expectedOptionCount: 4
  },
  {
    id: "statement-english-three-statements",
    category: "Statement Based",
    name: "Three statements with 'Which of the statements given above is/are correct?'",
    rawText: `Q15. Consider the following statements regarding the Reserve Bank of India:
1. It was established under the RBI Act 1934.
2. It is the sole authority to issue currency notes in India.
3. It regulates the credit system of the country.
Which of the statements given above are correct?
A. 1 and 2 only
B. 2 and 3 only
C. 1 and 3 only
D. 1, 2 and 3
Answer: D`,
    expectedType: "statement_based",
    expectedCorrectIndex: 3,
    expectedOptionCount: 4
  },
  {
    id: "statement-assumed-mean",
    category: "Statement Based",
    name: "Hindi Statistics Statement evaluation",
    rawText: `Q8. वर्गीकृत डेटा के माध्य की गणना करने के लिए उपयोग की जाने वाली विधियों के संबंध में निम्नलिखित कथनों पर विचार करें :
कथन (I) : कल्पित माध्य विधि में, अंतिम रूप से परिकलित माध्य, कल्पित माध्य 'a' के चयन से पूर्णतः स्वतंत्र होता है।
कथन (II) : सोपान-विचलन विधि गणितीय रूप से सुविधाजनक और अनुप्रयुक्त होती है, भले ही बारंबारता बंटन के वर्ग आकार (वर्ग चौड़ाई) निरंतर असमान हों।
उपर्युक्त कथनों के आलोक में, नीचे दिए गए विकल्पों में से सबसे उपयुक्त उत्तर चुनें :
A कथन (I) और कथन (II) दोनों ही सत्य हैं।
B कथन (I) और कथन (II) दोनों ही असत्य हैं।
C कथन (I) सत्य है लेकिन कथन (II) असत्य है।
D कथन (I) असत्य है लेकिन कथन (II) सत्य है।
Answer: C`,
    expectedType: "statement_based",
    expectedCorrectIndex: 2,
    expectedOptionCount: 4
  },

  // ─────────────────────────────────────────────────────────────
  // 4. MATCH THE FOLLOWING
  // ─────────────────────────────────────────────────────────────
  {
    id: "match-congruence-criteria",
    category: "Match the Following",
    name: "Congruence criteria Match List-I with List-II",
    rawText: `Q2. सूची-I में सर्वांगसमता मानदंडों का सूची-II में उनके सही विवरणों के साथ मिलान करें :
सूची-I:
(a) SSS सर्वांगसमता
(b) SAS सर्वांगसमता
(c) ASA सर्वांगसमता
(d) RHS सर्वांगसमता
सूची-II:
(i) दो कोण और उनके बीच की भुजा बराबर होते हैं।
(ii) समकोण त्रिभुजों का कर्ण और एक भुजा बराबर होते हैं।
(iii) तीनों संगत भुजाएँ बराबर होती हैं।
(iv) दो भुजाएँ और उनके बीच का कोण बराबर होते हैं।
नीचे दिए गए विकल्पों में से सबसे उपयुक्त उत्तर चुनें :
A (a)-(ii), (b)-(i), (c)-(iii), (d)-(iv)
B (a)-(iii), (b)-(ii), (c)-(i), (d)-(iv)
C (a)-(i), (b)-(ii), (c)-(iv), (d)-(iii)
D (a)-(iii), (b)-(iv), (c)-(i), (d)-(ii)
Answer: D`,
    expectedType: "match_following",
    expectedCorrectIndex: 3,
    expectedOptionCount: 4
  },
  {
    id: "match-english-history",
    category: "Match the Following",
    name: "History Match List I and List II with A-1 B-2 codes",
    rawText: `Q18. Match List-I with List-II:
List-I (Battles)
A. First Battle of Panipat
B. Battle of Khanwa
C. Battle of Chausa
D. Battle of Kannauj
List-II (Years)
1. 1526
2. 1527
3. 1539
4. 1540
Choose the correct code:
A. A-1, B-2, C-3, D-4
B. A-2, B-1, C-4, D-3
C. A-1, B-3, C-2, D-4
D. A-4, B-3, C-2, D-1
Answer: A`,
    expectedType: "match_following",
    expectedCorrectIndex: 0,
    expectedOptionCount: 4
  },
  {
    id: "match-tabular-hindi",
    category: "Match the Following",
    name: "Hindi Column Matching (खण्ड A और खण्ड B)",
    rawText: `प्रश्न 19: स्तम्भ A को स्तम्भ B से सुमेलित कीजिए:
स्तम्भ A | स्तम्भ B
1. विटामिन A | (क) रतौंधी
2. विटामिन C | (ख) स्कर्वी
3. विटामिन D | (ग) रिकेट्स
4. विटामिन B1 | (घ) बेरीबेरी
विकल्प:
A 1-क, 2-ख, 3-ग, 4-घ
B 1-ख, 2-क, 3-घ, 4-ग
C 1-ग, 2-घ, 3-क, 4-ख
D 1-घ, 2-ग, 3-ख, 4-क
Answer: A`,
    expectedType: "match_following",
    expectedCorrectIndex: 0,
    expectedOptionCount: 4
  },

  // ─────────────────────────────────────────────────────────────
  // 5. ASSERTION & REASON
  // ─────────────────────────────────────────────────────────────
  {
    id: "assertion-reason-hindi",
    category: "Assertion & Reason",
    name: "Hindi अभिकथन (A) और कारण (R)",
    rawText: `Q14. नीचे दो कथन दिए गए हैं, एक को अभिकथन (A) और दूसरे को कारण (R) कहा गया है:
अभिकथन (A) : लोहे में जंग लगना एक रासायनिक परिवर्तन है।
कारण (R) : जंग लगने पर लोहे का नया यौगिक (आयरन ऑक्साइड) बनता है।
उपर्युक्त कथनों के आलोक में, निम्नलिखित में से सही विकल्प चुनें :
A. (A) और (R) दोनों सही हैं और (R), (A) की सही व्याख्या है।
B. (A) और (R) दोनों सही हैं लेकिन (R), (A) की सही व्याख्या नहीं है।
C. (A) सही है लेकिन (R) गलत है।
D. (A) गलत है लेकिन (R) सही है।
Answer: A`,
    expectedType: "assertion_reason",
    expectedCorrectIndex: 0,
    expectedOptionCount: 4
  },
  {
    id: "assertion-reason-english-auto-options",
    category: "Assertion & Reason",
    name: "English Assertion & Reason with auto standard options",
    rawText: `Question 20.
Assertion (A): Photosynthesis occurs only in green plants.
Reason (R): Chlorophyll is necessary for trapping solar energy.
Ans: A`,
    expectedType: "assertion_reason",
    expectedCorrectIndex: 0,
    expectedOptionCount: 4
  },

  // ─────────────────────────────────────────────────────────────
  // 6. FILL IN THE BLANKS
  // ─────────────────────────────────────────────────────────────
  {
    id: "fill-blank-underscores",
    category: "Fill in the Blank",
    name: "Question with underscore blanks (____)",
    rawText: `Q21. प्रकाश संश्लेषण की क्रिया में पौधे ________ गैस ग्रहण करते हैं और ________ गैस छोड़ते हैं।
A. कार्बन डाइऑक्साइड, ऑक्सीजन
B. ऑक्सीजन, नाइट्रोजन
C. नाइट्रोजन, कार्बन डाइऑक्साइड
D. हीलियम, ऑक्सीजन
Answer: A`,
    expectedType: "fill_blank",
    expectedCorrectIndex: 0,
    expectedOptionCount: 4
  },
  {
    id: "fill-blank-english",
    category: "Fill in the Blank",
    name: "English fill blank with multiple blanks",
    rawText: `Q22. The process of converting water vapor into liquid is called ________.
A. Evaporation
B. Condensation
C. Precipitation
D. Transpiration
Answer: B`,
    expectedType: "fill_blank",
    expectedCorrectIndex: 1,
    expectedOptionCount: 4
  },

  // ─────────────────────────────────────────────────────────────
  // 7. TRUE / FALSE (2 Options)
  // ─────────────────────────────────────────────────────────────
  {
    id: "true-false-english",
    category: "True / False",
    name: "Binary 2-option True/False",
    rawText: `Q23. Sound can travel through a vacuum.
A. True
B. False
Answer: B`,
    expectedType: "true_false",
    expectedCorrectIndex: 1,
    expectedOptionCount: 2
  },
  {
    id: "true-false-hindi",
    category: "True / False",
    name: "Hindi सत्य / असत्य binary question",
    rawText: `प्रश्न 24: प्रकाश निर्वात में भी गति कर सकता है।
A. सत्य
B. असत्य
उत्तर: A`,
    expectedType: "true_false",
    expectedCorrectIndex: 0,
    expectedOptionCount: 2
  },

  // ─────────────────────────────────────────────────────────────
  // 8. PASSAGE-BASED QUESTIONS
  // ─────────────────────────────────────────────────────────────
  {
    id: "passage-based-hindi",
    category: "Passage Based",
    name: "Hindi Passage followed by reading comprehension question",
    rawText: `गद्यांश:
प्रदूषण आज की सबसे गंभीर वैश्विक समस्याओं में से एक है। औद्योगिकीकरण और वनों की अंधाधुंध कटाई से पर्यावरण का संतुलन बिगड़ गया है। यदि समय रहते प्रभावी कदम नहीं उठाए गए तो भावी पीढ़ियों के लिए स्वच्छ हवा और पानी दुर्लभ हो जाएंगे।

Q31. प्रस्तुत गद्यांश का मुख्य विषय क्या है?
A. औद्योगिकीकरण का विकास
B. पर्यावरण प्रदूषण और उसका समाधान
C. वनों की उपयोगिता
D. जल संरक्षण
Answer: B`,
    expectedType: "passage_based",
    expectedCorrectIndex: 1,
    expectedOptionCount: 4
  },

  // ─────────────────────────────────────────────────────────────
  // 9. INLINE OPTIONS ON SAME LINE
  // ─────────────────────────────────────────────────────────────
  {
    id: "inline-options-compact",
    category: "Inline Options",
    name: "All 4 options merged onto single line: (a) x (b) y (c) z (d) w",
    rawText: `Q5. एक संख्या का वर्ग 225 के साथ समाप्त होता है। संख्या के अंतिम दो अंक क्या हो सकते हैं ?
(a) 25 (b) 55 (c) 75 (d) 85
Answer: (d)`,
    expectedType: "simple",
    expectedCorrectIndex: 3,
    expectedOptionCount: 4
  },
  {
    id: "inline-options-alpha-dots",
    category: "Inline Options",
    name: "Single line options with letters: A. 10 B. 20 C. 30 D. 40",
    rawText: `Q11. Find the value of 5! / 3!:
A. 10 B. 20 C. 30 D. 40
Answer: B`,
    expectedType: "simple",
    expectedCorrectIndex: 1,
    expectedOptionCount: 4
  },

  // ─────────────────────────────────────────────────────────────
  // 10. ANSWER KEY AT BOTTOM OF TEXT
  // ─────────────────────────────────────────────────────────────
  {
    id: "answer-key-bottom-english",
    category: "Answer Key Section",
    name: "Text with no inline answer, but Answer Key table at end",
    rawText: `Q1. What is the powerhouse of the cell?
A. Nucleus
B. Mitochondria
C. Ribosome
D. Chloroplast

Q2. What is the unit of electric current?
A. Volt
B. Ohm
C. Ampere
D. Watt

Answer Key:
1-B, 2-C`,
    expectedType: "simple",
    expectedCorrectIndex: 1, // for Q1
    expectedOptionCount: 4,
    verifyFn: (q) => q.correctIndex === 1 // Q1 -> B
  },
  {
    id: "answer-key-bottom-hindi",
    category: "Answer Key Section",
    name: "Hindi text with उत्तरमाला at bottom",
    rawText: `प्रश्न 1: भारत का राष्ट्रीय खेल कौन सा है?
A. क्रिकेट
B. हॉकी
C. कबड्डी
D. फुटबॉल

उत्तरमाला:
1. B`,
    expectedType: "simple",
    expectedCorrectIndex: 1,
    expectedOptionCount: 4
  },

  // ─────────────────────────────────────────────────────────────
  // 11. BILINGUAL QUESTIONS
  // ─────────────────────────────────────────────────────────────
  {
    id: "bilingual-hindi-english",
    category: "Bilingual",
    name: "Bilingual question (Hindi + English together)",
    rawText: `Q27. कोशिका का शक्तिगृह किसे कहते हैं ? / Which organelle is known as the powerhouse of the cell?
A. माइटोकॉन्ड्रिया / Mitochondria
B. गॉल्जीकाय / Golgi apparatus
C. राइबोसोम / Ribosome
D. लाइसोसोम / Lysosome
Answer: A`,
    expectedType: "bilingual",
    expectedCorrectIndex: 0,
    expectedOptionCount: 4
  },

  // ─────────────────────────────────────────────────────────────
  // 12. IMAGE REFERENCE PLACEHOLDER
  // ─────────────────────────────────────────────────────────────
  {
    id: "image-reference-stem",
    category: "Image Reference",
    name: "Question containing [image] or diagram placeholder",
    rawText: `Q28. नीचे दिए गए परिपथ [image: circuit_diagram.png] में कुल प्रतिरोध की गणना कीजिए:
A. 5 ओह्म
B. 10 ओह्म
C. 15 ओह्म
D. 20 ओह्म
Answer: B`,
    expectedType: "image_reference",
    expectedCorrectIndex: 1,
    expectedOptionCount: 4
  },

  // ─────────────────────────────────────────────────────────────
  // 13. METADATA HEADERS (Subject / Chapter / Exam / Year)
  // ─────────────────────────────────────────────────────────────
  {
    id: "metadata-headers-parsing",
    category: "Metadata Extraction",
    name: "Subject, Exam, and Year in header block",
    rawText: `SUBJECT: सामान्य विज्ञान (GENERAL SCIENCE)
EXAM: RPSC RAS 2021
YEAR: 2021
CHAPTER: भौतिकी
TOPIC: गति के नियम

Q1. न्यूटन के गति के प्रथम नियम को क्या कहा जाता है?
A. संवेग का नियम
B. जड़त्व का नियम
C. क्रिया-प्रतिक्रिया का नियम
D. गुरुत्वाकर्षण का नियम
Answer: B`,
    expectedType: "simple",
    expectedCorrectIndex: 1,
    expectedOptionCount: 4,
    verifyFn: (q) => {
      const meta = q.meta || {};
      return meta.subject?.includes("विज्ञान") || meta.exam?.includes("RPSC") || meta.year === "2021";
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 14. BULLET / CHECKMARK CORRECT HINT (✓, **)
  // ─────────────────────────────────────────────────────────────
  {
    id: "checkmark-option-hint",
    category: "Hints & Markers",
    name: "Checkmark (✓) placed next to correct option instead of Answer line",
    rawText: `Q29. मानव शरीर की सबसे बड़ी ग्रंथि कौन सी है?
A. अग्न्याशय
B. यकृत (Liver) ✓
C. थायरॉयड
D. पीयूष ग्रंथि`,
    expectedType: "simple",
    expectedCorrectIndex: 1,
    expectedOptionCount: 4
  },
  {
    id: "bold-markdown-option-hint",
    category: "Hints & Markers",
    name: "Bold markdown (**...**) around correct option",
    rawText: `Q30. Which is the longest river in the world?
A. Amazon
**B. Nile**
C. Yangtze
D. Mississippi`,
    expectedType: "simple",
    expectedCorrectIndex: 1,
    expectedOptionCount: 4
  },

  // ─────────────────────────────────────────────────────────────
  // 15. MULTI-LINE OPTION TEXT CONTINUATION
  // ─────────────────────────────────────────────────────────────
  {
    id: "multiline-options",
    category: "Formatting Robustness",
    name: "Multi-line options wrapped across multiple lines",
    rawText: `Q32. भारतीय संविधान के अनुच्छेद 21 के अंतर्गत जीवन के अधिकार में शामिल है:
A. केवल जीवित रहने का अधिकार नहीं बल्कि
मानवीय गरिमा के साथ जीने का अधिकार।
B. केवल शारीरिक सुरक्षा का अधिकार।
C. विदेश यात्रा पर पूर्ण प्रतिबंध।
D. आपातकाल में स्वतः समाप्त हो जाने वाला अधिकार।
Answer: A`,
    expectedType: "simple",
    expectedCorrectIndex: 0,
    expectedOptionCount: 4,
    verifyFn: (q) => q.options[0].includes("मानवीय गरिमा")
  },

  // ─────────────────────────────────────────────────────────────
  // 16. HINDI DIGITS NUMBERING (१२३ -> 123)
  // ─────────────────────────────────────────────────────────────
  {
    id: "hindi-numerals-header",
    category: "Formatting Robustness",
    name: "Question number and options in Hindi digits (१, २, ३)",
    rawText: `प्रश्न १०. पृथ्वी दिवस कब मनाया जाता है ?
(१) २२ मार्च
(२) २२ अप्रैल
(३) २२ मई
(४) ५ जून
उत्तर: २`,
    expectedType: "simple",
    expectedCorrectIndex: 1,
    expectedOptionCount: 4
  },

  // ─────────────────────────────────────────────────────────────
  // 17. STATEMENT-BASED WITH ASK LINE & PAGE MARKER VARIANTS
  // ─────────────────────────────────────────────────────────────
  {
    id: "statement-variant-1-sep-line",
    category: "Statement Based",
    name: "Variant 1: Statement 3 on separate line with distinct statements[] and askLine",
    rawText: `Q33. पशुओं के आर्थिक महत्व के बारे में निम्नलिखित कथनों पर विचार कीजिए :
कथन 1: लैक एक प्राकृतिक राल है जो कीट लैसिफर लैक्का द्वारा स्रावित होता है।
कथन 2: वर्मी कंपोस्ट का उत्पादन जैविक अपशिष्ट को विघटित करने के लिए केंचुओं का उपयोग करके किया जाता है।
कथन 3: मधुमक्खी पालन से शहद और मोम दोनों प्राप्त होते हैं।
उपर्युक्त में से कौन-सा/से कथन सही है/हैं?
A. केवल 1 और 2
B. केवल 2 और 3
C. केवल 1 और 3
D. 1, 2 और 3
Answer: D
Explanation: सभी कथन सही हैं और पशुओं के आर्थिक महत्व को स्पष्ट करते हैं।`,
    expectedType: "statement_based",
    expectedCorrectIndex: 3,
    expectedOptionCount: 4,
    verifyFn: (q) => {
      const has3Stmts = Array.isArray(q.statements) && q.statements.length === 3;
      const stmt3Match = q.statements && q.statements[2].includes("मधुमक्खी पालन");
      const hasAskLine = q.askLine && q.askLine.includes("उपर्युक्त में से कौन-सा/से कथन सही");
      return Boolean(has3Stmts && stmt3Match && hasAskLine);
    }
  },
  {
    id: "statement-variant-2-same-line",
    category: "Statement Based",
    name: "Variant 2: Statement 3 without label + askLine merged on same line",
    rawText: `Q34. पशुओं के आर्थिक महत्व के बारे में निम्नलिखित कथनों पर विचार कीजिए :
कथन 1: लैक एक प्राकृतिक राल है जो कीट लैसिफर लैक्का द्वारा स्रावित होता है।
कथन 2: वर्मी कंपोस्ट का उत्पादन जैविक अपशिष्ट को विघटित करने के लिए केंचुओं का उपयोग करके किया जाता है।
तीसरा कथन यह है कि मधुमक्खी पालन से मोम मिलता है। उपर्युक्त में से कौन-सा कथन सही है?
A. केवल 1 और 2
B. केवल 2 और 3
C. केवल 1 और 3
D. 1, 2 और 3
Answer: D
Explanation: तीनों कथन सत्य हैं।`,
    expectedType: "statement_based",
    expectedCorrectIndex: 3,
    expectedOptionCount: 4,
    verifyFn: (q) => {
      const has3Stmts = Array.isArray(q.statements) && q.statements.length === 3;
      const stmt3AutoLabel = Boolean(q.statements && q.statements[2] && (q.statements[2].startsWith("कथन 3:") || q.statements[2].startsWith("3")));
      const stmt3Text = q.statements && q.statements[2].includes("मधुमक्खी पालन से मोम मिलता है");
      const stmt3NoAsk = q.statements && !q.statements[2].includes("उपर्युक्त में से कौन-सा");
      const hasAskLine = q.askLine && q.askLine.includes("उपर्युक्त में से कौन-सा कथन सही है?");
      return Boolean(has3Stmts && stmt3AutoLabel && stmt3Text && stmt3NoAsk && hasAskLine);
    }
  },
  {
    id: "statement-variant-3-page-marker",
    category: "Statement Based",
    name: "Variant 3: Explanation with trailing PAGE/progress marker stripped cleanly",
    rawText: `Q35. पशुओं के आर्थिक महत्व के बारे में निम्नलिखित कथनों पर विचार कीजिए :
कथन 1: लैक एक प्राकृतिक राल है जो कीट लैसिफर लैक्का द्वारा स्रावित होता है।
कथन 2: वर्मी कंपोस्ट का उत्पादन जैविक अपशिष्ट को विघटित करने के लिए केंचुओं का उपयोग करके किया जाता है।
कथन 3: मधुमक्खी पालन से शहद और मोम दोनों प्राप्त होते हैं।
उपर्युक्त में से कौन-सा/से कथन सही है/हैं?
A. केवल 1 और 2
B. केवल 2 और 3
C. केवल 1 और 3
D. 1, 2 और 3
Answer: D
Explanation: मधुमक्खी पालन और लैक दोनों महत्वपूर्ण कुटीर उद्योग हैं। PAGE 12 COMPLETED`,
    expectedType: "statement_based",
    expectedCorrectIndex: 3,
    expectedOptionCount: 4,
    verifyFn: (q) => {
      const expClean = q.explanation && !q.explanation.includes("PAGE") && !q.explanation.includes("COMPLETED");
      const expHasContent = q.explanation && q.explanation.includes("कुटीर उद्योग");
      return Boolean(expClean && expHasContent);
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 18. PIPE TABLE MATCH FOLLOWING WITH GENERATOR FOOTER (Q10)
  // ─────────────────────────────────────────────────────────────
  {
    id: "match-pipe-table-q10",
    category: "Match the Following",
    name: "Q10 Pipe table with 3 rows, answer A, and generator footer in explanation",
    rawText: `Q10. सूची-I को सूची-II से सुमेलित कीजिए :
सूची-I | सूची-II
(a) लैक | (i) लैसिफर लैक्का
(b) रेशम | (ii) बॉम्बेक्स मोरी
(c) शहद | (iii) एपिस इंडिका
A (a)-(i), (b)-(ii), (c)-(iii)
B (a)-(ii), (b)-(i), (c)-(iii)
C (a)-(iii), (b)-(ii), (c)-(i)
D (a)-(i), (b)-(iii), (c)-(ii)
Answer: A
Explanation: लैक कीट लैसिफर लैक्का से, रेशम बॉम्बेक्स मोरी से और शहद एपिस इंडिका से प्राप्त होता है।
Questions Generated: 10
Progress: 100%
Type NEXT to continue
PAGE 1 COMPLETED`,
    expectedType: "match_following",
    expectedCorrectIndex: 0,
    expectedOptionCount: 4,
    verifyFn: (q) => {
      const matchTable3Rows = Boolean(q.matchTable && Array.isArray(q.matchTable.rows) && q.matchTable.rows.length === 3 && q.matchTable.rows[0]?.left.includes("लैक"));
      const noFooter = Boolean(q.explanation && !q.explanation.includes("Questions Generated") && !q.explanation.includes("Progress") && !q.explanation.includes("Type NEXT"));
      return Boolean(matchTable3Rows && noFooter);
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 19. RAJASTHAN ENERGY 4Q REAL TEST FIXTURE
  // ─────────────────────────────────────────────────────────────
  {
    id: "rajasthan_energy_4q",
    category: "Real Case - Rajasthan Energy 4Q",
    name: "Rajasthan Energy 4-Question Batch with bullets and headers/footers",
    rawText: `— Page 1 —
Q1. राजस्थान में 'राजस्थान एकीकृत स्वच्छ ऊर्जा नीति-2024' में संशोधन के संदर्भ में निम्नलिखित कथनों पर विचार कीजिए:
 * इस संशोधन को 7 अगस्त, 2026 को मंजूरी दी गई थी।
 * इस नीति में संशोधन की मंजूरी मुख्यमंत्री भजनलाल शर्मा की अध्यक्षता में दी गई थी।
 * इसका मुख्य उद्देश्य अक्षय ऊर्जा निवेश, बैटरी भंडारण, पर्यावरण संरक्षण और विद्युत निकासी व्यवस्था को अधिक प्रभावी बनाना है।
   उपर्युक्त में से कौन-सा/से कथन सही है/हैं?
   A केवल 1 और 2
   B केवल 2 और 3
   C केवल 1 और 3
   D 1, 2 और 3
   Answer: D
   Explanation: मुख्यमंत्री भजनलाल शर्मा की अध्यक्षता में 7 अगस्त, 2026 को राजस्थान मंत्रिमंडल ने भू-राजस्व नियमों तथा 'राजस्थान एकीकृत स्वच्छ ऊर्जा नीति-2024' में संशोधन को मंजूरी दी थी, जिससे पहले दोनों कथन सही हैं। इस संशोधन का प्रमुख उद्देश्य अक्षय ऊर्जा निवेश, बैटरी भंडारण, पर्यावरण संरक्षण और विद्युत निकासी व्यवस्था को अधिक प्रभावी बनाना है, जिसके कारण तीसरा कथन भी पूरी तरह सही है।
Q2. संशोधित स्वच्छ ऊर्जा नीति-2024 के तहत अनिवार्य वृक्षारोपण और भूमि सीमा के प्रावधानों के संबंध में निम्नलिखित कथनों पर विचार कीजिए:
 * सौर, पवन एवं अन्य अक्षय ऊर्जा परियोजनाओं को आवंटित भूमि का 10% भाग वृक्षारोपण के लिए आरक्षित रखना होगा।
 * सौर एवं पवन परियोजनाओं के लिए अधिकतम भूमि सीमा 2 हेक्टेयर प्रति मेगावाट निर्धारित की गई है।
 * हाइब्रिड परियोजनाओं के लिए अधिकतम भूमि सीमा 2.5 हेक्टेयर प्रति मेगावाट निर्धारित की गई है।
   उपर्युक्त में से कौन-सा/से कथन सही है/हैं?
   A केवल 1 और 2
   B केवल 2 और 3
   C केवल 1 और 3
   D 1, 2 और 3
   Answer: D
   Explanation: नीति के प्रावधानों के अनुसार सौर, पवन एवं अन्य अक्षय ऊर्जा परियोजनाओं को आवंटित कुल भूमि का 10% हिस्सा अनिवार्य वृक्षारोपण के लिए आरक्षित रखना अनिवार्य है। इसके अतिरिक्त, सौर और पवन परियोजनाओं के लिए अधिकतम भूमि सीमा 2 हेक्टेयर प्रति मेगावाट तथा हाइब्रिड परियोजनाओं के लिए 2.5 हेक्टेयर प्रति मेगावाट तय की गई है, जिससे तीनों कथन सही हैं।
Q3. राजस्थान मंत्रिमंडल द्वारा मंजूर की गई तीन अक्षय ऊर्जा परियोजनाओं के संदर्भ में निम्नलिखित कथनों पर विचार कीजिए:
 * मंत्रिमंडल ने कुल 922 मेगावाट की तीन परियोजनाओं के लिए भूमि आवंटन मंजूर किया है।
 * भानीपुरा और पूगल (बीकानेर) के लिए 22 मेगावाट की परियोजना शामिल है।
 * बोदाना और नाचणा (जैसलमेर) के लिए 700 मेगावाट की सौर परियोजना शामिल है।
   उपर्युक्त में से कौन-सा/से कथन सही है/हैं?
   A केवल 1 और 2
   B केवल 2 और 3
   C केवल 1 और 3
   D 1, 2 और 3
   Answer: D
   Explanation: मंत्रिमंडल ने कुल 922 मेगावाट की तीन परियोजनाओं के लिए भूमि आवंटन को स्वीकृति दी है। इसमें भानीपुरा, पूगल (बीकानेर) के लिए 22 MW, रणधा, फतेहगढ़ (जैसलमेर) के लिए 200 MW तथा बोदाना, नाचणा (जैसलमेर) के लिए 700 MW सौर परियोजनाएं शामिल हैं, जिसके आधार पर दिए गए सभी कथन सही हैं।
Q4. राजस्थान की संशोधित स्वच्छ ऊर्जा नीति-2024 के अन्य प्रमुख प्रावधानों और लक्ष्यों के बारे में निम्नलिखित कथनों पर विचार कीजिए:
 * बैटरी ऊर्जा भंडारण प्रणाली (BESS) से जुड़ी परियोजनाओं के पंजीकरण शुल्क में स्लैब आधारित रियायतें दी गई हैं।
 * स्वीकृत विद्युत निकासी सुविधा (पावर इवैक्चुएशसन) के उपयोग की अधिकतम समय-सीमा 3 वर्ष से घटाकर 2 वर्ष कर दी गई है।
 * राज्य का लक्ष्य वित्त वर्ष 2029-30 तक 1,25,000 मेगावाट (125 GW) अक्षय ऊर्जा परियोजनाओं का लक्ष्य प्राप्त करना है।
   उपर्युक्त में से कौन-सा/से कथन सही है/हैं?
   A केवल 1 और 2
   B केवल 2 और 3
   C केवल 1 और 3
   D 1, 2 और 3
   Answer: D
   Explanation: संशोधित नीति में बैटरी ऊर्जा भंडारण प्रणाली (BESS) को बढ़ावा देने के लिए पंजीकरण शुल्क में स्लैब आधारित रियायतें और अधिक भंडारण क्षमता वालों को अतिरिक्त छूट देने का प्रावधान है। साथ ही, पावर इवैक्चुएशसन के उपयोग की अधिकतम समय-सीमा को 3 वर्ष से घटाकर 2 वर्ष कर दिया गया है तथा वित्त वर्ष 2029-30 तक 1,25,000 मेगावाट (125 GW) अक्षय ऊर्जा का लक्ष्य रखा गया है, अतः तीनों कथन सही हैं।
PAGE 1 COMPLETED
Questions Generated: 4
Progress: Page 1 (अंतिम पृष्ठ)
Type NEXT to generate questions from the next page.`,
    expectedType: "statement_based",
    expectedCorrectIndex: 3,
    expectedOptionCount: 4
  },

  // ─────────────────────────────────────────────────────────────
  // 20. MARKDOWN PIPE TABLE SANCTUARY TEST FIXTURE
  // ─────────────────────────────────────────────────────────────
  {
    id: "match-markdown-pipe-sanctuary",
    category: "Match the Following",
    name: "Markdown Pipe Table Sanctuary Matching",
    rawText: `प्रश्न: निम्नलिखित अभयारण्यों को उनके मुख्य वन्यजीव से सुमेलित कीजिए:
| अभयारण्य | मुख्य वन्यजीव |
|---|---|
| 1. ताल छापर अभयारण्य | A. उड़न गिलहरी |
| 2. राष्ट्रीय चम्बल अभयारण्य | B. काला हिरण |
| 3. सरिस्का अभयारण्य | C. घड़ियाल |
| 4. सीतामाता अभयारण्य | D. हरा कबूतर |
A 1-B, 2-C, 3-D, 4-A
B 1-A, 2-B, 3-C, 4-D
C 1-C, 2-D, 3-A, 4-B
D 1-D, 2-A, 3-B, 4-C
Answer: A
Explanation: ताल छापर काला हिरण के लिए, चम्बल घड़ियाल के लिए, सरिस्का हरा कबूतर के लिए और सीतामाता उड़न गिलहरी के लिए प्रसिद्ध है।`,
    expectedType: "match_following",
    expectedCorrectIndex: 0,
    expectedOptionCount: 4,
    verifyFn: (q) => {
      const has4Rows = Boolean(q.matchTable && q.matchTable.rows.length === 4);
      const row1Matches = Boolean(q.matchTable && q.matchTable.rows[0]?.left === "ताल छापर अभयारण्य" && q.matchTable.rows[0]?.right === "उड़न गिलहरी");
      const stemNotEmpty = Boolean(q.question && q.question.trim().length > 0 && q.question.includes("सुमेलित कीजिए"));
      return Boolean(has4Rows && row1Matches && stemNotEmpty);
    }
  },

  // ─────────────────────────────────────────────────────────────
  // 21-40. MATH FIXTURES AND SAFETY EDGE CASES
  // ─────────────────────────────────────────────────────────────
  {
    id: "math-arithmetic-percentage",
    category: "Math - Arithmetic",
    name: "Percentage Calculation Math Question",
    rawText: `Q1. If $25\%$ of a number $x$ is equal to $200$, find the value of $x$:
A. $600$
B. $750$
C. $800$
D. $1000$
Answer: C
Explanation: $\\frac{25}{100} \\times x = 200 \\implies x = 200 \\times 4 = 800$.`,
    expectedType: "simple",
    expectedCorrectIndex: 2,
    expectedOptionCount: 4,
    verifyFn: (q) => Boolean(q.meta?.hasMath && q.meta?.mathType === "arithmetic")
  },
  {
    id: "math-time-work",
    category: "Math - Time & Work",
    name: "Time and Work Efficiency",
    rawText: `Q2. A can complete a work in 10 days and B in 15 days. How many days will they take together?
A. 4 days
B. 5 days
C. 6 days
D. 8 days
Answer: C
Explanation: One day work = $\\frac{1}{10} + \\frac{1}{15} = \\frac{1}{6}$, so 6 days.`,
    expectedType: "simple",
    expectedCorrectIndex: 2,
    expectedOptionCount: 4,
    verifyFn: (q) => Boolean(q.meta?.hasMath && q.meta?.mathType === "time_work")
  },
  {
    id: "math-time-speed-distance",
    category: "Math - Speed & Distance",
    name: "Train Speed and Distance",
    rawText: `Q3. A train running at $72\\text{ km/h}$ crosses a pole in $15\\text{ seconds}$. Find the length of the train:
A. $200\\text{ m}$
B. $250\\text{ m}$
C. $300\\text{ m}$
D. $350\\text{ m}$
Answer: C
Explanation: Speed = $72 \\times \\frac{5}{18} = 20\\text{ m/s}$. Distance = $20 \\times 15 = 300\\text{ m}$.`,
    expectedType: "simple",
    expectedCorrectIndex: 2,
    expectedOptionCount: 4,
    verifyFn: (q) => Boolean(q.meta?.hasMath && q.meta?.mathType === "time_speed_distance")
  },
  {
    id: "math-mixture",
    category: "Math - Mixture",
    name: "Milk and Water Mixture Ratio",
    rawText: `Q4. In a $60\\text{ L}$ mixture, the ratio of milk to water is $2 : 1$. How much water should be added to make it $1 : 2$?
A. $20\\text{ L}$
B. $40\\text{ L}$
C. $60\\text{ L}$
D. $80\\text{ L}$
Answer: C
Explanation: Milk = 40L, Water = 20L. Adding 60L water gives 40L milk and 80L water (ratio 1:2).`,
    expectedType: "simple",
    expectedCorrectIndex: 2,
    expectedOptionCount: 4,
    verifyFn: (q) => Boolean(q.meta?.hasMath && q.meta?.mathType === "mixture")
  },
  {
    id: "math-number-system",
    category: "Math - Number System",
    name: "HCF and LCM Problem",
    rawText: `Q5. Find the HCF of $24$ and $36$:
A. $4$
B. $6$
C. $12$
D. $18$
Answer: C
Explanation: Factors of 24 are 1,2,3,4,6,8,12,24 and 36 are 1,2,3,4,6,9,12,18,36. HCF = 12.`,
    expectedType: "simple",
    expectedCorrectIndex: 2,
    expectedOptionCount: 4,
    verifyFn: (q) => Boolean(q.meta?.hasMath && q.meta?.mathType === "number_system")
  },
  {
    id: "math-simplification",
    category: "Math - Simplification",
    name: "BODMAS and Square Roots",
    rawText: `Q6. Evaluate $\\sqrt{144} + 2^3 \\times 5 - 10$:
A. $38$
B. $42$
C. $46$
D. $50$
Answer: B
Explanation: $\\sqrt{144} = 12$, $2^3 = 8$. $12 + (8 \\times 5) - 10 = 12 + 40 - 10 = 42$.`,
    expectedType: "simple",
    expectedCorrectIndex: 1,
    expectedOptionCount: 4,
    verifyFn: (q) => Boolean(q.meta?.hasMath && q.meta?.mathType === "simplification")
  },
  {
    id: "math-algebra",
    category: "Math - Algebra",
    name: "Quadratic Roots Equation",
    rawText: `Q7. Solve the quadratic equation $x^2 - 5x + 6 = 0$:
A. $x = 1, 6$
B. $x = 2, 3$
C. $x = -2, -3$
D. $x = 0, 5$
Answer: B
Explanation: $(x-2)(x-3) = 0 \\implies x = 2, 3$.`,
    expectedType: "simple",
    expectedCorrectIndex: 1,
    expectedOptionCount: 4,
    verifyFn: (q) => Boolean(q.meta?.hasMath && q.meta?.mathType === "algebra")
  },
  {
    id: "math-geometry",
    category: "Math - Geometry",
    name: "Triangle Angle Sum",
    rawText: `Q8. In $\\triangle ABC$, if $\\angle A = 60^\\circ$ and $\\angle B = 70^\\circ$, find $\\angle C$:
A. $40^\\circ$
B. $50^\\circ$
C. $60^\\circ$
D. $70^\\circ$
Answer: B
Explanation: Sum of angles = $180^\\circ$. $\\angle C = 180^\\circ - (60^\\circ + 70^\\circ) = 50^\\circ$.`,
    expectedType: "simple",
    expectedCorrectIndex: 1,
    expectedOptionCount: 4,
    verifyFn: (q) => Boolean(q.meta?.hasMath && q.meta?.mathType === "geometry")
  },
  {
    id: "math-mensuration",
    category: "Math - Mensuration",
    name: "Cylinder Volume",
    rawText: `Q9. Find the volume of a cylinder with radius $r = 7\\text{ cm}$ and height $h = 10\\text{ cm}$ (use $\\pi = \\frac{22}{7}$):
A. $1200\\text{ cm}^3$
B. $1540\\text{ cm}^3$
C. $1600\\text{ cm}^3$
D. $1800\\text{ cm}^3$
Answer: B
Explanation: $V = \\pi r^2 h = \\frac{22}{7} \\times 49 \\times 10 = 1540\\text{ cm}^3$.`,
    expectedType: "simple",
    expectedCorrectIndex: 1,
    expectedOptionCount: 4,
    verifyFn: (q) => Boolean(q.meta?.hasMath && q.meta?.mathType === "mensuration")
  },
  {
    id: "math-trigonometry",
    category: "Math - Trigonometry",
    name: "Trigonometric Identity",
    rawText: `Q10. What is the value of $\\sin^2\\theta + \\cos^2\\theta$:
A. $0$
B. $1$
C. $2$
D. $\\tan\\theta$
Answer: B
Explanation: Fundamental identity: $\\sin^2\\theta + \\cos^2\\theta = 1$.`,
    expectedType: "simple",
    expectedCorrectIndex: 1,
    expectedOptionCount: 4,
    verifyFn: (q) => Boolean(q.meta?.hasMath && q.meta?.mathType === "trigonometry")
  },
  {
    id: "math-data-interpretation",
    category: "Math - Data Interpretation",
    name: "Data Interpretation Table Render",
    rawText: `Q11. Refer to the data interpretation table below and calculate total production in 2024:
| Year | Production (Tons) |
|---|---|
| 2022 | 100 |
| 2023 | 150 |
| 2024 | 200 |
A. 100
B. 150
C. 200
D. 450
Answer: C
Explanation: The production in year 2024 as per the table is 200 tons.`,
    expectedType: "match_following",
    expectedCorrectIndex: 2,
    expectedOptionCount: 4,
    verifyFn: (q) => Boolean(q.meta?.hasMath && q.meta?.mathType === "data_interpretation")
  },
  {
    id: "math-number-series",
    category: "Math - Number Series",
    name: "Number Series Missing Term",
    rawText: `Q12. Find the missing term in the number series: 2, 6, 12, 20, 30, ?
A. 36
B. 40
C. 42
D. 48
Answer: C
Explanation: Differences are 4, 6, 8, 10, 12. So $30 + 12 = 42$.`,
    expectedType: "simple",
    expectedCorrectIndex: 2,
    expectedOptionCount: 4,
    verifyFn: (q) => Boolean(q.meta?.hasMath && q.meta?.mathType === "number_series")
  },
  {
    id: "math-statistics",
    category: "Math - Statistics",
    name: "Arithmetic Mean",
    rawText: `Q13. Calculate the mean of numbers 10, 20, 30, 40, 50:
A. 25
B. 30
C. 35
D. 40
Answer: B
Explanation: $\\text{Mean} = \\frac{10+20+30+40+50}{5} = \\frac{150}{5} = 30$.`,
    expectedType: "simple",
    expectedCorrectIndex: 1,
    expectedOptionCount: 4,
    verifyFn: (q) => Boolean(q.meta?.hasMath && q.meta?.mathType === "statistics")
  },
  {
    id: "math-probability",
    category: "Math - Probability",
    name: "Dice Probability",
    rawText: `Q14. What is the probability of getting an even number when a fair 6-sided dice is rolled?
A. $\\frac{1}{6}$
B. $\\frac{1}{3}$
C. $\\frac{1}{2}$
D. $\\frac{2}{3}$
Answer: C
Explanation: Even numbers = {2, 4, 6} (3 outcomes out of 6). $P = \\frac{3}{6} = \\frac{1}{2}$.`,
    expectedType: "simple",
    expectedCorrectIndex: 2,
    expectedOptionCount: 4,
    verifyFn: (q) => Boolean(q.meta?.hasMath && q.meta?.mathType === "probability")
  },
  {
    id: "math-permutation-combination",
    category: "Math - Permutations & Combinations",
    name: "Combination Selection Formula",
    rawText: `Q15. In how many ways can 2 students be selected from 5 students ($^5C_2$):
A. 5
B. 10
C. 15
D. 20
Answer: B
Explanation: $^5C_2 = \\frac{5 \\times 4}{2 \\times 1} = 10$.`,
    expectedType: "simple",
    expectedCorrectIndex: 1,
    expectedOptionCount: 4,
    verifyFn: (q) => Boolean(q.meta?.hasMath && q.meta?.mathType === "permutation_combination")
  },
  {
    id: "math-sets-venn",
    category: "Math - Sets & Venn",
    name: "Set Intersection Cardinality",
    rawText: `Q16. If $|A| = 20$, $|B| = 30$, and $|A \\cup B| = 40$, find $|A \\cap B|$:
A. 5
B. 10
C. 15
D. 20
Answer: B
Explanation: $|A \\cup B| = |A| + |B| - |A \\cap B| \\implies 40 = 20 + 30 - x \\implies x = 10$.`,
    expectedType: "simple",
    expectedCorrectIndex: 1,
    expectedOptionCount: 4,
    verifyFn: (q) => Boolean(q.meta?.hasMath && q.meta?.mathType === "sets_venn")
  },
  {
    id: "math-edge-negative-equation",
    category: "Math Safety Edge Case",
    name: "Negative equation starting line (-3x + 2 = 0) is not a bullet",
    rawText: `Q17. Solve the algebraic linear equation:
-3x + 2 = 0
A. x = 2/3
B. x = -2/3
C. x = 3/2
D. x = -3/2
Answer: A
Explanation: $-3x = -2 \\implies x = \\frac{2}{3}$.`,
    expectedType: "simple",
    expectedCorrectIndex: 0,
    expectedOptionCount: 4,
    verifyFn: (q) => {
      const stemNoBullet = !q.question.includes("कथन 1") && q.question.includes("-3x + 2 = 0");
      const optsValid = q.options.length === 4 && q.options[0] === "x = 2/3";
      return Boolean(stemNoBullet && optsValid && q.meta?.hasMath);
    }
  },
  {
    id: "math-edge-absolute-value",
    category: "Math Safety Edge Case",
    name: "Absolute value expression (|x - 3| < 5) is not a pipe table",
    rawText: `Q18. Find the range of $x$ satisfying the absolute value inequality:
|x - 3| < 5
A. -2 < x < 8
B. -5 < x < 5
C. 0 < x < 8
D. -8 < x < 2
Answer: A
Explanation: $-5 < x - 3 < 5 \\implies -2 < x < 8$.`,
    expectedType: "simple",
    expectedCorrectIndex: 0,
    expectedOptionCount: 4,
    verifyFn: (q) => {
      const noTable = !q.matchTable;
      const questionHasAbs = q.question.includes("|x - 3| < 5");
      return Boolean(noTable && questionHasAbs && q.meta?.hasMath);
    }
  },
  {
    id: "math-edge-asterisk-multiplication",
    category: "Math Safety Edge Case",
    name: "Asterisk multiplication (2 * 3) is not a bullet",
    rawText: `Q19. Calculate the product expression:
2 * 3 * 4 = ?
A. 12
B. 18
C. 24
D. 30
Answer: C
Explanation: $2 \\times 3 \\times 4 = 24$.`,
    expectedType: "simple",
    expectedCorrectIndex: 2,
    expectedOptionCount: 4,
    verifyFn: (q) => {
      const stemHasMult = q.question.includes("2 * 3 * 4");
      return Boolean(stemHasMult && q.meta?.hasMath);
    }
  },
  {
    id: "math-edge-indian-commas",
    category: "Math Safety Edge Case",
    name: "Indian commas (1,25,000), decimals (2.5), percent (12.5%), fractions (3/4)",
    rawText: `Q20. A trader earned Rs 1,25,000 in 2.5 months at 12.5% rate. Find 3/4 of the profit:
A. Rs 93,750
B. Rs 1,00,000
C. Rs 80,000
D. Rs 75,000
Answer: A
Explanation: $125000 \\times \\frac{3}{4} = 93750$.`,
    expectedType: "simple",
    expectedCorrectIndex: 0,
    expectedOptionCount: 4,
    verifyFn: (q) => {
      const stemHasCommas = q.question.includes("1,25,000");
      const stemHasDecimals = q.question.includes("2.5");
      const stemHasPercent = q.question.includes("12.5%");
      const stemHasFraction = q.question.includes("3/4");
      return Boolean(stemHasCommas && stemHasDecimals && stemHasPercent && stemHasFraction && q.meta?.hasMath);
    }
  },
  {
    id: "assertion-reason-gangaur",
    category: "Assertion Reason",
    name: "Gangaur Festival Assertion Reason",
    rawText: `Q5. नीचे दो कथन दिए गए हैं, एक को अभिकथन (A) और दूसरे को कारण (R) के रूप में नामांकित किया गया है।
अभिकथन (A) : गणगौर का त्यौहार राजस्थान में सुहागिन महिलाओं द्वारा अत्यंत श्रद्धा के साथ मनाया जाता है।
कारण (R) : यह पर्व चैत्र शुक्ल तृतीया को शिव (ईसर) और पार्वती (गौर) के पूजन के रूप में मनाया जाता है।
उपर्युक्त कथनों के आलोक में, सबसे उपयुक्त उत्तर चुनें :
A (A) और (R) दोनों ही सही हैं और (R), (A) की सही व्याख्या है।
B (A) और (R) दोनों ही सही हैं लेकिन (R), (A) की सही व्याख्या नहीं है।
C (A) सही है लेकिन (R) सही नहीं है।
D (A) सही नहीं है लेकिन (R) सही है।
Answer: A
Explanation: गणगौर का त्यौहार भगवान शिव और माता पार्वती की पूजा को समर्पित है, जो सुहागिन महिलाओं द्वारा अच्छे वर और अखंड सौभाग्य की प्राप्ति के लिए मनाया जाता है।`,
    expectedType: "assertion_reason",
    expectedCorrectIndex: 0,
    expectedOptionCount: 4,
    verifyFn: (q) => {
      return Boolean(
        q.type === "assertion_reason" &&
        q.assertion?.includes("गणगौर") &&
        q.reason?.includes("चैत्र शुक्ल तृतीया")
      );
    }
  }
];
