import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { setDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';

async function runTests() {
  const projectId = 'test-demo';
  const testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });

  const alice = testEnv.authenticatedContext('alice', { email: 'alice@example.com' });
  // setup: user doc for alice
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'activities/act1'), {
      creatorId: 'bob',
      participantIds: ['bob']
    });
  });

  try {
    const db = alice.firestore();
    console.log("Testing join subcollection...");
    await assertSucceeds(
      setDoc(doc(db, 'activities/act1/participants/alice'), {
        uid: 'alice',
        status: 'joined'
      })
    );
    console.log("Subcollection join OK");

    console.log("Testing activity participantIds update...");
    await assertSucceeds(
      updateDoc(doc(db, 'activities/act1'), {
        participantIds: arrayUnion('alice')
      })
    );
    console.log("Activity update OK");
    
    console.log("ALL TESTS PASSED");
  } catch (err: any) {
    console.error("Test failed:", err.message);
  }

  await testEnv.cleanup();
}

runTests();
