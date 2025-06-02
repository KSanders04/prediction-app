// app/(tabs)/home.tsx 
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  SafeAreaView,
  Button,
  RefreshControl,
} from 'react-native';

// Import firebase configuration
import { auth, db } from '../../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy,
  getDocs, 
  updateDoc, 
  doc,
  onSnapshot,
  Timestamp,
  getDoc,
  setDoc,
  increment,
  limit
} from 'firebase/firestore';
import { router } from 'expo-router';
import YoutubePlayer from 'react-native-youtube-iframe'

interface Guess {
  id: string;
  prediction: string;
  questionId: string;
  playerId: string;
  playerEmail?: string; // Optional field for user email
  timestamp: Timestamp;
}
interface QuestionTemplate {
  id: string;
  text: string; // Question text template
  options: Array<{
    optionText: string;
    optionPicture?: string; // Optional image for option
    optionVideo?: string;   // Optional video for option
  }>;
  type: string; // "field_goal", "coin_flip", "next_play"
  createdAt?: Date;
  updatedAt?: Date;
}

interface Game {
  name: string;
  status: string;
}

export default function Home() {
  // State variables
  const [currentView, setCurrentView] = useState<'player' | 'gamemaster' | 'games'>('player');
  const [gameNames, setGameNames] = useState<string[]>([]);
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [gameName, setGameName] = useState('');
  const [currentGame, setCurrentGame] = useState('No game active');
  const [currentQuestion, setCurrentQuestion] = useState('Waiting for question...');
  const [predictionStatus, setPredictionStatus] = useState('Waiting...');
  const [userPrediction, setUserPrediction] = useState('');
  const [allGuesses, setAllGuesses] = useState<Guess[]>([]);
  const [questionOptions, setQuestionOptions] = useState<string[]>([]);
  const [correctAnswer, setCorrectAnswer] = useState('Not set');
  const [liveGames, setLiveGames] = useState<string[]>([]);
  const [isGameMasterAccount, setIsGameMasterAccount] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  const [gameURL, setGameURL] = useState('');
  const [currentGameURL, setCurrentGameURL] = useState('');
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [questionTemplates, setQuestionTemplates] = useState<QuestionTemplate[]>([]);
  const [playerSelectedGame, setPlayerSelectedGame] = useState<string | null>(null);
  const [playerSelectedGameURL, setPlayerSelectedGameURL] = useState<string | null>(null);


  // This creates the questionTemplates collection in Firebase if it doesn't exist
  const initializeQuestionTemplates = useCallback(async () => {
    try {
      console.log('🔧 Checking for existing question templates...');
      
      // Check if questionTemplates collection exists and has data
      const templatesSnapshot = await getDocs(collection(db, "questionTemplates"));
      if (templatesSnapshot.empty) {
        console.log('📝 No templates found, creating default templates...');
        
        //create default template : These match our current hardcoded questions but stored in Firebase
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
          }
        ];

        // Add each template to Firebase questionTemplates collection
        for (const template of defaultTemplates) {
          await addDoc(collection(db, "questionTemplates"), template);
          console.log(`✅ Created template: ${template.type}`);
        }
        
        Alert.alert('Success', 'Question templates initialized in Firebase!');
      } else {
        console.log('✅ Templates already exist in Firebase');
      }
    } catch (error) {
      console.error("❌ Error initializing templates:", error);
    }
  }, []);

  // Load Templates from Firebase 
  const loadQuestionTemplates = useCallback(async () => {
    try {
      console.log('📥 Loading question templates from Firebase...');
      const templatesSnapshot = await getDocs(collection(db, "questionTemplates"));
      const templates: QuestionTemplate[] = [];
      
      templatesSnapshot.forEach((doc) => {
        templates.push({ id: doc.id, ...doc.data() } as QuestionTemplate);
      });
      
      setQuestionTemplates(templates);
      console.log(`✅ Loaded ${templates.length} templates from Firebase`);
    } catch (error) {
      console.error("❌ Error loading templates:", error);
    }
  }, []);

  // Check authentication and get user data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        console.log('User authenticated:', user.uid, user.email);
        setCurrentUser(user);
        setPlayerId(user.uid); // Use actual user ID instead of random
        
        // Initialize user document
        await initializeUser(user);
        
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const data = userSnap.data();
          setIsGameMasterAccount(data.isAdmin === true); // Check if user is admin
          console.log('User is gamemaster:', data.isGamemaster);
          console.log('User data:', data);
          
          // NEW: Initialize and Load Templates After User Authentication 
          await initializeQuestionTemplates();
          await loadQuestionTemplates();
        } else {
          console.log('User document does not exist');
          setIsGameMasterAccount(false);
        }
      } else {
        // User not logged in, redirect to login
        console.log('User not authenticated, redirecting to login');
        router.replace('/login');
      }
    });

    return () => unsubscribe();
  }, [initializeQuestionTemplates, loadQuestionTemplates]); // Add dependencies

  //  REAL-TIME GAME AND QUESTION LISTENER 
  // This makes ALL players see the same game/question across devices
  useEffect(() => {
    if (!playerId) return; // Wait for user to be authenticated
    
    console.log('Setting up real-time listeners for all games and questions');
    
    if (isGameMasterAccount) {
      const gamesQuery = query(
      collection(db, "games"),
      where("status", "==", "active"),
    );

    const unsubscribeGames = onSnapshot(gamesQuery, (snapshot) => {
      if (!snapshot.empty) {
        // Get the first (and should be only) active game
        const gameDoc = snapshot.docs[0];
        const gameData = gameDoc.data();
        
        console.log('Found active game:', gameData.name);
        
        // Set the current game info for ALL players (admin and regular players)
        setCurrentGameId(gameDoc.id);
        setCurrentGame(gameData.name);
        setCurrentGameURL(gameData.url || '');
        
        // Now listen for active questions in this game
        listenForActiveQuestions(gameDoc.id);
      } else {
        console.log('No active games found - resetting everything');
        // Reset everything if no active games
        setCurrentGameId(null);
        setCurrentGame('No game active');
        setCurrentGameURL('');
        setCurrentQuestionId(null);
        setCurrentQuestion('Waiting for question...');
        setPredictionStatus('Waiting...');
        setQuestionOptions([]);
        setCorrectAnswer('Not set');
        setUserPrediction('');
        setAllGuesses([]);
      }
    });

    return () => {
      console.log('Cleaning up real-time game listeners');
      unsubscribeGames();
    };
  }
  }, [playerId, isGameMasterAccount]); // Run when playerId changes (user logs in)

  // ===== EXISTING: Listen for active questions in real-time =====
  const listenForActiveQuestions = useCallback((gameId: string) => {
    console.log('Setting up real-time question listener for game:', gameId);
    
    const questionsQuery = query(
      collection(db, "questions"), // CHANGED: using "questions" instead of "predictions"
      where("gameId", "==", gameId),
      where("status", "in", ["active", "closed", "finished"]),
      orderBy("createdAt", "desc"),
      limit(1) // Get only the most recent question
    );

    const unsubscribeQuestions = onSnapshot(questionsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const questionDoc = snapshot.docs[0];
        const questionData = questionDoc.data();
        
        console.log('Found question:', questionData.question);
        console.log('Question status:', questionData.status);
        
        // Update question info for ALL players
        setCurrentQuestionId(questionDoc.id);
        setCurrentQuestion(questionData.question);
        setQuestionOptions(questionData.options || []);
        setCorrectAnswer(questionData.actual_result || 'Not set');
        
        // Set prediction status based on question status
        if (questionData.status === "active") {
          setPredictionStatus('Predictions OPEN');
        } else if (questionData.status === "closed") {
          setPredictionStatus('Predictions CLOSED');
        } else if (questionData.status === "finished") {
          setPredictionStatus('Results Available');
        }
        
        // Check if current user already made a prediction for this question
        checkUserPrediction(questionDoc.id);
        
      } else {
        console.log('No questions found for this game');
        setCurrentQuestionId(null);
        setCurrentQuestion('Waiting for question...');
        setPredictionStatus('Waiting...');
        setQuestionOptions([]);
        setCorrectAnswer('Not set');
        setUserPrediction('');
        setAllGuesses([]);
      }
    });

    return unsubscribeQuestions;
  }, [playerId]);

  // Check if user already made a prediction
  const checkUserPrediction = useCallback(async (questionId: string) => {
    if (!playerId) return;
    
    console.log('Checking if user already predicted for question:', questionId);
    
    try {
      const userGuessQuery = query(
        collection(db, "guesses"),
        where("questionId", "==", questionId),
        where("playerId", "==", playerId)
      );
      
      const snapshot = await getDocs(userGuessQuery);
      
      if (!snapshot.empty) {
        const userGuess = snapshot.docs[0].data();
        setUserPrediction(userGuess.prediction);
        console.log('User already predicted:', userGuess.prediction);
      } else {
        setUserPrediction('');
        console.log('User has not predicted yet');
      }
    } catch (error) {
      console.error('Error checking user prediction:', error);
    }
  }, [playerId]);

  // Load real-time data when question changes
  useEffect(() => {
    if (currentQuestionId) {
      const unsubscribe = loadGuessesRealTime();
      return () => unsubscribe && unsubscribe();
    }
  }, [currentQuestionId]);

  // MEMOIZED HANDLERS (prevents re-renders)
  const handleGameNameChange = useCallback((text: string) => {
    setGameName(text);
  }, []);

  const handleViewChange = useCallback((view: 'player' | 'gamemaster' | 'games') => {
    setCurrentView(view);
  }, []);

  //Video URL Functions
  const onVideoStateChange = (state: "unstarted" | "ended" | "playing" | "paused" | "buffering" | "cued") => {
    if (state === "playing") {
      setIsVideoPlaying(true);
    } else if (state === "paused" || state === "ended") {
      setIsVideoPlaying(false);
      if (state === "ended") {
        setCurrentGameURL("");
      }
    }
  };

  const togglePlaying = useCallback(() => {
    setIsVideoPlaying((prev) => !prev);
  }, []);

  const getURLID = (url: string): string => {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'youtu.be') {
        return parsed.pathname.slice(1);
      }
      return parsed.searchParams.get('v') || '';
    } catch {
      return '';
    }
  };

  // USER MANAGEMENT FUNCTIONS
  const initializeUser = useCallback(async (user: any) => {
    if (!user) return;
    
    try {
      console.log('Initializing user:', user.uid);
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        console.log('Creating new user document');
        // Create new user with email as name
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
        console.log('User document created successfully:', newUserData);
      } else {
        console.log('User document already exists');
      }
    } catch (error) {
      console.error("Error initializing user:", error);
    }
  }, []);

  const updateUserStats = useCallback(async (userId: string, isCorrect: boolean, gameId: string) => {
    try {
      console.log(`Updating stats for user ${userId}: correct=${isCorrect}`);
      
      const userRef = doc(db, "users", userId);
      
      // Check if user document exists first
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        // Create user document if it doesn't exist
        await setDoc(userRef, {
          uid: userId,
          email: userId, // Will be updated with real email later
          name: userId,
          totalPoints: isCorrect ? 10 : 0,
          gamesPlayed: 1,
          correctPredictions: isCorrect ? 1 : 0,
          totalPredictions: 1,
          lastPlayed: new Date(),
          createdAt: new Date(),
          isGamemaster: null
        });
        console.log(`Created new user document for ${userId}`);
      } else {
        // Update existing user document
        const updates: any = {
          totalPredictions: increment(1),
          lastPlayed: new Date()
        };

        if (isCorrect) {
          updates.correctPredictions = increment(1);
          updates.totalPoints = increment(10); // 10 points per correct prediction
        }

        await updateDoc(userRef, updates);
        console.log(`Updated existing user document for ${userId}`);
      }
    } catch (error) {
      console.error("Error updating user stats:", error);
    }
  }, []);

  // ADMIN FUNCTIONS FOR MULTI-DEVICE SUPPORT =====
  // Ensure only one active game at a time
  const adminCreateGame = useCallback(async () => {
    if (!gameName.trim()) {
      Alert.alert('Error', 'Please enter a game name!');
      return;
    }

    try {
      console.log('Creating new game and closing any existing active games');
      
      // ADDED: First, close any existing active games to prevent conflicts
      const activeGamesQuery = query(
        collection(db, "games"),
        where("status", "==", "active")
      );
      
      const activeGamesSnapshot = await getDocs(activeGamesQuery);
      
      // Close all active games
      const closePromises = activeGamesSnapshot.docs.map(doc => 
        updateDoc(doc.ref, { status: "closed", endedAt: new Date() })
      );
      
      if (closePromises.length > 0) {
        await Promise.all(closePromises);
        console.log('Closed', closePromises.length, 'existing active games');
      }

      // Now create the new game
      const videoID = getURLID(gameURL);
      const docRef = await addDoc(collection(db, "games"), {
        name: gameName,
        status: "active",
        createdAt: new Date(),
        url: gameURL,
        videoId: videoID,
        createdBy: playerId // Track who created the game
      });
      
      setGameName('');
      setGameURL('');
      Alert.alert('Success', `Game created: ${gameName}. All players can now see this game!`);
      
    } catch (error) {
      console.error("Error creating game:", error);
      Alert.alert('Error', 'Failed to create game');
    }
  }, [gameName, gameURL, playerId]);

  // Create Question from Template Function =====
  // This replaces the hardcoded question creation with template-based creation
  const adminCreateQuestionFromTemplate = useCallback(async (templateType: string) => {
    if (!currentGameId) {
      Alert.alert('Error', 'Create a game first!');
      return;
    }

    // Find the template by type
    const template = questionTemplates.find(t => t.type === templateType);
    if (!template) {
      Alert.alert('Error', 'Template not found!');
      return;
    }

    try {
      console.log('🎯 Creating question from template:', template.type);
      
      // ===== CLOSE EXISTING ACTIVE QUESTIONS =====
      const activeQuestionsQuery = query(
        collection(db, "questions"),
        where("gameId", "==", currentGameId),
        where("status", "==", "active")
      );
      
      const activeQuestionsSnapshot = await getDocs(activeQuestionsQuery);
      const closePromises = activeQuestionsSnapshot.docs.map(doc => 
        updateDoc(doc.ref, { status: "finished" })
      );
      
      if (closePromises.length > 0) {
        await Promise.all(closePromises);
        console.log('Closed', closePromises.length, 'existing active questions');
      }

      // ===== CREATE NEW QUESTION USING TEMPLATE DATA =====
      const docRef = await addDoc(collection(db, "questions"), {
        gameId: currentGameId,
        templateId: template.id, // ⭐ Store reference to template (KEY PART!)
        question: template.text, // Use template text
        options: template.options.map(opt => opt.optionText), // Extract option text
        status: "active",
        actual_result: null,
        createdAt: new Date(),
        createdBy: playerId
      });
      
      Alert.alert('Success', `Question created from template: ${template.type}! All players can see it.`);
      
    } catch (error) {
      console.error("❌ Error creating question from template:", error);
      Alert.alert('Error', 'Failed to create question');
    }
  }, [currentGameId, playerId, questionTemplates]);

  const adminCloseQuestion = useCallback(async () => {
    if (!currentQuestionId) {
      Alert.alert('Error', 'No active question!');
      return;
    }

    try {
      await updateDoc(doc(db, "questions", currentQuestionId), { // CHANGED: using "questions"
        status: "closed"
      });
      
      Alert.alert('Success', 'Question closed for all players!');
      
    } catch (error) {
      console.error("Error:", error);
      Alert.alert('Error', 'Failed to close question');
    }
  }, [currentQuestionId]);

  // Games functionality 
  const fetchActiveGames = useCallback(async () => {
    try {
      const gamesRef = collection(db, 'games');
      const q = query(gamesRef, where('status', '==', 'active'));
      const querySnapshot = await getDocs(q);

      const names: string[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.name) {
          names.push(data.name);
        }
      });

      setGameNames(names);
    } catch (error) {
      console.error('Error fetching active games:', error);
    }
  }, []);

  const joinGameButton = useCallback(async (gameName: string) => {
    try {
      const gamesRef = collection(db, 'games');
      const q = query(gamesRef, where('name', '==', gameName));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // Get the first matching document's data
        const docData = querySnapshot.docs[0].data();
        if (docData.url) {
          setCurrentGameURL(docData.url);
          setCurrentGameId(docData.videoId);
          setCurrentGame(gameName);
          setPlayerSelectedGame(gameName);
          setPlayerSelectedGameURL(docData.url);
          setCurrentView('player');
          
          console.log('attempting to change game')
        } else {
          console.log(`No URL found for game ${gameName}`);
        }
      } else {
        console.log(`Game not found: ${gameName}`);
      }
    } catch (error) {
      console.error('Error fetching game URL:', error);
    }
  }, []);

  useEffect(() => {
    fetchActiveGames();
  }, [fetchActiveGames]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchActiveGames();
    setRefreshing(false);
  };

  const adminEndedGame = useCallback(async () => {
    console.log('=== END GAME CLICKED ===');
    console.log('Current Game ID:', currentGameId);
    
    if (!currentGameId) {
      Alert.alert('Error', 'No active game!');
      return;
    }

    try {
      console.log('Attempting to close game:', currentGameId);
      
      const gameRef = doc(db, "games", currentGameId);
      
      // Check if game exists first
      const gameSnap = await getDoc(gameRef);
      if (!gameSnap.exists()) {
        console.log('Game document does not exist');
        Alert.alert('Error', 'Game not found in database');
        return;
      }
      
      console.log('Game exists, updating status...');
      await updateDoc(gameRef, {
        status: "closed",
        endedAt: new Date(),
        endedBy: playerId
      });

      console.log('Game status updated successfully');
      
      Alert.alert('Success', 'Game ended for all players! Everything has been reset.');
      
    } catch (error: any) {
      console.error("Error ending game:", error);
      Alert.alert('Error', 'Failed to end game: ' + (error?.message || 'Unknown error'));
    }
  }, [currentGameId, playerId]);

  const adminSetAnswer = useCallback(async (answer: string) => {
    if (!currentQuestionId) {
      Alert.alert('Error', 'No question active!');
      return;
    }

    try {
      await updateDoc(doc(db, "questions", currentQuestionId), { // CHANGED: using "questions"
        actual_result: answer,
        status: "finished"
      });
      
      Alert.alert('Success', `Answer set to: ${answer}. All players can now see the results!`);
      
    } catch (error) {
      console.error("Error:", error);
      Alert.alert('Error', 'Failed to set answer');
    }
  }, [currentQuestionId]);

  const adminCalculateWinners = useCallback(async () => {
    if (!currentQuestionId || correctAnswer === 'Not set') {
      Alert.alert('Error', 'Set the correct answer first!');
      return;
    }

    try {
      const guessesQuery = query(
        collection(db, "guesses"),
        where("questionId", "==", currentQuestionId)
      );
      const snapshot = await getDocs(guessesQuery);

      let winners = 0;
      let total = 0;
      const updatePromises: Promise<void>[] = [];

      snapshot.forEach((doc) => {
        const guess = doc.data();
        total++;
        const isCorrect = guess.prediction === correctAnswer;
        
        if (isCorrect) {
          winners++;
        }
        
        // Update user stats for each player
        const updatePromise = updateUserStats(guess.playerId, isCorrect, currentGameId || '');
        updatePromises.push(updatePromise);
      });

      // Wait for all user stat updates to complete
      await Promise.all(updatePromises);

      Alert.alert(
        'Results', 
        `🏆 FINAL RESULTS 🏆\n\nCorrect Answer: ${correctAnswer}\nWinners: ${winners} out of ${total} players\n\nAccuracy: ${total > 0 ? Math.round((winners/total) * 100) : 0}%`
      );
      
    } catch (error) {
      console.error("Error:", error);
      Alert.alert('Error', 'Failed to calculate winners');
    }
  }, [currentQuestionId, correctAnswer, currentGameId, updateUserStats]);

  // PLAYER FUNCTIONS (unchanged)
  const playerMakePrediction = useCallback(async (choice: string) => {
    if (!currentQuestionId) {
      Alert.alert('Error', 'No active question!');
      return;
    }

    if (predictionStatus === 'Predictions CLOSED' || predictionStatus === 'Results Available') {
      Alert.alert('Error', 'Predictions are closed!');
      return;
    }

    if (!playerId) {
      Alert.alert('Error', 'You must be logged in to make a prediction!');
      return;
    }

    // ADDED: Check if user already made a prediction
    if (userPrediction !== '') {
      Alert.alert('Error', 'You have already made a prediction for this question!');
      return;
    }

    try {
      const guessQuery = query(
      collection(db, "guesses"),
      where("questionId", "==", currentQuestionId),
      where("playerId", "==", playerId)
    );
    const guessSnapshot = await getDocs(guessQuery);

    if (!guessSnapshot.empty) {
      // Update the existing guess
      const guessDoc = guessSnapshot.docs[0];
      await updateDoc(doc(db, "guesses", guessDoc.id), {
        prediction: choice,
        timestamp: new Date()
      });
    } else {
      await addDoc(collection(db, "guesses"), {
        prediction: choice,
        questionId: currentQuestionId,
        playerId: playerId, // Use actual user ID
        playerEmail: currentUser?.email, // Store email for reference
        userName: currentUser?.userName,
        timestamp: new Date()
      });
    }
      setUserPrediction(choice);

      Alert.alert('Success', `Your prediction: ${choice} has been submitted!`);
      
    } catch (error) {
      console.error("Error:", error);
      Alert.alert('Error', 'Failed to submit prediction');
    }
  }, [currentQuestionId, predictionStatus, playerId, currentUser, userPrediction]);

  // Real-time data loading (unchanged)
  const loadGuessesRealTime = useCallback(() => {
    if (!currentQuestionId) return;

    const guessesQuery = query(
      collection(db, "guesses"),
      where("questionId", "==", currentQuestionId),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(guessesQuery, (snapshot) => {
      const guesses: Guess[] = [];
      snapshot.forEach((doc) => {
        guesses.push({ id: doc.id, ...doc.data() } as Guess);
      });
      setAllGuesses(guesses);
    });

    return unsubscribe;
  }, [currentQuestionId]);

  // Show loading if not authenticated yet
  if (!currentUser || !playerId) {
    return (
      <SafeAreaView style={styles.app}>
        <View style={styles.container}>
          <Text style={styles.title}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.app}>
      
      {/* View Toggle - only show if user is admin */}
      {isGameMasterAccount === true ? (
        <View style={styles.toggleContainer}>
          <TouchableOpacity 
            style={[styles.toggleButton, currentView === 'gamemaster' && styles.activeToggle]}
            onPress={() => handleViewChange('gamemaster')}
          >
            <Text style={[styles.toggleText, currentView === 'gamemaster' && styles.activeToggleText]}>
              👨‍💼 GM
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleButton, currentView === 'games' && styles.activeToggle]}
            onPress={() => handleViewChange('games')}
          >
            <Text style={[styles.toggleText, currentView === 'games' && styles.activeToggleText]}>
               📃 Games
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleButton, currentView === 'player' && styles.activeToggle]}
            onPress={() => handleViewChange('player')}
          >
            <Text style={[styles.toggleText, currentView === 'player' && styles.activeToggleText]}>
              🎯 Player
            </Text>
          </TouchableOpacity>
        </View>
      ) : <View style={styles.toggleContainer}>
                  <TouchableOpacity 
            style={[styles.toggleButton, currentView === 'games' && styles.activeToggle]}
            onPress={() => handleViewChange('games')}
          >
            <Text style={[styles.toggleText, currentView === 'games' && styles.activeToggleText]}>
               📃 Games
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleButton, currentView === 'player' && styles.activeToggle]}
            onPress={() => handleViewChange('player')}
          >
            <Text style={[styles.toggleText, currentView === 'player' && styles.activeToggleText]}>
              🎯 Player
            </Text>
          </TouchableOpacity>
        
        </View>}

      {isGameMasterAccount && currentView === 'gamemaster' ? (
        // ADMIN VIEW
        <ScrollView 
          style={styles.container}
          keyboardShouldPersistTaps="always"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          
          <Text style={styles.title}>🔧 GAMEMASTER PANEL</Text>
          <Text style={styles.welcomeText}>Welcome, {currentUser?.email}!</Text>
          
          {!currentGameURL || getURLID(currentGameURL) === "" ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Step 1: Create Game</Text>

              <TextInput
                style={styles.input}
                placeholder="Game name (e.g., Ball State vs Toledo)"
                value={gameName}
                onChangeText={handleGameNameChange}
                placeholderTextColor="#7f8c8d"
                autoCorrect={false}
                autoCapitalize="words"
              />

              <TextInput 
                style={styles.input} 
                placeholder="Game URL" 
                value={gameURL}
                onChangeText={setGameURL} 
                placeholderTextColor="#7f8c8d" 
                autoCorrect={false} 
                autoCapitalize='none' 
              />

              <TouchableOpacity style={styles.adminButton} onPress={adminCreateGame}>
                <Text style={styles.buttonText}>🎮 Create Game</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {currentGameURL !== "" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Game Play</Text>
              <YoutubePlayer
                height={200}
                play={isVideoPlaying}
                videoId={getURLID(currentGameURL)}
                onChangeState={onVideoStateChange}
              />
            
              <TouchableOpacity style={styles.primaryButton} onPress={togglePlaying}>
                <Text style={styles.buttonText}>▶️ {isVideoPlaying ? "Pause" : "Play"}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dangerButton}
                onPress={() => {
                  setCurrentGameURL("");
                  setGameURL("");
                  setIsVideoPlaying(false);
                }}
              >
                <Text style={styles.buttonText}>♻️ Remove Video</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ===== CLEAN: Create Questions from Templates ===== */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Step 2: Create Question</Text>
            
            {/* Question Creation Buttons */}
            {questionTemplates.length === 0 ? (
              <Text style={styles.statusText}>📥 Loading templates...</Text>
            ) : (
              questionTemplates.map((template) => (
                <TouchableOpacity 
                  key={template.id}
                  style={styles.adminButton} 
                  onPress={() => adminCreateQuestionFromTemplate(template.type)}
                >
                  <Text style={styles.buttonText}>
                    {template.type === 'field_goal' && '🥅 '}
                    {template.type === 'coin_flip' && '🪙 '}
                    {template.type === 'next_play' && '🏈 '}
                    {template.text}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>



          {/* Control Game */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Step 3: Control Game</Text>
            
            <TouchableOpacity style={styles.dangerButton} onPress={adminCloseQuestion}>
              <Text style={styles.buttonText}>🛑 Close Predictions</Text>
            </TouchableOpacity>
            
            {currentGameId !== null ? (
              <TouchableOpacity style={styles.dangerButton} onPress={adminEndedGame}>
                <Text style={styles.buttonText}>🛑 End Game</Text>
              </TouchableOpacity>
            ) : null}
            
            <Text style={styles.subTitle}>Set Answer:</Text>
            {questionOptions.map((option, index) => (
              <TouchableOpacity 
                key={`answer-${option}-${index}`}
                style={styles.successButton} 
                onPress={() => adminSetAnswer(option)}
              >
                <Text style={styles.buttonText}>✅ Answer: {option}</Text>
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity style={styles.primaryButton} onPress={adminCalculateWinners}>
              <Text style={styles.buttonText}>🏆 Calculate Winners</Text>
            </TouchableOpacity>
          </View>

          {/* Game Status */}
          <View style={styles.statusSection}>
            <Text style={styles.statusTitle}>Current Status:</Text>
            <Text style={styles.statusText}>📱 Game: {currentGame}</Text>
            <Text style={styles.statusText}>❓ Question: {currentQuestion}</Text>
            <Text style={styles.statusText}>🔄 Status: {predictionStatus}</Text>
            <Text style={styles.statusText}>✅ Answer: {correctAnswer}</Text>
            <Text style={styles.statusText}>👥 Total Predictions: {allGuesses.length}</Text>
          </View>
        </ScrollView>

      ) : ( (currentView === 'games' ? <ScrollView 
          style={styles.container}
          keyboardShouldPersistTaps="always"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>📃 Select A Game</Text>
          <Text style={styles.welcomeText}>Welcome, {currentUser?.email}!</Text>
          {gameNames.map((name, index) => (
            <TouchableOpacity
              key={index}
              style={styles.dangerButton}
              onPress={() => joinGameButton(name)}
              activeOpacity={0.7}
            >
              <Text style={styles.buttonText}>{name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView> :   

        // PLAYER VIEW
        <ScrollView 
          style={styles.container}
          keyboardShouldPersistTaps="always"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {!playerSelectedGame ? (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={styles.title}>🎯 MAKE PREDICTION</Text>
              <Text style={styles.welcomeText}>
                Please select a game from the Games tab to begin.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.title}>🎯 MAKE PREDICTION</Text>
              <Text style={styles.welcomeText}>Welcome, {currentUser?.email}!</Text>
              <YoutubePlayer
                height={200}
                play={isVideoPlaying}
                videoId={getURLID(currentGameURL)}
                onChangeState={onVideoStateChange}
              />            
          
          {/* Game Info */}
          <View style={styles.gameInfo}>
            <Text style={styles.gameText}>🏈 {currentGame}</Text>
            <Text style={[styles.statusBadge, 
              predictionStatus === 'Predictions OPEN' ? styles.openStatus : styles.closedStatus
            ]}>
              {predictionStatus}
            </Text>
          </View>

          {/* Question */}
          <View style={styles.questionSection}>
            <Text style={styles.questionText}>{currentQuestion}</Text>
            
            {/* Prediction Buttons */}
            {predictionStatus === 'Predictions OPEN' && questionOptions.map((option, index) => (
              <TouchableOpacity 
                key={`predict-${option}-${index}`}
                style={[styles.predictButton, userPrediction === option && styles.selectedButton]} 
                onPress={() => playerMakePrediction(option)}
                disabled={userPrediction !== ''} // ADDED: Disable if user already predicted
              >
                <Text style={styles.buttonText}>
                  {option} {userPrediction === option && '✓'}
                </Text>
              </TouchableOpacity>
            ))}
            
            {predictionStatus === 'Predictions CLOSED' && (
              <Text style={styles.closedText}>🛑 Predictions are closed. Waiting for results...</Text>
            )}
            
            {userPrediction !== '' && (
              <View style={styles.userChoiceContainer}>
                <Text style={styles.userChoice}>Your prediction: {userPrediction}</Text>
              </View>
            )}
          </View>

          {/* All Guesses */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              👥 All Predictions ({allGuesses.length})
            </Text>
            {allGuesses.length === 0 ? (
              <Text style={styles.noGuessesText}>No predictions yet. Be the first!</Text>
            ) : (
              allGuesses.map((guess, index) => {
                const isCorrect = correctAnswer !== 'Not set' && guess.prediction === correctAnswer;
                const isWrong = correctAnswer !== 'Not set' && guess.prediction !== correctAnswer;
                const isCurrentUser = guess.playerId === playerId;
                
                return (
                  <View key={`guess-${guess.id}-${index}`} style={[
                    styles.guessItem,
                    isCorrect && styles.correctGuess,
                    isWrong && styles.wrongGuess,
                    isCurrentUser && styles.currentUserGuess
                  ]}>
                    <Text style={styles.guessText}>
                      {isCurrentUser ? '👤 You' : (guess.playerEmail || guess.playerId)}: {guess.prediction}
                      {isCorrect && ' ✅'}
                      {isWrong && ' ❌'}
                      {correctAnswer === 'Not set' && ' ⏳'}
                    </Text>
                  </View>
                );
              })
            )}
            
            {correctAnswer !== 'Not set' && (
              <View style={styles.correctAnswerBox}>
                <Text style={styles.correctAnswerText}>
                  🎯 Correct Answer: {correctAnswer}
                </Text>
              </View>
            )}
          </View>
          </>
          )}
        </ScrollView>)
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#2c3e50',
  },
  welcomeText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
  section: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 15,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2c3e50',
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 15,
    marginBottom: 10,
    color: '#34495e',
  },
  input: {
    borderWidth: 2,
    borderColor: '#ecf0f1',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
    color: '#2c3e50',
  },
  adminButton: {
    backgroundColor: '#e74c3c',
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  predictButton: {
    backgroundColor: '#27ae60',
    padding: 22,
    borderRadius: 15,
    marginBottom: 15,
    alignItems: 'center',
  },
  selectedButton: {
    backgroundColor: '#16a085',
    borderWidth: 3,
    borderColor: '#1abc9c',
  },
  dangerButton: {
    backgroundColor: '#c0392b',
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  successButton: {
    backgroundColor: '#27ae60',
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#3498db',
    padding: 18,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 15,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  toggleButton: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
    borderRadius: 12,
  },
  activeToggle: {
    backgroundColor: '#3498db',
  },
  toggleText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#7f8c8d',
  },
  activeToggleText: {
    color: 'white',
  },
  gameInfo: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  gameText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  statusBadge: {
    fontSize: 16,
    fontWeight: 'bold',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  openStatus: {
    backgroundColor: '#d4edda',
    color: '#155724',
  },
  closedStatus: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
  },
  questionSection: {
    backgroundColor: 'white',
    padding: 25,
    borderRadius: 20,
    marginBottom: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  questionText: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 25,
    color: '#2c3e50',
    lineHeight: 28,
  },
  closedText: {
    fontSize: 18,
    color: '#e74c3c',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  userChoiceContainer: {
    backgroundColor: '#e8f5e8',
    padding: 15,
    borderRadius: 12,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#27ae60',
  },
  userChoice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#27ae60',
    textAlign: 'center',
  },
  statusSection: {
    backgroundColor: '#ecf0f1',
    padding: 20,
    borderRadius: 15,
    marginTop: 10,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#2c3e50',
  },
  statusText: {
    fontSize: 16,
    color: '#34495e',
    marginBottom: 8,
    lineHeight: 22,
  },
  guessItem: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#bdc3c7',
  },
  correctGuess: {
    backgroundColor: '#d4edda',
    borderLeftColor: '#28a745',
  },
  wrongGuess: {
    backgroundColor: '#f8d7da',
    borderLeftColor: '#dc3545',
  },
  currentUserGuess: {
    backgroundColor: '#e3f2fd',
    borderLeftColor: '#2196f3',
  },
  guessText: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
  },
  noGuessesText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 20,
  },
  correctAnswerBox: {
    backgroundColor: '#fff3cd',
    padding: 15,
    borderRadius: 12,
    marginTop: 15,
    borderWidth: 2,
    borderColor: '#ffc107',
  },
  correctAnswerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#856404',
    textAlign: 'center',
  },
  // ===== NEW: Template Management Styles =====
  templateInfo: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#17a2b8',
  },
});