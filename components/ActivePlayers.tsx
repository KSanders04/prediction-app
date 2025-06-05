// components/ActivePlayers.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Timestamp } from 'firebase/firestore';
import { listenForActivePlayers, formatTimeAgo } from './firebaseFunctions';


import { ActivePlayer, ActivePlayersProps } from '@/types';

export const ActivePlayers: React.FC<ActivePlayersProps> = ({ currentGameId }) => {
  const [activePlayers, setActivePlayers] = useState<ActivePlayer[]>([]);
  const [totalViewers, setTotalViewers] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentGameId) {
      setActivePlayers([]);
      setTotalViewers(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = listenForActivePlayers(
      currentGameId,
      (players, viewers) => {
        setActivePlayers(players);
        setTotalViewers(viewers);
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to active players:', error);
        setLoading(false);
      }
    );

    return () => { if (unsubscribe) unsubscribe(); };
  }, [currentGameId]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>👥 Live Activity</Text>
        <Text style={styles.loadingText}>Loading active players...</Text>
      </View>
    );
  }

  if (!currentGameId) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>👥 Live Activity</Text>
        <Text style={styles.emptyText}>No active game. Join a game to see live activity!</Text>
      </View>
    );
  }

  const playingCount = activePlayers.filter(player => player.isPlaying).length;
  const watchingCount = totalViewers - playingCount;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>👥 Live Activity</Text>

      {/* Summary Stats */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{totalViewers}</Text>
          <Text style={styles.summaryLabel}>Total Viewers</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryNumber, styles.playingNumber]}>{playingCount}</Text>
          <Text style={styles.summaryLabel}>Active Players</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{watchingCount}</Text>
          <Text style={styles.summaryLabel}>Just Watching</Text>
        </View>
      </View>

      {/* Active Players List */}
      {activePlayers.length === 0 ? (
        <Text style={styles.emptyText}>No one is currently active in this game.</Text>
      ) : (
        <ScrollView style={styles.playersList} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>🟢 Currently Online</Text>
          {activePlayers.map((player, index) => (
            <View key={`${player.userId}-${index}`} style={[
              styles.playerItem,
              player.isPlaying && styles.playingPlayerItem
            ]}>
              <View style={styles.playerInfo}>
                <Text style={styles.playerEmail}>
                  {player.isPlaying ? '🎯' : '👀'} {player.email || 'Anonymous'}
                </Text>
                <Text style={styles.playerStatus}>
                  {player.isPlaying ? 'Playing' : 'Watching'} • Joined {formatTimeAgo(player.joinedAt)}
                </Text>
              </View>
              <View style={[
                styles.statusDot,
                player.isPlaying ? styles.playingDot : styles.watchingDot
              ]} />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    maxHeight: 400,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2c3e50',
    textAlign: 'center',
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
    fontSize: 14,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  summaryNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  playingNumber: {
    color: '#27ae60',
  },
  summaryLabel: {
    fontSize: 10,
    color: '#7f8c8d',
    marginTop: 2,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 10,
  },
  playersList: {
    maxHeight: 200,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3498db',
  },
  playingPlayerItem: {
    backgroundColor: '#e8f5e8',
    borderLeftColor: '#27ae60',
  },
  playerInfo: {
    flex: 1,
  },
  playerEmail: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2c3e50',
    marginBottom: 2,
  },
  playerStatus: {
    fontSize: 11,
    color: '#7f8c8d',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  playingDot: {
    backgroundColor: '#27ae60',
  },
  watchingDot: {
    backgroundColor: '#3498db',
  },
});