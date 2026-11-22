import { jest } from '@jest/globals';

export const getItemAsync = jest.fn(async () => null);
export const setItemAsync = jest.fn(async () => undefined);
export const deleteItemAsync = jest.fn(async () => undefined);
export const isAvailableAsync = jest.fn(async () => true);
