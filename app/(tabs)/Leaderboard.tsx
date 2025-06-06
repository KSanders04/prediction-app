// app/(tabs)/two.tsx  (Leaderboard section)
import React, { useState, useEffect, useCallback } from 'react';
import {StyleSheet,ScrollView,View,Text,SafeAreaView,RefreshControl,} from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { router } from 'expo-router';
import { User } from '@/types';
import { UserStats } from '../../components/userStats';
import {getLeaderboardUsers, getUserById, createUserIfNotExists,} from '../../components/firebaseFunctions';
import { auth } from '../../firebaseConfig';
import { Timestamp } from 'firebase/firestore';

export default function LeaderboardScreen() {
  const [leaderboard, setLeaderboard] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authUser, setAuthUser] = useState<any>(null);
  const [playerId, setPlayerId] = useState<string>('');

  // Check authentication first
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthUser(user);
        setPlayerId(user.uid);
      } else {
        router.replace('/login');
      }
    });
    return unsubscribe;
  }, []);

  // Load leaderboard and current user
  useEffect(() => {
    if (playerId) {
      loadLeaderboard();
      loadCurrentUser();
    }
  }, [playerId]);

  const loadLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      const users = await getLeaderboardUsers(50);
      setLeaderboard(users);
    } catch (error) {
      console.error("Error loading leaderboard:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCurrentUser = useCallback(async () => {
    if (!playerId) return;
    try {
      let user = await getUserById(playerId);
      if (!user && authUser) {
        user = await createUserIfNotExists(authUser);
      }
      setCurrentUser(user);
    } catch (error) {
      console.error("Error loading current user:", error);
    }
  }, [playerId, authUser]);

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

  const formatLastPlayed = (timestamp: any): string => {
    const now = new Date();
    let lastPlayedDate: Date;
    if (timestamp instanceof Timestamp) {
      lastPlayedDate = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      lastPlayedDate = timestamp;
    } else if (typeof timestamp === 'string') {
      lastPlayedDate = new Date(timestamp);
    } else {
      return 'Unknown';
    }
    const diffInMinutes = Math.floor((now.getTime() - lastPlayedDate.getTime()) / (1000 * 60));
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

  // Show loading if not authenticated yet
  if (!authUser || !playerId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
          <UserStats
            currentUser={{
              ...currentUser,
              userName: currentUser.userName ?? `User_${currentUser.id.slice(0, 6)}`
            }}
            authUser={authUser}
            getCurrentUserRank={getCurrentUserRank}
            getRankSuffix={getRankSuffix}
            getAccuracy={getAccuracy}
            formatLastPlayed={formatLastPlayed}
          />
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
                      {isCurrentUser ? '👤 You' : user.userName || `User_${user.id.slice(0, 6)}`}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  userEmail: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
    marginBottom: 15,
    fontStyle: 'italic',
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