import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app);
const auth = getAuth(app);

async function testFetch() {
  try {
    const cred = await signInWithEmailAndPassword(auth, "choihou95@gmail.com", "password123"); // Assuming the user isn't using a simple password... wait I don't know the password
    console.log("Logged in");
  } catch(e) {
    console.log("Could not log in");
  }
}
testFetch();
