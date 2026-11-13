import { ParsedQuestionItem } from '../questionParser';

export interface MathTestSample {
  id: string;
  mathType: string;
  description: string;
  rawText: string;
  expectedCorrectIndex: number;
}

export const MATH_FIXTURES: MathTestSample[] = [
  {
    id: "math_arithmetic_1",
    mathType: "arithmetic",
    description: "Percentage profit calculation",
    rawText: `Q1. यदि किसी वस्तु का क्रय मूल्य $₹800$ है और इसे $25\%$ के लाभ पर बेचा जाता है, तो विक्रय मूल्य क्या होगा?
A $₹900$
B $₹1000$
C $₹1050$
D $₹1100$
Answer: B
Explanation: $800 \\times 1.25 = ₹1000$`,
    expectedCorrectIndex: 1
  },
  {
    id: "math_arithmetic_2",
    mathType: "arithmetic",
    description: "Simple interest calculation",
    rawText: `Q2. $₹5000$ का $10\%$ वार्षिक दर से $2$ वर्ष का साधारण ब्याज कितना होगा?
A $₹800$
B $₹1000$
C $₹1200$
D $₹1500$
Answer: B
Explanation: $\\text{SI} = \\frac{5000 \\times 10 \\times 2}{100} = ₹1000$`,
    expectedCorrectIndex: 1
  },
  {
    id: "math_time_work_1",
    mathType: "time_work",
    description: "Combined time and work",
    rawText: `Q1. $A$ किसी कार्य को $10$ दिनों में तथा $B$ उसी कार्य को $15$ दिनों में पूरा कर सकता है। दोनों मिलकर उस कार्य को कितने दिनों में पूरा करेंगे?
A $5$ दिन
B $6$ दिन
C $8$ दिन
D $12$ दिन
Answer: B
Explanation: $\\frac{10 \\times 15}{10 + 15} = 6$ दिन`,
    expectedCorrectIndex: 1
  },
  {
    id: "math_time_work_2",
    mathType: "time_work",
    description: "Pipes and cisterns",
    rawText: `Q2. एक नल किसी टंकी को $4$ घंटे में भर सकता है। टंकी में पानी भरने की दर क्या है?
A $1/4$ भाग प्रति घंटा
B $1/2$ भाग प्रति घंटा
C $3/4$ भाग प्रति घंटा
D $1$ भाग प्रति घंटा
Answer: A
Explanation: $1$ घंटे में $1/4$ भाग भरेगा।`,
    expectedCorrectIndex: 0
  },
  {
    id: "math_time_speed_distance_1",
    mathType: "time_speed_distance",
    description: "Distance from speed and time",
    rawText: `Q1. एक कार $60\\text{ km/h}$ की गति से $3$ घंटे में कितनी दूरी तय करेगी?
A $120\\text{ km}$
B $150\\text{ km}$
C $180\\text{ km}$
D $200\\text{ km}$
Answer: C
Explanation: $60 \\times 3 = 180\\text{ km}$`,
    expectedCorrectIndex: 2
  },
  {
    id: "math_time_speed_distance_2",
    mathType: "time_speed_distance",
    description: "Train crossing speed",
    rawText: `Q2. $100\\text{ m}$ लंबी रेलगाड़ी $36\\text{ km/h}$ की चाल से खंभे को कितने समय में पार करेगी?
A $5\\text{ sec}$
B $10\\text{ sec}$
C $15\\text{ sec}$
D $20\\text{ sec}$
Answer: B
Explanation: $36 \\times \\frac{5}{18} = 10\\text{ m/s}$। समय $= \\frac{100}{10} = 10\\text{ sec}$।`,
    expectedCorrectIndex: 1
  },
  {
    id: "math_mixture_1",
    mathType: "mixture",
    description: "Ratio of mixture",
    rawText: `Q1. $40\\text{ लीटर}$ मिश्रण में दूध और पानी का अनुपात $3 : 1$ है। मिश्रण में पानी की मात्रा कितनी है?
A $10\\text{ लीटर}$
B $20\\text{ लीटर}$
C $30\\text{ लीटर}$
D $5\\text{ लीटर}$
Answer: A
Explanation: $40 \\times \\frac{1}{4} = 10\\text{ लीटर}$`,
    expectedCorrectIndex: 0
  },
  {
    id: "math_number_system_1",
    mathType: "number_system",
    description: "HCF calculation",
    rawText: `Q1. $12$ और $18$ का महत्तम समापवर्तक (HCF) क्या होगा?
A $2$
B $3$
C $6$
D $36$
Answer: C
Explanation: $\\text{HCF}(12, 18) = 6$`,
    expectedCorrectIndex: 2
  },
  {
    id: "math_number_system_2",
    mathType: "number_system",
    description: "Divisibility rule",
    rawText: `Q2. निम्नलिखित में से कौन-सी संख्या $3$ से पूर्णतः विभाजित है?
A $124$
B $125$
C $126$
D $127$
Answer: C
Explanation: $1 + 2 + 6 = 9$ (जो $3$ से विभाज्य है)।`,
    expectedCorrectIndex: 2
  },
  {
    id: "math_simplification_1",
    mathType: "simplification",
    description: "Square root and exponent simplification",
    rawText: `Q1. व्यंजक $\\sqrt{16} + 3^2 \\times 2$ का मान ज्ञात कीजिए।
A $20$
B $22$
C $24$
D $14$
Answer: B
Explanation: $4 + 9 \\times 2 = 22$`,
    expectedCorrectIndex: 1
  },
  {
    id: "math_simplification_2",
    mathType: "simplification",
    description: "BODMAS fraction calculation",
    rawText: `Q2. $\\frac{3}{4} + \\frac{1}{2}$ का मान क्या होगा?
A $1/4$
B $3/8$
C $5/4$
D $7/4$
Answer: C
Explanation: $\\frac{3}{4} + \\frac{2}{4} = \\frac{5}{4}$`,
    expectedCorrectIndex: 2
  },
  {
    id: "math_algebra_1",
    mathType: "algebra",
    description: "Linear system of equations",
    rawText: `Q1. यदि $x + y = 10$ और $x - y = 4$ है, तो $x$ का मान क्या होगा?
A $5$
B $6$
C $7$
D $8$
Answer: C
Explanation: $2x = 14 \\implies x = 7$`,
    expectedCorrectIndex: 2
  },
  {
    id: "math_algebra_2",
    mathType: "algebra",
    description: "Quadratic roots",
    rawText: `Q2. द्विघात समीकरण $x^2 - 5x + 6 = 0$ के मूल क्या होंगे?
A $1, 6$
B $2, 3$
C $-2, -3$
D $0, 5$
Answer: B
Explanation: $(x-2)(x-3) = 0 \\implies x = 2, 3$`,
    expectedCorrectIndex: 1
  },
  {
    id: "math_geometry_1",
    mathType: "geometry",
    description: "Right angle triangle hypotenuse",
    rawText: `Q1. एक समकोण त्रिभुज में आधार $3\\text{ cm}$ और लम्ब $4\\text{ cm}$ है। इसके कर्ण की लम्बाई ज्ञात कीजिए।
A $5\\text{ cm}$
B $6\\text{ cm}$
C $7\\text{ cm}$
D $8\\text{ cm}$
Answer: A
Explanation: $\\sqrt{3^2 + 4^2} = 5\\text{ cm}$`,
    expectedCorrectIndex: 0
  },
  {
    id: "math_geometry_2",
    mathType: "geometry",
    description: "Circle radius and diameter",
    rawText: `Q2. वृत्त के व्यास और त्रिज्या का संबंध क्या है?
A $\\text{व्यास} = \\text{त्रिज्या}$
B $\\text{व्यास} = 2 \\times \\text{त्रिज्या}$
C $\\text{व्यास} = \\frac{\\text{त्रिज्या}}{2}$
D $\\text{व्यास} = 4 \\times \\text{त्रिज्या}$
Answer: B
Explanation: $d = 2r$`,
    expectedCorrectIndex: 1
  },
  {
    id: "math_mensuration_1",
    mathType: "mensuration",
    description: "Circle area calculation",
    rawText: `Q1. एक वृत्त की त्रिज्या $7\\text{ cm}$ है। वृत्त का क्षेत्रफल ज्ञात कीजिए। ($\\pi = \\frac{22}{7}$)
A $144\\text{ cm}^2$
B $154\\text{ cm}^2$
C $164\\text{ cm}^2$
D $176\\text{ cm}^2$
Answer: B
Explanation: $\\pi r^2 = \\frac{22}{7} \\times 49 = 154\\text{ cm}^2$`,
    expectedCorrectIndex: 1
  },
  {
    id: "math_mensuration_2",
    mathType: "mensuration",
    description: "Cube volume",
    rawText: `Q2. $4\\text{ cm}$ भुजा वाले घन का आयतन कितना होगा?
A $16\\text{ cm}^3$
B $32\\text{ cm}^3$
C $64\\text{ cm}^3$
D $128\\text{ cm}^3$
Answer: C
Explanation: $V = a^3 = 4^3 = 64\\text{ cm}^3$`,
    expectedCorrectIndex: 2
  },
  {
    id: "math_trigonometry_1",
    mathType: "trigonometry",
    description: "Sin and cos identity",
    rawText: `Q1. यदि $\\sin\\theta = \\frac{3}{5}$ है, तो $\\cos\\theta$ का मान क्या होगा?
A $\\frac{4}{5}$
B $\\frac{3}{4}$
C $\\frac{5}{4}$
D $\\frac{1}{2}$
Answer: A
Explanation: $\\cos\\theta = \\sqrt{1 - 9/25} = 4/5$`,
    expectedCorrectIndex: 0
  },
  {
    id: "math_trigonometry_2",
    mathType: "trigonometry",
    description: "Tan 45 degrees",
    rawText: `Q2. $\\tan 45^\\circ$ का मान क्या होता है?
A $0$
B $1/2$
C $1$
D $\\sqrt{3}$
Answer: C
Explanation: $\\tan 45^\\circ = 1$`,
    expectedCorrectIndex: 2
  },
  {
    id: "math_data_interpretation_1",
    mathType: "data_interpretation",
    description: "Table percentage increase",
    rawText: `Q1. नीचे दी गई सारणी में दो वर्षों के गेहूं उत्पादन के आंकड़े दर्शाये गए हैं।
| वर्ष | उत्पादन (टन में) |
|---|---|
| 2021 | 100 |
| 2022 | 150 |
वर्ष 2021 की तुलना में वर्ष 2022 में उत्पादन में कितने प्रतिशत की वृद्धि हुई?
A $25\\%$
B $50\\%$
C $75\\%$
D $100\\%$
Answer: B
Explanation: $\\frac{150-100}{100} \\times 100\\% = 50\\%$`,
    expectedCorrectIndex: 1
  },
  {
    id: "math_number_series_1",
    mathType: "number_series",
    description: "Geometric sequence next term",
    rawText: `Q1. दी गई श्रृंखला में लुप्त पद ज्ञात कीजिए: $2, 4, 8, 16, ?$
A $24$
B $30$
C $32$
D $64$
Answer: C
Explanation: $16 \\times 2 = 32$`,
    expectedCorrectIndex: 2
  },
  {
    id: "math_statistics_1",
    mathType: "statistics",
    description: "Mean calculation",
    rawText: `Q1. आंकड़ों $2, 4, 6, 8, 10$ का समांतर माध्य क्या होगा?
A $5$
B $6$
C $7$
D $8$
Answer: B
Explanation: $\\frac{30}{5} = 6$`,
    expectedCorrectIndex: 1
  },
  {
    id: "math_probability_1",
    mathType: "probability",
    description: "Dice probability",
    rawText: `Q1. एक निष्पक्ष पासे को फेंकने पर सम संख्या आने की प्रायिकता क्या है?
A $\\frac{1}{6}$
B $\\frac{1}{3}$
C $\\frac{1}{2}$
D $\\frac{2}{3}$
Answer: C
Explanation: $3/6 = 1/2$`,
    expectedCorrectIndex: 2
  },
  {
    id: "math_permutation_combination_1",
    mathType: "permutation_combination",
    description: "Factorial arrangement",
    rawText: `Q1. $5$ व्यक्तियों को एक पंक्ति में कितने प्रकार से व्यवस्थित किया जा सकता है?
A $60$
B $120$
C $24$
D $720$
Answer: B
Explanation: $5! = 120$`,
    expectedCorrectIndex: 1
  },
  {
    id: "math_sets_venn_1",
    mathType: "sets_venn",
    description: "Set intersection",
    rawText: `Q1. यदि समुच्चय $A = \\{1, 2, 3\\}$ और $B = \\{3, 4, 5\\}$ है, तो $A \\cap B$ का मान क्या होगा?
A $\\{1, 2\\}$
B $\\{3\\}$
C $\\{4, 5\\}$
D $\\{1, 2, 3, 4, 5\\}$
Answer: B
Explanation: $A \\cap B = \\{3\\}$`,
    expectedCorrectIndex: 1
  },

  // ── SPECIFIC EDGE CASES REQUIRED BY PROMPT ──
  {
    id: "edge_case_negative_equation",
    mathType: "algebra",
    description: "Starting negative equation -3x + 2 = 0 must NOT be treated as a bullet",
    rawText: `Q1. समीकरण हल कीजिए:
-3x + 2 = 0
x का मान क्या होगा?
A $2/3$
B $-2/3$
C $3/2$
D $1$
Answer: A
Explanation: $-3x = -2 \\implies x = 2/3$`,
    expectedCorrectIndex: 0
  },
  {
    id: "edge_case_absolute_value_not_table",
    mathType: "algebra",
    description: "Single line with absolute value |x - 3| < 5 must NOT be treated as a pipe table",
    rawText: `Q1. असमिका |x - 3| < 5 का हल समुच्चय क्या होगा?
A $-2 < x < 8$
B $x > 8$
C $x < -2$
D $2 < x < 5$
Answer: A
Explanation: $-5 < x - 3 < 5 \\implies -2 < x < 8$`,
    expectedCorrectIndex: 0
  },
  {
    id: "edge_case_star_operator",
    mathType: "simplification",
    description: "Equation with 2 * 3 must NOT be treated as a bullet",
    rawText: `Q1. 2 * 3 + 4 का मान ज्ञात कीजिए:
A $8$
B $10$
C $12$
D $14$
Answer: B
Explanation: $2 \\times 3 + 4 = 6 + 4 = 10$`,
    expectedCorrectIndex: 1
  },
  {
    id: "edge_case_indian_comma",
    mathType: "arithmetic",
    description: "Indian comma number 1,25,000 must NOT be split",
    rawText: `Q1. एक व्यक्ति का वार्षिक वेतन $₹1,25,000$ है। इसका मासिक वेतन क्या होगा?
A $₹10,416.67$
B $₹12,500$
C $₹15,000$
D $₹20,000$
Answer: A
Explanation: $1,25,000 / 12 = 10,416.67$`,
    expectedCorrectIndex: 0
  }
];
