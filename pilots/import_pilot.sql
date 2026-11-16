BEGIN;

INSERT INTO public.subjects (id, name, hindi_name, description, icon, color, order_index)
VALUES ('sub_raj_hist', 'Rajasthan History', 'राजस्थान का इतिहास', 'राजस्थान का प्राचीन, मध्यकालीन एवं आधुनिक इतिहास', 'landmark', '#8B1E3F', 1)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  hindi_name = EXCLUDED.hindi_name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  order_index = EXCLUDED.order_index;

INSERT INTO public.chapters (id, subject_id, name, hindi_name, order_index)
VALUES ('chap_raj_sources', 'sub_raj_hist', 'Historical Sources & Inscriptions', 'राजस्थान के ऐतिहासिक स्रोत, अभिलेख एवं सिक्के', 1)
ON CONFLICT (id) DO UPDATE SET
  subject_id = EXCLUDED.subject_id,
  name = EXCLUDED.name,
  hindi_name = EXCLUDED.hindi_name,
  order_index = EXCLUDED.order_index;
INSERT INTO public.chapters (id, subject_id, name, hindi_name, order_index)
VALUES ('chap_raj_1857', 'sub_raj_hist', 'Revolt of 1857 in Rajasthan', '1857 की क्रान्ति एवं राजस्थान', 2)
ON CONFLICT (id) DO UPDATE SET
  subject_id = EXCLUDED.subject_id,
  name = EXCLUDED.name,
  hindi_name = EXCLUDED.hindi_name,
  order_index = EXCLUDED.order_index;

INSERT INTO public.topics (id, subject_id, chapter_id, name, hindi_name, order_index)
VALUES ('top_inscriptions', 'sub_raj_hist', 'chap_raj_sources', 'Major Inscriptions', 'प्रमुख अभिलेख व शिलालेख', 1)
ON CONFLICT (id) DO UPDATE SET
  subject_id = EXCLUDED.subject_id,
  chapter_id = EXCLUDED.chapter_id,
  name = EXCLUDED.name,
  hindi_name = EXCLUDED.hindi_name,
  order_index = EXCLUDED.order_index;
INSERT INTO public.topics (id, subject_id, chapter_id, name, hindi_name, order_index)
VALUES ('top_coins', 'sub_raj_hist', 'chap_raj_sources', 'Ancient Coins & Copperplates', 'प्राचीन सिक्के एवं ताम्रपत्र', 2)
ON CONFLICT (id) DO UPDATE SET
  subject_id = EXCLUDED.subject_id,
  chapter_id = EXCLUDED.chapter_id,
  name = EXCLUDED.name,
  hindi_name = EXCLUDED.hindi_name,
  order_index = EXCLUDED.order_index;
INSERT INTO public.topics (id, subject_id, chapter_id, name, hindi_name, order_index)
VALUES ('top_cantonments', 'sub_raj_hist', 'chap_raj_1857', 'Military Cantonments of 1857', '1857 की छह सैनिक छावनियाँ', 1)
ON CONFLICT (id) DO UPDATE SET
  subject_id = EXCLUDED.subject_id,
  chapter_id = EXCLUDED.chapter_id,
  name = EXCLUDED.name,
  hindi_name = EXCLUDED.hindi_name,
  order_index = EXCLUDED.order_index;
INSERT INTO public.topics (id, subject_id, chapter_id, name, hindi_name, order_index)
VALUES ('top_auwa', 'sub_raj_hist', 'chap_raj_1857', 'Auwa Revolt & Kushal Singh', 'आउवा का विद्रोह व ठाकुर कुशाल सिंह', 2)
ON CONFLICT (id) DO UPDATE SET
  subject_id = EXCLUDED.subject_id,
  chapter_id = EXCLUDED.chapter_id,
  name = EXCLUDED.name,
  hindi_name = EXCLUDED.hindi_name,
  order_index = EXCLUDED.order_index;

