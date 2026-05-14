import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import fs from "fs";

async function run() {
  const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
  const app = initializeApp(config);
  const db = getFirestore(app);
  const auth = getAuth(app);
  
  try {
    await signInWithEmailAndPassword(auth, "choihou95@gmail.com", "password123"); 
    // Wait, testing credentials won't work, let me use my fallback test logic without auth or use anonymous auth if enabled?
  } catch(e) {
    console.log("Could not log in");
  }
}
run();
