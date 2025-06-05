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
  RefreshControl,
} from 'react-native';

// Import from firebaseFunctions instead of direct Firebase imports
import {
  initializeUser,
  initializeQuestionTemplates,
  loadQuestionTemplates,
  createGame,
  listenToActiveGames,
  listenToAdminGames,
  endGame,
  createQuestionFromTemplate,
  listenToActiveQuestions,
  closeQuestion,
  setAnswer,
  makePrediction,
  checkUserPrediction,
  listenToGuesses,
  joinGame,
  calculateWinners,
  loadUserData,
  checkUserGameMasterStatus
} from '../../components/firebaseFunctions';

// Still need auth for user state
import { auth } from '../../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { router } from 'expo-router';
import YoutubePlayer from 'react-native-youtube-iframe';

// Define interfaces for type safety
interface Game {
  id: string;
  name: string;
  status: string;
  createdBy: string;
  url?: string;
  videoId?: string;
  createdAt: Date;
}

interface Question {
  id: string;
  gameId: string;
  question: string;
  options: string[];
  status: "active" | "closed" | "finished";
  actual_result: string;
  createdAt: Date;
  createdBy: string;
}

interface Guess {
  id: string;
  prediction: string;
  questionId: string;
  playerId: string;
  playerEmail?: string;
  timestamp: any;
}

