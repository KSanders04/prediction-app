import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import React from "react";

const SelectedMode = () => {
  const handleSelect = (mode: "home" | "groupMode" | "") => {
    router.replace(`/${mode}`); //This assumes you have routes like /solo, /groups(empty for now because we do not have group page), /legend(empty string for now because we do not have legend page)
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Game Mode</Text>
      <TouchableOpacity style={styles.button} onPress={() => handleSelect("home")}>
        <Text style={styles.buttonText}>Solo</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={() => handleSelect("groupMode")}>
        <Text style={styles.buttonText}>Groups</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={() => handleSelect("")}>
        <Text style={styles.buttonText}>Legend</Text>
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
});
