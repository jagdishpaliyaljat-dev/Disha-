import { MapQuizQuestion } from "../types";

export const RAJASTHAN_MAP_QUIZ_QUESTIONS: MapQuizQuestion[] = [
  {
    id: "mq_01",
    prompt: "नक्शे पर 'फलौदी' ज़िले को स्पर्श करें (कुरजां पक्षी शरणस्थली 'खींचन' वाला ज़िला)",
    targetDistrictId: "phalodi",
    targetDistrictName: "फलौदी",
    category: "district_locate",
    hint: "जोधपुर के उत्तर-पश्चिम में स्थित राजस्थान का सबसे शुष्क ज़िला।",
    difficulty: "easy",
    explanation: "फलौदी राजस्थान का सबसे शुष्क क्षेत्र है, जहाँ प्रसिद्ध 'खींचन' गांव और लोकदेवता पाबूजी का कोलू स्थित है।"
  },
  {
    id: "mq_02",
    prompt: "ताम्रयुगीन सभ्यताओं की जननी 'गणेश्वर सभ्यता' और 'खेतड़ी कॉपर' अब किस ज़िले में हैं? नक्शे पर छुएं:",
    targetDistrictId: "neem_ka_thana",
    targetDistrictName: "नीम का थाना",
    category: "new_formation",
    hint: "सीकर और झुंझुनूं के बीच नवगठित तोरावाटी क्षेत्र।",
    difficulty: "easy",
    explanation: "कांतली नदी के तट पर स्थित गणेश्वर सभ्यता और खेतड़ी कॉपर कॉम्प्लेक्स अब नीम का थाना ज़िले में आते हैं।"
  },
  {
    id: "mq_03",
    prompt: "राजस्थान का प्रसिद्ध 'सिवाना दुर्ग' एवं 'पचपदरा रिफाइनरी' किस नए ज़िले में स्थित है? नक्शे पर टैप करें:",
    targetDistrictId: "balotra",
    targetDistrictName: "बालोतरा",
    category: "new_formation",
    hint: "बाड़मेर के पूर्व में स्थित ज़िला जहाँ लूणी नदी खारी होती है।",
    difficulty: "easy",
    explanation: "छप्पन की पहाड़ियों में स्थित सिवाना दुर्ग और HPCL पचपदरा रिफाइनरी अब नवगठित बालोतरा ज़िले में है।"
  },
  {
    id: "mq_04",
    prompt: "महाराणा प्रताप की संकटकालीन राजधानी 'चावंड' एवं 'हाड़ी रानी' का स्मारक किस ज़िले में है?",
    targetDistrictId: "salumbar",
    targetDistrictName: "सलूंबर",
    category: "monument_fort",
    hint: "उदयपुर के दक्षिण-पूर्व में स्थित नया ज़िला जहाँ जयसमंद झील भी है।",
    difficulty: "medium",
    explanation: "चावंड 1585 में प्रताप की राजधानी बनी और हाड़ी रानी का प्रसिद्ध बलिदान स्थल सलूंबर अब स्वतंत्र ज़िला है।"
  },
  {
    id: "mq_05",
    prompt: "ग्राम पंचायत से सीधे ज़िला बनने का ऐतिहासिक रिकॉर्ड बनाने वाला राजस्थान का सबसे छोटा ज़िला कौन सा है?",
    targetDistrictId: "dudu",
    targetDistrictName: "दूदू",
    category: "new_formation",
    hint: "जयपुर और अजमेर के बीच राष्ट्रीय राजमार्ग पर स्थित केवल 3 तहसीलों वाला ज़िला।",
    difficulty: "easy",
    explanation: "दूदू सीधे ग्राम पंचायत से ज़िला बना। मानसिंह प्रथम का जन्मस्थान मौजमाबाद भी इसी ज़िले में है।"
  },
  {
    id: "mq_06",
    prompt: "'जलमहलों की नगरी' के नाम से विख्यात महाराजा सूरजमल का ऐतिहासिक डीग किस स्थान पर है?",
    targetDistrictId: "deeg",
    targetDistrictName: "डीग",
    category: "monument_fort",
    hint: "भरतपुर के उत्तर में हरियाणा सीमा से सटा नया ज़िला।",
    difficulty: "easy",
    explanation: "डीग के जलमहल बदनसिंह व महाराजा सूरजमल द्वारा निर्मित हैं, जो अब स्वतंत्र ज़िला मुख्यालय है।"
  },
  {
    id: "mq_07",
    prompt: "विश्व प्रसिद्ध 'फड़ चित्रकला' (जोशी परिवार) एवं रामस्नेही संप्रदाय का 'फूलडोल मेला' कहाँ आयोजित होता है?",
    targetDistrictId: "shahpura",
    targetDistrictName: "शाहपुरा",
    category: "art_culture",
    hint: "भीलवाड़ा से अलग हुआ नया ज़िला, केसरी सिंह बारहठ की जन्मस्थली।",
    difficulty: "medium",
    explanation: "शाहपुरा फड़ पेंटिंग्स की जन्मस्थली है और रामस्नेही संप्रदाय की अंतरराष्ट्रीय प्रधान पीठ यहाँ स्थित है।"
  },
  {
    id: "mq_08",
    prompt: "प्राचीन 'बैराठ सभ्यता' (मौर्यकालीन भाब्रू शिलालेख) और 'नीमराणा की जापानी ज़ोन' किस ज़िले में है?",
    targetDistrictId: "kotputli_behror",
    targetDistrictName: "कोटपूतली-बहरोड़",
    category: "geography_nature",
    hint: "जयपुर व अलवर के बीच उत्तर-पूर्व सीमा पर स्थित ज़िला।",
    difficulty: "medium",
    explanation: "विराटनगर (बैराठ) और नीमराणा औद्योगिक पार्क अब नवगठित कोटपूतली-बहरोड़ ज़िले के अंग हैं।"
  },
  {
    id: "mq_09",
    prompt: "राजस्थान का पंजाब कहे जाने वाला क्षेत्र जहाँ 'गोगाजी की ओल्डी' और 'पथमेड़ा गोधाम' स्थित हैं:",
    targetDistrictId: "sanchor",
    targetDistrictName: "सांचौर",
    category: "geography_nature",
    hint: "जालौर से अलग हुआ गुजरात सीमावर्ती ज़िला जहाँ नर्मदा नहर प्रवेश करती है।",
    difficulty: "medium",
    explanation: "सांचौर को 5 नदियों के कछार के कारण राजस्थान का पंजाब कहते हैं। गोगाजी की ओल्डी किलोरियों की ढाणी में है।"
  },
  {
    id: "mq_10",
    prompt: "अकबर-बीरबल की सवारी वाला ऐतिहासिक 'बादशाह का मेला' और 'द कृष्णा मिल्स' किस ज़िले में हैं?",
    targetDistrictId: "beawar",
    targetDistrictName: "ब्यावर",
    category: "art_culture",
    hint: "अजमेर के दक्षिण-पश्चिम में मध्य अरावली की तलहटी में स्थित ज़िला।",
    difficulty: "medium",
    explanation: "ब्यावर में धुलंडी के अगले दिन बादशाह का मेला भरता है जिसमें बीरबल का 'भैरव नृत्य' होता है।"
  },
  {
    id: "mq_11",
    prompt: "संत पीपा की पवित्र गुफा 'टोडा रायसिंह' और 'हाड़ी रानी की बावड़ी' किस ज़िले में है?",
    targetDistrictId: "kekri",
    targetDistrictName: "केकड़ी",
    category: "art_culture",
    hint: "अजमेर और टोंक के बीच स्थित अंगारों की होली वाला नया ज़िला।",
    difficulty: "hard",
    explanation: "टोडा रायसिंह अब नवगठित केकड़ी ज़िले में आता है जहाँ संत पीपा की प्रसिद्ध गुफा स्थित है।"
  },
  {
    id: "mq_12",
    prompt: "जागीरी दुर्गों का सिरमौर 'कुचामन दुर्ग' और 'कुचामनी ख्याल' की जन्मस्थली किस ज़िले में है?",
    targetDistrictId: "didwana_kuchaman",
    targetDistrictName: "डीडवाना-कुचामन",
    category: "monument_fort",
    hint: "नागौर के पूर्वी भाग से अलग हुआ नया नमक उत्पादक ज़िला।",
    difficulty: "medium",
    explanation: "कुचामन का जालिम दुर्ग और पं. लच्छीराम की कुचामनी ख्याल अब डीडवाना-कुचामन ज़िले में हैं।"
  },
  {
    id: "mq_13",
    prompt: "लैला-मजनूं की ऐतिहासिक मज़ार और प्रसिद्ध 'बुड्ढा जोहड़ गुरुद्वारा' किस नए ज़िले में है?",
    targetDistrictId: "anupgarh",
    targetDistrictName: "अनूपगढ़",
    category: "art_culture",
    hint: "श्रीगंगानगर के दक्षिण में घग्घर नदी के नाली क्षेत्र में स्थित सीमावर्ती ज़िला।",
    difficulty: "medium",
    explanation: "बिंजौर स्थित लैला-मजनूं मज़ार और बुड्ढा जोहड़ गुरुद्वारा अब नवगठित अनूपगढ़ ज़िले में हैं।"
  },
  {
    id: "mq_14",
    prompt: "राजस्थान का सबसे बड़ा ज़िला क्षेत्रफल में कौन सा है? नक्शे पर स्पर्श करें:",
    targetDistrictId: "jaisalmer",
    targetDistrictName: "जैसलमेर",
    category: "district_locate",
    hint: "पश्चिमी सीमा का 38,401 वर्ग किमी क्षेत्र वाला स्वर्ण नगरी ज़िला।",
    difficulty: "easy",
    explanation: "जैसलमेर 38,401 वर्ग किमी क्षेत्रफल के साथ राजस्थान का सबसे बड़ा ज़िला है।"
  },
  {
    id: "mq_15",
    prompt: "राजस्थान का सर्वोच्च पर्वत शिखर 'गुरुशिखर' (1722 मीटर) और 'नक्की झील' किस ज़िले में है?",
    targetDistrictId: "sirohi",
    targetDistrictName: "सिरोही",
    category: "geography_nature",
    hint: "माउंट आबू और देलवाड़ा जैन मंदिरों वाला दक्षिणी-पश्चिमी ज़िला।",
    difficulty: "easy",
    explanation: "अरावली का सर्वोच्च शिखर गुरुशिखर (संतों का शिखर) और नक्की झील सिरोही ज़िले के माउंट आबू में स्थित हैं।"
  },
  {
    id: "mq_16",
    prompt: "आदिवासियों का महाकुंभ 'बेणेश्वर धाम' (सोम, माही, जाखम त्रिवेणी) किस ज़िले में स्थित है?",
    targetDistrictId: "dungarpur",
    targetDistrictName: "डूंगरपुर",
    category: "art_culture",
    hint: "पहाड़ों की नगरी जहाँ खंडित शिवलिंग की पूजा की जाती है।",
    difficulty: "easy",
    explanation: "नवाटापुरा (डूंगरपुर) में माघ पूर्णिमा को बेणेश्वर मेला आयोजित होता है।"
  },
  {
    id: "mq_17",
    prompt: "राजस्थान का जलियांवाला बाग कहे जाने वाला 'मानगढ़ धाम' (17 नवंबर 1913) किस ज़िले में है?",
    targetDistrictId: "banswara",
    targetDistrictName: "बांसवाड़ा",
    category: "geography_nature",
    hint: "कर्क रेखा से गुजरने वाला 100 द्वीपों का शहर और नया संभाग मुख्यालय।",
    difficulty: "easy",
    explanation: "मानगढ़ धाम बांसवाड़ा ज़िले के आनंदपुरी के समीप स्थित है जहाँ 1500 भील देशभक्त शहीद हुए थे।"
  },
  {
    id: "mq_18",
    prompt: "काँच पर सोने की अत्यंत बारीक मीनाकारी वाली प्रसिद्ध 'थेवा कला' किस ज़िले की पहचान है?",
    targetDistrictId: "pratapgarh",
    targetDistrictName: "प्रतापगढ़",
    category: "art_culture",
    hint: "जाखम बांध और सीतामाता अभयारण्य (उड़न गिलहरी) वाला ज़िला।",
    difficulty: "easy",
    explanation: "प्रतापगढ़ का राजसोनी परिवार थेवा कला का एकछत्र शिल्पी है।"
  },
  {
    id: "mq_19",
    prompt: "आहू और कालीसिंध नदियों के संगम पर बना यूनेस्को विश्व धरोहर 'गागरोन जलदुर्ग' कहाँ है?",
    targetDistrictId: "jhalawar",
    targetDistrictName: "झालावाड़",
    category: "monument_fort",
    hint: "राजस्थान का नागपुर (संतरा नगरी) और सर्वाधिक वर्षा वाला ज़िला।",
    difficulty: "easy",
    explanation: "गागरोन दुर्ग झालावाड़ में स्थित बिना नींव का प्रसिद्ध जलदुर्ग है।"
  },
  {
    id: "mq_20",
    prompt: "रणथंभौर राष्ट्रीय उद्यान और भारत का एकमात्र 'त्रिनेत्र गणेश जी का मंदिर' किस ज़िले में है?",
    targetDistrictId: "sawai_madhopur",
    targetDistrictName: "सवाई माधोपुर",
    category: "monument_fort",
    hint: "अरावली और विंध्याचल के संगम पर स्थित बाघों की भूमि।",
    difficulty: "easy",
    explanation: "सवाई माधोपुर में रणथंभौर दुर्ग के भीतर त्रिनेत्र गणेश जी का विश्वप्रसिद्ध मंदिर स्थित है।"
  }
];