INSERT INTO public.questions (id, subject_id, chapter_id, topic_id, question, options, correct_answer, explanation, exam, year, level, verified)
VALUES (
  'q_pilot_001',
  'sub_raj_hist',
  'chap_raj_sources',
  'top_inscriptions',
  'बिजौलिया शिलालेख (1170 ई.) के अनुसार सांभर झील का निर्माण किस चौहान शासक ने करवाया था?',
  '["अजयराज","वासुदेव","विग्रहराज चतुर्थ","पृथ्वीराज तृतीय"]'::jsonb,
  1,
  'बिजौलिया शिलालेख (गुणभद्र रचित) के अनुसार चौहान वंश के मूल पुरुष वासुदेव ने 551 ई. में शाकम्भरी में चौहान राज्य की स्थापना की तथा सांभर झील का निर्माण करवाया।',
  'RAS Pre / 2nd Grade',
  '2021',
  'medium',
  true
)
ON CONFLICT (id) DO UPDATE SET
  subject_id = EXCLUDED.subject_id,
  chapter_id = EXCLUDED.chapter_id,
  topic_id = EXCLUDED.topic_id,
  question = EXCLUDED.question,
  options = EXCLUDED.options,
  correct_answer = EXCLUDED.correct_answer,
  explanation = EXCLUDED.explanation,
  exam = EXCLUDED.exam,
  year = EXCLUDED.year,
  level = EXCLUDED.level,
  verified = EXCLUDED.verified;
INSERT INTO public.questions (id, subject_id, chapter_id, topic_id, question, options, correct_answer, explanation, exam, year, level, verified)
VALUES (
  'q_pilot_002',
  'sub_raj_hist',
  'chap_raj_sources',
  'top_inscriptions',
  'बड़वा ग्राम (कोटा) से प्राप्त यूप अभिलेख का संबंध किस प्राचीन वंश से है?',
  '["मौखरि वंश","मालव वंश","गुप्त वंश","कुषाण वंश"]'::jsonb,
  0,
  'कोटा के बड़वा ग्राम से मौखरि राजाओं के यूप अभिलेख (239 ई.) प्राप्त हुए हैं, जिनसे मौखरि वंश के त्रिरात्र यज्ञ का विवरण मिलता है।',
  'Assistant Professor / College Lecturer',
  '2020',
  'hard',
  true
)
ON CONFLICT (id) DO UPDATE SET
  subject_id = EXCLUDED.subject_id,
  chapter_id = EXCLUDED.chapter_id,
  topic_id = EXCLUDED.topic_id,
  question = EXCLUDED.question,
  options = EXCLUDED.options,
  correct_answer = EXCLUDED.correct_answer,
  explanation = EXCLUDED.explanation,
  exam = EXCLUDED.exam,
  year = EXCLUDED.year,
  level = EXCLUDED.level,
  verified = EXCLUDED.verified;
INSERT INTO public.questions (id, subject_id, chapter_id, topic_id, question, options, correct_answer, explanation, exam, year, level, verified)
VALUES (
  'q_pilot_003',
  'sub_raj_hist',
  'chap_raj_sources',
  'top_coins',
  'प्राचीन राजस्थान में ''मालव सिक्के'' सर्वाधिक संख्या में किस पुरातात्विक स्थल से प्राप्त हुए हैं?',
  '["बैराठ (विराटनगर)","रैढ़ (टोंक)","नगर (टोंक)","नगरी (चित्तौड़गढ़)"]'::jsonb,
  2,
  'टोंक जिले के ''नगर'' (प्राचीन मालवनगर) से भारी संख्या में मालव गण के तांबे के सिक्के मिले हैं। (रैढ़ को भारत का टाटानगर कहा जाता है)।',
  'RSMSSB Patwar',
  '2021',
  'medium',
  true
)
ON CONFLICT (id) DO UPDATE SET
  subject_id = EXCLUDED.subject_id,
  chapter_id = EXCLUDED.chapter_id,
  topic_id = EXCLUDED.topic_id,
  question = EXCLUDED.question,
  options = EXCLUDED.options,
  correct_answer = EXCLUDED.correct_answer,
  explanation = EXCLUDED.explanation,
  exam = EXCLUDED.exam,
  year = EXCLUDED.year,
  level = EXCLUDED.level,
  verified = EXCLUDED.verified;
INSERT INTO public.questions (id, subject_id, chapter_id, topic_id, question, options, correct_answer, explanation, exam, year, level, verified)
VALUES (
  'q_pilot_004',
  'sub_raj_hist',
  'chap_raj_sources',
  'top_coins',
  'रियासतकालीन ''मदनशाही सिक्के'' किस रियासत में प्रचलित थे?',
  '["झालावाड़","कोटा","बूंदी","बीकानेर"]'::jsonb,
  0,
  'झालावाड़ रियासत में मदनसिंह के समय ''मदनशाही'' सिक्के (रुपया) ढाले गए थे।',
  'CET Graduate Level',
  '2023',
  'easy',
  true
)
ON CONFLICT (id) DO UPDATE SET
  subject_id = EXCLUDED.subject_id,
  chapter_id = EXCLUDED.chapter_id,
  topic_id = EXCLUDED.topic_id,
  question = EXCLUDED.question,
  options = EXCLUDED.options,
  correct_answer = EXCLUDED.correct_answer,
  explanation = EXCLUDED.explanation,
  exam = EXCLUDED.exam,
  year = EXCLUDED.year,
  level = EXCLUDED.level,
  verified = EXCLUDED.verified;
