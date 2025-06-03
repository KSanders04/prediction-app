// app/(tabs)/home.tsx 
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
} from 'firebase/firestore';
import YoutubePlayer from 'react-native-youtube-iframe';
import { get } from 'react-native/Libraries/TurboModule/TurboModuleRegistry';

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
  const [currentView, setCurrentView] = useState<'player' | 'leaderboard' | 'games'>('player');
  const [gameNames, setGameNames] = useState<string[]>([]);
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
  const [isGroupAdmin, setIsGroupAdmin] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [groupAdminID, setGroupAdminID] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const [groupCode, setGroupCode] = useState<string>('');

  const [currentGameURL, setCurrentGameURL] = useState('');
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [playerSelectedGame, setPlayerSelectedGame] = useState<string | null>(null);




  // --- GROUP ADMIN LOGIC ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
            setCurrentUser(user);

            const groupsRef = collection(db, 'groups');

            // Find group where user is admin
            const q = query(
            groupsRef,
            where('groupStatus', '==', 'active'),
            where('createdBy', '==', user.email)
            );
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
            const groupDoc = querySnapshot.docs[0];
            const groupData = groupDoc.data();

            setGroupCode(groupData.code || '');
            // Update admin fields if missing
            if (!groupData.groupAdminID || groupData.groupAdminID === '') {
                await updateDoc(groupDoc.ref, {
                groupAdminID: groupData.createdBy || user.uid,
                isAdmin: true,
                adminEmail: groupData.createdBy || user.email,
                adminId: user.uid,
                });
            }

            setGroupMembers(groupData.members || []); //Retrieves members in the group
            setGroupAdminID(groupData.groupAdminID || groupData.createdBy || '');
            setIsGroupAdmin(
                groupData.groupAdminID === user.uid ||
                groupData.createdBy === user.email ||
                groupData.isAdmin === true
            );
            } else {
            setGroupAdminID('');
            setIsGroupAdmin(false);
            }
        } else {
            setCurrentUser(null);
            setGroupAdminID('');
            setIsGroupAdmin(false);
        }
        });
        
        return () => unsubscribe();
        
    }, []);

  // --- FETCH GAMES ---
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

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchActiveGames();
    setRefreshing(false);
  };

  // --- JOIN GAME ---
  const joinGameButton = useCallback(async (gameName: string) => {
    try {
      const selectedGame = allGames.find(game => game.name === gameName);
      if (!selectedGame) {
        Alert.alert('Error', `Game not found: ${gameName}`);
        return;
      }
      setCurrentGameId(selectedGame.id);
      setCurrentGame(selectedGame.name);
      setCurrentGameURL(selectedGame.url || '');
      setPlayerSelectedGame(selectedGame.name);
      setCurrentView('player');
      Alert.alert('Success', `Joined game: ${gameName}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to join game');
    }
  }, [allGames]);

  // --- VIDEO ---
  const onVideoStateChange = (state: string) => {
    if (state === "playing") setIsVideoPlaying(true);
    else if (state === "paused" || state === "ended") {
      setIsVideoPlaying(false);
      if (state === "ended") setCurrentGameURL("");
    }
  };
  const togglePlaying = useCallback(() => {
    setIsVideoPlaying((prev) => !prev);
  }, []);
  const getURLID = (url: string): string => {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1);
      return parsed.searchParams.get('v') || '';
    } catch {
      return '';
    }
  };

  // --- LOADING STATE ---
  if (!currentUser || isGroupAdmin === null) {
    return (
      <SafeAreaView style={styles.app}>
        <View style={styles.container}>
          <Text style={styles.title}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }
const getCurrentCode = async () => {
      try {
      const groupsRef = collection(db, 'groups');
      const q = query(groupsRef, where('groupAdminID', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const groupDoc = querySnapshot.docs[0];
        return groupDoc.data().code || '';
      }
    } catch (error) {
      console.error('Error fetching group code:', error);
    }
    return '';
  }
  getCurrentCode()




  // --- TABS ---
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

      {/* Main Views */}
      {isGroupAdmin && currentView === 'games' ? (
        <ScrollView
          style={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.title}>📃 Select A Game</Text>
          <Text style={styles.welcomeText}>Group Code: {groupCode}</Text>
          <Text style={styles.infoText}>
            🎮 {allGames.length} active games available
          </Text>
          {allGames.length === 0 ? (
            <View style={styles.section}>
              <Text style={styles.noGamesText}>
                No active games found. Create one as group leader!
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
                    Created by: {game.createdBy === currentUser.uid ? 'You' : `User ${game.createdBy.slice(0, 6)}`}
                  </Text>
                  <Text style={styles.gameButtonTime}>
                    {game.createdAt ? new Date(game.createdAt).toLocaleString() : 'Recently'}
                  </Text>
                </View>
                {playerSelectedGame === game.name && (
                  <Text style={styles.selectedBadge}>✓ JOINED</Text>
                )}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      ) : currentView === 'leaderboard' ? (
        <ScrollView style={styles.container}>
          <Text style={styles.title}>🏆 Leaderboard</Text>
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
              {/* Question */}
              <View style={styles.questionSection}>
                <Text style={styles.questionText}>{currentQuestion}</Text>
                {/* Prediction Buttons */}
                {predictionStatus === 'Predictions OPEN' && questionOptions.map((option, index) => (
                  <TouchableOpacity
                    key={`predict-${option}-${index}`}
                    style={[styles.predictButton, userPrediction === option && styles.selectedButton]}
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
                    return (
                      <View key={`guess-${guess.id}-${index}`} style={[
                        styles.guessItem,
                        isCorrect && styles.correctGuess,
                        isWrong && styles.wrongGuess,
                      ]}>
                        <Text style={styles.guessText}>
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

              {/* Debug Info */}
              <View style={styles.debugSection}>
                <Text style={styles.debugTitle}>🔧 Debug Info</Text>
                <Text style={styles.debugText}>Is Group Admin: {isGroupAdmin ? 'Yes' : 'No'}</Text>
                <Text style={styles.debugText}>Group Admin ID: {groupAdminID}</Text>
                <Text style={styles.debugText}>Current User UID: {currentUser?.uid}</Text>
                <Text style={styles.debugText}>Selected Game: {playerSelectedGame}</Text>
                <Text style={styles.debugText}>Current Game ID: {currentGameId}</Text>
                <Text style={styles.debugText}>Question ID: {currentQuestionId}</Text>
                <Text style={styles.debugText}>Current Question: {currentQuestion}</Text>
                <Text style={styles.debugText}>Prediction Status: {predictionStatus}</Text>
                <Text style={styles.debugText}>Question Options: {questionOptions.join(', ')}</Text>
                <Text style={styles.debugText}>All Active Games: {allGames.map(g => `${g.name}(${g.id.slice(0,6)})`).join(', ')}</Text>
              </View>
            </>
          )}

          {/*GROUP MEMBERS BOX*/}
            <View style={styles.section}>
                <Text style={styles.groupTitle}>👥 Group Members</Text>
                {groupMembers.length === 0 ? (
                <Text style={styles.groupMemberText}>No members yet.</Text>
            ) : (
                groupMembers.map((member, idx) => (
                <Text key={idx} style={styles.groupMemberText}>{member}</Text>
                ))
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
  groupSection:{
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 15,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    alignItems: 'center',
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
    paddingLeft: 10,
    textAlign: 'center',
  },
});