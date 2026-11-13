import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import config from "../firebase-applet-config.json";

async function main() {
  console.log("Connecting to Firestore database:", config.firestoreDatabaseId || "(default)");
  const app = initializeApp(config);
  const db = config.firestoreDatabaseId
    ? getFirestore(app, config.firestoreDatabaseId)
    : getFirestore(app);

  const timestamp = new Date().toISOString();

  // 1. Create 'curriculum' collection -> doc 'main'
  console.log("Creating collection: curriculum...");
  await setDoc(doc(db, "curriculum", "main"), {
    id: "main",
    title: "RajPrep Curriculum Store",
    version: "1.0.0",
    customSubjects: [
      {
        id: "sub_economics_01",
        name: "Economics & General Studies",
        hindiName: "अर्थशास्त्र एवं सामान्य अध्ययन",
        icon: "TrendingUp",
        color: "blue",
        description: "Macroeconomics, Public Finance, Economic Survey, and Indian Economy",
        order: 1,
      }
    ],
    customChapters: [
      {
        id: "ch_macro_01",
        subjectId: "sub_economics_01",
        number: 1,
        title: "Macroeconomic Aggregates & National Income",
        hindiTitle: "समष्टि आर्थिक समुच्चय एवं राष्ट्रीय आय",
      }
    ],
    customTopics: [
      {
        id: "top_gdp_01",
        chapterId: "ch_macro_01",
        subjectId: "sub_economics_01",
        title: "GDP & GSDP Growth Trends",
        hindiTitle: "जीडीपी एवं जीएसडीपी विकास प्रवृत्तियां",
      }
    ],
    customQuestions: [
      {
        id: "q_demo_01",
        topicId: "top_gdp_01",
        chapterId: "ch_macro_01",
        subjectId: "sub_economics_01",
        text: "स्थिर मूल्यों पर सकल घरेलू उत्पाद (GDP) की गणना हेतु वर्तमान में आधार वर्ष क्या है?",
        options: ["2004-05", "2011-12", "2015-16", "2021-22"],
        correctAnswer: 1,
        explanation: "वर्तमान में राष्ट्रीय आय एवं जीडीपी गणना हेतु आधार वर्ष 2011-12 प्रभावी है।",
        difficulty: "medium",
        questionType: "standard",
        createdAt: timestamp,
      }
    ],
    lastUpdatedAt: timestamp,
  });

  // 2. Create 'subjects' collection -> doc 'sub_economics_01'
  console.log("Creating collection: subjects...");
  await setDoc(doc(db, "subjects", "sub_economics_01"), {
    id: "sub_economics_01",
    name: "Economics & General Studies",
    hindiName: "अर्थशास्त्र एवं सामान्य अध्ययन",
    icon: "TrendingUp",
    color: "blue",
    description: "Macroeconomics, Public Finance, Economic Survey, and Indian Economy",
    order: 1,
    createdAt: timestamp,
  });

  // 3. Create 'chapters' collection -> doc 'ch_macro_01'
  console.log("Creating collection: chapters...");
  await setDoc(doc(db, "chapters", "ch_macro_01"), {
    id: "ch_macro_01",
    subjectId: "sub_economics_01",
    number: 1,
    title: "Macroeconomic Aggregates & National Income",
    hindiTitle: "समष्टि आर्थिक समुच्चय एवं राष्ट्रीय आय",
    order: 1,
    createdAt: timestamp,
  });

  // 4. Create 'topics' collection -> doc 'top_gdp_01'
  console.log("Creating collection: topics...");
  await setDoc(doc(db, "topics", "top_gdp_01"), {
    id: "top_gdp_01",
    chapterId: "ch_macro_01",
    subjectId: "sub_economics_01",
    title: "GDP & GSDP Growth Trends",
    hindiTitle: "जीडीपी एवं जीएसडीपी विकास प्रवृत्तियां",
    order: 1,
    createdAt: timestamp,
  });

  // 5. Create 'questions' collection -> doc 'q_demo_01'
  console.log("Creating collection: questions...");
  await setDoc(doc(db, "questions", "q_demo_01"), {
    id: "q_demo_01",
    topicId: "top_gdp_01",
    chapterId: "ch_macro_01",
    subjectId: "sub_economics_01",
    text: "स्थिर मूल्यों पर सकल घरेलू उत्पाद (GDP) की गणना हेतु वर्तमान में आधार वर्ष क्या है?",
    options: ["2004-05", "2011-12", "2015-16", "2021-22"],
    correctAnswer: 1,
    explanation: "वर्तमान में राष्ट्रीय आय एवं जीडीपी गणना हेतु आधार वर्ष 2011-12 प्रभावी है।",
    difficulty: "medium",
    type: "standard",
    createdAt: timestamp,
  });

  // 6. Create 'users' collection -> doc for admin user + subcollections 'progress' & 'history'
  console.log("Creating collection: users (with progress and history subcollections)...");
  const adminUserId = "usr_jagdishpaliyaljat2003_gmail_com";
  await setDoc(doc(db, "users", adminUserId), {
    id: adminUserId,
    name: "Jagdish Paliyal",
    email: "jagdishpaliyaljat2003@gmail.com",
    role: "admin",
    targetExam: "General Studies & Economics",
    dailyGoalQuestions: 30,
    streakDays: 0,
    createdAt: timestamp,
    settings: {
      soundEnabled: true,
      hapticsEnabled: true,
      autoAdvance: true,
    }
  });

  // Subcollection progress
  await setDoc(doc(db, "users", adminUserId, "progress", "q_demo_01"), {
    questionId: "q_demo_01",
    status: "unattempted",
    stage: 0,
    nextReviewAt: timestamp.split("T")[0],
    wrongCount: 0,
    bookmarked: false,
    lastAnsweredAt: null,
    updatedAt: timestamp,
  });

  // Subcollection history
  const todayStr = timestamp.split("T")[0];
  await setDoc(doc(db, "users", adminUserId, "history", todayStr), {
    date: todayStr,
    questionsPracticed: 0,
    correctCount: 0,
    wrongCount: 0,
    timeSpentSeconds: 0,
    updatedAt: timestamp,
  });

  console.log("All collections created successfully in Firestore!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Initialization failed:", err);
    process.exit(1);
  });
