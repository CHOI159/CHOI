import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, updateDoc, arrayUnion } from "firebase/firestore";
import fs from "fs";

async function run() {
  const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
  const app = initializeApp(config);
  const db = getFirestore(app);
  const auth = getAuth(app);
  
  try {
    await signInWithEmailAndPassword(auth, "choihou95@gmail.com", "password123"); 
    console.log("Logged in!");
    const user = auth.currentUser;
    if (!user) return;

    // Use a known document id from the console or find one
    // But since I can't read easily, let me create one
    const { addDoc, collection } = require("firebase/firestore");
    const docRef = await addDoc(collection(db, "activities"), {
        creatorId: user.uid,
        participantIds: [],
        status: "active"
    });
    console.log("Created acitivity:", docRef.id);

    // Update the same doc - should work because creatorId == user.uid
    await updateDoc(docRef, { participantIds: arrayUnion(user.uid) });
    console.log("Updated by creator ok");

    // But let's see if updating works when creatorId != user.uid
    // Wait, the rule says (existing().creatorId == request.auth.uid) || affectedKeys...
    // Let's modify the document to have creatorId = "someone_else"
    await updateDoc(docRef, { creatorId: "someone_else" });
    console.log("Changed creator to someone else.");

    // Now try to update participantIds
    await updateDoc(docRef, { participantIds: arrayUnion(user.uid) });
    console.log("Updated participantIds as non-creator successfully!");

  } catch(e) {
    console.error("Test failed: ", e);
  }
}
run();
