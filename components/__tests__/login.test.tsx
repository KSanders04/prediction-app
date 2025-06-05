import { render, fireEvent } from "@testing-library/react-native";
import { router } from "expo-router";
import Login from "../../app/login";

// Mock Firebase functions
jest.mock("@/components/firebaseFunctions", () => ({
  emailSignIn: jest.fn(),
}));

// Mock expo-router
jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

describe("Login Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly", () => {
    const { getByText, getByPlaceholderText, getByTestId } = render(<Login />);

    expect(getByTestId("sign-in-text")).toBeTruthy();
    expect(getByTestId("sign-in-button")).toBeTruthy();
    expect(getByPlaceholderText("Email")).toBeTruthy();
    expect(getByPlaceholderText("Password")).toBeTruthy();
  });

  it("handles user input correctly", () => {
    const { getByPlaceholderText } = render(<Login />);

    const emailInput = getByPlaceholderText("Email");
    const passwordInput = getByPlaceholderText("Password");

    fireEvent.changeText(emailInput, "admin@admin.com");
    fireEvent.changeText(passwordInput, "12345678");

    expect(emailInput.props.value).toBe("admin@admin.com");
    expect(passwordInput.props.value).toBe("12345678");
  });

  it("shows error message when login fails", () => {
    const { getByTestId } = render(<Login />);
    const signInButton = getByTestId("sign-in-button");

    fireEvent.press(signInButton);
    // Add error message check once implemented
  });

  // Single snapshot test with proper cleaning
  it("matches snapshot", () => {
    const { toJSON } = render(<Login />);
    const snapshot = toJSON();

    // Clean the snapshot by removing dynamic properties
    const cleanSnapshot = (obj: any): Record<string, any> => {
      if (!obj || typeof obj !== 'object') return obj;
      
      const cleaned: Record<string, any> = Array.isArray(obj) ? [] : {};
      
      Object.entries(obj).forEach(([key, value]) => {
        if (!['nativeID', 'testID', 'style', 'key'].includes(key)) {
          cleaned[key] = cleanSnapshot(value);
        }
      });
      
      return cleaned;
    };

    expect(cleanSnapshot(snapshot)).toMatchSnapshot();
  });
});
