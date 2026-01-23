import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState, useRef } from 'react';
import { UserProfile, UserCar } from '@/types/user';
import { trpcClient } from '@/lib/trpc';

const USER_KEY = 'user_profile';

export const [UserProvider, useUser] = createContextHook(() => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userRef = useRef<UserProfile | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const stored = await AsyncStorage.getItem(USER_KEY);
      if (stored) {
        const userData = JSON.parse(stored);
        userRef.current = userData;
        setUser(userData);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveUser = async (userData: UserProfile) => {
    try {
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(userData));
      userRef.current = userData;
      setUser(userData);
    } catch (error) {
      console.error('Failed to save user:', error);
    }
  };

  const signUp = useCallback(async (
    email: string, 
    displayName: string,
    password: string,
    country?: string, 
    city?: string, 
    carBrand?: string, 
    carModel?: string,
    profilePicture?: string,
    carPicture?: string,
    additionalCars?: UserCar[]
  ) => {
    const cars: UserCar[] = [];
    if (carBrand && carModel) {
      cars.push({
        id: Date.now().toString(),
        brand: carBrand,
        model: carModel,
        picture: carPicture,
        isPrimary: true,
      });
    }
    if (additionalCars) {
      cars.push(...additionalCars);
    }
    const userId = Date.now().toString();
    const newUser: UserProfile = {
      id: userId,
      email,
      password,
      displayName,
      profilePicture,
      country,
      city,
      carBrand,
      carModel,
      carPicture,
      cars: cars.length > 0 ? cars : undefined,
      createdAt: Date.now(),
    };
    await saveUser(newUser);

    try {
      await trpcClient.user.register.mutate({
        id: userId,
        email,
        displayName,
        country,
        city,
        carBrand,
        carModel,
      });
      console.log('User registered and welcome email sent');
    } catch (error) {
      console.error('Failed to register user on backend:', error);
    }

    return newUser;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const stored = await AsyncStorage.getItem(USER_KEY);
    if (stored) {
      const userData = JSON.parse(stored);
      if (userData.email === email) {
        if (userData.password === password) {
          setUser(userData);
          return { success: true, user: userData };
        } else {
          return { success: false, error: 'incorrect_password' };
        }
      }
    }
    return { success: false, error: 'not_found' };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(USER_KEY);
      setUser(null);
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  }, []);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    const updatedUser = { ...currentUser, ...updates };
    await saveUser(updatedUser);
  }, []);

  const updateCar = useCallback(async (carBrand: string, carModel: string, carPicture?: string) => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    const updatedCars = currentUser.cars ? [...currentUser.cars] : [];
    const primaryIndex = updatedCars.findIndex(c => c.isPrimary);
    if (primaryIndex >= 0) {
      updatedCars[primaryIndex] = { ...updatedCars[primaryIndex], brand: carBrand, model: carModel, picture: carPicture };
    } else {
      updatedCars.unshift({
        id: Date.now().toString(),
        brand: carBrand,
        model: carModel,
        picture: carPicture,
        isPrimary: true,
      });
    }
    const updatedUser = { ...currentUser, carBrand, carModel, carPicture, cars: updatedCars };
    await saveUser(updatedUser);
  }, []);

  const addCar = useCallback(async (brand: string, model: string, picture?: string) => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    const newCar: UserCar = {
      id: Date.now().toString(),
      brand,
      model,
      picture,
      isPrimary: false,
    };
    const updatedCars = currentUser.cars ? [...currentUser.cars, newCar] : [newCar];
    const updatedUser = { ...currentUser, cars: updatedCars };
    await saveUser(updatedUser);
  }, []);

  const removeCar = useCallback(async (carId: string) => {
    const currentUser = userRef.current;
    if (!currentUser || !currentUser.cars) return;
    const updatedCars = currentUser.cars.filter(c => c.id !== carId);
    const updatedUser = { ...currentUser, cars: updatedCars };
    await saveUser(updatedUser);
  }, []);

  const setPrimaryCar = useCallback(async (carId: string) => {
    const currentUser = userRef.current;
    if (!currentUser || !currentUser.cars) return;
    const updatedCars = currentUser.cars.map(c => ({
      ...c,
      isPrimary: c.id === carId,
    }));
    const primaryCar = updatedCars.find(c => c.isPrimary);
    const updatedUser = {
      ...currentUser,
      cars: updatedCars,
      carBrand: primaryCar?.brand,
      carModel: primaryCar?.model,
      carPicture: primaryCar?.picture,
    };
    await saveUser(updatedUser);
  }, []);

  const updateProfilePicture = useCallback(async (profilePicture: string) => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    const updatedUser = { ...currentUser, profilePicture };
    await saveUser(updatedUser);
  }, []);

  const updateCountry = useCallback(async (country: string) => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    const updatedUser = { ...currentUser, country };
    await saveUser(updatedUser);
  }, []);

  const updateCity = useCallback(async (city: string) => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    const updatedUser = { ...currentUser, city };
    await saveUser(updatedUser);
  }, []);

  const updateLocation = useCallback(async (country: string, city: string) => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    const updatedUser = { ...currentUser, country, city };
    await saveUser(updatedUser);
  }, []);

  const getCarDisplayName = useCallback(() => {
    if (user?.carBrand && user?.carModel) {
      return `${user.carBrand} ${user.carModel}`;
    }
    return null;
  }, [user]);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    updateCar,
    addCar,
    removeCar,
    setPrimaryCar,
    updateProfilePicture,
    updateCountry,
    updateCity,
    updateLocation,
    getCarDisplayName,
  };
});
