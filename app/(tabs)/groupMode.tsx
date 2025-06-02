import { View, Text, TouchableOpacity, StyleSheet, TextInput } from "react-native";
import { router } from "expo-router";
import React from "react";

const SelectedMode = () => {

  const [groupcode, setGroupCode] = React.useState('');

  const joinGameButton = () => {
    router.push("/home"); // just send to home for now
  }
  const createGameButton = () => { 
    router.push("/home"); // shows them a custom code at the top of the screenbased on what game they pick, send them to games tab
    const min = 100000;
    const max = 999999;
    const randomCode = Math.floor(Math.random() * (max - min + 1)) + min; // generates a random code between 1000000 and 9999999
    setGroupCode(randomCode.toString()); // sets the group code state to the random code
    alert(`Your group code is: ${randomCode}`); // alerts the user with the group code
    console.log("Group code created:", randomCode); // logs the group code to the console
  }

    const [code, setCode] = React.useState("");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter Group Code</Text>
            <TextInput
              style={styles.textInput}
              placeholder="CODE"
              value={code}
              onChangeText={setCode}
            />
      <TouchableOpacity style={styles.button} onPress={joinGameButton}>
        <Text style={styles.buttonText}>Join Group</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={createGameButton}>
        <Text style={styles.buttonText}>Create Group</Text>
      </TouchableOpacity>

    </View>
  );
};

export default SelectedMode;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#F5F5F5",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 40,
  },
  button: {
    width: "90%",
    padding: 20,
    backgroundColor: "#3949AB",
    borderRadius: 12,
    marginVertical: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
  },
    textInput: {
    height: 50,
    width: "90%",
    backgroundColor: "#FFFFFF",
    borderColor: "#E8EAF6",
    borderWidth: 2,
    borderRadius: 15,
    marginVertical: 15,
    paddingHorizontal: 25,
    fontSize: 16,
    color: "#3C4858",
    shadowColor: "#9E9E9E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});
