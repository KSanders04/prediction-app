import React from 'react';
import { render } from '@testing-library/react-native';
import Index from '../../app/index'; 
import { Redirect } from 'expo-router';

jest.mock('expo-router', () => ({
  Redirect: jest.fn(() => null),
}));

it('renders Redirect to /login', () => {
  render(<Index />);
  expect(Redirect).toHaveBeenCalledWith({ href: '/login' }, undefined);
});

