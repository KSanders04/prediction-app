import { auth, db } from "../firebaseConfig";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword} from "firebase/auth";
import { doc, setDoc, getDoc, query, collection, where, getDocs } from "firebase/firestore";

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

{/*---- CREATE ACCOUNT FIREBASE/LOGIC ----*/}
// Handles user sign up with email, password, and profile info
export const emailSignUp = async (
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  userName: string
) => {
  // Username validation
  if (!userName.trim()) throw new Error("Username cannot be empty.");
  if (userName.trim().length < 6) throw new Error("Username must be at least 6 characters long.");
  if (!firstName.trim() || !lastName.trim()) throw new Error("First and last name cannot be empty.");
  if (!email.trim() || !password.trim()) throw new Error("Email and password cannot be empty.");
  if (password.length < 6) throw new Error("Password must be at least 6 characters long.");

  // Check if username exists
  const usernameQuery = query(collection(db, "users"), where("userName", "==", userName));
  const usernameSnapshot = await getDocs(usernameQuery);
  if (!usernameSnapshot.empty) throw new Error("That username is already taken. Please choose another.");

  // Check if email exists
  const emailQuery = query(collection(db, "users"), where("email", "==", email));
  const emailSnapshot = await getDocs(emailQuery);
  if (!emailSnapshot.empty) throw new Error("That email is already in use. Please choose another.");

  // Create account
  const user = await createUserWithEmailAndPassword(auth, email, password);
  const userCredential = user.user;
  const userRef = doc(db, "users", userCredential.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid: userCredential.uid,
      firstName,
      lastName,
      userName,
      email: userCredential.email,
      createdAt: new Date().toISOString(),
      isAdmin: null,
      correctPredictions: 0,
      gamesPlayed: 0,
      totalPoints: 0,
      totalPredictions: 0,
    });
  }

  return user;
};