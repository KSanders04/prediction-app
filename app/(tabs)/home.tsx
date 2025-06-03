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
  playerEmail?: string;
  timestamp: Timestamp;
}

interface QuestionTemplate {
  id: string;
  text: string;
  options: Array<{
    optionText: string;
    optionPicture?: string;
    optionVideo?: string;
  }>;
  type: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface Game {
  id: string;
  name: string;
  status: string;
  createdBy: string;
  url?: string;
  videoId?: string;
  createdAt: Date;
  liveViewers?: string[];
  totalViewers?: string[];
}

export default function Home() {
  // State variables
  const [currentView, setCurrentView] = useState<'player' | 'gamemaster' | 'games'>('player');
  const [gameNames, setGameNames] = useState<string[]>([]);
  const [allGames, setAllGames] = useState<Game[]>([]); // NEW: Store all game objects
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
  const [adminGameOpen, setAdminGameOpen] = useState<boolean>(false);

  // FIXED: Load user data from Firestore to get userName
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  // NEW: Track which game the admin is currently managing
  const [adminCurrentGameId, setAdminCurrentGameId] = useState<string | null>(null);

  // Load current user data from Firestore
  const loadCurrentUserData = useCallback(async () => {
    if (!playerId) return;
    
    try {
      const userRef = doc(db, 'users', playerId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        setCurrentUserData(userData);
        console.log('Loaded user data:', userData);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }, [playerId]);

  // This creates the questionTemplates collection in Firebase if it doesn't exist
  const initializeQuestionTemplates = useCallback(async () => {
    try {
      console.log('🔧 Checking for existing question templates...');
      
      const templatesSnapshot = await getDocs(collection(db, "questionTemplates"));
      if (templatesSnapshot.empty) {
        console.log('📝 No templates found, creating default templates...');
        
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
        setPlayerId(user.uid);
        
        await initializeUser(user);
        await loadCurrentUserData(); // Load user data after authentication
        
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const data = userSnap.data();
          setIsGameMasterAccount(data.isGamemaster === true);
          console.log('User is gamemaster:', data.isGamemaster);
          
          await initializeQuestionTemplates();
          await loadQuestionTemplates();
          await loadCurrentUserData(); // Load user data after setting gamemaster status
        } else {
          console.log('User document does not exist');
          setIsGameMasterAccount(false);
        }
      } else {
        console.log('User not authenticated, redirecting to login');
        router.replace('/login');
      }
    });

    return () => unsubscribe();
  }, [initializeQuestionTemplates, loadQuestionTemplates, loadCurrentUserData]);

  // NEW: Enhanced real-time listener for ALL games (for players) and admin's games
  useEffect(() => {
    if (!playerId) return;
    
    console.log('Setting up real-time listeners for games and questions');
    
    // Listen for ALL active games (for players to see in Games tab)
    const allGamesQuery = query(
      collection(db, "games"),
      where("status", "==", "active"),
      orderBy("createdAt", "desc")
    );

    const unsubscribeAllGames = onSnapshot(allGamesQuery, (snapshot) => {
      const games: Game[] = [];
      const gameNames: string[] = [];
      
      snapshot.forEach((doc) => {
        const gameData = doc.data();
        const game: Game = {
          id: doc.id,
          name: gameData.name,
          status: gameData.status,
          createdBy: gameData.createdBy,
          url: gameData.url,
          videoId: gameData.videoId,
          createdAt: gameData.createdAt?.toDate() || new Date()
        };
        games.push(game);
        gameNames.push(gameData.name);
      });
      
      setAllGames(games);
      setGameNames(gameNames);
      console.log(`Found ${games.length} active games from all admins`);
    });

    // If user is admin, listen for THEIR active games specifically
    if (isGameMasterAccount) {
      const adminGamesQuery = query(
        collection(db, "games"),
        where("status", "==", "active"),
        where("createdBy", "==", playerId)
      );

      const unsubscribeAdminGames = onSnapshot(adminGamesQuery, (snapshot) => {
        if (!snapshot.empty) {
          const gameDoc = snapshot.docs[0]; // Admin should only have one active game
          const gameData = gameDoc.data();
          
          console.log('Admin found their active game:', gameData.name);
          
          setAdminCurrentGameId(gameDoc.id);
          setCurrentGameId(gameDoc.id);
          setCurrentGame(gameData.name);
          setCurrentGameURL(gameData.url || '');
          setAdminGameOpen(true);
          
          // Listen for questions in admin's game
          listenForActiveQuestions(gameDoc.id);
        } else {
          console.log('No active games found for this admin');
          setAdminCurrentGameId(null);
          setAdminGameOpen(false);
          // Don't reset currentGameId here if player selected a game
          if (!playerSelectedGame) {
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
        }
      });

      return () => {
        console.log('Cleaning up admin game listeners');
        unsubscribeAllGames();
        unsubscribeAdminGames();
      };
    }

    return () => {
      console.log('Cleaning up all games listener');
      unsubscribeAllGames();
    };
  }, [playerId, isGameMasterAccount]);

  // NEW: Listen for questions in the selected game (for players)
  useEffect(() => {
    if (currentGameId && !isGameMasterAccount) {
      console.log('🎯 Player listening for questions in game:', currentGameId);
      const unsubscribe = listenForActiveQuestions(currentGameId);
      return () => unsubscribe && unsubscribe();
    }
  }, [currentGameId, isGameMasterAccount, playerId]); // Added playerId dependency

  // Listen for active questions in real-time
  const listenForActiveQuestions = useCallback((gameId: string) => {
    console.log('Setting up real-time question listener for game:', gameId);


    console.log('🔍 Setting up real-time question listener for game:', gameId);
    console.log('🔍 Current user is gamemaster:', isGameMasterAccount);
    console.log('🔍 Player ID:', playerId);
    

    const questionsQuery = query(
      collection(db, "questions"),
      where("gameId", "==", gameId),
      where("status", "in", ["active", "closed", "finished"]),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const unsubscribeQuestions = onSnapshot(questionsQuery, (snapshot) => {

      console.log('📥 Question snapshot received, docs count:', snapshot.docs.length);

      
      if (!snapshot.empty) {
        const questionDoc = snapshot.docs[0];
        const questionData = questionDoc.data();
        
        console.log('✅ Found question:', questionData.question);
        console.log('✅ Question status:', questionData.status);
        console.log('✅ Question ID:', questionDoc.id);
        
        setCurrentQuestionId(questionDoc.id);
        setCurrentQuestion(questionData.question);
        setQuestionOptions(questionData.options || []);
        setCorrectAnswer(questionData.actual_result || 'Not set');
        
        if (questionData.status === "active") {
          setPredictionStatus('Predictions OPEN');
          console.log('🟢 Predictions are OPEN');
        } else if (questionData.status === "closed") {
          setPredictionStatus('Predictions CLOSED');
          console.log('🟡 Predictions are CLOSED');
        } else if (questionData.status === "finished") {
          setPredictionStatus('Results Available');
          console.log('🔴 Results Available');
        }
        
        checkUserPrediction(questionDoc.id);
      } else {
        console.log('❌ No questions found for this game');
        setCurrentQuestionId(null);
        setCurrentQuestion('Waiting for question...');
        setPredictionStatus('Waiting...');
        setQuestionOptions([]);
        setCorrectAnswer('Not set');
        setUserPrediction('');
        setAllGuesses([]);
      }
    }, (error) => {
      console.error('❌ Error in question listener:', error);
    });

    return unsubscribeQuestions;
  }, [playerId, isGameMasterAccount]); // Added isGameMasterAccount dependency

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

  // MEMOIZED HANDLERS
  const handleGameNameChange = useCallback((text: string) => {
    setGameName(text);
  }, []);

  const handleViewChange = useCallback((view: 'player' | 'gamemaster' | 'games') => {
    setCurrentView(view);
  }, []);

  // Video URL Functions
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

  const updateUserStats = useCallback(async (userId: string, isCorrect: boolean, currentGameId: string) => {
    try {
      console.log(`Updating stats for user ${userId}: correct=${isCorrect}`);
      
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
        console.log(`Created new user document for ${userId}`);
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
        console.log(`Updated existing user document for ${userId}`);
      }
    } catch (error) {
      console.error("Error updating user stats:", error);
    }
  }, []);

  // FIXED: Admin create game with proper validation
  const adminCreateGame = useCallback(async () => {
    if (!gameName.trim()) {
      Alert.alert('Error', 'Please enter a game name!');
      return;
    }
    if (!gameURL.trim()) {
      Alert.alert('Error', 'Please enter a valid game URL!');
      return;
    }

    try {
      console.log('Creating new game and checking for existing active games');
      
      // Check if this admin already has an active game
      const checkAdminQuery = query(
        collection(db, 'games'),
        where('createdBy', '==', playerId),
        where('status', '==', 'active')
      );

      const checkAdminSnapshot = await getDocs(checkAdminQuery);
      if (!checkAdminSnapshot.empty) {
        Alert.alert('Error', 'You already have an active game! Please end your current game first.');
        return;
      }

      // Create the new game
      const videoID = getURLID(gameURL);
      const docRef = await addDoc(collection(db, "games"), {
        name: gameName,
        status: "active",
        createdAt: new Date(),
        url: gameURL,
        videoId: videoID,
        createdBy: playerId,
        liveViewers: [],
        totalViewers: [],
      });
      
      console.log('✅ Game created successfully with ID:', docRef.id);
      
      setGameName('');
      setGameURL('');
      Alert.alert('Success', `Game "${gameName}" created successfully! All players can now see this game.`);
      
    } catch (error: any) {
      console.error("❌ Error creating game:", error);
      Alert.alert('Error', 'Failed to create game: ' + (error?.message || 'Unknown error'));
    }
  }, [gameName, gameURL, playerId]);

  // FIXED: Create question with proper game validation and admin ownership
  const adminCreateQuestionFromTemplate = useCallback(async (templateType: string) => {
    // Validate admin has an active game
    if (!adminCurrentGameId) {
      Alert.alert('Error', 'Create a game first!');
      return;
    }

    // Double-check this admin owns the game
    try {
      const gameRef = doc(db, "games", adminCurrentGameId);
      const gameSnap = await getDoc(gameRef);
      
      if (!gameSnap.exists()) {
        Alert.alert('Error', 'Game not found!');
        return;
      }
      
      const gameData = gameSnap.data();
      if (gameData.createdBy !== playerId) {
        Alert.alert('Error', 'You can only create questions for your own game!');
        return;
      }
      
      if (gameData.status !== 'active') {
        Alert.alert('Error', 'Game is not active!');
        return;
      }
    } catch (error) {
      console.error('Error validating game ownership:', error);
      Alert.alert('Error', 'Failed to validate game ownership');
      return;
    }

    const template = questionTemplates.find(t => t.type === templateType);
    if (!template) {
      Alert.alert('Error', 'Template not found!');
      return;
    }

    try {
      console.log('🎯 Creating question from template:', template.type, 'for admin game:', adminCurrentGameId);
      console.log('🎯 Admin player ID:', playerId);
      
      // CRITICAL: Close existing active questions ONLY in THIS admin's game
      const activeQuestionsQuery = query(
        collection(db, "questions"),
        where("gameId", "==", adminCurrentGameId),  // ← ONLY this admin's game
        where("createdBy", "==", playerId),         // ← ONLY this admin's questions
        where("status", "==", "active")
      );
      
      const activeQuestionsSnapshot = await getDocs(activeQuestionsQuery);
      console.log(`🔄 Found ${activeQuestionsSnapshot.docs.length} active questions in admin's game to close`);
      
      const closePromises = activeQuestionsSnapshot.docs.map(doc => {
        console.log(`🛑 Closing question: ${doc.data().question} in game: ${doc.data().gameId}`);
        return updateDoc(doc.ref, { status: "finished" });
      });
      
      if (closePromises.length > 0) {
        await Promise.all(closePromises);
        console.log(`✅ Closed ${closePromises.length} existing active questions in admin's game`);
      }

      // Create new question ONLY for this admin's game
      const docRef = await addDoc(collection(db, "questions"), {
        gameId: adminCurrentGameId,           // ← SPECIFIC to this admin's game
        templateId: template.id,
        question: template.text,
        options: template.options.map(opt => opt.optionText),
        status: "active",
        actual_result: null,
        createdAt: new Date(),
        createdBy: playerId                  // ← SPECIFIC to this admin
      });

      console.log(`✅ Question created successfully with ID: ${docRef.id} for game: ${adminCurrentGameId}`);
      Alert.alert('Success', `Question created: ${template.type}! Only players in your game can see it.`);
      
    } catch (error: any) {
      console.error("❌ Error creating question from template:", error);
      Alert.alert('Error', 'Failed to create question: ' + (error?.message || 'Unknown error'));
    }
  }, [adminCurrentGameId, playerId, questionTemplates]);

  // FIXED: Close question only in admin's game
  const adminCloseQuestion = useCallback(async () => {
    if (!currentQuestionId) {
      Alert.alert('Error', 'No active question!');
      return;
    }

    if (!adminCurrentGameId) {
      Alert.alert('Error', 'No active game!');
      return;
    }

    try {
      // Verify this question belongs to the admin's game
      const questionRef = doc(db, "questions", currentQuestionId);
      const questionSnap = await getDoc(questionRef);
      
      if (!questionSnap.exists()) {
        Alert.alert('Error', 'Question not found!');
        return;
      }
      
      const questionData = questionSnap.data();
      if (questionData.gameId !== adminCurrentGameId || questionData.createdBy !== playerId) {
        Alert.alert('Error', 'You can only close questions in your own game!');
        return;
      }

      await updateDoc(questionRef, {
        status: "closed"
      });
      
      console.log(`✅ Question closed in game: ${adminCurrentGameId}`);
      Alert.alert('Success', 'Question closed for players in your game!');
      
    } catch (error) {
      console.error("Error:", error);
      Alert.alert('Error', 'Failed to close question');
    }
  }, [currentQuestionId, adminCurrentGameId, playerId]);

  // Games functionality 
  const fetchActiveGames = useCallback(async () => {
    try {
      const gamesRef = collection(db, 'games');
      const q = query(gamesRef, where('status', '==', 'active'));
      const querySnapshot = await getDocs(q);

      const names: string[] = [];
      const games: Game[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.name) {
          names.push(data.name);
          games.push({
            id: doc.id,
            ...data
          } as Game);
        }
      });

      setGameNames(names);
      setAllGames(games);
    } catch (error) {
      console.error('Error fetching active games:', error);
    }
  }, []);

