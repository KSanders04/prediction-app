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
} from 'react-native';

// Import irebase configuration
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
  increment,
  getDoc,
  setDoc
} from 'firebase/firestore';
import YoutubePlayer from 'react-native-youtube-iframe'

// Types
interface Guess {
  id: string;
  prediction: string;
  questionId: string;
  playerId: string;
  timestamp: Timestamp;
}

export default function Home() {
  // State variables
  const [currentView, setCurrentView] = useState<'player' | 'admin'>('admin');
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

  const [isAdminAccount, setIsAdminAccount] = useState<boolean | null>(null)

  const [gameURL, setGameURL] = useState('')
  const [currentGameURL, setCurrentGameURL] = useState('')
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)

  
  // Generate unique player ID
  const [playerId] = useState('Player_' + Math.random().toString(36).substr(2, 6));

  // Load real-time data when question changes
  useEffect(() => {
    if (currentQuestionId) {
      const unsubscribe = loadGuessesRealTime();
      return () => unsubscribe && unsubscribe();
    }
  }, [currentQuestionId]);

useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.isAdmin !== null) {
          setIsAdminAccount(data.isAdmin);
          console.log('User isAdmin:', data.isAdmin);
        } else {
          console.log('isAdmin is null');
        }
      }
    } else {
      setIsAdminAccount(null); // or false, depending on your logic
    }
  });

  return () => unsubscribe(); // cleanup
}, []);

  // MEMOIZED HANDLERS (prevents re-renders)
  const handleGameNameChange = useCallback((text: string) => {
    setGameName(text);
  }, []);

  const handleViewChange = useCallback((view: 'player' | 'admin') => {
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
  const initializeUser = useCallback(async () => {
    try {
      const userRef = doc(db, "users", playerId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        // Create new user
        await setDoc(userRef, {
          name: playerId,
          totalPoints: 0,
          gamesPlayed: 0,
          correctPredictions: 0,
          totalPredictions: 0,
          lastPlayed: new Date()
        });
      }
    } catch (error) {
      console.error("Error initializing user:", error);
    }
  }, [playerId]);

  const updateUserStats = useCallback(async (userId: string, isCorrect: boolean, gameId: string) => {
    try {
      const userRef = doc(db, "users", userId);
      const updates: any = {
        totalPredictions: increment(1),
        lastPlayed: new Date()
      };

      if (isCorrect) {
        updates.correctPredictions = increment(1);
        updates.totalPoints = increment(10); // 10 points per correct prediction
      }

      await updateDoc(userRef, updates);
    } catch (error) {
      console.error("Error updating user stats:", error);
    }
  }, []);



  // ADMIN FUNCTIONS
  const adminCreateGame = useCallback(async () => {
    if (!gameName.trim()) {
      Alert.alert('Error', 'Please enter a game name!');
      return;
    }

    try {
      const videoID = getURLID(gameURL)
      const docRef = await addDoc(collection(db, "games"), {
        name: gameName,
        status: "active",
        createdAt: new Date(),
        url: gameURL,
        videoId: videoID
      });
      
      setCurrentGameId(docRef.id);
      setCurrentGame(gameName);
      setCurrentGameURL(gameURL);
      setGameName('');
      setGameURL('')
      Alert.alert('Success', `Game created: ${gameName}`);
      
    } catch (error) {
      console.error("Error creating game:", error);
      Alert.alert('Error', 'Failed to create game');
    }
  }, [gameName, gameURL]);

  const adminCreateQuestion = useCallback(async (questionType: string) => {
    if (!currentGameId) {
      Alert.alert('Error', 'Create a game first!');
      return;
    }

    const questions: { [key: string]: { text: string; options: string[] } } = {
      FIELD_GOAL: {
        text: "Will the field goal be MADE or MISSED?",
        options: ["MADE", "MISSED"]
      },
      COIN_FLIP: {
        text: "Coin flip: HEADS or TAILS?", 
        options: ["HEADS", "TAILS"]
      },
      NEXT_PLAY: {
        text: "Next play: RUSH or PASS?",
        options: ["RUSH", "PASS"]
      }
    };

    const questionData = questions[questionType];

    try {
      const docRef = await addDoc(collection(db, "predictions"), {
        gameId: currentGameId,
        question: questionData.text,
        options: questionData.options,
        status: "active",
        actual_result: null,
        createdAt: new Date()
      });
      
      setCurrentQuestionId(docRef.id);
      setCurrentQuestion(questionData.text);
      setQuestionOptions(questionData.options);
      setPredictionStatus('Predictions OPEN');
      setUserPrediction('');
      
      Alert.alert('Success', `Question created: ${questionData.text}`);
      
    } catch (error) {
      console.error("Error creating question:", error);
      Alert.alert('Error', 'Failed to create question');
    }
  }, [currentGameId]);

  const adminCloseQuestion = useCallback(async () => {
    if (!currentQuestionId) {
      Alert.alert('Error', 'No active question!');
      return;
    }

    try {
      await updateDoc(doc(db, "predictions", currentQuestionId), {
        status: "closed"
      });
      
      setPredictionStatus('Predictions CLOSED');
      Alert.alert('Success', 'Question closed!');
      
    } catch (error) {
      console.error("Error:", error);
      Alert.alert('Error', 'Failed to close question');
    }
  }, [currentQuestionId]);
  const adminEndedGame = useCallback(async () => {
    if (!currentGameId) {
      Alert.alert('Error', 'No active game!');
      return;
    }

    try {
      await updateDoc(doc(db, "games", currentGameId), {
        status: "closed"
      });
      
      setCurrentGameId(null);
      Alert.alert('Success', 'Game Ended!');
      
    } catch (error) {
      console.error("Error:", error);
      Alert.alert('Error', 'Failed to close game');
    }
  }, [currentGameId]);

  const adminSetAnswer = useCallback(async (answer: string) => {
    if (!currentQuestionId) {
      Alert.alert('Error', 'No question active!');
      return;
    }

    try {
      await updateDoc(doc(db, "predictions", currentQuestionId), {
        actual_result: answer,
        status: "finished"
      });
      
      setCorrectAnswer(answer);
      setPredictionStatus('Results Available');
      Alert.alert('Success', `Answer set to: ${answer}`);
      
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

      snapshot.forEach((doc) => {
        const guess = doc.data();
        total++;
        if (guess.prediction === correctAnswer) {
          winners++;
        }
      });

      Alert.alert(
        'Results', 
        `🏆 FINAL RESULTS 🏆\n\nCorrect Answer: ${correctAnswer}\nWinners: ${winners} out of ${total} players\n\nAccuracy: ${total > 0 ? Math.round((winners/total) * 100) : 0}%`
      );
      
    } catch (error) {
      console.error("Error:", error);
      Alert.alert('Error', 'Failed to calculate winners');
    }
  }, [currentQuestionId, correctAnswer]);

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

    try {
      await addDoc(collection(db, "guesses"), {
        prediction: choice,
        questionId: currentQuestionId,
        playerId: playerId,
        timestamp: new Date()
      });

      setUserPrediction(choice);
      Alert.alert('Success', `Your prediction: ${choice} has been submitted!`);
      
    } catch (error) {
      console.error("Error:", error);
      Alert.alert('Error', 'Failed to submit prediction');
    }
  }, [currentQuestionId, predictionStatus, playerId]);

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

  return (
    <SafeAreaView style={styles.app}>
      {/* View Toggle */}
      <View style={styles.toggleContainer}>
        {isAdminAccount !== null ? <TouchableOpacity 
          style={[styles.toggleButton, currentView === 'admin' && styles.activeToggle]}
          onPress={() => handleViewChange('admin')}
        >
          <Text style={[styles.toggleText, currentView === 'admin' && styles.activeToggleText]}>
            👨‍💼 Admin
          </Text>
        </TouchableOpacity> : null}
        <TouchableOpacity 
          style={[styles.toggleButton, currentView === 'player' && styles.activeToggle]}
          onPress={() => handleViewChange('player')}
        >
          <Text style={[styles.toggleText, currentView === 'player' && styles.activeToggleText]}>
            🎯 Player
          </Text>
        </TouchableOpacity>
      </View>

      {isAdminAccount !== null ? (currentView === 'admin' ? (
        // ADMIN VIEW
        <ScrollView 
          style={styles.container}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>🔧 ADMIN PANEL</Text>
          
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

          {/* Create Questions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Step 2: Create Question</Text>
            <TouchableOpacity 
              style={styles.adminButton} 
              onPress={() => adminCreateQuestion('FIELD_GOAL')}
            >
              <Text style={styles.buttonText}>🥅 Field Goal Question</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.adminButton} 
              onPress={() => adminCreateQuestion('COIN_FLIP')}
            >
              <Text style={styles.buttonText}>🪙 Coin Flip Question</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.adminButton} 
              onPress={() => adminCreateQuestion('NEXT_PLAY')}
            >
              <Text style={styles.buttonText}>🏈 Next Play Question</Text>
            </TouchableOpacity>
          </View>

          {/* Control Game */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Step 3: Control Game</Text>
            <TouchableOpacity style={styles.dangerButton} onPress={adminCloseQuestion}>
              <Text style={styles.buttonText}>🛑 Close Predictions</Text>
            </TouchableOpacity>
              {currentGameId !== null ? <TouchableOpacity style={styles.dangerButton} onPress={adminEndedGame}>
              <Text style={styles.buttonText}>🛑 End Game</Text>
            </TouchableOpacity>: null}
            
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
      ): <ScrollView 
          style={styles.container}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>🎯 MAKE PREDICTION</Text>
          
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
                      {isCurrentUser ? '👤 You' : guess.playerId}: {guess.prediction}
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
        </ScrollView>) : (
        // PLAYER VIEW
        <ScrollView 
          style={styles.container}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>🎯 MAKE PREDICTION</Text>
          
          {/* Game Info */}
          <View style={styles.gameInfo}>
            <Text style={styles.gameText}>🏈 {currentGameId !== null ? currentGame : null}</Text>
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
                      {isCurrentUser ? '👤 You' : guess.playerId}: {guess.prediction}
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
    marginBottom: 25,
    color: '#2c3e50',
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
});
