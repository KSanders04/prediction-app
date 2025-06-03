// app/groupHome.tsx 
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
  RefreshControl,
  StyleSheet,
} from 'react-native';

import { auth, db } from '../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  addDoc,
  onSnapshot,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import YoutubePlayer from 'react-native-youtube-iframe';

interface Guess {
  id: string;
  prediction: string;
  questionId: string;
  playerId: string;
  playerEmail?: string;
  userName?: string;
  timestamp: Timestamp;
}

interface Game {
  id: string;
  name: string;
  status: string;
  createdBy: string;
  url?: string;
  videoId?: string;
  createdAt: Date;
}

interface GroupData {
  id: string;
  code: string;
  groupStatus: string;
  createdBy: string;
  members: string[];
  groupName: string;
  currentGameId?: string;
  currentGameName?: string;
  groupAdminID: string;
}

export default function GroupHome() {
  // State variables
  const [currentView, setCurrentView] = useState<'player' | 'leaderboard' | 'games'>('player');
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [currentGame, setCurrentGame] = useState('No game active');
  const [currentQuestion, setCurrentQuestion] = useState('Waiting for question...');
  const [predictionStatus, setPredictionStatus] = useState('Waiting...');
  const [userPrediction, setUserPrediction] = useState('');
  const [allGuesses, setAllGuesses] = useState<Guess[]>([]);
  const [questionOptions, setQuestionOptions] = useState<string[]>([]);
  const [correctAnswer, setCorrectAnswer] = useState('Not set');
  const [isGroupAdmin, setIsGroupAdmin] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [groupCode, setGroupCode] = useState<string>('');
  const [currentGameURL, setCurrentGameURL] = useState('');
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [playerSelectedGame, setPlayerSelectedGame] = useState<string | null>(null);
  const [groupData, setGroupData] = useState<GroupData | null>(null);
  const [groupDocId, setGroupDocId] = useState<string | null>(null);

  // Cleanup functions for listeners
  const [unsubscribeFunctions, setUnsubscribeFunctions] = useState<Array<() => void>>([]);

  // Authentication and group setup
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        setPlayerId(user.uid);
        await setupGroupData(user);
      } else {
        cleanupAllListeners();
        setCurrentUser(null);
        setPlayerId('');
        setIsGroupAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Cleanup function for all listeners
  const cleanupAllListeners = useCallback(() => {
    unsubscribeFunctions.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        try {
          unsubscribe();
        } catch (error) {
          console.error('Error cleaning up listener:', error);
        }
      }
    });
    setUnsubscribeFunctions([]);
  }, [unsubscribeFunctions]);

  // Add a listener to the cleanup list
  const addUnsubscribeFunction = useCallback((unsubscribe: () => void) => {
    setUnsubscribeFunctions(prev => [...prev, unsubscribe]);
  }, []);

  const setupGroupData = async (user: any) => {
    try {
      cleanupAllListeners();
      
      const groupsRef = collection(db, 'groups');

      // Check if user is admin
      const adminQuery = query(
        groupsRef,
        where('groupStatus', '==', 'active'),
        where('createdBy', '==', user.email)
      );
      const adminSnapshot = await getDocs(adminQuery);

      if (!adminSnapshot.empty) {
        const groupDoc = adminSnapshot.docs[0];
        const groupDocData = groupDoc.data();
        
        console.log('🔧 User is group admin');
        
        setGroupDocId(groupDoc.id);
        setGroupCode(groupDocData.code || '');
        setGroupMembers(groupDocData.members || []);
        setIsGroupAdmin(true);
        
        const groupInfo: GroupData = {
          id: groupDoc.id,
          ...groupDocData
        } as GroupData;
        setGroupData(groupInfo);
        
        // Set up group listener
        const groupUnsubscribe = setupGroupListener(groupDoc.id);
        addUnsubscribeFunction(groupUnsubscribe);
        
        // Auto-select game if exists
        if (groupDocData.currentGameId && groupDocData.currentGameName) {
          console.log('🎮 Auto-selecting admin game:', groupDocData.currentGameName);
          await selectGameForGroup(groupDocData.currentGameId, groupDocData.currentGameName, groupDocData.url);
        }
        
      } else {
        // Check if user is a member
        const memberQuery = query(
          groupsRef,
          where('groupStatus', '==', 'active'),
          where('members', 'array-contains', user.uid)
        );
        const memberSnapshot = await getDocs(memberQuery);

        if (!memberSnapshot.empty) {
          const groupDoc = memberSnapshot.docs[0];
          const groupDocData = groupDoc.data();
          
          console.log('🔧 User is group member');
          
          setGroupDocId(groupDoc.id);
          setGroupCode(groupDocData.code || '');
          setGroupMembers(groupDocData.members || []);
          setIsGroupAdmin(false);
          
          const groupInfo: GroupData = {
            id: groupDoc.id,
            ...groupDocData
          } as GroupData;
          setGroupData(groupInfo);
          
          // Set up group listener
          const groupUnsubscribe = setupGroupListener(groupDoc.id);
          addUnsubscribeFunction(groupUnsubscribe);
          
          // Auto-select game if exists
          if (groupDocData.currentGameId && groupDocData.currentGameName) {
            console.log('🎮 Auto-selecting member game:', groupDocData.currentGameName);
            await selectGameForGroup(groupDocData.currentGameId, groupDocData.currentGameName, groupDocData.url);
          }
          
        } else {
          console.log('❌ User is not in any active group');
          setIsGroupAdmin(false);
        }
      }
    } catch (error) {
      console.error('Error setting up group data:', error);
      setIsGroupAdmin(false);
    }
  };

  // Set up real-time listener for group changes
  const setupGroupListener = (groupDocId: string) => {
    console.log('📡 Setting up group listener');
    
    const groupDocRef = doc(db, 'groups', groupDocId);
    
    return onSnapshot(groupDocRef, async (doc) => {
      if (doc.exists()) {
        const groupDocData = doc.data();
        console.log('🔄 Group data updated');
        
        setGroupMembers(groupDocData.members || []);
        
        // Check for game changes
        if (groupDocData.currentGameId && groupDocData.currentGameName) {
          if (groupDocData.currentGameId !== currentGameId) {
            console.log('🎮 Group game changed to:', groupDocData.currentGameName);
            await selectGameForGroup(groupDocData.currentGameId, groupDocData.currentGameName, groupDocData.url);
          }
        } else {
          console.log('🚫 Group cleared game selection');
          clearGameSelection();
        }
      }
    }, (error) => {
      console.error('❌ Error in group listener:', error);
    });
  };

  // Select game for the group
  const selectGameForGroup = async (gameId: string, gameName: string, gameUrl?: string) => {
    try {
      console.log('🎯 Selecting game:', gameName);
      
      setCurrentGameId(gameId);
      setCurrentGame(gameName);
      setPlayerSelectedGame(gameName);
      
      // Get game URL if not provided
      if (!gameUrl) {
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        if (gameDoc.exists()) {
          const gameData = gameDoc.data();
          setCurrentGameURL(gameData.url || '');
        }
      } else {
        setCurrentGameURL(gameUrl);
      }
      
      console.log('✅ Game selected successfully');
      
    } catch (error) {
      console.error('❌ Error selecting game:', error);
    }
  };

  // Clear game selection
  const clearGameSelection = () => {
    console.log('🗑️ Clearing game selection');
    
    setCurrentGameId(null);
    setCurrentGame('No game active');
    setPlayerSelectedGame(null);
    setCurrentGameURL('');
    setCurrentQuestionId(null);
    setCurrentQuestion('Waiting for question...');
    setPredictionStatus('Waiting...');
    setQuestionOptions([]);
    setCorrectAnswer('Not set');
    setUserPrediction('');
    setAllGuesses([]);
  };

  // Listen for questions when game is selected
  useEffect(() => {
    if (currentGameId && playerId) {
      console.log('🎯 Setting up question listener for game:', currentGameId);
      
      const questionsQuery = query(
        collection(db, "questions"),
        where("gameId", "==", currentGameId),
        where("status", "in", ["active", "closed", "finished"]),
        orderBy("createdAt", "desc"),
        limit(1)
      );

      const questionUnsubscribe = onSnapshot(questionsQuery, (snapshot) => {
        console.log('📥 Question snapshot received, count:', snapshot.docs.length);
        
        if (!snapshot.empty) {
          const questionDoc = snapshot.docs[0];
          const questionData = questionDoc.data();
          
          console.log('✅ Found question:', questionData.question);
          
          if (questionData.gameId === currentGameId) {
            setCurrentQuestionId(questionDoc.id);
            setCurrentQuestion(questionData.question);
            setQuestionOptions(questionData.options || []);
            setCorrectAnswer(questionData.actual_result || 'Not set');
            
            if (questionData.status === "active") {
              setPredictionStatus('Predictions OPEN');
            } else if (questionData.status === "closed") {
              setPredictionStatus('Predictions CLOSED');
            } else if (questionData.status === "finished") {
              setPredictionStatus('Results Available');
            }
            
            checkUserPrediction(questionDoc.id);
          }
        } else {
          console.log('❌ No questions found');
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

      addUnsubscribeFunction(questionUnsubscribe);
      
      return () => {
        questionUnsubscribe();
      };
    }
  }, [currentGameId, playerId]);

  // Listen for guesses when question is active
  useEffect(() => {
    if (currentQuestionId) {
      console.log('👥 Setting up guess listener');
      
      const guessesQuery = query(
        collection(db, "guesses"),
        where("questionId", "==", currentQuestionId),
        orderBy("timestamp", "asc")
      );

      const guessUnsubscribe = onSnapshot(guessesQuery, (snapshot) => {
        const guesses: Guess[] = [];
        snapshot.forEach((doc) => {
          guesses.push({ id: doc.id, ...doc.data() } as Guess);
        });
        console.log(`👥 Updated guesses: ${guesses.length}`);
        setAllGuesses(guesses);
      });

      addUnsubscribeFunction(guessUnsubscribe);
      
      return () => {
        guessUnsubscribe();
      };
    }
  }, [currentQuestionId]);

  // Check if user already made a prediction
  const checkUserPrediction = useCallback(async (questionId: string) => {
    if (!playerId || !questionId) return;
    
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
      } else {
        setUserPrediction('');
      }
    } catch (error) {
      console.error('Error checking user prediction:', error);
    }
  }, [playerId]);

  // Fetch active games
  const fetchActiveGames = useCallback(async () => {
    try {
      const gamesRef = collection(db, 'games');
      const q = query(gamesRef, where('status', '==', 'active'));
      const querySnapshot = await getDocs(q);

      const games: Game[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        games.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date()
        } as Game);
      });

      setAllGames(games);
      console.log(`📋 Fetched ${games.length} active games`);
    } catch (error) {
      console.error('Error fetching active games:', error);
    }
  }, []);

  useEffect(() => {
    fetchActiveGames();
  }, [fetchActiveGames]);

  // Player prediction function
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
      console.log('🎯 Making prediction:', choice);
      
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
          timestamp: Timestamp.fromDate(new Date())
        });
      } else {
        await addDoc(collection(db, "guesses"), {
          prediction: choice,
          questionId: currentQuestionId,
          playerId: playerId,
          playerEmail: currentUser?.email || null,
          userName: currentUser?.email || `Player_${playerId.slice(0, 6)}`,
          timestamp: Timestamp.fromDate(new Date())
        });
      }
      
      setUserPrediction(choice);
      Alert.alert('Success', `Your prediction: ${choice} submitted!`);
      
    } catch (error) {
      console.error("Error submitting prediction:", error);
      Alert.alert('Error', 'Failed to submit prediction');
    }
  }, [currentQuestionId, predictionStatus, playerId, currentUser, userPrediction]);

  // Join game function
  const joinGameButton = useCallback(async (gameName: string) => {
    try {
      const selectedGame = allGames.find(game => game.name === gameName);
      if (!selectedGame) {
        Alert.alert('Error', `Game not found: ${gameName}`);
        return;
      }

      console.log('🎮 Setting group game to:', selectedGame.name);
      
      if (groupDocId) {
        await updateDoc(doc(db, 'groups', groupDocId), {
          currentGameId: selectedGame.id,
          currentGameName: selectedGame.name,
          url: selectedGame.url || '',
          lastGameUpdate: Timestamp.fromDate(new Date()),
          updatedBy: currentUser?.email || playerId
        });
        
        console.log('✅ Group game updated');
        Alert.alert('Success', `Group is now playing: ${gameName}\n\nAll members will see this game!`);
      } else {
        Alert.alert('Error', 'Group not found');
      }
      
    } catch (error) {
      console.error('❌ Error setting group game:', error);
      Alert.alert('Error', 'Failed to set group game');
    }
  }, [allGames, groupDocId, currentUser, playerId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchActiveGames();
    setRefreshing(false);
  };

  // Video functions
  const onVideoStateChange = (state: string) => {
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAllListeners();
    };
  }, []);

  // Loading state
  if (!currentUser || isGroupAdmin === null) {
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
      {isGroupAdmin ? (
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, currentView === 'games' && styles.activeToggle]}
            onPress={() => setCurrentView('games')}
          >
            <Text style={[styles.toggleText, currentView === 'games' && styles.activeToggleText]}>
              📃 Games
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, currentView === 'player' && styles.activeToggle]}
            onPress={() => setCurrentView('player')}
          >
            <Text style={[styles.toggleText, currentView === 'player' && styles.activeToggleText]}>
              🎯 Player
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, currentView === 'leaderboard' && styles.activeToggle]}
            onPress={() => setCurrentView('leaderboard')}
          >
            <Text style={[styles.toggleText, currentView === 'leaderboard' && styles.activeToggleText]}>
              🏆 Scores
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, currentView === 'player' && styles.activeToggle]}
            onPress={() => setCurrentView('player')}
          >
            <Text style={[styles.toggleText, currentView === 'player' && styles.activeToggleText]}>
              🎯 Player
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, currentView === 'leaderboard' && styles.activeToggle]}
            onPress={() => setCurrentView('leaderboard')}
          >
            <Text style={[styles.toggleText, currentView === 'leaderboard' && styles.activeToggleText]}>
              🏆 Leaderboard
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Content */}
      {currentView === 'games' ? (
        <ScrollView
          style={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.title}>📃 Select Group Game</Text>
          <Text style={styles.welcomeText}>Group Code: {groupCode}</Text>
          <Text style={styles.infoText}>
            🎮 {allGames.length} active games available
          </Text>
          <Text style={styles.warningText}>
            ⚠️ {isGroupAdmin ? 'As group admin, selecting a game sets it for ALL members!' : 'Only group admin can select games.'}
          </Text>
          
          {allGames.length === 0 ? (
            <View style={styles.section}>
              <Text style={styles.noGamesText}>
                No active games found. Wait for a Game Master to create one!
              </Text>
            </View>
          ) : (
            allGames.map((game, index) => (
              <TouchableOpacity
                key={`${game.id}-${index}`}
                style={[
                  styles.gameButton,
                  playerSelectedGame === game.name && styles.selectedGameButton,
                  !isGroupAdmin && styles.disabledGameButton
                ]}
                onPress={() => isGroupAdmin ? joinGameButton(game.name) : Alert.alert('Not Allowed', 'Only group admin can select games.')}
                activeOpacity={isGroupAdmin ? 0.7 : 1}
              >
                <View style={styles.gameButtonContent}>
                  <Text style={styles.gameButtonTitle}>{game.name}</Text>
                  <Text style={styles.gameButtonSubtitle}>
                    Game Master: {game.createdBy === currentUser.email ? 'You' : game.createdBy.slice(0, 20)}
                  </Text>
                  <Text style={styles.gameButtonTime}>
                    {game.createdAt ? game.createdAt.toLocaleString() : 'Recently'}
                  </Text>
                </View>
                {playerSelectedGame === game.name && (
                  <Text style={styles.selectedBadge}>✓ PLAYING</Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      ) : currentView === 'leaderboard' ? (
        <ScrollView style={styles.container}>
          <Text style={styles.title}>🏆 Leaderboard</Text>
          <Text style={styles.welcomeText}>Group Code: {groupCode}</Text>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Group Leaderboard</Text>
            <Text style={styles.instructionText}>
              Leaderboard functionality coming soon!
            </Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {!playerSelectedGame ? (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={styles.title}>🎯 MAKE PREDICTION</Text>
              <Text style={styles.welcomeText}>Group Code: {groupCode}</Text>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📋 Getting Started</Text>
                <Text style={styles.instructionText}>
                  {isGroupAdmin ? 
                    '1. Go to Games tab and select a game for your group' :
                    '1. Wait for group admin to select a game'
                  }
                </Text>
                <Text style={styles.instructionText}>
                  2. Game Master creates questions in main app
                </Text>
                <Text style={styles.instructionText}>
                  3. Questions appear here automatically
                </Text>
                <Text style={styles.instructionText}>
                  4. Make predictions when questions are active
                </Text>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.title}>🎯 MAKE PREDICTION</Text>
              <Text style={styles.welcomeText}>Group Code: {groupCode}</Text>
              
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
                <Text style={[
                  styles.statusBadge,
                  predictionStatus === 'Predictions OPEN' ? styles.openStatus : styles.closedStatus
                ]}>
                  {predictionStatus}
                </Text>
              </View>

              {/* Question Section */}
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
                  <Text style={styles.closedText}>🛑 Predictions closed. Waiting for results...</Text>
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
                  👥 Group Predictions ({allGuesses.length})
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
                          {isCurrentUser ? '👤 You' : (guess.playerEmail || 'Player')}: {guess.prediction}
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

              {/* Group Members */}
              <View style={styles.section}>
                <Text style={styles.groupTitle}>👥 Group Members ({groupMembers.length})</Text>
                {groupMembers.length === 0 ? (
                  <Text style={styles.groupMemberText}>No members yet.</Text>
                ) : (
                  groupMembers.map((member, idx) => (
                    <Text key={idx} style={styles.groupMemberText}>
                      {member === playerId ? '👤 You' : `Member ${idx + 1}`}
                    </Text>
                  ))
                )}
              </View>

              {/* Debug Info */}
              <View style={styles.debugSection}>
                <Text style={styles.debugTitle}>🔧 Debug Info</Text>
                <Text style={styles.debugText}>Group Admin: {isGroupAdmin ? 'Yes' : 'No'}</Text>
                <Text style={styles.debugText}>Player ID: {playerId}</Text>
                <Text style={styles.debugText}>Group Doc ID: {groupDocId}</Text>
                <Text style={styles.debugText}>Selected Game: {playerSelectedGame}</Text>
                <Text style={styles.debugText}>Current Game ID: {currentGameId}</Text>
                <Text style={styles.debugText}>Question ID: {currentQuestionId}</Text>
                <Text style={styles.debugText}>Prediction Status: {predictionStatus}</Text>
                <Text style={styles.debugText}>User Prediction: {userPrediction}</Text>
                <Text style={styles.debugText}>Total Games: {allGames.length}</Text>
                <Text style={styles.debugText}>Active Listeners: {unsubscribeFunctions.length}</Text>
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
  warningText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
    color: '#e67e22',
    backgroundColor: '#fef9e7',
    padding: 10,
    borderRadius: 8,
    fontWeight: '600',
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
  disabledGameButton: {
    opacity: 0.6,
    borderLeftColor: '#95a5a6',
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
  groupTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2c3e50',
    textAlign: 'center',
  },
  groupMemberText: {
    fontSize: 16,
    color: '#34495e',
    marginBottom: 8,
    textAlign: 'center',
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