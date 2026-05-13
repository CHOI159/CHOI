import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, doc, updateDoc, arrayUnion, setDoc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app);
const auth = getAuth(app);

async function run() {
  try {
    const cred = await signInAnonymously(auth);
    console.log("Created user", cred.user.uid);
    const activityRef = doc(db, 'activities', "test-act-123"); 
    await setDoc(activityRef, {
      title: 'Test',
      creatorId: cred.user.uid,
      participantIds: [cred.user.uid]
    });
    console.log("Created activity");

    // Clear auth and sign in to a new anonymous account? No, signInAnonymously reuses the same unless signed out.
    await auth.signOut();
    const cred2 = await signInAnonymously(auth);
    const testActRef2 = doc(db, 'activities', 'test-act-123');
    await updateDoc(testActRef2, {
        participantIds: arrayUnion(cred2.user.uid)
    });
    console.log("Updated participantIds successfully!");
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}
run();