  // FIXED: Join game functionality
  const joinGameButton = useCallback(async (gameName: string) => {
    try {
      console.log('🎮 Player attempting to join game:', gameName);
      console.log('🎮 Available games:', allGames.map(g => g.name));
      
      // Find the game in our allGames array
      const selectedGame = allGames.find(game => game.name === gameName);
      
      if (!selectedGame) {
        console.log(`❌ Game not found: ${gameName}`);
        Alert.alert('Error', `Game not found: ${gameName}`);
        return;
      }


      console.log('Found game:', selectedGame);
    // First, remove user from previous game if exists
    if (currentGameId) {
      console.log('Removing user from previous game:', currentGameId);
      const previousGameRef = doc(db, "games", currentGameId);
      const previousGameDoc = await getDoc(previousGameRef);

      console.log('✅ Found game:', selectedGame);
      console.log('✅ Game ID:', selectedGame.id);

      
      if (previousGameDoc.exists()) {
        const previousGameData = previousGameDoc.data();
        const updatedLiveViewers = (previousGameData.liveViewers || [])
          .filter((email: string) => email !== currentUser.email);
        
        await updateDoc(previousGameRef, {
          liveViewers: updatedLiveViewers
        });
        console.log('Removed user from previous game live viewers');
      }
    }
    
    // Then, add user to new game
    const gameRef = doc(db, "games", selectedGame.id);
    const gameDoc = await getDoc(gameRef);
    
    if (gameDoc.exists()) {
      const gameData = gameDoc.data();
      const liveViewers = Array.from(new Set([...(gameData.liveViewers || []), currentUser.email]));
      const totalViewers = Array.from(new Set([...(gameData.totalViewers || []), currentUser.email]));
      
      await updateDoc(gameRef, {
        liveViewers,
        totalViewers
      });
      console.log('Added user to new game viewers');
    }


      setCurrentGameId(selectedGame.id);
      setCurrentGame(selectedGame.name);
      setCurrentGameURL(selectedGame.url || '');
      setPlayerSelectedGame(selectedGame.name);
      setPlayerSelectedGameURL(selectedGame.url || '');
      setCurrentView('player');
      
      console.log('✅ Player successfully joined game:', selectedGame.name);
      console.log('✅ Current game ID set to:', selectedGame.id);
      
      Alert.alert('Success', `Joined game: ${gameName}`);
      
    } catch (error) {
      console.error('❌ Error joining game:', error);
      Alert.alert('Error', 'Failed to join game');
    }
  }, [allGames]);

