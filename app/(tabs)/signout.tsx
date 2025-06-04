import { StyleSheet, TouchableOpacity, Text, Alert, View } from 'react-native';
import { router } from 'expo-router';
import { signOutUser, listenForSignOut } from '@/components/firebaseFunctions';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';


export default function TabOneScreen() {
  // Redirect to login if not authenticated
  listenForSignOut(() => router.replace('/'));

  const handleSignOut = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign Out", style: "destructive", onPress: async () => {
            await signOutUser();
            router.replace('/');
          }
        }
      ]
    );
  };

  return (
    <TouchableOpacity style={styles.button} onPress={handleSignOut}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <FontAwesome
        name="sign-out"
        size={25}
        color="#FFFFFF"
        style={{ marginRight: 8, opacity: 1 }}
      />
      <Text style={styles.text}>Sign Out</Text>
    </View>
  </TouchableOpacity>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA', 
  },
  title: {
    fontSize: 28, 
    fontWeight: '800', 
    color: '#1A237E', 
    marginBottom: 40, 
  },
  separator: {
    marginVertical: 30,
    height: 2, 
    width: '80%',
    backgroundColor: '#E8EAF6', 
  },
  button: {
    width: '90%',
    backgroundColor: '#3498db', 
    padding: 20,
    borderRadius: 15, 
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5C6BC0', 
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5, 
    marginTop: 10, 
    marginBottom: 20,
  },
  text: {
    color: '#FFFFFF', 
    fontSize: 18, 
    fontWeight: '600', 
  }
});