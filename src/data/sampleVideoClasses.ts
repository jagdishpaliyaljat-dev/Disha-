import { Subject, Chapter } from "../types";

export const SAMPLE_VIDEO_SUBJECTS: Subject[] = [
  {
    id: "sub_demo_hist",
    name: "Rajasthan History",
    hindiName: "राजस्थान का इतिहास",
    color: "rose",
    description: "1857 की क्रांति, प्रजामंडल, किसान आंदोलन एवं राजस्थान का एकीकरण",
    order: 1,
  },
  {
    id: "sub_demo_geo",
    name: "Rajasthan Geography",
    hindiName: "राजस्थान का भूगोल",
    color: "emerald",
    description: "भौतिक प्रदेश, अरावली पर्वतमाला, अपवाह तंत्र एवं खनिज संपदा",
    order: 2,
  },
  {
    id: "sub_demo_culture",
    name: "Art & Culture",
    hindiName: "कला एवं संस्कृति",
    color: "amber",
    description: "प्रमुख दुर्ग, स्थापत्य कला, लोक देवता, मेले एवं त्योहार",
    order: 3,
  },
];

export const SAMPLE_VIDEO_CHAPTERS: Chapter[] = [
  // ==========================================
  // SUBJECT 1: RAJASTHAN HISTORY
  // ==========================================
  {
    id: "chap_demo_1857",
    subjectId: "sub_demo_hist",
    number: 1,
    title: "1857 Revolt in Rajasthan",
    hindiTitle: "1857 की क्रांति एवं राजस्थान",
    isPublished: true,
    topics: [
      {
        id: "top_demo_nasirabad",
        chapterId: "chap_demo_1857",
        subjectId: "sub_demo_hist",
        number: 1,
        title: "Revolt in Nasirabad and Neemuch",
        hindiTitle: "नसीराबाद और नीमच छावनी में विद्रोह",
        videoUrl: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
        videoDuration: "24:15 min",
        videoTitle: "1857 क्रांति: नसीराबाद एवं नीमच विद्रोह (RPSC विशेष व्याख्यान)",
        pdfUrl: "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/preview",
        pdfTitle: "1857 क्रांति हस्तलिखित नोट्स - भाग 1",
        guideSummary: `• 28 मई 1857 को नसीराबाद छावनी में 15वीं बंगाल नेटिव इन्फैंट्री द्वारा राजस्थान में क्रांति की शुरुआत हुई।
• न्यूबरी और मेजर स्पोटिसवुड अंग्रेज अधिकारी मारे गए।
• 3 जून 1857 को नीमच छावनी में मोहम्मद अली बेग और हीरा सिंह के नेतृत्व में विद्रोह हुआ।
• डूंगला गाँव में रुघाराम जाट ने अंग्रेज परिवारों को शरण दी, जिन्हें बाद में मेवाड़ महाराणा स्वरूप सिंह ने जगमंदिर में ठहराया।`,
        questions: [
          {
            id: "q_demo_1",
            question: "राजस्थान में 1857 के विप्लव का प्रथम विद्रोह कहाँ हुआ था?",
            hindiQuestion: "राजस्थान में 1857 के विप्लव का प्रथम विद्रोह कहाँ हुआ था?",
            options: ["कोटा", "नसीराबाद", "आउवा", "नीमच", "अनुत्तरित प्रश्न"],
            correctOption: 1,
            explanation: "राजस्थान में 1857 की क्रांति का प्रारंभ 28 मई 1857 को नसीराबाद छावनी से हुआ था।",
          } as any,
          {
            id: "q_demo_2",
            question: "नीमच छावनी में 1857 की क्रांति भड़कने की सही तिथि क्या थी?",
            hindiQuestion: "नीमच छावनी में 1857 की क्रांति भड़कने की सही तिथि क्या थी?",
            options: ["28 मई 1857", "31 मई 1857", "3 जून 1857", "21 अगस्त 1857", "अनुत्तरित प्रश्न"],
            correctOption: 2,
            explanation: "नीमच में 3 जून 1857 को मोहम्मद अली बेग के नेतृत्व में सैनिकों ने विद्रोह का बिगुल फूँका।",
          } as any,
        ],
      },
      {
        id: "top_demo_auwa",
        chapterId: "chap_demo_1857",
        subjectId: "sub_demo_hist",
        number: 2,
        title: "Auwa Revolt and Thakur Kushal Singh",
        hindiTitle: "आउवा का विद्रोह एवं ठाकुर कुशाल सिंह",
        videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        videoDuration: "19:40 min",
        videoTitle: "आउवा विद्रोह, बिथोड़ा एवं चेलावास का युद्ध",
        pdfUrl: "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/preview",
        pdfTitle: "आउवा विद्रोह एवं युद्ध इतिहास नोट्स",
        guideSummary: `• बिथोड़ा का युद्ध (8 सितम्बर 1857): ठाकुर कुशाल सिंह ने जोधपुर राज्य की सेना व कैप्टन हीथकोट को पराजित किया।
• चेलावास का युद्ध (18 सितम्बर 1857): इसे 'काले और गोरों का युद्ध' कहा जाता है। पॉलिटिकल एजेंट मॉक मेसन का सिर काटकर आउवा किले के मुख्य दरवाजे पर लटकाया गया।
• सुगाली माता: 10 सिर और 54 हाथों वाली देवी, जो 1857 के क्रांतिकारियों की आराध्य देवी थीं।`,
        questions: [
          {
            id: "q_demo_3",
            question: "चेलावास का युद्ध (काले-गोरों का युद्ध) कब लड़ा गया था?",
            hindiQuestion: "चेलावास का युद्ध (काले-गोरों का युद्ध) कब लड़ा गया था?",
            options: ["8 सितम्बर 1857", "18 सितम्बर 1857", "10 अक्टूबर 1857", "24 मई 1857", "अनुत्तरित प्रश्न"],
            correctOption: 1,
            explanation: "18 सितम्बर 1857 को चेलावास का युद्ध लड़ा गया जिसमें ए.जी.जी. जॉर्ज लॉरेंस की पराजय हुई।",
          } as any,
        ],
      },
    ],
  },
  {
    id: "chap_demo_prajamandal",
    subjectId: "sub_demo_hist",
    number: 2,
    title: "Prajamandal Movements",
    hindiTitle: "राजस्थान के प्रजामंडल आंदोलन",
    isPublished: true,
    topics: [
      {
        id: "top_demo_mewar_praj",
        chapterId: "chap_demo_prajamandal",
        subjectId: "sub_demo_hist",
        number: 1,
        title: "Mewar Prajamandal",
        hindiTitle: "मेवाड़ प्रजामंडल (माणिक्यलाल वर्मा)",
        videoUrl: "https://www.youtube.com/watch?v=fJ9rUzIMcZQ",
        videoDuration: "22:10 min",
        videoTitle: "मेवाड़ प्रजामंडल: स्थापना, अधिवेशन एवं संघर्ष",
        pdfUrl: "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/preview",
        pdfTitle: "मेवाड़ प्रजामंडल हस्तलिखित क्लास नोट्स",
        guideSummary: `• 24 अप्रैल 1938 को उदयपुर में बलवंत सिंह मेहता की अध्यक्षता में मेवाड़ प्रजामंडल की स्थापना हुई।
• माणिक्यलाल वर्मा इसके मुख्य महामंत्री और सूत्रधार थे।
• नवंबर 1941 में मेवाड़ प्रजामंडल का प्रथम अधिवेशन जे.बी. कृपलानी और विजयलक्ष्मी पंडित की उपस्थिति में हुआ।
• माणिक्यलाल वर्मा ने 'पंछीड़ा' गीत गाकर किसानों और जनमानस में राष्ट्रीय चेतना जगाई।`,
        questions: [
          {
            id: "q_demo_4",
            question: "मेवाड़ प्रजामंडल की स्थापना किसकी अध्यक्षता में हुई थी?",
            hindiQuestion: "मेवाड़ प्रजामंडल की स्थापना किसकी अध्यक्षता में हुई थी?",
            options: ["माणिक्यलाल वर्मा", "बलवंत सिंह मेहता", "भोगीलाल पंड्या", "जयनारायण व्यास", "अनुत्तरित प्रश्न"],
            correctOption: 1,
            explanation: "24 अप्रैल 1938 को बलवंत सिंह मेहता की अध्यक्षता में मेवाड़ प्रजामंडल गठित हुआ।",
          } as any,
        ],
      },
    ],
  },

  // ==========================================
  // SUBJECT 2: RAJASTHAN GEOGRAPHY
  // ==========================================
  {
    id: "chap_demo_geo_divisions",
    subjectId: "sub_demo_geo",
    number: 1,
    title: "Physical Divisions of Rajasthan",
    hindiTitle: "राजस्थान के भौतिक प्रदेश",
    isPublished: true,
    topics: [
      {
        id: "top_demo_thar",
        chapterId: "chap_demo_geo_divisions",
        subjectId: "sub_demo_geo",
        number: 1,
        title: "Thar Desert & Arid Plains",
        hindiTitle: "थार का मरुस्थल एवं अर्द्ध-शुष्क मैदान",
        videoUrl: "https://www.youtube.com/watch?v=9bZkp7q19f0",
        videoDuration: "28:30 min",
        videoTitle: "राजस्थान भूगोल: पश्चिमी रेतीला मैदान व थार मरुस्थल",
        pdfUrl: "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/preview",
        pdfTitle: "राजस्थान भौतिक प्रदेश - संपूर्ण भूगोल नोट्स",
        guideSummary: `• राजस्थान के कुल क्षेत्रफल का 61.11% भाग थार मरुस्थल के अंतर्गत आता है।
• यहाँ राज्य की लगभग 40% जनसंख्या निवास करती है।
• लाठी सीरीज़ क्षेत्र: पोकरण से मोहनगढ़ (जैसलमेर) तक 60 किमी लंबी भूगर्भीय मीठे पानी की पट्टी।
• बरखान (अर्धचंद्राकार बालूका स्तूप) मरुस्थलीकरण के लिए सबसे अधिक उत्तरदायी माने जाते हैं।`,
        questions: [
          {
            id: "q_demo_5",
            question: "राजस्थान के कुल क्षेत्रफल का कितना प्रतिशत भाग मरुस्थल के अंतर्गत आता है?",
            hindiQuestion: "राजस्थान के कुल क्षेत्रफल का कितना प्रतिशत भाग मरुस्थल के अंतर्गत आता है?",
            options: ["41.11%", "51.11%", "61.11%", "71.11%", "अनुत्तरित प्रश्न"],
            correctOption: 2,
            explanation: "राजस्थान के कुल भूभाग का 61.11% क्षेत्र पश्चिमी रेतीले मैदान (थार मरुस्थल) में विस्तृत है।",
          } as any,
        ],
      },
      {
        id: "top_demo_aravalli",
        chapterId: "chap_demo_geo_divisions",
        subjectId: "sub_demo_geo",
        number: 2,
        title: "Aravalli Mountain Range",
        hindiTitle: "अरावली पर्वतमाला एवं प्रमुख दर्रे",
        videoUrl: "https://www.youtube.com/watch?v=kJQP7kiw5Fk",
        videoDuration: "23:45 min",
        videoTitle: "अरावली पर्वतमाला: चोटियाँ, दर्रे व भौगोलिक महत्व",
        pdfUrl: "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/preview",
        pdfTitle: "अरावली पर्वतमाला क्विक रिवीज़न चार्ट",
        guideSummary: `• विश्व की प्राचीनतम वलित पर्वतमाला (प्री-कैम्ब्रियन युगीन)।
• कुल लंबाई: 692 किमी (गुजरात के पालनपुर से दिल्ली की रायसीना पहाड़ी तक)।
• राजस्थान में लंबाई: 550 किमी (लगभग 80%)।
• सर्वोच्च शिखर: गुरुशिखर (1722 मीटर), सिरोही जिले में स्थित है जिसे कर्नल जेम्स टॉड ने 'संतों का शिखर' कहा।`,
        questions: [
          {
            id: "q_demo_6",
            question: "कर्नल जेम्स टॉड ने किस पर्वत शिखर को 'संतों का शिखर' कहा है?",
            hindiQuestion: "कर्नल जेम्स टॉड ने किस पर्वत शिखर को 'संतों का शिखर' कहा है?",
            options: ["सेर", "देलवाड़ा", "गुरुशिखर", "अचलगढ़", "अनुत्तरित प्रश्न"],
            correctOption: 2,
            explanation: "कर्नल टॉड ने माउंट आबू स्थित गुरुशिखर (1722 मी) को संतों का शिखर कहा था।",
          } as any,
        ],
      },
    ],
  },

  // ==========================================
  // SUBJECT 3: ART & CULTURE
  // ==========================================
  {
    id: "chap_demo_forts",
    subjectId: "sub_demo_culture",
    number: 1,
    title: "Forts of Rajasthan",
    hindiTitle: "राजस्थान के प्रमुख ऐतिहासिक दुर्ग",
    isPublished: true,
    topics: [
      {
        id: "top_demo_chittorgarh",
        chapterId: "chap_demo_forts",
        subjectId: "sub_demo_culture",
        number: 1,
        title: "Chittorgarh & Kumbhalgarh Forts",
        hindiTitle: "चित्तौड़गढ़ एवं कुम्भलगढ़ दुर्ग",
        videoUrl: "https://www.youtube.com/watch?v=kYJ4f1d_qEQ",
        videoDuration: "31:00 min",
        videoTitle: "चित्तौड़गढ़ व कुम्भलगढ़ दुर्ग: इतिहास, स्थापत्य व साके",
        pdfUrl: "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/preview",
        pdfTitle: "राजस्थान के दुर्ग एवं स्थापत्य कला नोट्स",
        guideSummary: `• 'गढ़ तो चित्तौड़गढ़, बाकी सब गढ़ैया' - मेसा के पठार पर गंभीरी व बेड़च नदियों के संगम पर स्थित।
• चित्तौड़गढ़ के तीन प्रसिद्ध साके: 1303 (पद्मिनी), 1534 (कर्मावती), 1567-68 (जयमल-पत्ता)।
• यूनेस्को विश्व धरोहर (2013) में शामिल 6 दुर्ग: चीकू गाजर आम (चित्तौड़, कुम्भलगढ़, गागरोन, जैसलमेर, रणथंभौर, आमेर)।
• कुम्भलगढ़ दुर्ग: महाराणा कुम्भा द्वारा शिल्पी मंडन की देखरेख में निर्मित। इसकी 36 किमी लम्बी प्राचीर को 'भारत की महान दीवार' (Great Wall of India) कहा जाता है।`,
        questions: [
          {
            id: "q_demo_7",
            question: "कुम्भलगढ़ दुर्ग का मुख्य शिल्पी (वास्तुकार) कौन था?",
            hindiQuestion: "कुम्भलगढ़ दुर्ग का मुख्य शिल्पी (वास्तुकार) कौन था?",
            options: ["मंडन", "जैता", "नापा", "दीपक", "अनुत्तरित प्रश्न"],
            correctOption: 0,
            explanation: "कुम्भलगढ़ दुर्ग का मुख्य शिल्पी मंडन था, जिसे महाराणा कुम्भा ने नियुक्त किया था।",
          } as any,
        ],
      },
    ],
  },
];
