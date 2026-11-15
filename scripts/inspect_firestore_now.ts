import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const saPath = "/data/user/0/com.termux/files/home/.antigem/uploads/72eb56a320ab4a8b/gen-lang-client-0811306192-firebase-adminsdk-fbsvc-83ac998822.json";
const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));

const app = initializeApp({
  credential: cert(sa),
  projectId: "gen-lang-client-0811306192"
}, "inspector-app");

async function check() {
  console.log("=== CHECKING FIRESTORE WITH ADMIN SDK ===");
  
  // Try with specific database ID first
  const namedDbId = "ai-studio-quizproshopx-3bfab5fe-4412-4a74-8471-935f57b6f194";
  console.log(`Checking named database: ${namedDbId}...`);
  try {
    const dbNamed = getFirestore(app, namedDbId);
    const collections = await dbNamed.listCollections();
    console.log("Found collections in named DB:", collections.map(c => c.id));
    for (const col of collections) {
      try {
        const countSnap = await col.count().get();
        console.log(`Named DB Collection [${col.id}]: ${countSnap.data().count} documents`);
      } catch (e: any) {
        console.log(`Named DB Collection [${col.id}] count error: ${e.message}`);
      }
    }
  } catch (err: any) {
    console.log(`Named DB error: ${err.message}`);
  }

  // Try default database
  console.log("\nChecking (default) database...");
  try {
    const dbDef = getFirestore(app);
    const collectionsDef = await dbDef.listCollections();
    console.log("Found collections in default DB:", collectionsDef.map(c => c.id));
    for (const col of collectionsDef) {
      try {
        const countSnap = await col.count().get();
        console.log(`Default DB Collection [${col.id}]: ${countSnap.data().count} documents`);
      } catch (e: any) {
        console.log(`Default DB Collection [${col.id}] count error: ${e.message}`);
      }
    }
  } catch (err: any) {
    console.log(`Default DB error: ${err.message}`);
  }
}

check().catch(err => {
  console.error("Fatal check error:", err);
  process.exit(1);
});
