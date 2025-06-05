import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import Profile from '@/app/(tabs)/profile';
import * as firebaseFunctions from '../../components/firebaseFunctions';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('prediction-app/components/signout.tsx', () => () => <></>);

jest.mock('../../components/firebaseFunctions', () => ({
  fetchUserData: jest.fn(),
  getCurrentUser: jest.fn(),
  updateUsername: jest.fn(),
  changePassword: jest.fn(),
  uploadProfileImage: jest.fn(),
  getCurrentUserRank: jest.fn(),
  getRankSuffix: jest.fn(),
  getAccuracy: jest.fn(),
  formatLastPlayed: jest.fn(),
}));

describe('Profile Screen', () => {
  const mockUser = { uid: '123456', email: 'test@example.com' };

  const mockData = {
    firstName: 'Jane',
    lastName: 'Doe',
    userName: 'jdoe',
    profilePic: '',
    totalPoints: 100,
    correctPrictions: 100,
    gamesPlayedictions: 80,
    totalPreded: 10,
    lastPlayed: null,
    groups: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (firebaseFunctions.getCurrentUser as jest.Mock).mockResolvedValue(mockUser);
    (firebaseFunctions.fetchUserData as jest.Mock).mockResolvedValue(mockData);
  });

  it('renders profile with user data', async () => {
    const { getByText } = render(<Profile />);
    await waitFor(() => {
      expect(getByText('Jane Doe')).toBeTruthy();
      expect(getByText('Edit Username')).toBeTruthy();
    });
  });

  it('lets user edit and save username', async () => {
    const { getByText, getByPlaceholderText } = render(<Profile />);
    await waitFor(() => getByText('Edit Username'));

    fireEvent.press(getByText('Edit Username'));

    const input = getByPlaceholderText('Enter new username');
    fireEvent.changeText(input, 'newUsername');
    fireEvent.press(getByText('Save'));

    await waitFor(() =>
      expect(firebaseFunctions.updateUsername).toHaveBeenCalledWith(
        mockUser.uid,
        'newUsername'
      )
    );
  });

  it('renders Change Password button and responds to press', async () => {
      const { getByText } = render(<Profile />);

      const button = await waitFor(() => getByText('Change Password'));
      expect(button).toBeTruthy();

      //This test shows that button does press and that no crashes happen
      fireEvent.press(button);
  });

    it('matches snapshot', () => {
      const tree = render(<Profile />).toJSON();
      expect(tree).toMatchSnapshot();
  });
});