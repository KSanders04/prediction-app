import { render, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import SelectedMode from '../../app/selectMode';

// Mock expo-router
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

describe('SelectedMode Component', () => {
  beforeEach(() => {
    // Clear mock calls between tests
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    const { getByText } = render(<SelectedMode />);
    
    // Check if all buttons and title are present
    expect(getByText('Select Game Mode')).toBeTruthy();
    expect(getByText('Solo')).toBeTruthy();
    expect(getByText('Groups')).toBeTruthy();
    expect(getByText('Legend')).toBeTruthy();
  });

  it('navigates to home when Solo is pressed', () => {
    const { getByText } = render(<SelectedMode />);
    const soloButton = getByText('Solo');
    
    fireEvent.press(soloButton);
    expect(router.push).toHaveBeenCalledWith('/home');
  });

  it('navigates to groupMode when Groups is pressed', () => {
    const { getByText } = render(<SelectedMode />);
    const groupsButton = getByText('Groups');
    
    fireEvent.press(groupsButton);
    expect(router.push).toHaveBeenCalledWith('/groupMode');
  });

  it('navigates to empty route when Legend is pressed', () => {
    const { getByText } = render(<SelectedMode />);
    const legendButton = getByText('Legend');
    
    fireEvent.press(legendButton);
    expect(router.push).toHaveBeenCalledWith('/');
  });

  it('matches snapshot', () => {
    const tree = render(<SelectedMode />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});