  useEffect(() => {
    fetchActiveGames();
  }, [fetchActiveGames]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchActiveGames();
    setRefreshing(false);
  };

  // FIXED: End game functionality
  const adminEndedGame = useCallback(async () => {
    console.log('=== END GAME CLICKED ===');
    console.log('Admin Current Game ID:', adminCurrentGameId);
    
    if (!adminCurrentGameId) {
      Alert.alert('Error', 'No active game to end!');
      return;
    }

    try {
      console.log('Attempting to close game:', adminCurrentGameId);
      
      const gameRef = doc(db, "games", adminCurrentGameId);
      
      // Check if game exists first
      const gameSnap = await getDoc(gameRef);
      if (!gameSnap.exists()) {
        console.log('Game document does not exist');
        Alert.alert('Error', 'Game not found in database');
        return;
      }
      
      // Verify this admin owns this game
      const gameData = gameSnap.data();
      if (gameData.createdBy !== playerId) {
        Alert.alert('Error', 'You can only end games you created!');
        return;
      }
      
      console.log('Game exists and belongs to admin, updating status...');
      await updateDoc(gameRef, {
        status: "ended",
        endedAt: new Date(),
        endedBy: playerId
      });

      console.log('✅ Game status updated successfully');
      Alert.alert('Success', 'Game ended successfully! All players have been notified.');
      
    } catch (error: any) {
      console.error("❌ Error ending game:", error);
      Alert.alert('Error', 'Failed to end game: ' + (error?.message || 'Unknown error'));
    }
  }, [adminCurrentGameId, playerId]);

