import { StyleSheet, TouchableOpacity, Text, View } from 'react-native';
import { auth } from '../../firebaseConfig';
import { getAuth } from 'firebase/auth';
import { router } from 'expo-router';

export default function TabOneScreen() {
  getAuth().onAuthStateChanged((user) => {
    if (!user) router.replace('/'); // if user is not logged in return them to the login page
  });

const handleSignOut = async () => { // function to handle all the sign out and alert user 
  alert("Sign Out Successful")
  router.replace('/')
  await auth.signOut()
}

  return (
      <TouchableOpacity style={styles.button} onPress={(handleSignOut)}>
        <Text style={styles.text}>Sign Out</Text>
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
    marginTop: 15, 
  },
  text: {
    color: '#FFFFFF', 
    fontSize: 18, 
    fontWeight: '600', 
  }
});


