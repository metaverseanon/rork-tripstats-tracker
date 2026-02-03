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

  useEffect(() => {
    const syncTimezone = async () => {
      const currentUser = userRef.current;
      if (!currentUser) return;
      
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detectedTimezone && currentUser.timezone !== detectedTimezone) {
        console.log('Updating user timezone:', detectedTimezone);
        const updatedUser = { ...currentUser, timezone: detectedTimezone };
        await saveUser(updatedUser);
        
        try {
          await trpcClient.user.updateTimezone.mutate({
            userId: currentUser.id,
            timezone: detectedTimezone,
          });
          console.log('Timezone synced to backend');
        } catch (error) {
          console.error('Failed to sync timezone to backend:', error);
        }
      }
    };
    
    if (user && !isLoading) {
      syncTimezone();
    }
  }, [user, isLoading]);

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

    try {
      console.log('Attempting to register user:', { email, displayName, country, city, carBrand, carModel });
      const result = await trpcClient.user.register.mutate({
        id: userId,
        email,
        displayName,
        password,
        country,
        city,
        carBrand,
        carModel,
      });
      console.log('Registration result:', JSON.stringify(result, null, 2));
      
      if (!result.success) {
        const errorMsg = (result as { error?: string }).error || 'Registration failed';
        console.error('Registration failed with error:', errorMsg);
        throw new Error(errorMsg);
      }
      console.log('User registered on backend successfully');
    } catch (error: any) {
      console.error('Failed to register user on backend:', error);
      // Extract the most useful error message
      let errorMessage = 'Registration failed. Please try again.';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.data?.message) {
        errorMessage = error.data.message;
      } else if (error?.shape?.message) {
        errorMessage = error.shape.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      throw new Error(errorMessage);
    }

    const newUser: UserProfile = {
      id: userId,
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

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const result = await trpcClient.user.login.mutate({ email, password });
      
      if (!result.success) {
        return { 
          success: false, 
          error: result.error || 'incorrect_password',
          message: result.message 
        };
      }

      const stored = await AsyncStorage.getItem(USER_KEY);
      let userData: UserProfile;
      
      if (stored) {
        const localData = JSON.parse(stored);
        if (localData.email?.toLowerCase() === email.toLowerCase()) {
          userData = {
            ...localData,
            ...result.user,
          };
        } else {
          userData = {
            ...result.user,
            createdAt: result.user?.createdAt || Date.now(),
          } as UserProfile;
        }
      } else {
        userData = {
          ...result.user,
          createdAt: result.user?.createdAt || Date.now(),
        } as UserProfile;
      }

      await saveUser(userData);
      return { success: true, user: userData };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'network_error', message: 'Failed to connect. Please try again.' };
    }
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

  const signInWithGoogle = useCallback(async (
    email: string,
    displayName: string,
    profilePicture?: string
  ) => {
    const stored = await AsyncStorage.getItem(USER_KEY);
    if (stored) {
      const userData = JSON.parse(stored);
      if (userData.email?.toLowerCase() === email.toLowerCase()) {
        if (profilePicture && !userData.profilePicture) {
          userData.profilePicture = profilePicture;
        }
        userRef.current = userData;
        setUser(userData);
        return { success: true, user: userData };
      }
    }
    
    const userId = Date.now().toString();
    const newUser: UserProfile = {
      id: userId,
      email,
      displayName,
      profilePicture,
      createdAt: Date.now(),
      authProvider: 'google',
    };
    await saveUser(newUser);

    try {
      await trpcClient.user.register.mutate({
        id: userId,
        email,
        displayName,
      });
      console.log('Google user registered');
    } catch (error) {
      console.error('Failed to register Google user on backend:', error);
    }

    return { success: true, user: newUser };
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    signUp,
    signIn,
    signOut,
    signInWithGoogle,
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