  // FIXED: Set answer only for admin's game question
  const adminSetAnswer = useCallback(async (answer: string) => {
    if (!currentQuestionId) {
      Alert.alert('Error', 'No question active!');
      return;
    }

    if (!adminCurrentGameId) {
      Alert.alert('Error', 'No active game!');
      return;
    }

    try {
      // Verify this question belongs to the admin's game
      const questionRef = doc(db, "questions", currentQuestionId);
      const questionSnap = await getDoc(questionRef);
      
      if (!questionSnap.exists()) {
        Alert.alert('Error', 'Question not found!');
        return;
      }
      
      const questionData = questionSnap.data();
      if (questionData.gameId !== adminCurrentGameId || questionData.createdBy !== playerId) {
        Alert.alert('Error', 'You can only set answers for questions in your own game!');
        return;
      }

      await updateDoc(questionRef, {
        actual_result: answer,
        status: "finished"
      });
      
      console.log(`✅ Answer set for question in game: ${adminCurrentGameId}`);
      Alert.alert('Success', `Answer set to: ${answer}. Players in your game can now see the results!`);
      
    } catch (error) {
      console.error("Error:", error);
      Alert.alert('Error', 'Failed to set answer');
    }
  }, [currentQuestionId, adminCurrentGameId, playerId]);

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
        
