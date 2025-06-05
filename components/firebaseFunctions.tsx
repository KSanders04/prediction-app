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
import { 
  doc, 
  setDoc, 
  getDoc, 
  query, 
  collection, 
  where, 
  getDocs, 
  updateDoc,
  onSnapshot,
  orderBy,
  limit,
  Timestamp,
  addDoc,
  increment
} from "firebase/firestore";

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

{/*---- ACTIVE PLAYERS FIREBASE/LOGIC ----*/}
// Listen for active players in a game
export const listenForActivePlayers = (
  currentGameId: string,
  onUpdate: (players: any[], totalViewers: number) => void,
  onError: (error: any) => void
) => {
  if (!currentGameId) return () => {};

  const presenceQuery = query(
    collection(db, 'presence'),
    where('gameId', '==', currentGameId),
    where('status', '==', 'online'),
    orderBy('joinedAt', 'desc'),
    limit(50)
  );

  const unsubscribe = onSnapshot(presenceQuery, (snapshot) => {
    const players: any[] = [];
    let viewers = 0;
    snapshot.forEach((doc) => {
      const data = doc.data();
      players.push(data);
      viewers++;
    });
    onUpdate(players, viewers);
  }, onError);

  return unsubscribe;
};

// Format "time ago" for timestamps
export const formatTimeAgo = (timestamp: Timestamp): string => {
  try {
    const now = new Date();
    const time = timestamp.toDate();
    const diffMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch (error) {
    return 'Unknown';
  }
};

{/*---- NEW: HOME GAME FIREBASE/LOGIC (YOUR PART) ----*/}
// Initialize user document if doesn't exist
export const initializeUser = async (user: any) => {
  if (!user) return;
  
  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      const newUserData = {
        uid: user.uid,
        email: user.email,
        name: user.email || `User_${user.uid.slice(0, 6)}`,
        totalPoints: 0,
        gamesPlayed: 0,
        correctPredictions: 0,
        totalPredictions: 0,
        lastPlayed: new Date(),
        createdAt: new Date(),
        isGamemaster: null
      };
      
      await setDoc(userRef, newUserData);
    }
  } catch (error) {
    console.error("Error initializing user:", error);
    throw error;
  }
};