interface QuestionTemplate {
  id: string;
  text: string;
  options: Array<{ optionText: string }>;
  type: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export default function Home() {
  // State variables - same as before
  const [currentView, setCurrentView] = useState<'player' | 'gamemaster' | 'games'>('player');
  const [allGames, setAllGames] = useState<Game[]>([]);
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
  const [isGameMasterAccount, setIsGameMasterAccount] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [gameURL, setGameURL] = useState('');
  const [currentGameURL, setCurrentGameURL] = useState('');
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [questionTemplates, setQuestionTemplates] = useState<QuestionTemplate[]>([]);
  const [playerSelectedGame, setPlayerSelectedGame] = useState<string | null>(null);
  const [adminGameOpen, setAdminGameOpen] = useState<boolean>(false);
  const [currentUserData, setCurrentUserData] = useState<any>(null);
  const [adminCurrentGameId, setAdminCurrentGameId] = useState<string | null>(null);

  // Replace the existing loadCurrentUserData function with:
const loadCurrentUserData = useCallback(async () => {
  if (!playerId) return;
  
  try {
    const userData = await loadUserData(playerId);
    if (userData) {
      setCurrentUserData(userData);
    }
  } catch (error) {
    console.error('Error loading user data:', error);
  }
}, [playerId]);

  // Check authentication and setup - using firebaseFunctions
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      setCurrentUser(user);
      setPlayerId(user.uid);
      
      // Use functions from firebaseFunctions.tsx
      await initializeUser(user);
      await loadCurrentUserData();
      
      // Use firebaseFunctions instead of direct DB calls
      const { isGamemaster, userData } = await checkUserGameMasterStatus(user.uid);
      setIsGameMasterAccount(isGamemaster);
      
      if (userData) {
        // Initialize templates using firebaseFunctions
        await initializeQuestionTemplates();
        const templates = await loadQuestionTemplates();
        setQuestionTemplates(templates);
        
        await loadCurrentUserData();
      }
    } else {
      router.replace('/login');
    }
  });

  return () => unsubscribe();
}, [loadCurrentUserData]);

  // Listen for games - using firebaseFunctions
  useEffect(() => {
    if (!playerId) return;
    
    // Listen for all active games using firebaseFunctions
    const unsubscribeAllGames = listenToActiveGames((games) => {
      setAllGames(games);
    });

    // If user is admin, listen for their games using firebaseFunctions
    let unsubscribeAdminGames: (() => void) | undefined;
    if (isGameMasterAccount) {
      unsubscribeAdminGames = listenToAdminGames(playerId, (game) => {
        if (game) {
          setAdminCurrentGameId(game.id);
          setCurrentGameId(game.id);
          setCurrentGame(game.name);
          setCurrentGameURL(game.url || '');
          setAdminGameOpen(true);
          
          // Listen for questions in admin's game using firebaseFunctions
          listenForActiveQuestions(game.id);
        } else {
          setAdminCurrentGameId(null);
          setAdminGameOpen(false);
          if (!playerSelectedGame) {
            resetGameState();
          }
        }
      });
    }

    return () => {
      unsubscribeAllGames();
      if (unsubscribeAdminGames) unsubscribeAdminGames();
    };
  }, [playerId, isGameMasterAccount, playerSelectedGame]);

  // Listen for questions when game is selected - using firebaseFunctions
  const listenForActiveQuestions = useCallback((gameId: string) => {
    const unsubscribe = listenToActiveQuestions(gameId, (question) => {
      if (question) {
        setCurrentQuestionId(question.id);
        setCurrentQuestion(question.question);
        setQuestionOptions(question.options);
        setCorrectAnswer(question.actual_result || 'Not set');
        
        switch (question.status) {
          case "active":
            setPredictionStatus('Predictions OPEN');
            break;
          case "closed":
            setPredictionStatus('Predictions CLOSED');
            break;
          case "finished":
            setPredictionStatus('Results Available');
            break;
        }
        
        checkUserPredictionWrapper(question.id);
      } else {
        resetQuestionState();
      }
    });

    return unsubscribe;
  }, [playerId]);

  // Listen for guesses when question is active - using firebaseFunctions
  useEffect(() => {
    if (!currentQuestionId) return;
    
    const unsubscribe = listenToGuesses(currentQuestionId, (guesses) => {
      setAllGuesses(guesses);
    });

    return () => unsubscribe();
  }, [currentQuestionId]);

  // Check if user already made a prediction - using firebaseFunctions
  const checkUserPredictionWrapper = useCallback(async (questionId: string) => {
    if (!playerId) return;
    
    try {
      const prediction = await checkUserPrediction(questionId, playerId);
      setUserPrediction(prediction);
    } catch (error) {
      console.error('Error checking user prediction:', error);
    }
  }, [playerId]);

  // Reset functions
  const resetGameState = () => {
    setCurrentGameId(null);
    setCurrentGame('No game active');
    setCurrentGameURL('');
    resetQuestionState();
  };

  const resetQuestionState = () => {
    setCurrentQuestionId(null);
    setCurrentQuestion('Waiting for question...');
    setPredictionStatus('Waiting...');
    setQuestionOptions([]);
    setCorrectAnswer('Not set');
    setUserPrediction('');
    setAllGuesses([]);
  };

  // ADMIN FUNCTIONS - Now using firebaseFunctions
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
      const videoID = getURLID(gameURL);
      await createGame({
        name: gameName,
        url: gameURL,
        videoId: videoID,
        createdBy: playerId,
      });
      
      setGameName('');
      setGameURL('');
      Alert.alert('Success', `Game "${gameName}" created successfully!`);
      
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create game');
    }
  }, [gameName, gameURL, playerId]);

  const adminCreateQuestionFromTemplate = useCallback(async (templateType: string) => {
    if (!adminCurrentGameId) {
      Alert.alert('Error', 'Create a game first!');
      return;
    }

    const template = questionTemplates.find(t => t.type === templateType);
    if (!template) {
      Alert.alert('Error', 'Template not found!');
      return;
    }

    try {
      await createQuestionFromTemplate(adminCurrentGameId, template, playerId);
      Alert.alert('Success', `Question created: ${template.type}!`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create question');
    }
  }, [adminCurrentGameId, playerId, questionTemplates]);

  const adminCloseQuestion = useCallback(async () => {
    if (!currentQuestionId || !adminCurrentGameId) {
      Alert.alert('Error', 'No active question or game!');
      return;
    }

    try {
      await closeQuestion(currentQuestionId, adminCurrentGameId, playerId);
      Alert.alert('Success', 'Question closed!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to close question');
    }
  }, [currentQuestionId, adminCurrentGameId, playerId]);

  const adminSetAnswer = useCallback(async (answer: string) => {
    if (!currentQuestionId || !adminCurrentGameId) {
      Alert.alert('Error', 'No question active or no game!');
      return;
    }

    try {
      await setAnswer(currentQuestionId, answer, adminCurrentGameId, playerId);
      Alert.alert('Success', `Answer set to: ${answer}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to set answer');
    }
  }, [currentQuestionId, adminCurrentGameId, playerId]);

  const adminCalculateWinners = useCallback(async () => {
    if (!currentQuestionId || correctAnswer === 'Not set') {
      Alert.alert('Error', 'Set the correct answer first!');
      return;
    }

    try {
      const results = await calculateWinners(currentQuestionId, correctAnswer);

      Alert.alert(
        'Results', 
        `🏆 FINAL RESULTS 🏆\n\nCorrect Answer: ${correctAnswer}\nWinners: ${results.winners} out of ${results.total} players\n\nAccuracy: ${results.accuracy}%\n\n📊 Stats Updated:\n• Solo players: ${results.soloPlayers}\n• Group players: ${results.groupPlayers}`
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to calculate winners');
    }
  }, [currentQuestionId, correctAnswer]);

  const adminEndedGame = useCallback(async () => {
    if (!adminCurrentGameId) {
      Alert.alert('Error', 'No active game to end!');
      return;
    }

    try {
      await endGame(adminCurrentGameId, playerId);
      Alert.alert('Success', 'Game ended successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to end game');
    }
  }, [adminCurrentGameId, playerId]);

  // PLAYER FUNCTIONS - Now using firebaseFunctions
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
      Alert.alert('Error', 'You must be logged in!');
      return;
    }

    if (userPrediction !== '') {
      Alert.alert('Error', 'You already made a prediction!');
      return;
    }

    try {
      await makePrediction({
        questionId: currentQuestionId,
        playerId: playerId,
        playerEmail: currentUser?.email,
        userName: currentUserData?.userName || currentUser?.email || `Player_${playerId.slice(0, 6)}`,
        prediction: choice,
      });
      
      setUserPrediction(choice);
      Alert.alert('Success', `Your prediction: ${choice} submitted!`);
      
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit prediction');
    }
  }, [currentQuestionId, predictionStatus, playerId, currentUser, currentUserData, userPrediction]);

  const joinGameButton = useCallback(async (gameName: string) => {
    try {
      const selectedGame = allGames.find(game => game.name === gameName);
      if (!selectedGame) {
        Alert.alert('Error', `Game not found: ${gameName}`);
        return;
      }
      
      // Join new game using firebaseFunctions
      await joinGame(selectedGame.id, currentUser.email);

      setCurrentGameId(selectedGame.id);
      setCurrentGame(selectedGame.name);
      setCurrentGameURL(selectedGame.url || '');
      setPlayerSelectedGame(selectedGame.name);
      setCurrentView('player');
      
      Alert.alert('Success', `Joined game: ${gameName}`);
      
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to join game');
    }
  }, [allGames, currentUser]);

  // UTILITY FUNCTIONS
  const onRefresh = async () => {
    setRefreshing(true);
    // Could add a getAllActiveGames function to firebaseFunctions if needed
    setRefreshing(false);
  };

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

  const handleGameNameChange = useCallback((text: string) => {
    setGameName(text);
  }, []);

  const handleViewChange = useCallback((view: 'player' | 'gamemaster' | 'games') => {
    setCurrentView(view);
  }, []);

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

      {/* Rest of the UI remains the same - just the Firebase logic is moved to firebaseFunctions */}
      {isGameMasterAccount && currentView === 'gamemaster' ? (
        // ADMIN VIEW - Same UI, using firebaseFunctions for logic
        <ScrollView 
          style={styles.container}
          keyboardShouldPersistTaps="always"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          
          <Text style={styles.title}>🔧 GAMEMASTER PANEL</Text>
          <Text style={styles.welcomeText}>Welcome {currentUserData?.firstName} {currentUserData?.lastName}!</Text>
          
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

          {/* Video Player Section */}
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
        // GAMES VIEW - Same UI
        <ScrollView 
          style={styles.container}
          keyboardShouldPersistTaps="always"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>📃 Select A Game</Text>
          <Text style={styles.welcomeText}>Welcome {currentUserData?.firstName} {currentUserData?.lastName}!</Text>
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
        // PLAYER VIEW - Same UI  
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
              <Text style={styles.welcomeText}>Welcome {currentUserData?.firstName} {currentUserData?.lastName}!</Text>
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
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// Styles remain exactly the same as your original file
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
});