        const updatePromise = updateUserStats(guess.playerId, isCorrect, currentGameId || '');
        updatePromises.push(updatePromise);
      });

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

  // PLAYER FUNCTIONS
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
        const guessDoc = guessSnapshot.docs[0];
        await updateDoc(doc(db, "guesses", guessDoc.id), {
          prediction: choice,
          timestamp: new Date()
        });
      } else {
        await addDoc(collection(db, "guesses"), {
          prediction: choice,
          questionId: currentQuestionId,
          playerId: playerId,
          playerEmail: currentUser?.email || null,
          userName: currentUserData?.userName || currentUserData?.firstName || currentUser?.email || `Player_${playerId.slice(0, 6)}`,
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

  // Real-time data loading
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
      
      {/* View Toggle */}
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
      ) : (
        <View style={styles.toggleContainer}>
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
      )}

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
          
          {!adminGameOpen ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Step 1: Create Game</Text>
              <Text style={styles.infoText}>
                📌 You can only have one active game at a time
              </Text>

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
                placeholder="Game URL (YouTube link)" 
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
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Active Game</Text>
              <Text style={styles.gameStatusText}>
                🎮 Game: {currentGame}
              </Text>
              <Text style={styles.gameStatusText}>
                🆔 Game ID: {adminCurrentGameId}
              </Text>
            </View>
          )}

          {currentGameURL !== "" && adminGameOpen && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Game Stream Control</Text>
              <YoutubePlayer
                height={200}
                play={isVideoPlaying}
                videoId={getURLID(currentGameURL)}
                onChangeState={onVideoStateChange}
              />
              <TouchableOpacity style={styles.primaryButton} onPress={togglePlaying}>
                <Text style={styles.buttonText}>
                  {isVideoPlaying ? "⏸️ Pause" : "▶️ Play"}
                </Text>
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

          {/* Create Questions from Templates */}
          {adminGameOpen && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Step 2: Create Question</Text>
              <Text style={styles.infoText}>
                📝 Creating a new question will close any active question in YOUR game only
              </Text>
              
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
                      {template.type === 'drive_result' && '🎯 '}
                      {template.type === 'qb_action' && '🏃 '}
                      {template.text}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* Control Game */}
          {adminGameOpen && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Step 3: Control Game</Text>
              
              <TouchableOpacity style={styles.warningButton} onPress={adminCloseQuestion}>
                <Text style={styles.buttonText}>🛑 Close Predictions</Text>
              </TouchableOpacity>
              
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

              <TouchableOpacity style={styles.dangerButton} onPress={adminEndedGame}>
                <Text style={styles.buttonText}>🔚 End Game</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Game Status */}
          <View style={styles.statusSection}>
            <Text style={styles.statusTitle}>Current Status:</Text>
            <Text style={styles.statusText}>📱 Game: {currentGame}</Text>
            <Text style={styles.statusText}>❓ Question: {currentQuestion}</Text>
            <Text style={styles.statusText}>🔄 Status: {predictionStatus}</Text>
            <Text style={styles.statusText}>✅ Answer: {correctAnswer}</Text>
            <Text style={styles.statusText}>👥 Total Predictions: {allGuesses.length}</Text>
            <Text style={styles.statusText}>🆔 Game ID: {adminCurrentGameId || 'None'}</Text>
            <Text style={styles.statusText}>🔢 Question ID: {currentQuestionId || 'None'}</Text>
          </View>
        </ScrollView>

      ) : currentView === 'games' ? (
        // GAMES VIEW
        <ScrollView 
          style={styles.container}
          keyboardShouldPersistTaps="always"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>📃 Select A Game</Text>
          <Text style={styles.welcomeText}>Welcome, {currentUser?.email}!</Text>
          <Text style={styles.infoText}>
            🎮 {allGames.length} active games available from all game masters
          </Text>
          
          {allGames.length === 0 ? (
            <View style={styles.section}>
              <Text style={styles.noGamesText}>
                No active games found. 
                {isGameMasterAccount ? ' Create one in the GM tab!' : ' Wait for a game master to create a game.'}
              </Text>
            </View>
          ) : (
            allGames.map((game, index) => (
              <TouchableOpacity
                key={`${game.id}-${index}`}
                style={[
                  styles.gameButton,
                  playerSelectedGame === game.name && styles.selectedGameButton
                ]}
                onPress={() => joinGameButton(game.name)}
                activeOpacity={0.7}
              >
                <View style={styles.gameButtonContent}>
                  <Text style={styles.gameButtonTitle}>{game.name}</Text>
                  <Text style={styles.gameButtonSubtitle}>
                    Created by: {game.createdBy === playerId ? 'You' : `GM ${game.createdBy.slice(0, 6)}`}
                  </Text>
                  <Text style={styles.gameButtonTime}>
                    {game.createdAt ? game.createdAt.toLocaleString() : 'Recently'}
                  </Text>
                </View>
                {playerSelectedGame === game.name && (
                  <Text style={styles.selectedBadge}>✓ JOINED</Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      ) : (
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
              <Text style={styles.welcomeText}>Welcome, {currentUser?.email}!</Text>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📋 Getting Started</Text>
                <Text style={styles.instructionText}>
                  1. Go to the Games tab
                </Text>
                <Text style={styles.instructionText}>
                  2. Select an active game
                </Text>
                <Text style={styles.instructionText}>
                  3. Return here to make predictions
                </Text>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.title}>🎯 MAKE PREDICTION</Text>
              <Text style={styles.welcomeText}>Welcome, {currentUser?.email}!</Text>
              
              {currentGameURL && (
                <View style={styles.section}>
                  <YoutubePlayer
                    height={200}
                    play={isVideoPlaying}
                    videoId={getURLID(currentGameURL)}
                    onChangeState={onVideoStateChange}
                  />
                  <TouchableOpacity style={styles.primaryButton} onPress={togglePlaying}>
                    <Text style={styles.buttonText}>
                      {isVideoPlaying ? "⏸️ Pause" : "▶️ Play"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
          
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
                    disabled={userPrediction !== ''}
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

              {/* Enhanced Debug Info */}
              <View style={styles.debugSection}>
                <Text style={styles.debugTitle}>🔧 Debug Info</Text>
                <Text style={styles.debugText}>Is GameMaster: {isGameMasterAccount ? 'Yes' : 'No'}</Text>
                <Text style={styles.debugText}>Selected Game: {playerSelectedGame}</Text>
                <Text style={styles.debugText}>Current Game ID: {currentGameId}</Text>
                <Text style={styles.debugText}>Admin Game ID: {adminCurrentGameId}</Text>
                <Text style={styles.debugText}>Question ID: {currentQuestionId}</Text>
                <Text style={styles.debugText}>Player ID: {playerId}</Text>
                <Text style={styles.debugText}>Current Question: {currentQuestion}</Text>
                <Text style={styles.debugText}>Prediction Status: {predictionStatus}</Text>
                <Text style={styles.debugText}>Question Options: {questionOptions.join(', ')}</Text>
                <Text style={styles.debugText}>All Active Games: {allGames.map(g => `${g.name}(${g.id.slice(0,6)})`).join(', ')}</Text>
              </View>
            </>
          )}
        </ScrollView>
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
  infoText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
    color: '#34495e',
    backgroundColor: '#e8f4fd',
    padding: 10,
    borderRadius: 8,
  },
  instructionText: {
    fontSize: 16,
    color: '#34495e',
    marginBottom: 8,
    paddingLeft: 10,
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
  warningButton: {
    backgroundColor: '#f39c12',
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
  gameStatusText: {
    fontSize: 16,
    color: '#34495e',
    marginBottom: 5,
    fontWeight: '600',
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
  noGamesText: {
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
  gameButton: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  selectedGameButton: {
    borderLeftColor: '#27ae60',
    backgroundColor: '#f8fff8',
  },
  gameButtonContent: {
    flex: 1,
  },
  gameButtonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  gameButtonSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 3,
  },
  gameButtonTime: {
    fontSize: 12,
    color: '#95a5a6',
  },
  selectedBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: '#27ae60',
    color: 'white',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 'bold',
  },
  debugSection: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#6c757d',
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#495057',
  },
  debugText: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 3,
    fontFamily: 'monospace',
  },
});