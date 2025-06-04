import { auth, db, storage } from "../firebaseConfig";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  getAuth, 
  reauthenticateWithCredential, 
  EmailAuthProvider, 
  updatePassword,
  } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, getDoc, query, collection, where, getDocs, updateDoc } from "firebase/firestore";

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

{/*---- SIGN OUT FIREBASE/LOGIC ----*/}
// Handles user sign out
export const signOutUser = async () => {
  await auth.signOut();
};
// Listen for auth state changes and redirect if not logged in
export const listenForSignOut = (redirect: () => void) => {
  getAuth().onAuthStateChanged((user) => {
    if (!user) redirect();
  });
};

{/*---- PROFILE FIREBASE/LOGIC ----*/}
// Get current user
export const getCurrentUser = () => {
  return auth.currentUser;
};

// Fetch user data
export const fetchUserData = async (uid: string) => {
  const docRef = doc(db, 'users', uid);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
};

// Upload profile image and update Firestore
export const uploadProfileImage = async (uid: string, uri: string) => {
  const response = await fetch(uri);
  const blob = await response.blob();
  const storageRef = ref(storage, `profilePics/${uid}.jpg`);
  await uploadBytes(storageRef, blob);
  const downloadURL = await getDownloadURL(storageRef);
  await updateDoc(doc(db, 'users', uid), { profilePic: downloadURL });
  return downloadURL;
};

// Update username
export const updateUsername = async (uid: string, newUsername: string) => {
  await updateDoc(doc(db, 'users', uid), { userName: newUsername });
};

// Get current user rank (stub, replace with real logic if needed)
export const getCurrentUserRank = () => 1;

// Get rank suffix
export const getRankSuffix = (rank: number) => {
  if (rank % 100 >= 11 && rank % 100 <= 13) return 'th';
  switch (rank % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

// Calculate accuracy percentage
export const getAccuracy = (correct: number, total: number) =>
  total > 0 ? Math.round((correct / total) * 100) : 0;

// Format last played date
export const formatLastPlayed = (timestamp: any) => {
  if (!timestamp) return 'Never';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString();
};

{/*---- CHANGE PASSWORD FIREBASE/LOGIC ----*/}
// Change password logic for use in changePasswordPage
export const changePassword = async (
  currentPassword: string,
  newPassword: string
) => {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('No authenticated user.');
  }
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
};