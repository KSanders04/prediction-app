import { auth, db } from "../firebaseConfig";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

{/*---- LOGIN FIREBASE/LOGIC ----*/}
// Handles user sign in with email and password
export const emailSignIn = async (email: string, password: string) => {
  try {
    const user = await signInWithEmailAndPassword(auth, email, password);
    const userCredential = user.user;
    const userRef = doc(db, "users", userCredential.uid);
    const userSnap = await getDoc(userRef);

    // If user doc doesn't exist, create it with default values
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: userCredential.uid,
        email: userCredential.email,
        createdAt: new Date().toISOString(),
        isGamemaster: null,
        correctPredictions: 0,
        gamesPlayed: 0,
        totalPoints: 0,
        totalPredictions: 0,
      });
    }
    return user;
  } catch (error: any) {
    throw error;
  }
};