// Initialize question templates
export const initializeQuestionTemplates = async () => {
  try {
    const templatesSnapshot = await getDocs(collection(db, "questionTemplates"));
    if (templatesSnapshot.empty) {
      const defaultTemplates = [
        {
          text: "Will the field goal be :MADE or MISSED?",
          options: [
            { optionText: "MADE" },
            { optionText: "MISSED" }
          ],
          type: "field_goal",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          text: "Coin flip: HEADS or TAILS?",
          options: [
            { optionText: "HEADS" },
            { optionText: "TAILS" }
          ],
          type: "coin_flip",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          text: "Next play: RUSH or PASS?",
          options: [
            { optionText: "RUSH" },
            { optionText: "PASS" }
          ],
          type: "next_play",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          text: "Will this drive result in: TOUCHDOWN, FIELD GOAL, or TURNOVER?",
          options: [
            { optionText: "TOUCHDOWN" },
            { optionText: "FIELD GOAL" },
            { optionText: "TURNOVER" }
          ],
          type: "drive_result",
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          text: "Will the quarterback: THROW, RUN, or HAND OFF?",
          options: [
            { optionText: "THROW" },
            { optionText: "RUN" },
            { optionText: "HAND OFF" }
          ],
          type: "qb_action",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      for (const template of defaultTemplates) {
        await addDoc(collection(db, "questionTemplates"), template);
      }
    }
  } catch (error) {
    console.error("Error initializing templates:", error);
    throw error;
  }
};

// Load question templates
export const loadQuestionTemplates = async () => {
  try {
    const templatesSnapshot = await getDocs(collection(db, "questionTemplates"));
    const templates: any[] = [];
    
    templatesSnapshot.forEach((doc) => {
      templates.push({ id: doc.id, ...doc.data() });
    });
    
    return templates;
  } catch (error) {
    console.error("Error loading templates:", error);
    throw error;
  }
};

// Create game
export const createGame = async (gameData: {
  name: string;
  url: string;
  videoId: string;
  createdBy: string;
}) => {
  try {
    // Check if admin already has an active game
    const checkAdminQuery = query(
      collection(db, 'games'),
      where('createdBy', '==', gameData.createdBy),
      where('status', '==', 'active')
    );

    const checkAdminSnapshot = await getDocs(checkAdminQuery);
    if (!checkAdminSnapshot.empty) {
      throw new Error('You already have an active game! Please end your current game first.');
    }

    // Create the new game
    const docRef = await addDoc(collection(db, "games"), {
      name: gameData.name,
      status: "active",
      createdAt: new Date(),
      url: gameData.url,
      videoId: gameData.videoId,
      createdBy: gameData.createdBy,
      liveViewers: [],
      totalViewers: [],
    });
    
    return docRef.id;
  } catch (error) {
    console.error("Error creating game:", error);
    throw error;
  }
};

// Get all active games (for refresh functionality)
export const getAllActiveGames = async () => {
  try {
    const q = query(
      collection(db, "games"),
      where("status", "==", "active"),
      orderBy("createdAt", "desc")
    );
    
    const snapshot = await getDocs(q);
    const games: any[] = [];
    
    snapshot.forEach((doc) => {
      const gameData = doc.data();
      games.push({
        id: doc.id,
        name: gameData.name,
        status: gameData.status,
        createdBy: gameData.createdBy,
        url: gameData.url,
        videoId: gameData.videoId,
        createdAt: gameData.createdAt?.toDate() || new Date()
      });
    });
    
    return games;
  } catch (error) {
    console.error("Error fetching active games:", error);
    throw error;
  }
};

// Listen for all active games
export const listenToActiveGames = (callback: (games: any[]) => void) => {
  const allGamesQuery = query(
    collection(db, "games"),
    where("status", "==", "active"),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(allGamesQuery, (snapshot) => {
    const games: any[] = [];
    
    snapshot.forEach((doc) => {
      const gameData = doc.data();
      games.push({
        id: doc.id,
        name: gameData.name,
        status: gameData.status,
        createdBy: gameData.createdBy,
        url: gameData.url,
        videoId: gameData.videoId,
        createdAt: gameData.createdAt?.toDate() || new Date()
      });
    });
    
    callback(games);
  });
};

// Listen for admin's active games
export const listenToAdminGames = (adminId: string, callback: (game: any) => void) => {
  const adminGamesQuery = query(
    collection(db, "games"),
    where("status", "==", "active"),
    where("createdBy", "==", adminId)
  );

  return onSnapshot(adminGamesQuery, (snapshot) => {
    if (!snapshot.empty) {
      const gameDoc = snapshot.docs[0];
      const gameData = gameDoc.data();
      
      const game = {
        id: gameDoc.id,
        name: gameData.name,
        status: gameData.status,
        createdBy: gameData.createdBy,
        url: gameData.url,
        videoId: gameData.videoId,
        createdAt: gameData.createdAt?.toDate() || new Date()
      };
      callback(game);
    } else {
      callback(null);
    }
  });
};

// End game
export const endGame = async (gameId: string, adminId: string) => {
  try {
    const gameRef = doc(db, "games", gameId);
    const gameSnap = await getDoc(gameRef);
    
    if (!gameSnap.exists()) {
      throw new Error('Game not found in database');
    }
    
    const gameData = gameSnap.data();
    if (gameData.createdBy !== adminId) {
      throw new Error('You can only end games you created!');
    }
    
    await updateDoc(gameRef, {
      status: "ended",
      endedAt: new Date(),
      endedBy: adminId
    });
  } catch (error) {
    console.error("Error ending game:", error);
    throw error;
  }
};

// Create question from template
export const createQuestionFromTemplate = async (
  gameId: string,
  template: any,
  adminId: string
) => {
  try {
    // Verify game ownership
    const gameRef = doc(db, "games", gameId);
    const gameSnap = await getDoc(gameRef);
    
    if (!gameSnap.exists()) {
      throw new Error('Game not found!');
    }
    
    const gameData = gameSnap.data();
    if (gameData.createdBy !== adminId) {
      throw new Error('You can only create questions for your own game!');
    }
    
    if (gameData.status !== 'active') {
      throw new Error('Game is not active!');
    }

    // Close existing active questions in this admin's game
    const activeQuestionsQuery = query(
      collection(db, "questions"),
      where("gameId", "==", gameId),
      where("createdBy", "==", adminId),
      where("status", "==", "active")
    );
    
    const activeQuestionsSnapshot = await getDocs(activeQuestionsQuery);
    
    const closePromises = activeQuestionsSnapshot.docs.map(doc => 
      updateDoc(doc.ref, { status: "finished" })
    );
    
    if (closePromises.length > 0) {
      await Promise.all(closePromises);
    }

    // Create new question
    const docRef = await addDoc(collection(db, "questions"), {
      gameId: gameId,
      templateId: template.id,
      question: template.text,
      options: template.options.map((opt: any) => opt.optionText),
      status: "active",
      actual_result: null,
      createdAt: new Date(),
      createdBy: adminId
    });

    return docRef.id;
  } catch (error) {
    console.error("Error creating question:", error);
    throw error;
  }
};

// Listen for active questions
export const listenToActiveQuestions = (gameId: string, callback: (question: any) => void) => {
  const questionsQuery = query(
    collection(db, "questions"),
    where("gameId", "==", gameId),
    where("status", "in", ["active", "closed", "finished"]),
    orderBy("createdAt", "desc"),
    limit(1)
  );

  return onSnapshot(questionsQuery, (snapshot) => {
    if (!snapshot.empty) {
      const questionDoc = snapshot.docs[0];
      const questionData = questionDoc.data();
      
      const question = {
        id: questionDoc.id,
        gameId: questionData.gameId,
        question: questionData.question,
        options: questionData.options || [],
        status: questionData.status,
        actual_result: questionData.actual_result || 'Not set',
        createdAt: questionData.createdAt?.toDate() || new Date(),
        createdBy: questionData.createdBy
      };
      callback(question);
    } else {
      callback(null);
    }
  });
};

// Close question
export const closeQuestion = async (questionId: string, gameId: string, adminId: string) => {
  try {
    const questionRef = doc(db, "questions", questionId);
    const questionSnap = await getDoc(questionRef);
    
    if (!questionSnap.exists()) {
      throw new Error('Question not found!');
    }
    
    const questionData = questionSnap.data();
    if (questionData.gameId !== gameId || questionData.createdBy !== adminId) {
      throw new Error('You can only close questions in your own game!');
    }

    await updateDoc(questionRef, {
      status: "closed"
    });
  } catch (error) {
    console.error("Error closing question:", error);
    throw error;
  }
};

// Set answer
export const setAnswer = async (questionId: string, answer: string, gameId: string, adminId: string) => {
  try {
    const questionRef = doc(db, "questions", questionId);
    const questionSnap = await getDoc(questionRef);
    
    if (!questionSnap.exists()) {
      throw new Error('Question not found!');
    }
    
    const questionData = questionSnap.data();
    if (questionData.gameId !== gameId || questionData.createdBy !== adminId) {
      throw new Error('You can only set answers for questions in your own game!');
    }

    await updateDoc(questionRef, {
      actual_result: answer,
      status: "finished"
    });
  } catch (error) {
    console.error("Error setting answer:", error);
    throw error;
  }
};

// Make prediction
export const makePrediction = async (predictionData: {
  questionId: string;
  playerId: string;
  playerEmail?: string;
  userName?: string;
  prediction: string;
}) => {
  try {
    const guessQuery = query(
      collection(db, "guesses"),
      where("questionId", "==", predictionData.questionId),
      where("playerId", "==", predictionData.playerId)
    );
    const guessSnapshot = await getDocs(guessQuery);

    if (!guessSnapshot.empty) {
      const guessDoc = guessSnapshot.docs[0];
      await updateDoc(doc(db, "guesses", guessDoc.id), {
        prediction: predictionData.prediction,
        timestamp: new Date()
      });
    } else {
      await addDoc(collection(db, "guesses"), {
        prediction: predictionData.prediction,
        questionId: predictionData.questionId,
        playerId: predictionData.playerId,
        playerEmail: predictionData.playerEmail || null,
        userName: predictionData.userName || `Player_${predictionData.playerId.slice(0, 6)}`,
        timestamp: new Date()
      });
    }
  } catch (error) {
    console.error("Error making prediction:", error);
    throw error;
  }
};

// Check user prediction
export const checkUserPrediction = async (questionId: string, playerId: string) => {
  try {
    const userGuessQuery = query(
      collection(db, "guesses"),
      where("questionId", "==", questionId),
      where("playerId", "==", playerId)
    );
    
    const snapshot = await getDocs(userGuessQuery);
    
    if (!snapshot.empty) {
      const userGuess = snapshot.docs[0].data();
      return userGuess.prediction;
    }
    return '';
  } catch (error) {
    console.error('Error checking user prediction:', error);
    throw error;
  }
};

// Listen to guesses
export const listenToGuesses = (questionId: string, callback: (guesses: any[]) => void) => {
  const guessesQuery = query(
    collection(db, "guesses"),
    where("questionId", "==", questionId),
    orderBy("timestamp", "asc")
  );

  return onSnapshot(guessesQuery, (snapshot) => {
    const guesses: any[] = [];
    snapshot.forEach((doc) => {
      guesses.push({ id: doc.id, ...doc.data() });
    });
    callback(guesses);
  });
};

// Join game
export const joinGame = async (gameId: string, userEmail: string) => {
  try {
    const gameRef = doc(db, "games", gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (gameDoc.exists()) {
      const gameData = gameDoc.data();
      const liveViewers = Array.from(new Set([...(gameData.liveViewers || []), userEmail]));
      const totalViewers = Array.from(new Set([...(gameData.totalViewers || []), userEmail]));
      
      await updateDoc(gameRef, {
        liveViewers,
        totalViewers
      });
    }
  } catch (error) {
    console.error("Error joining game:", error);
    throw error;
  }
};

// Leave game (for when switching games)
export const leaveGame = async (gameId: string, userEmail: string) => {
  try {
    const gameRef = doc(db, "games", gameId);
    const gameDoc = await getDoc(gameRef);
    
    if (gameDoc.exists()) {
      const gameData = gameDoc.data();
      const updatedLiveViewers = (gameData.liveViewers || [])
        .filter((email: string) => email !== userEmail);
      
      await updateDoc(gameRef, {
        liveViewers: updatedLiveViewers
      });
    }
  } catch (error) {
    console.error("Error leaving game:", error);
    throw error;
  }
};

// Update user stats
export const updateUserStats = async (userId: string, isCorrect: boolean) => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: userId,
        email: userId,
        name: userId,
        totalPoints: isCorrect ? 10 : 0,
        gamesPlayed: 1,
        correctPredictions: isCorrect ? 1 : 0,
        totalPredictions: 1,
        lastPlayed: new Date(),
        createdAt: new Date(),
        isGamemaster: null
      });
    } else {
      const updates: any = {
        totalPredictions: increment(1),
        lastPlayed: new Date()
      };

      if (isCorrect) {
        updates.correctPredictions = increment(1);
        updates.totalPoints = increment(10);
      }

      await updateDoc(userRef, updates);
    }
  } catch (error) {
    console.error("Error updating user stats:", error);
    throw error;
  }
};

