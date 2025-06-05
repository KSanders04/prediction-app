import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import ChangePasswordPage from '../../app/changePasswordPage';
import { Alert } from 'react-native';
import { changePassword } from '../firebaseFunctions';

let mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => {
  mockGoBack = jest.fn(); 
  return {
    useNavigation: () => ({
      goBack: mockGoBack,
    }),
  };
});

jest.mock('../firebaseFunctions', () => ({
  changePassword: jest.fn(),
}));

jest.spyOn(Alert, 'alert').mockImplementation(() => {});

afterEach(() => {
  jest.clearAllMocks();
});

describe('ChangePasswordPage', () => {
  it('shows error if fields are empty', async () => { // Checks if all fields are filled 
    const { getByText } = render(<ChangePasswordPage />);
    await act(async () => {
      fireEvent.press(getByText('Save'));
    });
    expect(Alert.alert).toHaveBeenCalledWith('Error', 'Please fill in all fields.');
  });

  it('shows error if new password is not 6 letters long', async () => { // Checks if new password is at least 6 characters
    const { getByText, getByPlaceholderText } = render(<ChangePasswordPage />);
    fireEvent.changeText(getByPlaceholderText('Current Password'), 'currentPass');
    fireEvent.changeText(getByPlaceholderText('New Password'), '123'); 
    fireEvent.changeText(getByPlaceholderText('Confirm New Password'), '123');

    await act(async () => {
      fireEvent.press(getByText('Save'));
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Password must be at least 6 characters long.');
    });
  });

  it('shows error if new passwords do not match', async () => { // Checks if new password and confirm new password match
    const { getByText, getByPlaceholderText } = render(<ChangePasswordPage />);
    fireEvent.changeText(getByPlaceholderText('Current Password'), 'currentPass');
    fireEvent.changeText(getByPlaceholderText('New Password'), 'newPass123');
    fireEvent.changeText(getByPlaceholderText('Confirm New Password'), 'newPass456');

    await act(async () => {
      fireEvent.press(getByText('Save'));
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'New passwords do not match.');
    });
  });

  it('calls changePassword with correct parameters', async () => { // Checks if changePassword is called with correct parameters
    const { getByText, getByPlaceholderText } = render(<ChangePasswordPage />);
    fireEvent.changeText(getByPlaceholderText('Current Password'), 'currentPass');
    fireEvent.changeText(getByPlaceholderText('New Password'), 'newPass123');
    fireEvent.changeText(getByPlaceholderText('Confirm New Password'), 'newPass123');

    await act(async () => {
      fireEvent.press(getByText('Save'));
    });

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith('currentPass', 'newPass123');
    });
  });

  it('shows success alert on successful password change', async () => { // Checks if success alert is shown after successful password change
    (changePassword as jest.Mock).mockResolvedValueOnce({});

    const { getByText, getByPlaceholderText } = render(<ChangePasswordPage />);
    fireEvent.changeText(getByPlaceholderText('Current Password'), 'currentPass');
    fireEvent.changeText(getByPlaceholderText('New Password'), 'newPass123');
    fireEvent.changeText(getByPlaceholderText('Confirm New Password'), 'newPass123');

    await act(async () => {
      fireEvent.press(getByText('Save'));
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Success', 'Password updated!');
    });
  });

  it('resets fields and calls goBack after successful password change', async () => { // Checks if fields are reset and goBack is called after successful password change
    (changePassword as jest.Mock).mockResolvedValueOnce({});

    const { getByText, getByPlaceholderText } = render(<ChangePasswordPage />);
    fireEvent.changeText(getByPlaceholderText('Current Password'), 'currentPass');
    fireEvent.changeText(getByPlaceholderText('New Password'), 'newPass123');
    fireEvent.changeText(getByPlaceholderText('Confirm New Password'), 'newPass123');

    await act(async () => {
      fireEvent.press(getByText('Save'));
    });

    await waitFor(() => {
      expect(getByPlaceholderText('Current Password').props.value).toBe('');
      expect(getByPlaceholderText('New Password').props.value).toBe('');
      expect(getByPlaceholderText('Confirm New Password').props.value).toBe('');
      expect(mockGoBack).toHaveBeenCalled();
    });
  });
});
