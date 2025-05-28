// First, install expo-av for video support:
// npm install expo-av

// VideoGameComponent.tsx - Add this to your components folder
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

interface VideoQuestion {
  time: number;
  question: string;
  options: string[];
  correctAnswer: string | null;
  triggered: boolean;
  id?: string;
}

interface VideoGameComponentProps {
  gameId: string | null;
  isAdmin: boolean;
  playerId: string;
  onQuestionTriggered: (question: VideoQuestion) => void;
}

export default function VideoGameComponent({ 
  gameId, 
  isAdmin, 
  playerId, 
  onQuestionTriggered 
}: VideoGameComponentProps) {
  const videoRef = useRef<Video>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [gameActive, setGameActive] = useState(false);

  // Pre-scripted questions for football/soccer game
  const [videoQuestions, setVideoQuestions] = useState<VideoQuestion[]>([
    {
      time: 15, // 15 seconds into video
      question: "Will there be a goal in the next 2 minutes?",
      options: ["Yes", "No"],
      correctAnswer: null,
      triggered: false
    },
    {
      time: 45, // 45 seconds
      question: "Next team to get possession?",
      options: ["Home Team", "Away Team"],
      correctAnswer: null,
      triggered: false
    },
    {
      time: 75, // 1 minute 15 seconds
      question: "Will there be a corner kick in the next minute?",
      options: ["Yes", "No"],
      correctAnswer: null,
      triggered: false
    },
    {
      time: 120, // 2 minutes
      question: "Next player to touch the ball?",
      options: ["Forward", "Midfielder", "Defender", "Goalkeeper"],
      correctAnswer: null,
      triggered: false
    }
  ]);

  // Monitor video time and trigger questions
  useEffect(() => {
    if (!gameActive || !isAdmin) return;

    const questionToTrigger = videoQuestions.find(q => 
      Math.abs(currentTime - q.time) < 1 && !q.triggered
    );

    if (questionToTrigger) {
      triggerQuestion(questionToTrigger);
    }
  }, [currentTime, gameActive, isAdmin]);

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setCurrentTime(status.positionMillis ? status.positionMillis / 1000 : 0);
      setIsPlaying(status.isPlaying || false);
    }
  };

  const startVideoGame = async () => {
    if (!gameId) {
      Alert.alert('Error', 'Create a game first!');
      return;
    }

    try {
      // Reset all questions
      setVideoQuestions(prev => prev.map(q => ({ ...q, triggered: false, correctAnswer: null })));
      setGameActive(true);
      
      // Reset video to beginning
      if (videoRef.current) {
        await videoRef.current.setPositionAsync(0);
        await videoRef.current.playAsync();
      }
      
      Alert.alert('Success', 'Video game started! Questions will appear automatically.');
    } catch (error) {
      console.error('Error starting video game:', error);
      Alert.alert('Error', 'Failed to start video game');
    }
  };

  const triggerQuestion = async (question: VideoQuestion) => {
    if (!gameId) return;

    try {
      // Create question in Firebase
      const docRef = await addDoc(collection(db, "predictions"), {
        gameId: gameId,
        question: question.question,
        options: question.options,
        status: "active",
        phase: "predicting",
        actual_result: null,
        videoTimestamp: currentTime,
        createdAt: new Date()
      });

      // Mark question as triggered
      setVideoQuestions(prev => prev.map(q => 
        q.time === question.time ? { ...q, triggered: true, id: docRef.id } : q
      ));

      // Notify parent component
      onQuestionTriggered({ ...question, id: docRef.id });

      Alert.alert('Question Triggered!', `${question.question}`);
    } catch (error) {
      console.error('Error triggering question:', error);
    }
  };

  const setQuestionAnswer = async (questionIndex: number, answer: string) => {
    const question = videoQuestions[questionIndex];
    if (!question.id) return;

    try {
      await updateDoc(doc(db, "predictions", question.id), {
        actual_result: answer,
        status: "finished",
        phase: "results"
      });

      setVideoQuestions(prev => prev.map((q, i) => 
        i === questionIndex ? { ...q, correctAnswer: answer } : q
      ));

      Alert.alert('Success', `Answer set to: ${answer}`);
    } catch (error) {
      console.error('Error setting answer:', error);
    }
  };

  const togglePlayPause = async () => {
    if (!videoRef.current) return;

    try {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  };

  if (!gameId) {
    return (
      <View style={styles.container}>
        <Text style={styles.infoText}>Create a game first to use video mode</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🎥 Video Game Mode</Text>
      
      {/* Video Player */}
      <View style={styles.videoContainer}>
        <Video
          ref={videoRef}
          style={styles.video}
          // You can replace this with your own sports video URL
          source={{ uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' }}
          useNativeControls={false}
          resizeMode={ResizeMode.CONTAIN}
          isLooping={false}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          onLoad={() => setVideoLoaded(true)}
        />
        
        <View style={styles.videoControls}>
          <TouchableOpacity 
            style={styles.playButton} 
            onPress={togglePlayPause}
            disabled={!videoLoaded}
          >
            <Text style={styles.playButtonText}>
              {isPlaying ? '⏸️ Pause' : '▶️ Play'}
            </Text>
          </TouchableOpacity>
          
          <Text style={styles.timeText}>
            {Math.floor(currentTime)}s
          </Text>
        </View>
      </View>

      {/* Admin Controls */}
      {isAdmin && (
        <View style={styles.adminSection}>
          <TouchableOpacity 
            style={styles.startButton} 
            onPress={startVideoGame}
          >
            <Text style={styles.buttonText}>🚀 Start Video Game</Text>
          </TouchableOpacity>

          {/* Question Timeline */}
          <View style={styles.questionTimeline}>
            <Text style={styles.sectionTitle}>📋 Question Timeline</Text>
            {videoQuestions.map((question, index) => (
              <View 
                key={index} 
                style={[
                  styles.questionItem,
                  question.triggered && styles.triggeredQuestion,
                  currentTime >= question.time - 5 && currentTime < question.time && styles.upcomingQuestion
                ]}
              >
                <Text style={styles.questionTime}>{question.time}s</Text>
                <Text style={styles.questionText}>{question.question}</Text>
                
                {question.triggered && question.correctAnswer === null && (
                  <View style={styles.answerButtons}>
                    <Text style={styles.setAnswerText}>Set Answer:</Text>
                    {question.options.map((option, optionIndex) => (
                      <TouchableOpacity
                        key={optionIndex}
                        style={styles.answerButton}
                        onPress={() => setQuestionAnswer(index, option)}
                      >
                        <Text style={styles.answerButtonText}>{option}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                
                {question.correctAnswer && (
                  <Text style={styles.correctAnswer}>✅ Answer: {question.correctAnswer}</Text>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Player View */}
      {!isAdmin && (
        <View style={styles.playerSection}>
          <Text style={styles.sectionTitle}>🎯 Player View</Text>
          {gameActive ? (
            <Text style={styles.infoText}>
              Watching the game... Questions will appear automatically!
            </Text>
          ) : (
            <Text style={styles.infoText}>
              Waiting for admin to start the video game...
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
    color: '#2c3e50',
  },
  videoContainer: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  video: {
    width: '100%',
    height: 200,
    borderRadius: 10,
  },
  videoControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
  },
  playButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  playButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  timeText: {
    fontSize: 16,
    color: '#7f8c8d',
  },
  adminSection: {
    marginHorizontal: 20,
  },
  startButton: {
    backgroundColor: '#e74c3c',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  questionTimeline: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2c3e50',
  },
  questionItem: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#bdc3c7',
  },
  triggeredQuestion: {
    backgroundColor: '#d4edda',
    borderLeftColor: '#28a745',
  },
  upcomingQuestion: {
    backgroundColor: '#fff3cd',
    borderLeftColor: '#ffc107',
  },
  questionTime: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#7f8c8d',
    marginBottom: 5,
  },
  questionText: {
    fontSize: 16,
    color: '#2c3e50',
    marginBottom: 10,
  },
  answerButtons: {
    marginTop: 10,
  },
  setAnswerText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#34495e',
  },
  answerButton: {
    backgroundColor: '#27ae60',
    padding: 8,
    borderRadius: 6,
    marginBottom: 5,
    alignItems: 'center',
  },
  answerButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  correctAnswer: {
    fontSize: 14,
    color: '#27ae60',
    fontWeight: 'bold',
    marginTop: 5,
  },
  playerSection: {
    marginHorizontal: 20,
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  infoText: {
    fontSize: 16,
    color: '#7f8c8d',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});