// Calculate winners
export const calculateWinners = async (questionId: string, correctAnswer: string) => {
  try {
    const guessesQuery = query(
      collection(db, "guesses"),
      where("questionId", "==", questionId)
    );
    const snapshot = await getDocs(guessesQuery);

    let winners = 0;
    let total = 0;
    let soloPlayers = 0;
    let groupPlayers = 0;
    const updatePromises: Promise<void>[] = [];

    for (const doc of snapshot.docs) {
      const guess = doc.data();
      total++;
      const isCorrect = guess.prediction === correctAnswer;
      
      if (isCorrect) {
        winners++;
      }
      
      // Check if this player is currently in a group
      const groupsRef = collection(db, 'groups');
      const memberQuery = query(
        groupsRef,
        where('groupStatus', '==', 'active'),
        where('members', 'array-contains', guess.playerId)
      );
      const memberSnapshot = await getDocs(memberQuery);
      
      // Only update global stats if player is NOT in an active group
      if (memberSnapshot.empty) {
        const updatePromise = updateUserStats(guess.playerId, isCorrect);
        updatePromises.push(updatePromise);
        soloPlayers++;
      } else {
        groupPlayers++;
      }
    }

    await Promise.all(updatePromises);

    return {
      winners,
      total,
      soloPlayers,
      groupPlayers,
      accuracy: total > 0 ? Math.round((winners/total) * 100) : 0
    };
  } catch (error) {
    console.error("Error calculating winners:", error);
    throw error;
  }
};

export const testFunction = () => {
  console.log("Test function works!");
  return "success";
};