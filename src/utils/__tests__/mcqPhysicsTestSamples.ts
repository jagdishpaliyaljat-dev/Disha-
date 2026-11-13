
export const MCQ_PHYSICS_TEST_SAMPLES = [
  {
    id: "phys_kinematics_1",
    description: "Average speed calculation",
    rawText: `Q1. एक कार 60 km/h की गति से 2 घंटे और फिर 40 km/h की गति से 3 घंटे चलती है। कार की औसत गति क्या है?
A 45 km/h
B 48 km/h
C 50 km/h
D 52 km/h
Answer: B
Explanation: कुल दूरी = (60 \times 2) + (40 \times 3) = 120 + 120 = 240 km। कुल समय = 2 + 3 = 5 घंटे। औसत गति = 240 / 5 = 48 km/h।`,
    mathType: "physics",
    physicsTopic: "kinematics",
    hasUnits: true,
    isNegative: false,
    correctIndex: 1
  },
  {
    id: "phys_laws_motion_1",
    description: "Newton's second law",
    rawText: `Q1. 5 kg द्रव्यमान की वस्तु पर 20 N का बल लगाने पर उत्पन्न त्वरण कितना होगा?
A 2 m/s²
B 4 m/s²
C 5 m/s²
D 10 m/s²
Answer: B
Explanation: F = ma \implies a = F / m = 20 / 5 = 4 m/s²।`,
    mathType: "physics",
    physicsTopic: "laws_of_motion",
    hasUnits: true,
    isNegative: false,
    correctIndex: 1
  },
  {
    id: "phys_work_energy_1",
    description: "Kinetic energy",
    rawText: `Q1. 2 kg द्रव्यमान की एक वस्तु 10 m/s के वेग से चल रही है। इसकी गतिज ऊर्जा कितनी होगी?
A 50 J
B 100 J
C 150 J
D 200 J
Answer: B
Explanation: K.E. = \frac{1}{2}mv^2 = \frac{1}{2} \times 2 \times 10^2 = 100 J।`,
    mathType: "physics",
    physicsTopic: "work_energy_power",
    hasUnits: true,
    isNegative: false,
    correctIndex: 1
  },
  {
    id: "phys_gravitation_1",
    description: "Acceleration due to gravity on moon",
    rawText: `Q1. यदि पृथ्वी पर g = 9.8 m/s² है, तो चंद्रमा पर g का मान लगभग कितना होगा?
(g_{moon} \approx \frac{1}{6} g_{earth})
A 1.6 m/s²
B 4.9 m/s²
C 9.8 m/s²
D 0 m/s²
Answer: A
Explanation: चंद्रमा पर गुरुत्वीय त्वरण पृथ्वी का लगभग 1/6 होता है। 9.8 / 6 \approx 1.63 m/s²।`,
    mathType: "physics",
    physicsTopic: "gravitation",
    hasUnits: true,
    isNegative: false,
    correctIndex: 0
  },
  {
    id: "phys_properties_matter_1",
    description: "Density calculation",
    rawText: `Q1. 500 g द्रव्यमान वाली वस्तु का आयतन 200 cm³ है। इसका घनत्व क्या होगा?
A 2.5 g/cm³
B 0.4 g/cm³
C 1.5 g/cm³
D 5 g/cm³
Answer: A
Explanation: घनत्व = द्रव्यमान / आयतन = 500 / 200 = 2.5 g/cm³।`,
    mathType: "physics",
    physicsTopic: "properties_of_matter",
    hasUnits: true,
    isNegative: false,
    correctIndex: 0
  },
  {
    id: "phys_heat_1",
    description: "Specific heat capacity unit",
    rawText: `Q1. विशिष्ट ऊष्मा धारिता (Specific heat capacity) की SI इकाई क्या है?
A J/kg
B J/kg·K
C J/K
D cal/g
Answer: B
Explanation: SI इकाई J/kg·K है।`,
    mathType: "physics",
    physicsTopic: "heat_thermodynamics",
    hasUnits: true,
    isNegative: false,
    correctIndex: 1
  },
  {
    id: "phys_waves_1",
    description: "Sound wave frequency",
    rawText: `Q1. पराश्रव्य तरंगों (Ultrasonic waves) की आवृत्ति कितनी होती है?
A 20 Hz से कम
B 20 Hz से 20,000 Hz के बीच
C 20,000 Hz से अधिक
D 100 Hz
Answer: C
Explanation: पराश्रव्य तरंगों की आवृत्ति 20 kHz (20,000 Hz) से अधिक होती है।`,
    mathType: "physics",
    physicsTopic: "waves_sound",
    hasUnits: true,
    isNegative: false,
    correctIndex: 2
  },
  {
    id: "phys_optics_1",
    description: "Refractive index",
    rawText: `Q1. प्रकाश की चाल निर्वात में 3 \times 10^8 m/s है। यदि कांच का अपवर्तनांक 1.5 है, तो कांच में प्रकाश की चाल क्या होगी?
A 2 \times 10^8 m/s
B 3 \times 10^8 m/s
C 4.5 \times 10^8 m/s
D 1.5 \times 10^8 m/s
Answer: A
Explanation: v = c / n = (3 \times 10^8) / 1.5 = 2 \times 10^8 m/s।`,
    mathType: "physics",
    physicsTopic: "optics",
    hasUnits: true,
    isNegative: false,
    correctIndex: 0
  },
  {
    id: "phys_electricity_1",
    description: "Ohm's Law",
    rawText: `Q1. एक चालक का प्रतिरोध 10 \Omega है। यदि इसमें 2 A की धारा प्रवाहित हो रही है, तो इसके सिरों के बीच विभवांतर (Potential difference) क्या होगा?
A 5 V
B 12 V
C 20 V
D 2 V
Answer: C
Explanation: V = IR = 2 \times 10 = 20 V।`,
    mathType: "physics",
    physicsTopic: "electricity",
    hasUnits: true,
    isNegative: false,
    correctIndex: 2
  },
  {
    id: "phys_magnetism_1",
    description: "Magnetic field unit",
    rawText: `Q1. चुंबकीय क्षेत्र की तीव्रता (Magnetic field intensity) की SI इकाई क्या है?
A वेबर (Wb)
B टेस्ला (T)
C हेनरी (H)
D फैराड (F)
Answer: B
Explanation: चुंबकीय क्षेत्र की SI इकाई टेस्ला (T) है।`,
    mathType: "physics",
    physicsTopic: "magnetism_emi",
    hasUnits: true,
    isNegative: false,
    correctIndex: 1
  },
  {
    id: "phys_modern_1",
    description: "Photoelectric effect",
    rawText: `Q1. प्रकाश विद्युत प्रभाव (Photoelectric effect) की व्याख्या किसने की थी?
A आइंस्टीन (Einstein)
B न्यूटन (Newton)
C मैक्सवेल (Maxwell)
D हर्ट्ज़ (Hertz)
Answer: A
Explanation: आइंस्टीन ने 1905 में इसकी व्याख्या की थी।`,
    mathType: "physics",
    physicsTopic: "modern_physics",
    hasUnits: false,
    isNegative: false,
    correctIndex: 0
  },
  {
    id: "phys_units_1",
    description: "Dimension of Force",
    rawText: `Q1. बल (Force) का विमीय सूत्र (Dimensions) क्या है?
A [M L T⁻¹]
B [M L T⁻²]
C [M L² T⁻²]
D [M L⁻¹ T⁻²]
Answer: B
Explanation: F = ma \implies [M] [L T⁻²] = [M L T⁻²]।`,
    mathType: "physics",
    physicsTopic: "units_dimensions",
    hasUnits: false,
    isNegative: false,
    correctIndex: 1
  },
  {
    id: "phys_neg_1",
    description: "Negative physics question",
    rawText: `Q1. निम्नलिखित में से कौन सा कथन सही नहीं है?
A प्रकाश एक अनुप्रस्थ तरंग है।
B ध्वनि निर्वात में यात्रा कर सकती है।
C प्रकाश की चाल निर्वात में अधिकतम होती है।
D ध्वनि एक अनुदैर्ध्य तरंग है।
Answer: B
Explanation: ध्वनि को यात्रा करने के लिए माध्यम की आवश्यकता होती है, यह निर्वात में यात्रा नहीं कर सकती।`,
    mathType: "physics",
    physicsTopic: "waves_sound",
    hasUnits: false,
    isNegative: true,
    correctIndex: 1
  },
  {
    id: "phys_const_1",
    description: "Constant in bracket safety",
    rawText: `Q1. एक पत्थर को 100 m की ऊंचाई से गिराया जाता है। इसे जमीन पर पहुँचने में कितना समय लगेगा?
(g = 10 m/s^2)
A 2.5 s
B 4.47 s
C 10 s
D 5 s
Answer: B
Explanation: h = \frac{1}{2}gt^2 \implies 100 = \frac{1}{2} \times 10 \times t^2 \implies t^2 = 20 \implies t \approx 4.47 s।`,
    mathType: "physics",
    physicsTopic: "gravitation",
    hasUnits: true,
    isNegative: false,
    correctIndex: 1
  },
  {
    id: "phys_exponent_1",
    description: "Negative exponent bullet safety",
    rawText: `Q1. इलेक्ट्रॉन का आवेश (Charge of electron) कितना होता है?
A 1.6 \times 10^{-19} C
B -1.6 \times 10^{-19} C
C 9.1 \times 10^{-31} C
D 1.6 \times 10^{19} C
Answer: B
Explanation: इलेक्ट्रॉन पर ऋण आवेश होता है जिसका परिमाण 1.6 \times 10^{-19} कूलम्ब है।`,
    mathType: "physics",
    physicsTopic: "modern_physics",
    hasUnits: true,
    isNegative: false,
    correctIndex: 1
  },
  {
    id: "phys_ratio_1",
    description: "Resistance ratio",
    rawText: `Q1. यदि वोल्टेज V और धारा I का अनुपात स्थिर रहता है, तो इसे क्या कहते हैं?
A आवेश
B प्रतिरोध
C चालकता
D विभव
Answer: B
Explanation: V : I = R (प्रतिरोध)। यह ओम का नियम है।`,
    mathType: "physics",
    physicsTopic: "electricity",
    hasUnits: false,
    isNegative: false,
    correctIndex: 1
  },
  {
    id: "phys_diagram_1",
    description: "Diagram placeholder parsing",
    rawText: `Q1. नीचे दिए गए परिपथ (Circuit) में कुल प्रतिरोध क्या होगा?
[image: series_circuit_3_resistors]
A 5 \Omega
B 10 \Omega
C 15 \Omega
D 20 \Omega
Answer: C
Explanation: श्रेणीक्रम में कुल प्रतिरोध R = R1 + R2 + R3 होता है।`,
    mathType: "physics",
    physicsTopic: "electricity",
    hasUnits: true,
    isNegative: false,
    correctIndex: 2
  },
  {
    id: "phys_scientist_1",
    description: "Instruments and scientists",
    rawText: `Q1. टेलीस्कोप का आविष्कार किसने किया था?
A गैलीलियो (Galileo)
B न्यूटन (Newton)
C आइंस्टीन (Einstein)
D फैराडे (Faraday)
Answer: A
Explanation: गैलीलियो ने सबसे पहले खगोलीय टेलीस्कोप का उपयोग किया था।`,
    mathType: "physics",
    physicsTopic: "instruments_scientists",
    hasUnits: false,
    isNegative: false,
    correctIndex: 0
  },
  {
    id: "phys_app_1",
    description: "Everyday applications",
    rawText: `Q1. हीरा (Diamond) क्यों चमकता है?
A पूर्ण आंतरिक परावर्तन (TIR) के कारण
B परावर्तन के कारण
C अपवर्तन के कारण
D विवर्तन के कारण
Answer: A
Explanation: हीरे की चमक का मुख्य कारण प्रकाश का पूर्ण आंतरिक परावर्तन है।`,
    mathType: "physics",
    physicsTopic: "everyday_applications",
    hasUnits: false,
    isNegative: false,
    correctIndex: 0
  },
  {
    id: "phys_match_1",
    description: "Match quantity and unit",
    rawText: `Q1. सूची-I को सूची-II से सुमेलित कीजिए:
सूची-I (राशि) | सूची-II (इकाई)
1. बल | i. जूल
2. ऊर्जा | ii. वाट
3. शक्ति | iii. पास्कल
4. दाब | iv. न्यूटन
A 1-iv, 2-i, 3-ii, 4-iii
B 1-i, 2-ii, 3-iii, 4-iv
C 1-iv, 2-ii, 3-i, 4-iii
D 1-iii, 2-i, 3-ii, 4-iv
Answer: A
Explanation: बल-न्यूटन, ऊर्जा-जूल, शक्ति-वाट, दाब-पास्कल।`,
    mathType: "physics",
    physicsTopic: "units_dimensions",
    hasUnits: false,
    isNegative: false,
    correctIndex: 0
  },
  {
    id: "phys_assertion_1",
    description: "Assertion Reason Physics",
    rawText: `Q1. अभिकथन (A): जब हम बस में अचानक ब्रेक लगाते हैं, तो हम आगे की ओर झुक जाते हैं।
कारण (R): यह विराम के जड़त्व (Inertia of rest) के कारण होता है।
A A और R दोनों सही हैं और R, A की सही व्याख्या है।
B A और R दोनों सही हैं लेकिन R, A की सही व्याख्या नहीं है।
C A सही है लेकिन R गलत है।
D A गलत है लेकिन R सही है।
Answer: C
Explanation: यह गति के जड़त्व (Inertia of motion) के कारण होता है, विराम के जड़त्व के कारण नहीं।`,
    mathType: "physics",
    physicsTopic: "laws_of_motion",
    hasUnits: false,
    isNegative: false,
    correctIndex: 2
  },
  {
    id: "phys_rotation_1",
    description: "Moment of inertia of sphere",
    rawText: `Q1. एक ठोस गोले (Solid sphere) का उसके व्यास के परितः जड़त्व आघूर्ण (Moment of inertia) क्या होगा?
A \frac{2}{5} MR^2
B \frac{2}{3} MR^2
C \frac{1}{2} MR^2
D MR^2
Answer: A
Explanation: ठोस गोले का I = \frac{2}{5} MR^2 होता है।`,
    mathType: "physics",
    physicsTopic: "rotation_shm",
    hasUnits: false,
    isNegative: false,
    correctIndex: 0
  },
  {
    id: "phys_vectors_1",
    description: "Vector dot product",
    rawText: `Q1. यदि \vec{A} = 2\hat{i} + 3\hat{j} और \vec{B} = \hat{i} - \hat{j} है, तो \vec{A} \cdot \vec{B} का मान क्या होगा?
A 1
B -1
C 5
D 0
Answer: B
Explanation: \vec{A} \cdot \vec{B} = (2 \times 1) + (3 \times -1) = 2 - 3 = -1।`,
    mathType: "physics",
    physicsTopic: "units_dimensions",
    hasUnits: false,
    isNegative: false,
    correctIndex: 1
  },
  {
    id: "phys_modern_2",
    description: "Radioactivity half life",
    rawText: `Q1. एक रेडियोधर्मी पदार्थ की अर्द्ध-आयु (Half-life) 10 दिन है। 20 दिनों के बाद कितना अंश शेष बचेगा?
A 1/2
B 1/4
C 1/8
D 3/4
Answer: B
Explanation: 2 अर्द्ध-आयु के बाद शेष अंश = (1/2)^2 = 1/4।`,
    mathType: "physics",
    physicsTopic: "modern_physics",
    hasUnits: true,
    isNegative: false,
    correctIndex: 1
  },
  {
    id: "phys_greek_1",
    description: "Greek letters in physics",
    rawText: `Q1. तरंगदैर्ध्य (Wavelength) को आमतौर पर किस ग्रीक अक्षर से दर्शाया जाता है?
A \mu
B \lambda
C \omega
D \rho
Answer: B
Explanation: तरंगदैर्ध्य को \lambda (Lambda) से दर्शाया जाता है।`,
    mathType: "physics",
    physicsTopic: "waves_sound",
    hasUnits: false,
    isNegative: false,
    correctIndex: 1
  }
];
