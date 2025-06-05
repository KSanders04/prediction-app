import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import Signout from "@/components/signout";
import { Alert } from "react-native";

// Mock dependencies
jest.mock("expo-router", () => ({
  router: { replace: jest.fn() }
}));
jest.mock("@/components/firebaseFunctions", () => ({
  signOutUser: jest.fn(),
  listenForSignOut: jest.fn()
}));
jest.mock('@expo/vector-icons/FontAwesome', () => 'FontAwesome');

describe("SignOut Screen", () => {
  it("renders sign out button", () => {
    const { getByText } = render(<Signout />);
    expect(getByText("Sign Out")).toBeTruthy();
  });

  it("shows alert when sign out button is pressed", () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { getByText } = render(<Signout />);
    fireEvent.press(getByText("Sign Out"));
    // Since Alert.alert is used, you can check if it was called
    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

      it('matches snapshot', () => {
        const tree = render(<Signout />).toJSON();
        expect(tree).toMatchSnapshot();
    });
});