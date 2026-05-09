import { 
  doc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  serverTimestamp,
  getDocs,
  getDoc,
  increment,
  setDoc
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";

async function settleRecords(activityId: string) {
  const participantsRef = collection(db, `activities/${activityId}/participants`);
  const snapshot = await getDocs(participantsRef);
  
  const noShowUids: string[] = [];
  const arrivedUids: string[] = [];
  
  const pendingUpdates: { uid: string, type: 'no-show' | 'stood-up' }[] = [];

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data.status === 'no-show') noShowUids.push(docSnap.id);
    if (data.status === 'arrived') arrivedUids.push(docSnap.id);
    
    if (data.status === 'no-show' && !data.hasNoShowSettled) {
      pendingUpdates.push({ uid: docSnap.id, type: 'no-show' });
    }
  });

  if (noShowUids.length > 0) {
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.status === 'arrived' && !data.hasStoodUpSettled) {
        pendingUpdates.push({ uid: docSnap.id, type: 'stood-up' });
      }
    });
  }
  
  for (const update of pendingUpdates) {
    const userRef = doc(db, 'users', update.uid);
    const pRef = doc(db, `activities/${activityId}/participants`, update.uid);
    
    if (update.type === 'no-show') {
      await setDoc(userRef, { noShowCount: increment(1), updatedAt: serverTimestamp() }, { merge: true });
      await setDoc(pRef, { hasNoShowSettled: true, updatedAt: serverTimestamp() }, { merge: true });
    } else if (update.type === 'stood-up') {
      await setDoc(userRef, { stoodUpCount: increment(1), updatedAt: serverTimestamp() }, { merge: true });
      await setDoc(pRef, { hasStoodUpSettled: true, updatedAt: serverTimestamp() }, { merge: true });
    }
  }
}

export const activityService = {
  async completeActivity(activityId: string) {
    console.log(`[ActivityService] Completing activity: ${activityId}`);
    try {
      const activityRef = doc(db, "activities", activityId);
      await settleRecords(activityId);

      await updateDoc(activityRef, {
        status: "completed",
        updatedAt: serverTimestamp(),
      });
      console.log(`[ActivityService] Activity ${activityId} marked as completed`);
      return true;
    } catch (error) {
      console.error(`[ActivityService] Error completing activity:`, error);
      handleFirestoreError(error, OperationType.UPDATE, `activities/${activityId}`);
      throw error;
    }
  },

  async cancelActivity(activityId: string) {
    console.log(`[ActivityService] Cancelling activity: ${activityId}`);
    try {
      const activityRef = doc(db, "activities", activityId);
      await settleRecords(activityId);
      
      await updateDoc(activityRef, {
        status: "cancelled",
        updatedAt: serverTimestamp(),
      });
      console.log(`[ActivityService] Activity ${activityId} marked as cancelled`);
      return true;
    } catch (error) {
      console.error(`[ActivityService] Error cancelling activity:`, error);
      handleFirestoreError(error, OperationType.UPDATE, `activities/${activityId}`);
      throw error;
    }
  },

  async archiveActivity(activityId: string) {
    console.log(`[ActivityService] Archiving activity: ${activityId}`);
    try {
      const activityRef = doc(db, "activities", activityId);
      const snap = await getDoc(activityRef);
      if (snap.exists() && snap.data().status === 'active') {
        await settleRecords(activityId);
      }
      
      await updateDoc(activityRef, {
        status: "archived",
        updatedAt: serverTimestamp(),
      });
      console.log(`[ActivityService] Activity ${activityId} marked as archived`);
      return true;
    } catch (error) {
      console.error(`[ActivityService] Error archiving activity:`, error);
      handleFirestoreError(error, OperationType.UPDATE, `activities/${activityId}`);
      throw error;
    }
  },

  async permanentDelete(activityId: string) {
    console.log(`[ActivityService] Permanently deleting activity: ${activityId}`);
    try {
      const activityRef = doc(db, "activities", activityId);
      await deleteDoc(activityRef);
      console.log(`[ActivityService] Activity ${activityId} deleted permanently`);
      return true;
    } catch (error) {
      console.error(`[ActivityService] Error deleting activity:`, error);
      handleFirestoreError(error, OperationType.DELETE, `activities/${activityId}`);
      throw error;
    }
  },

  async updateParticipantStatus(activityId: string, userId: string, status: string) {
    console.log(`[ActivityService] Updating participant ${userId} status to ${status} for activity ${activityId}`);
    try {
      const pRef = doc(db, `activities/${activityId}/participants`, userId);
      await updateDoc(pRef, {
        status,
        updatedAt: serverTimestamp(),
      });
      return true;
    } catch (error) {
      console.error(`[ActivityService] Error updating participant status:`, error);
      handleFirestoreError(error, OperationType.UPDATE, `activities/${activityId}/participants/${userId}`);
      throw error;
    }
  }
};
