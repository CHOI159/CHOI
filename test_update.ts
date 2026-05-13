import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, doc, updateDoc, arrayUnion, setDoc, serverTimestamp } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app);
const auth = getAuth(app);

async function run() {
  try {
    const cred = await signInAnonymously(auth);
    console.log("Created user", cred.user.uid);
    
    const id = "test-act-123";
    const user = cred.user;

    const pRef = doc(db, `activities/${id}/participants`, user.uid);
    await setDoc(pRef, {
        uid: user.uid,
        displayName: 'test',
        photoURL: 'test',
        status: 'joined',
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    console.log("Wrote participant document successfully!");

    const activityRef = doc(db, 'activities', id);
    await updateDoc(activityRef, {
        participantIds: arrayUnion(user.uid)
    });
    console.log("Updated participantIds successfully!");

  } catch (e: any) {
    console.error("Error:", e.message);
  }
}
run();