INSERT INTO public.questions (id, subject_id, chapter_id, topic_id, question, options, correct_answer, explanation, exam, year, level, verified)
VALUES (
  'q_pilot_005',
  'sub_raj_hist',
  'chap_raj_sources',
  'top_inscriptions',
  'अपराजित का शिलालेख (661 ई.) किस जिले से प्राप्त हुआ है?',
  '["उदयपुर","राजसमंद","भीलवाड़ा","चित्तौड़गढ़"]'::jsonb,
  0,
  'अपराजित का शिलालेख उदयपुर के नागदा के निकट कुण्डेश्वर मंदिर से प्राप्त हुआ, जो गुहिल शासक अपराजित की विजयों का उल्लेख करता है।',
  '1st Grade Teacher',
  '2022',
  'medium',
  true
)
ON CONFLICT (id) DO UPDATE SET
  subject_id = EXCLUDED.subject_id,
  chapter_id = EXCLUDED.chapter_id,
  topic_id = EXCLUDED.topic_id,
  question = EXCLUDED.question,
  options = EXCLUDED.options,
  correct_answer = EXCLUDED.correct_answer,
  explanation = EXCLUDED.explanation,
  exam = EXCLUDED.exam,
  year = EXCLUDED.year,
  level = EXCLUDED.level,
  verified = EXCLUDED.verified;
INSERT INTO public.questions (id, subject_id, chapter_id, topic_id, question, options, correct_answer, explanation, exam, year, level, verified)
VALUES (
  'q_pilot_006',
  'sub_raj_hist',
  'chap_raj_1857',
  'top_cantonments',
  'राजस्थान में 1857 की क्रान्ति का प्रथम विद्रोह 28 मई 1857 को किस छावनी में हुआ था?',
  '["नीमच छावनी","नसीराबाद छावनी","एरिनपुरा छावनी","देवली छावनी","अनुत्तरित प्रश्न"]'::jsonb,
  1,
  '28 मई 1857 को नसीराबाद छावनी में 15वीं बंगाल नेटिव इन्फैंट्री के सैनिकों ने विद्रोह का बिगुल फूंका। कैप्टन स्पोटिस वुड व न्यूबरी मारे गए।',
  'RPSC RAS Pre',
  '2023',
  'easy',
  true
)
ON CONFLICT (id) DO UPDATE SET
  subject_id = EXCLUDED.subject_id,
  chapter_id = EXCLUDED.chapter_id,
  topic_id = EXCLUDED.topic_id,
  question = EXCLUDED.question,
  options = EXCLUDED.options,
  correct_answer = EXCLUDED.correct_answer,
  explanation = EXCLUDED.explanation,
  exam = EXCLUDED.exam,
  year = EXCLUDED.year,
  level = EXCLUDED.level,
  verified = EXCLUDED.verified;
INSERT INTO public.questions (id, subject_id, chapter_id, topic_id, question, options, correct_answer, explanation, exam, year, level, verified)
VALUES (
  'q_pilot_007',
  'sub_raj_hist',
  'chap_raj_1857',
  'top_cantonments',
  '1857 की क्रांति के समय राजस्थान की कौन-सी दो सैनिक छावनियों ने प्रत्यक्ष विद्रोह में भाग नहीं लिया था?',
  '["ब्यावर एवं खेरवाड़ा","देवली एवं एरिनपुरा","नीमच एवं नसीराबाद","ब्यावर एवं देवली","अनुत्तरित प्रश्न"]'::jsonb,
  0,
  'ब्यावर (मेर रेजीमेंट) तथा खेरवाड़ा (मेवाड़ भील कोर - MBK) छावनियों के सैनिकों ने प्रत्यक्ष रूप से विद्रोह में भाग नहीं लिया।',
  'RPSC 2nd Grade',
  '2022',
  'medium',
  true
)
ON CONFLICT (id) DO UPDATE SET
  subject_id = EXCLUDED.subject_id,
  chapter_id = EXCLUDED.chapter_id,
  topic_id = EXCLUDED.topic_id,
  question = EXCLUDED.question,
  options = EXCLUDED.options,
  correct_answer = EXCLUDED.correct_answer,
  explanation = EXCLUDED.explanation,
  exam = EXCLUDED.exam,
  year = EXCLUDED.year,
  level = EXCLUDED.level,
  verified = EXCLUDED.verified;
