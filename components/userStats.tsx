import { View, Text, StyleSheet } from "react-native";
import React from "react";



interface User {
  userName: string,
  totalPoints: number;
  correctPredictions: number;
  totalPredictions: number;
  gamesPlayed: number;
  lastPlayed: any;
}

export const UserStats: React.FC<{
  currentUser: User;
  authUser: any;
  getCurrentUserRank: () => number;
  getRankSuffix: (rank: number) => string;
  getAccuracy: (correct: number, total: number) => number;
  formatLastPlayed: (timestamp: any) => string;
}> = ({
  currentUser,
  authUser,
  getCurrentUserRank,
  getRankSuffix,
  getAccuracy,
  formatLastPlayed,
}) => (
  <View style={styles.currentUserSection}>
   <Text style={styles.sectionTitle}>📊 Your Stats</Text>

<View style={styles.nameContainer}>
  <Text style={styles.nameText}>
    {currentUser.userName || authUser?.email || `User_${authUser?.uid?.slice(0, 6)}`}
  </Text>
  {currentUser.userName && (
  <Text style={styles.usernameText}>@{currentUser.userName}</Text>
)}

</View>
    <View style={styles.statsGrid}>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{getCurrentUserRank() || '--'}</Text>
        <Text style={styles.statLabel}>
          {getCurrentUserRank()
            ? `${getCurrentUserRank()}${getRankSuffix(getCurrentUserRank())} Place`
            : 'Unranked'}
        </Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{currentUser.totalPoints}</Text>
        <Text style={styles.statLabel}>Total Points</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>
          {getAccuracy(currentUser.correctPredictions, currentUser.totalPredictions)}%
        </Text>
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
);

const styles = StyleSheet.create({
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
  nameContainer: {
  alignItems: 'center',
  marginBottom: 15,
},
nameText: {
  fontSize: 18,
  fontWeight: '600',
  color: '#2c3e50',
},
usernameText: {
  fontSize: 14,
  color: '#7f8c8d',
  fontStyle: 'italic',
  marginTop: 2,
},
});