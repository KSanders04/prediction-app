// app/(tabs)/two.tsx
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  SafeAreaView,
  RefreshControl,
} from 'react-native';

// Import Firebase configuration
import { db } from '../../firebaseConfig';
import { 
  collection, 
  query, 
  orderBy,
  limit,
  getDocs, 
  doc,
  getDoc,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';

// Types
interface User {
  id: string;
  name: string;
  totalPoints: number;
  gamesPlayed: number;
  correctPredictions: number;
  totalPredictions: number;
  lastPlayed: Timestamp;
}

export default function LeaderboardScreen() {
  const [leaderboard, setLeaderboard] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Generate same player ID as in home.tsx
  const [playerId] = useState('Player_' + Math.random().toString(36).substr(2, 6));

  useEffect(() => {
    loadLeaderboard();
    loadCurrentUser();
    
    // Set up real-time listener for leaderboard
    const unsubscribe = setupRealtimeLeaderboard();
    return () => unsubscribe();
  }, []);

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      const leaderboardQuery = query(
        collection(db, "users"),
        orderBy("totalPoints", "desc"),
        limit(50)
      );
      
      const snapshot = await getDocs(leaderboardQuery);
      const users: User[] = [];
      
      snapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() } as User);
      });
      
      setLeaderboard(users);
    } catch (error) {
      console.error("Error loading leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentUser = async () => {
    try {
      const userRef = doc(db, "users", playerId);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        setCurrentUser({ id: userSnap.id, ...userSnap.data() } as User);
      }
    } catch (error) {
      console.error("Error loading current user:", error);
    }
  };

  const setupRealtimeLeaderboard = () => {
    const leaderboardQuery = query(
      collection(db, "users"),
      orderBy("totalPoints", "desc"),
      limit(50)
    );

    return onSnapshot(leaderboardQuery, (snapshot) => {
      const users: User[] = [];
      snapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() } as User);
      });
      setLeaderboard(users);
      
      // Update current user if they're in the leaderboard
      const updatedCurrentUser = users.find(user => user.id === playerId);
      if (updatedCurrentUser) {
        setCurrentUser(updatedCurrentUser);
      }
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadLeaderboard(), loadCurrentUser()]);
    setRefreshing(false);
  };

  const getRankSuffix = (rank: number): string => {
    if (rank % 100 >= 11 && rank % 100 <= 13) return 'th';
    switch (rank % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  const formatLastPlayed = (timestamp: Timestamp): string => {
    const now = new Date();
    const lastPlayed = timestamp.toDate();
    const diffInMinutes = Math.floor((now.getTime() - lastPlayed.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getCurrentUserRank = (): number => {
    return leaderboard.findIndex(user => user.id === playerId) + 1;
  };

  const getAccuracy = (correct: number, total: number): number => {
    return total > 0 ? Math.round((correct / total) * 100) : 0;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>🏆 Leaderboard</Text>

        {/* Your Stats Section */}
        {currentUser && (
          <View style={styles.currentUserSection}>
            <Text style={styles.sectionTitle}>📊 Your Stats</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{getCurrentUserRank() || '--'}</Text>
                <Text style={styles.statLabel}>
                  {getCurrentUserRank() ? `${getCurrentUserRank()}${getRankSuffix(getCurrentUserRank())} Place` : 'Unranked'}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{currentUser.totalPoints}</Text>
                <Text style={styles.statLabel}>Total Points</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{getAccuracy(currentUser.correctPredictions, currentUser.totalPredictions)}%</Text>
                <Text style={styles.statLabel}>Accuracy</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{currentUser.gamesPlayed}</Text>
                <Text style={styles.statLabel}>Games Played</Text>
              </View>
            </View>
            
            <View style={styles.detailedStats}>
              <Text style={styles.detailText}>
                ✅ Correct Predictions: {currentUser.correctPredictions} / {currentUser.totalPredictions}
              </Text>
              <Text style={styles.detailText}>
                🕐 Last Played: {formatLastPlayed(currentUser.lastPlayed)}
              </Text>
            </View>
          </View>
        )}

        {/* Top Players Section */}
        <View style={styles.leaderboardSection}>
          <Text style={styles.sectionTitle}>👑 Top Players</Text>
          {loading ? (
            <Text style={styles.loadingText}>Loading leaderboard...</Text>
          ) : leaderboard.length === 0 ? (
            <Text style={styles.emptyText}>No players yet. Be the first to play!</Text>
          ) : (
            leaderboard.map((user, index) => {
              const rank = index + 1;
              const isCurrentUser = user.id === playerId;
              
              return (
                <View 
                  key={user.id} 
                  style={[
                    styles.leaderboardItem,
                    isCurrentUser && styles.currentUserItem,
                    rank <= 3 && styles.topThreeItem
                  ]}
                >
                  <View style={styles.rankSection}>
                    <Text style={[
                      styles.rankText,
                      rank === 1 && styles.firstPlace,
                      rank === 2 && styles.secondPlace,
                      rank === 3 && styles.thirdPlace
                    ]}>
                      {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                    </Text>
                  </View>
                  
                  <View style={styles.playerInfo}>
                    <Text style={[styles.playerName, isCurrentUser && styles.currentUserName]}>
                      {isCurrentUser ? '👤 You' : user.name}
                    </Text>
                    <Text style={styles.playerStats}>
                      {user.gamesPlayed} games • {getAccuracy(user.correctPredictions, user.totalPredictions)}% accuracy
                    </Text>
                  </View>
                  
                  <View style={styles.pointsSection}>
                    <Text style={[styles.pointsText, isCurrentUser && styles.currentUserPoints]}>
                      {user.totalPoints}
                    </Text>
                    <Text style={styles.pointsLabel}>pts</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Achievement Section */}
        <View style={styles.achievementsSection}>
          <Text style={styles.sectionTitle}>🎯 Quick Facts</Text>
          <View style={styles.factsList}>
            <Text style={styles.factItem}>🎮 Total Active Players: {leaderboard.length}</Text>
            <Text style={styles.factItem}>
              🏆 Top Score: {leaderboard[0]?.totalPoints || 0} pts by {leaderboard[0]?.name || 'None'}
            </Text>
            <Text style={styles.factItem}>💡 Earn 10 points for each correct prediction!</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  scrollView: {
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 25,
    color: '#2c3e50',
  },
  currentUserSection: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2c3e50',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 4,
    textAlign: 'center',
  },
  detailedStats: {
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
    paddingTop: 15,
  },
  detailText: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 5,
  },
  leaderboardSection: {
    backgroundColor: 'white',
    margin: 20,
    marginTop: 0,
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  loadingText: {
    textAlign: 'center',
    color: '#7f8c8d',
    fontStyle: 'italic',
    padding: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#7f8c8d',
    fontStyle: 'italic',
    padding: 20,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#bdc3c7',
  },
  currentUserItem: {
    backgroundColor: '#e3f2fd',
    borderLeftColor: '#2196f3',
  },
  topThreeItem: {
    backgroundColor: '#fff8e1',
    borderLeftColor: '#ffc107',
  },
  rankSection: {
    width: 40,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#34495e',
  },
  firstPlace: {
    fontSize: 24,
  },
  secondPlace: {
    fontSize: 24,
  },
  thirdPlace: {
    fontSize: 24,
  },
  playerInfo: {
    flex: 1,
    marginLeft: 15,
  },
  playerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 2,
  },
  currentUserName: {
    color: '#2196f3',
  },
  playerStats: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  pointsSection: {
    alignItems: 'center',
  },
  pointsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  currentUserPoints: {
    color: '#2196f3',
  },
  pointsLabel: {
    fontSize: 10,
    color: '#7f8c8d',
  },
  achievementsSection: {
    backgroundColor: 'white',
    margin: 20,
    marginTop: 0,
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  factsList: {
    marginTop: 10,
  },
  factItem: {
    fontSize: 14,
    color: '#34495e',
    marginBottom: 8,
    paddingLeft: 10,
  },
});