INSERT INTO public.questions (id, subject_id, chapter_id, topic_id, question, options, correct_answer, explanation, exam, year, level, verified)
VALUES (
  'q_pilot_008',
  'sub_raj_hist',
  'chap_raj_1857',
  'top_auwa',
  '18 सितंबर 1857 को लड़ा गया ''चेलावास का युद्ध'' किस अन्य नाम से भी जाना जाता है?',
  '["बिथोड़ा का युद्ध","कालों और गोरों का युद्ध","आउवा का प्रथम युद्ध","पाली का महायुद्ध","अनुत्तरित प्रश्न"]'::jsonb,
  1,
  'चेलावास के युद्ध में क्रांतिकारियों ने जोधपुर के पॉलिटिकल एजेंट मॉक मेसन का सिर काटकर आउवा के किले पर लटका दिया था। इसे ''गोरों-कालों का युद्ध'' कहा जाता है।',
  'RPSC RAS Pre',
  '2021',
  'medium',
  true
)
ON CONFLICT (id) DO UPDATE SET
  subject_id = EXCLUDED.subject_id,
  chapter_id = EXCLUDED.chapter_id,
  topic_id = EXCLUDED.topic_id,
  question = EXCLUDED.question,
  options = EXCLUDED.options,
  correct_answer = EXCLUDED.correct_answer,
  explanation = EXCLUDED.explanation,
  exam = EXCLUDED.exam,
  year = EXCLUDED.year,
  level = EXCLUDED.level,
  verified = EXCLUDED.verified;
INSERT INTO public.questions (id, subject_id, chapter_id, topic_id, question, options, correct_answer, explanation, exam, year, level, verified)
VALUES (
  'q_pilot_009',
  'sub_raj_hist',
  'chap_raj_1857',
  'top_auwa',
  '1857 की क्रान्ति में आउवा के ठाकुर कुशाल सिंह की कुलदेवी कौन थीं, जिनकी मूर्ति 10 सिर व 54 हाथों वाली मानी जाती है?',
  '["बाण माता","सुगाली माता","करणी माता","जीण माता","अनुत्तरित प्रश्न"]'::jsonb,
  1,
  'सुगाली माता को 1857 के स्वाधीनता संग्राम की देवी कहा जाता है। इनकी अष्टधातु की मूर्ति के 10 सिर और 54 हाथ हैं।',
  'RSMSSB VDO',
  '2022',
  'easy',
  true
)
ON CONFLICT (id) DO UPDATE SET
  subject_id = EXCLUDED.subject_id,
  chapter_id = EXCLUDED.chapter_id,
  topic_id = EXCLUDED.topic_id,
  question = EXCLUDED.question,
  options = EXCLUDED.options,
  correct_answer = EXCLUDED.correct_answer,
  explanation = EXCLUDED.explanation,
  exam = EXCLUDED.exam,
  year = EXCLUDED.year,
  level = EXCLUDED.level,
  verified = EXCLUDED.verified;
INSERT INTO public.questions (id, subject_id, chapter_id, topic_id, question, options, correct_answer, explanation, exam, year, level, verified)
VALUES (
  'q_pilot_010',
  'sub_raj_hist',
  'chap_raj_1857',
  'top_auwa',
  'आउवा के ठाकुर कुशाल सिंह की जांच के लिए ब्रिटिश सरकार ने किस आयोग का गठन किया था?',
  '["मेजर बर्टन कमीशन","मेजर टेलर कमीशन","ट्रेन्च कमीशन","हंटर कमीशन","अनुत्तरित प्रश्न"]'::jsonb,
  1,
  '10 नवंबर 1860 को मेजर टेलर कमीशन की रिपोर्ट के आधार पर कुशाल सिंह को निर्दोष मानकर रिहा किया गया।',
  'RPSC College Lecturer',
  '2021',
  'hard',
  true
)
ON CONFLICT (id) DO UPDATE SET
  subject_id = EXCLUDED.subject_id,
  chapter_id = EXCLUDED.chapter_id,
  topic_id = EXCLUDED.topic_id,
  question = EXCLUDED.question,
  options = EXCLUDED.options,
  correct_answer = EXCLUDED.correct_answer,
  explanation = EXCLUDED.explanation,
  exam = EXCLUDED.exam,
  year = EXCLUDED.year,
  level = EXCLUDED.level,
  verified = EXCLUDED.verified;

COMMIT;