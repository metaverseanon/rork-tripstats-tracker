import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { UserProfile, UserCar } from '@/types/user';

const USER_KEY = 'user_profile';

export const [UserProvider, useUser] = createContextHook(() => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const stored = await AsyncStorage.getItem(USER_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
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
      setUser(userData);
    } catch (error) {
      console.error('Failed to save user:', error);
    }
  };

  const signUp = useCallback(async (
    email: string, 
    displayName: string, 
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
    const newUser: UserProfile = {
      id: Date.now().toString(),
      email,
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
    return newUser;
  }, []);

  const signIn = useCallback(async (email: string) => {
    const stored = await AsyncStorage.getItem(USER_KEY);
    if (stored) {
      const userData = JSON.parse(stored);
      if (userData.email === email) {
        setUser(userData);
        return userData;
      }
    }
    return null;
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
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    await saveUser(updatedUser);
  }, [user]);

  const updateCar = useCallback(async (carBrand: string, carModel: string, carPicture?: string) => {
    if (!user) return;
    const updatedCars = user.cars ? [...user.cars] : [];
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
    const updatedUser = { ...user, carBrand, carModel, carPicture, cars: updatedCars };
    await saveUser(updatedUser);
  }, [user]);

  const addCar = useCallback(async (brand: string, model: string, picture?: string) => {
    if (!user) return;
    const newCar: UserCar = {
      id: Date.now().toString(),
      brand,
      model,
      picture,
      isPrimary: false,
    };
    const updatedCars = user.cars ? [...user.cars, newCar] : [newCar];
    const updatedUser = { ...user, cars: updatedCars };
    await saveUser(updatedUser);
  }, [user]);

  const removeCar = useCallback(async (carId: string) => {
    if (!user || !user.cars) return;
    const updatedCars = user.cars.filter(c => c.id !== carId);
    const updatedUser = { ...user, cars: updatedCars };
    await saveUser(updatedUser);
  }, [user]);

  const setPrimaryCar = useCallback(async (carId: string) => {
    if (!user || !user.cars) return;
    const updatedCars = user.cars.map(c => ({
      ...c,
      isPrimary: c.id === carId,
    }));
    const primaryCar = updatedCars.find(c => c.isPrimary);
    const updatedUser = {
      ...user,
      cars: updatedCars,
      carBrand: primaryCar?.brand,
      carModel: primaryCar?.model,
      carPicture: primaryCar?.picture,
    };
    await saveUser(updatedUser);
  }, [user]);

  const updateProfilePicture = useCallback(async (profilePicture: string) => {
    if (!user) return;
    const updatedUser = { ...user, profilePicture };
    await saveUser(updatedUser);
  }, [user]);

  const updateCountry = useCallback(async (country: string) => {
    if (!user) return;
    const updatedUser = { ...user, country };
    await saveUser(updatedUser);
  }, [user]);

  const updateCity = useCallback(async (city: string) => {
    if (!user) return;
    const updatedUser = { ...user, city };
    await saveUser(updatedUser);
  }, [user]);

  const updateLocation = useCallback(async (country: string, city: string) => {
    if (!user) return;
    const updatedUser = { ...user, country, city };
    await saveUser(updatedUser);
  }, [user]);

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
