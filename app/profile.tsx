import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { User, Car, ChevronDown, LogOut, Check, Globe, MapPin, Navigation, Search, Camera, Plus, X, Image as ImageIcon, Eye, EyeOff } from 'lucide-react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useSettings } from '@/providers/SettingsProvider';
import { ThemeColors } from '@/constants/colors';
import { useUser } from '@/providers/UserProvider';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { CAR_BRANDS, getModelsForBrand } from '@/constants/cars';
import { trpcClient } from '@/lib/trpc';
import { COUNTRIES, getCitiesForCountry } from '@/constants/countries';
import { UserCar } from '@/types/user';

WebBrowser.maybeCompleteAuthSession();

interface AdditionalCar {
  id: string;
  brand: string;
  model: string;
  picture?: string;
}

export default function ProfileScreen() {
  const { user, isAuthenticated, signUp, signIn, signOut, updateProfile, updateCar, updateLocation, addCar, removeCar, setPrimaryCar, signInWithGoogle } = useUser();
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signin');
  const { colors } = useSettings();
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [profilePicture, setProfilePicture] = useState(user?.profilePicture || '');
  const [selectedCountry, setSelectedCountry] = useState(user?.country || '');
  const [selectedCity, setSelectedCity] = useState(user?.city || '');
  const [selectedBrand, setSelectedBrand] = useState(user?.carBrand || '');
  const [selectedModel, setSelectedModel] = useState(user?.carModel || '');
  const [carPicture, setCarPicture] = useState(user?.carPicture || '');
  const [additionalCars, setAdditionalCars] = useState<AdditionalCar[]>([]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showBrandPicker, setShowBrandPicker] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [showAddCarForm, setShowAddCarForm] = useState(false);
  const [newCarBrand, setNewCarBrand] = useState('');
  const [newCarModel, setNewCarModel] = useState('');
  const [newCarPicture, setNewCarPicture] = useState('');
  const [showNewBrandPicker, setShowNewBrandPicker] = useState(false);
  const [showNewModelPicker, setShowNewModelPicker] = useState(false);
  const [isCheckingDisplayName, setIsCheckingDisplayName] = useState(false);
  const [displayNameError, setDisplayNameError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [resetStep, setResetStep] = useState<'email' | 'code' | 'newPassword'>('email');
  const [isResetting, setIsResetting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: '229508757301-qu9290kh0vb6ijl7jpmftbkmbpotnn6m.apps.googleusercontent.com',
    iosClientId: '229508757301-kdqacnt706ifo720d6ftp617s8itd825.apps.googleusercontent.com',
    androidClientId: '229508757301-qu9290kh0vb6ijl7jpmftbkmbpotnn6m.apps.googleusercontent.com',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const accessToken = response.authentication?.accessToken;
      if (accessToken) {
        (async () => {
          setIsGoogleLoading(true);
          try {
            const userInfoResponse = await fetch(
              'https://www.googleapis.com/userinfo/v2/me',
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const googleUser = await userInfoResponse.json();
            console.log('Google user info:', googleUser);
            
            if (googleUser.email) {
              await signInWithGoogle(
                googleUser.email,
                googleUser.name || googleUser.email.split('@')[0],
                googleUser.picture
              );
              Alert.alert('Success', 'Signed in with Google successfully');
              router.back();
            } else {
              Alert.alert('Error', 'Could not retrieve email from Google account');
            }
          } catch (error) {
            console.error('Google sign in error:', error);
            Alert.alert('Error', 'Failed to sign in with Google. Please try again.');
          } finally {
            setIsGoogleLoading(false);
          }
        })();
      }
    }
  }, [response, signInWithGoogle]);

  const handleGoogleButtonPress = async () => {
    try {
      await promptAsync();
    } catch (error) {
      console.error('Google prompt error:', error);
      Alert.alert('Error', 'Failed to open Google sign in. Please try again.');
    }
  };

  const availableModels = useMemo(() => {
    return selectedBrand ? getModelsForBrand(selectedBrand) : [];
  }, [selectedBrand]);

  const availableCities = useMemo(() => {
    return selectedCountry ? getCitiesForCountry(selectedCountry) : [];
  }, [selectedCountry]);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const search = countrySearch.toLowerCase();
    return COUNTRIES.filter(
      (country) =>
        country.name.toLowerCase().includes(search) ||
        country.code.toLowerCase().includes(search)
    );
  }, [countrySearch]);

  const newCarModels = useMemo(() => {
    return newCarBrand ? getModelsForBrand(newCarBrand) : [];
  }, [newCarBrand]);

  const existingCars = useMemo(() => {
    return user?.cars?.filter(c => !c.isPrimary) || [];
  }, [user?.cars]);

  const allUserCars = useMemo(() => {
    return user?.cars || [];
  }, [user?.cars]);

  const handleSelectActiveCar = async (carId: string) => {
    await setPrimaryCar(carId);
    const selectedCar = user?.cars?.find(c => c.id === carId);
    if (selectedCar) {
      setSelectedBrand(selectedCar.brand);
      setSelectedModel(selectedCar.model);
      setCarPicture(selectedCar.picture || '');
    }
  };

  const showImagePickerOptions = (type: 'profile' | 'car' | 'newCar') => {
    Alert.alert(
      'Add Photo',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: () => handleCameraCapture(type),
        },
        {
          text: 'Choose from Library',
          onPress: () => handleLibraryPick(type),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleCameraCapture = async (type: 'profile' | 'car' | 'newCar') => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
      return;
    }

    const aspect: [number, number] = type === 'profile' ? [1, 1] : [16, 9];
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect,
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      if (type === 'profile') {
        setProfilePicture(uri);
      } else if (type === 'car') {
        setCarPicture(uri);
      } else {
        setNewCarPicture(uri);
      }
      console.log(`${type} picture captured:`, uri);
    }
  };

  const handleLibraryPick = async (type: 'profile' | 'car' | 'newCar') => {
    const aspect: [number, number] = type === 'profile' ? [1, 1] : [16, 9];
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect,
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      if (type === 'profile') {
        setProfilePicture(uri);
      } else if (type === 'car') {
        setCarPicture(uri);
      } else {
        setNewCarPicture(uri);
      }
      console.log(`${type} picture selected:`, uri);
    }
  };

  const pickProfilePicture = () => showImagePickerOptions('profile');

  const pickCarPicture = () => showImagePickerOptions('car');

  const pickNewCarPicture = () => showImagePickerOptions('newCar');

  const handleCountrySelect = (countryCode: string) => {
    setSelectedCountry(countryCode);
    setSelectedCity('');
    setShowCountryPicker(false);
    setCountrySearch('');
  };

  const handleCitySelect = (city: string) => {
    setSelectedCity(city);
    setShowCityPicker(false);
  };

  const handleBrandSelect = (brand: string) => {
    setSelectedBrand(brand);
    setSelectedModel('');
    setShowBrandPicker(false);
  };

  const handleModelSelect = (model: string) => {
    setSelectedModel(model);
    setShowModelPicker(false);
  };

  const handleNewBrandSelect = (brand: string) => {
    setNewCarBrand(brand);
    setNewCarModel('');
    setShowNewBrandPicker(false);
  };

  const handleNewModelSelect = (model: string) => {
    setNewCarModel(model);
    setShowNewModelPicker(false);
  };

  const handleAddCar = () => {
    if (!newCarBrand || !newCarModel) {
      Alert.alert('Error', 'Please select brand and model');
      return;
    }
    const newCar: AdditionalCar = {
      id: Date.now().toString(),
      brand: newCarBrand,
      model: newCarModel,
      picture: newCarPicture || undefined,
    };
    setAdditionalCars([...additionalCars, newCar]);
    setNewCarBrand('');
    setNewCarModel('');
    setNewCarPicture('');
    setShowAddCarForm(false);
  };

  const handleRemoveAdditionalCar = (carId: string) => {
    setAdditionalCars(additionalCars.filter(c => c.id !== carId));
  };

  const handleRemoveExistingCar = async (carId: string) => {
    Alert.alert(
      'Remove Car',
      'Are you sure you want to remove this car?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeCar(carId),
        },
      ]
    );
  };

  const handleUseMyLocation = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Location detection is not available on web. Please select your location manually.');
      return;
    }
    
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location permissions to use this feature.');
        setIsLocating(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const [geocode] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (geocode) {
        const countryName = geocode.country || '';
        const cityName = geocode.city || geocode.subregion || geocode.region || '';

        const matchedCountry = COUNTRIES.find(
          c => c.name.toLowerCase() === countryName.toLowerCase() ||
               c.code.toLowerCase() === (geocode.isoCountryCode || '').toLowerCase()
        );

        if (matchedCountry) {
          setSelectedCountry(matchedCountry.code);
          
          const matchedCity = matchedCountry.cities.find(
            c => c.toLowerCase() === cityName.toLowerCase()
          );
          
          if (matchedCity) {
            setSelectedCity(matchedCity);
          } else if (cityName) {
            setSelectedCity(cityName);
          }
          
          console.log('Location detected:', matchedCountry.name, cityName);
        } else {
          Alert.alert('Location Found', `We detected ${cityName}, ${countryName} but couldn't match it to our country list. Please select manually.`);
        }
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Failed to get your location. Please try again or select manually.');
    } finally {
      setIsLocating(false);
    }
  };

  const handleSave = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    if (!isAuthenticated && !password.trim()) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }
    if (!isAuthenticated && password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (!isAuthenticated && authMode === 'signup' && !displayName.trim()) {
      Alert.alert('Error', 'Please enter your display name');
      return;
    }
    if (!isAuthenticated && authMode === 'signup' && !selectedBrand) {
      Alert.alert('Error', 'Please select your car brand');
      return;
    }
    if (!isAuthenticated && authMode === 'signup' && !selectedModel) {
      Alert.alert('Error', 'Please select your car model');
      return;
    }

    if (!isAuthenticated && authMode === 'signup') {
      setIsCheckingDisplayName(true);
      try {
        const result = await trpcClient.user.checkDisplayName.query({ displayName: displayName.trim() });
        if (!result.available) {
          setDisplayNameError('This display name is already taken');
          Alert.alert('Error', 'This display name is already taken. Please choose a different one.');
          setIsCheckingDisplayName(false);
          return;
        }
        setDisplayNameError('');
      } catch (error) {
        console.error('Failed to check display name:', error);
      } finally {
        setIsCheckingDisplayName(false);
      }
    }

    setIsSubmitting(true);
    try {
      if (isAuthenticated) {
        await updateProfile({ email, displayName, profilePicture: profilePicture || undefined });
        if (selectedCountry) {
          await updateLocation(selectedCountry, selectedCity);
        }
        if (selectedBrand && selectedModel) {
          await updateCar(selectedBrand, selectedModel, carPicture || undefined);
        }
        for (const car of additionalCars) {
          await addCar(car.brand, car.model, car.picture);
        }
        Alert.alert('Success', 'Profile updated successfully');
        router.back();
      } else if (authMode === 'signin') {
        const result = await signIn(email, password);
        if (result.success) {
          Alert.alert('Success', 'Signed in successfully');
          router.back();
        } else if (result.error === 'incorrect_password') {
          Alert.alert('Error', 'Incorrect password. Please try again.');
        } else {
          Alert.alert('Error', 'No account found with this email. Please sign up first.');
        }
      } else {
        const carsToAdd: UserCar[] = additionalCars.map(c => ({
          id: c.id,
          brand: c.brand,
          model: c.model,
          picture: c.picture,
          isPrimary: false,
        }));
        await signUp(
          email, 
          displayName,
          password,
          selectedCountry || undefined, 
          selectedCity || undefined, 
          selectedBrand || undefined, 
          selectedModel || undefined,
          profilePicture || undefined,
          carPicture || undefined,
          carsToAdd.length > 0 ? carsToAdd : undefined
        );
        Alert.alert('Success', 'Account created successfully');
        router.back();
      }
    } catch (error: any) {
      console.error('Profile save error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Extract the most useful error message
      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.data?.message) {
        errorMessage = error.data.message;
      } else if (error?.shape?.message) {
        errorMessage = error.shape.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.back();
          },
        },
      ]
    );
  };

  const handleForgotPassword = () => {
    setResetEmail(email);
    setResetCode('');
    setNewPassword('');
    setResetStep('email');
    setShowForgotPassword(true);
  };

  const handleRequestResetCode = async () => {
    if (!resetEmail.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }
    setIsResetting(true);
    try {
      console.log('Requesting password reset for:', resetEmail.trim());
      const result = await trpcClient.user.requestPasswordReset.mutate({ email: resetEmail.trim() });
      console.log('Password reset result:', JSON.stringify(result, null, 2));
      
      if (result.success && result.emailSent) {
        setResetStep('code');
        Alert.alert('Code Sent', 'A reset code has been sent to your email. Please check your inbox.');
      } else {
        const errorMessage = (result as { error?: string }).error || 'Failed to send reset code. Please try again.';
        console.log('Password reset error message:', errorMessage);
        Alert.alert('Error', errorMessage);
      }
    } catch (error: unknown) {
      console.error('Failed to request reset code:', error);
      let errorMessage = 'Failed to send reset code. Please try again.';
      
      if (error && typeof error === 'object') {
        const err = error as { message?: string; data?: { message?: string }; shape?: { message?: string } };
        if (err.message) {
          errorMessage = err.message;
        } else if (err.data?.message) {
          errorMessage = err.data.message;
        } else if (err.shape?.message) {
          errorMessage = err.shape.message;
        }
      }
      
      const lowerMessage = errorMessage.toLowerCase();
      if (lowerMessage.includes('429') || lowerMessage.includes('rate') || lowerMessage.includes('too many')) {
        Alert.alert('Please Wait', 'Too many requests. Please wait a minute and try again.');
      } else if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || lowerMessage.includes('failed to fetch')) {
        Alert.alert('Error', 'Network error. Please check your connection and try again.');
      } else if (lowerMessage.includes('non-json') || lowerMessage.includes('html')) {
        Alert.alert('Server Busy', 'The server is temporarily busy. Please try again in a moment.');
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setIsResetting(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!resetCode.trim()) {
      Alert.alert('Error', 'Please enter the reset code');
      return;
    }
    setIsResetting(true);
    try {
      const result = await trpcClient.user.verifyResetCode.mutate({ 
        email: resetEmail.trim(), 
        code: resetCode.trim() 
      });
      if (result.valid) {
        setResetStep('newPassword');
      } else {
        Alert.alert('Error', result.error || 'Invalid code');
      }
    } catch (error) {
      console.error('Failed to verify code:', error);
      Alert.alert('Error', 'Failed to verify code. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    setIsResetting(true);
    try {
      const result = await trpcClient.user.resetPassword.mutate({
        email: resetEmail.trim(),
        newPassword: newPassword,
      });

      if (result.success) {
        setShowForgotPassword(false);
        setPassword(newPassword);
        setResetEmail('');
        setResetCode('');
        setNewPassword('');
        setConfirmNewPassword('');
        setResetStep('email');
        Alert.alert('Success', 'Your password has been reset. You can now sign in.');
      } else {
        const errorMsg = (result as { error?: string }).error || 'Failed to reset password.';
        Alert.alert('Error', errorMsg);
      }
    } catch (error) {
      console.error('Failed to reset password:', error);
      Alert.alert('Error', 'Failed to reset password. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  const closeAllPickers = () => {
    setShowCountryPicker(false);
    setShowCityPicker(false);
    setShowBrandPicker(false);
    setShowModelPicker(false);
    setShowNewBrandPicker(false);
    setShowNewModelPicker(false);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: isAuthenticated ? 'Edit Profile' : authMode === 'signin' ? 'Sign In' : 'Create Account',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontSize: 16, fontWeight: '600' as const },
          headerTitleAlign: 'center',
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.avatarSection}>
            {(isAuthenticated || authMode === 'signup') && (
              <TouchableOpacity style={styles.avatarContainer} onPress={pickProfilePicture}>
                {profilePicture ? (
                  <Image source={{ uri: profilePicture }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatar}>
                    <User color={colors.textInverted} size={48} />
                  </View>
                )}
                <View style={styles.cameraOverlay}>
                  <Camera color={colors.textInverted} size={16} />
                </View>
              </TouchableOpacity>
            )}
            {!isAuthenticated && authMode === 'signin' && (
              <View style={styles.avatar}>
                <User color={colors.textInverted} size={48} />
              </View>
            )}
            <Text style={styles.avatarText}>
              {isAuthenticated ? 'Your Profile' : authMode === 'signin' ? 'Welcome Back' : 'Join RedLine'}
            </Text>
            <Text style={styles.avatarSubtext}>
              {isAuthenticated
                ? 'Update your profile and car information'
                : authMode === 'signin'
                ? 'Sign in with your email to access your trips'
                : 'Create an account to save your trips and compete on leaderboards'}
            </Text>
            {(isAuthenticated || authMode === 'signup') && <Text style={styles.tapToChangeText}>Tap photo to change</Text>}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account Information</Text>
            
            {(isAuthenticated || authMode === 'signup') && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Display Name</Text>
                <TextInput
                  style={[styles.input, displayNameError ? styles.inputError : null]}
                  value={displayName}
                  onChangeText={(text) => {
                    setDisplayName(text);
                    setDisplayNameError('');
                  }}
                  placeholder="Enter your name"
                  placeholderTextColor={colors.textLight}
                  autoCapitalize="words"
                />
                {displayNameError ? (
                  <Text style={styles.errorText}>{displayNameError}</Text>
                ) : null}
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor={colors.textLight}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {!isAuthenticated && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder={authMode === 'signin' ? 'Enter your password' : 'Create a password'}
                    placeholderTextColor={colors.textLight}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff size={20} color={colors.textLight} />
                    ) : (
                      <Eye size={20} color={colors.textLight} />
                    )}
                  </TouchableOpacity>
                </View>
                {authMode === 'signup' && (
                  <Text style={styles.passwordHint}>Must be at least 6 characters</Text>
                )}
                {authMode === 'signin' && (
                  <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPasswordButton}>
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {(isAuthenticated || authMode === 'signup') && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Globe color={colors.text} size={20} />
              <Text style={styles.sectionTitle}>Location (Optional)</Text>
            </View>

            <TouchableOpacity
              style={styles.locationButton}
              onPress={handleUseMyLocation}
              disabled={isLocating}
              activeOpacity={0.7}
            >
              {isLocating ? (
                <ActivityIndicator size="small" color={colors.textInverted} />
              ) : (
                <Navigation size={18} color={colors.textInverted} />
              )}
              <Text style={styles.locationButtonText}>
                {isLocating ? 'Detecting...' : 'Use My Location'}
              </Text>
            </TouchableOpacity>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Country</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => {
                  closeAllPickers();
                  setShowCountryPicker(!showCountryPicker);
                }}
              >
                <Text style={[styles.pickerText, !selectedCountry && styles.placeholderText]}>
                  {selectedCountry ? COUNTRIES.find(c => c.code === selectedCountry)?.flag + ' ' + COUNTRIES.find(c => c.code === selectedCountry)?.name : 'Select country'}
                </Text>
                <ChevronDown color={colors.textLight} size={20} />
              </TouchableOpacity>

              {showCountryPicker && (
                <View style={styles.pickerOptions}>
                  <View style={styles.searchContainer}>
                    <Search size={16} color={colors.textLight} />
                    <TextInput
                      style={styles.searchInput}
                      value={countrySearch}
                      onChangeText={setCountrySearch}
                      placeholder="Search country..."
                      placeholderTextColor={colors.textLight}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  <ScrollView style={styles.pickerScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {filteredCountries.map((country) => (
                      <TouchableOpacity
                        key={country.code}
                        style={[
                          styles.pickerOption,
                          selectedCountry === country.code && styles.pickerOptionSelected,
                        ]}
                        onPress={() => handleCountrySelect(country.code)}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            selectedCountry === country.code && styles.pickerOptionTextSelected,
                          ]}
                        >
                          {country.flag} {country.name}
                        </Text>
                        {selectedCountry === country.code && (
                          <Check color={colors.accent} size={18} />
                        )}
                      </TouchableOpacity>
                    ))}
                    {filteredCountries.length === 0 && (
                      <View style={styles.noResults}>
                        <Text style={styles.noResultsText}>No countries found</Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>City</Text>
              <TouchableOpacity
                style={[styles.picker, !selectedCountry && styles.pickerDisabled]}
                onPress={() => {
                  if (selectedCountry) {
                    closeAllPickers();
                    setShowCityPicker(!showCityPicker);
                  }
                }}
                disabled={!selectedCountry}
              >
                <View style={styles.pickerContent}>
                  <MapPin size={16} color={selectedCity ? colors.text : colors.textLight} />
                  <Text style={[styles.pickerText, !selectedCity && styles.placeholderText]}>
                    {selectedCity || (selectedCountry ? 'Select city' : 'Select country first')}
                  </Text>
                </View>
                <ChevronDown color={colors.textLight} size={20} />
              </TouchableOpacity>

              {showCityPicker && availableCities.length > 0 && (
                <View style={styles.pickerOptions}>
                  <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                    {availableCities.map((city, cityIndex) => (
                      <TouchableOpacity
                        key={city || `city-${cityIndex}`}
                        style={[
                          styles.pickerOption,
                          selectedCity === city && styles.pickerOptionSelected,
                        ]}
                        onPress={() => handleCitySelect(city)}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            selectedCity === city && styles.pickerOptionTextSelected,
                          ]}
                        >
                          {city}
                        </Text>
                        {selectedCity === city && (
                          <Check color={colors.accent} size={18} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>
          )}

          {isAuthenticated && allUserCars.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Car color={colors.text} size={20} />
                <Text style={styles.sectionTitle}>My Garage</Text>
              </View>
              <Text style={styles.selectCarHint}>Tap a car to set it as your active car for tracking</Text>
              <View style={styles.garageGrid}>
                {allUserCars.map((car, index) => (
                  <TouchableOpacity
                    key={car.id || `user-car-${index}`}
                    style={[
                      styles.garageCard,
                      car.isPrimary && styles.garageCardActive,
                    ]}
                    onPress={() => handleSelectActiveCar(car.id)}
                    activeOpacity={0.7}
                  >
                    {car.picture ? (
                      <Image source={{ uri: car.picture }} style={styles.garageCarImage} />
                    ) : (
                      <View style={styles.garageCarImagePlaceholder}>
                        <Car color={colors.textLight} size={32} />
                      </View>
                    )}
                    <View style={styles.garageCardContent}>
                      <Text style={styles.garageCarBrand} numberOfLines={1}>{car.brand}</Text>
                      <Text style={styles.garageCarModel} numberOfLines={1}>{car.model}</Text>
                      {car.isPrimary && (
                        <View style={styles.activeTag}>
                          <Check color={colors.textInverted} size={10} />
                          <Text style={styles.activeTagText}>Active</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {(isAuthenticated || authMode === 'signup') && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Car color={colors.text} size={20} />
              <Text style={styles.sectionTitle}>Primary Car {authMode === 'signup' && !isAuthenticated ? '(Required)' : '(Optional)'}</Text>
            </View>

            <TouchableOpacity style={styles.carImagePicker} onPress={pickCarPicture}>
              {carPicture ? (
                <Image source={{ uri: carPicture }} style={styles.carImage} />
              ) : (
                <View style={styles.carImagePlaceholder}>
                  <ImageIcon color={colors.textLight} size={32} />
                  <Text style={styles.carImagePlaceholderText}>Tap to add car photo</Text>
                </View>
              )}
              <View style={styles.carCameraOverlay}>
                <Camera color={colors.textInverted} size={14} />
              </View>
            </TouchableOpacity>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Brand</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => {
                  closeAllPickers();
                  setShowBrandPicker(!showBrandPicker);
                }}
              >
                <Text style={[styles.pickerText, !selectedBrand && styles.placeholderText]}>
                  {selectedBrand || 'Select brand'}
                </Text>
                <ChevronDown color={colors.textLight} size={20} />
              </TouchableOpacity>
              
              {showBrandPicker && (
                <View style={styles.pickerOptions}>
                  <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                    {CAR_BRANDS.map((brand) => (
                      <TouchableOpacity
                        key={brand.name}
                        style={[
                          styles.pickerOption,
                          selectedBrand === brand.name && styles.pickerOptionSelected,
                        ]}
                        onPress={() => handleBrandSelect(brand.name)}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            selectedBrand === brand.name && styles.pickerOptionTextSelected,
                          ]}
                        >
                          {brand.name}
                        </Text>
                        {selectedBrand === brand.name && (
                          <Check color={colors.accent} size={18} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Model</Text>
              <TouchableOpacity
                style={[styles.picker, !selectedBrand && styles.pickerDisabled]}
                onPress={() => {
                  if (selectedBrand) {
                    closeAllPickers();
                    setShowModelPicker(!showModelPicker);
                  }
                }}
                disabled={!selectedBrand}
              >
                <Text style={[styles.pickerText, !selectedModel && styles.placeholderText]}>
                  {selectedModel || (selectedBrand ? 'Select model' : 'Select brand first')}
                </Text>
                <ChevronDown color={colors.textLight} size={20} />
              </TouchableOpacity>

              {showModelPicker && availableModels.length > 0 && (
                <View style={styles.pickerOptions}>
                  <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                    {availableModels.map((model, index) => (
                      <TouchableOpacity
                        key={`${model}-${index}`}
                        style={[
                          styles.pickerOption,
                          selectedModel === model && styles.pickerOptionSelected,
                        ]}
                        onPress={() => handleModelSelect(model)}
                      >
                        <Text
                          style={[
                            styles.pickerOptionText,
                            selectedModel === model && styles.pickerOptionTextSelected,
                          ]}
                        >
                          {model}
                        </Text>
                        {selectedModel === model && (
                          <Check color={colors.accent} size={18} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>
          )}

          {(isAuthenticated || authMode === 'signup') && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Car color={colors.text} size={20} />
              <Text style={styles.sectionTitle}>Additional Cars</Text>
            </View>

            {existingCars.map((car, index) => (
              <View key={car.id || `existing-car-${index}`} style={styles.additionalCarCard}>
                {car.picture && (
                  <Image source={{ uri: car.picture }} style={styles.additionalCarImage} />
                )}
                <View style={styles.additionalCarInfo}>
                  <Text style={styles.additionalCarName}>{car.brand} {car.model}</Text>
                </View>
                <TouchableOpacity
                  style={styles.removeCarButton}
                  onPress={() => handleRemoveExistingCar(car.id)}
                >
                  <X color={colors.danger} size={18} />
                </TouchableOpacity>
              </View>
            ))}

            {additionalCars.map((car, index) => (
              <View key={car.id || `additional-car-${index}`} style={styles.additionalCarCard}>
                {car.picture && (
                  <Image source={{ uri: car.picture }} style={styles.additionalCarImage} />
                )}
                <View style={styles.additionalCarInfo}>
                  <Text style={styles.additionalCarName}>{car.brand} {car.model}</Text>
                  <Text style={styles.additionalCarLabel}>New</Text>
                </View>
                <TouchableOpacity
                  style={styles.removeCarButton}
                  onPress={() => handleRemoveAdditionalCar(car.id)}
                >
                  <X color={colors.danger} size={18} />
                </TouchableOpacity>
              </View>
            ))}

            {(isAuthenticated || authMode === 'signup') && showAddCarForm ? (
              <View style={styles.addCarForm}>
                <TouchableOpacity style={styles.carImagePickerSmall} onPress={pickNewCarPicture}>
                  {newCarPicture ? (
                    <Image source={{ uri: newCarPicture }} style={styles.carImageSmall} />
                  ) : (
                    <View style={styles.carImagePlaceholderSmall}>
                      <Camera color={colors.textLight} size={20} />
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Brand</Text>
                  <TouchableOpacity
                    style={styles.picker}
                    onPress={() => {
                      closeAllPickers();
                      setShowNewBrandPicker(!showNewBrandPicker);
                    }}
                  >
                    <Text style={[styles.pickerText, !newCarBrand && styles.placeholderText]}>
                      {newCarBrand || 'Select brand'}
                    </Text>
                    <ChevronDown color={colors.textLight} size={20} />
                  </TouchableOpacity>
                  
                  {showNewBrandPicker && (
                    <View style={styles.pickerOptions}>
                      <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                        {CAR_BRANDS.map((brand) => (
                          <TouchableOpacity
                            key={brand.name}
                            style={[
                              styles.pickerOption,
                              newCarBrand === brand.name && styles.pickerOptionSelected,
                            ]}
                            onPress={() => handleNewBrandSelect(brand.name)}
                          >
                            <Text
                              style={[
                                styles.pickerOptionText,
                                newCarBrand === brand.name && styles.pickerOptionTextSelected,
                              ]}
                            >
                              {brand.name}
                            </Text>
                            {newCarBrand === brand.name && (
                              <Check color={colors.accent} size={18} />
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Model</Text>
                  <TouchableOpacity
                    style={[styles.picker, !newCarBrand && styles.pickerDisabled]}
                    onPress={() => {
                      if (newCarBrand) {
                        closeAllPickers();
                        setShowNewModelPicker(!showNewModelPicker);
                      }
                    }}
                    disabled={!newCarBrand}
                  >
                    <Text style={[styles.pickerText, !newCarModel && styles.placeholderText]}>
                      {newCarModel || (newCarBrand ? 'Select model' : 'Select brand first')}
                    </Text>
                    <ChevronDown color={colors.textLight} size={20} />
                  </TouchableOpacity>

                  {showNewModelPicker && newCarModels.length > 0 && (
                    <View style={styles.pickerOptions}>
                      <ScrollView style={styles.pickerScroll} nestedScrollEnabled>
                        {newCarModels.map((model, index) => (
                          <TouchableOpacity
                            key={`${model}-${index}`}
                            style={[
                              styles.pickerOption,
                              newCarModel === model && styles.pickerOptionSelected,
                            ]}
                            onPress={() => handleNewModelSelect(model)}
                          >
                            <Text
                              style={[
                                styles.pickerOptionText,
                                newCarModel === model && styles.pickerOptionTextSelected,
                              ]}
                            >
                              {model}
                            </Text>
                            {newCarModel === model && (
                              <Check color={colors.accent} size={18} />
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.addCarFormButtons}>
                  <TouchableOpacity
                    style={styles.cancelCarButton}
                    onPress={() => {
                      setShowAddCarForm(false);
                      setNewCarBrand('');
                      setNewCarModel('');
                      setNewCarPicture('');
                    }}
                  >
                    <Text style={styles.cancelCarButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmCarButton}
                    onPress={handleAddCar}
                  >
                    <Text style={styles.confirmCarButtonText}>Add Car</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addCarButton}
                onPress={() => setShowAddCarForm(true)}
              >
                <Plus color={colors.accent} size={20} />
                <Text style={styles.addCarButtonText}>Add Another Car</Text>
              </TouchableOpacity>
            )}
          </View>
          )}

          <TouchableOpacity
            style={[styles.saveButton, (isSubmitting || isCheckingDisplayName) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSubmitting || isCheckingDisplayName}
          >
            <Text style={styles.saveButtonText}>
              {isSubmitting || isCheckingDisplayName ? 'Saving...' : isAuthenticated ? 'Save Changes' : authMode === 'signin' ? 'Sign In' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          {!isAuthenticated && (
            <>
              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={[styles.googleButton, (isGoogleLoading || !request) && styles.googleButtonDisabled]}
                onPress={handleGoogleButtonPress}
                disabled={isGoogleLoading || !request}
                activeOpacity={0.7}
              >
                {isGoogleLoading ? (
                  <ActivityIndicator size="small" color="#4285F4" />
                ) : (
                  <>
                    <View style={styles.googleIconContainer}>
                      <Text style={styles.googleIcon}>G</Text>
                    </View>
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchAuthButton}
                onPress={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
              >
                <Text style={styles.switchAuthText}>
                  {authMode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                  <Text style={styles.switchAuthLink}>
                    {authMode === 'signin' ? 'Sign Up' : 'Sign In'}
                  </Text>
                </Text>
              </TouchableOpacity>
            </>
          )}

          {isAuthenticated && (
            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
              <LogOut color={colors.danger} size={20} />
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {showForgotPassword && (
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {resetStep === 'email' ? 'Reset Password' : resetStep === 'code' ? 'Enter Code' : 'New Password'}
              </Text>
              <TouchableOpacity onPress={() => setShowForgotPassword(false)} style={styles.modalCloseButton}>
                <X size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {resetStep === 'email' && (
              <>
                <Text style={styles.modalDescription}>
                  Enter your email address and we will send you a code to reset your password.
                </Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={styles.input}
                    value={resetEmail}
                    onChangeText={setResetEmail}
                    placeholder="Enter your email"
                    placeholderTextColor={colors.textLight}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                <TouchableOpacity
                  style={[styles.saveButton, isResetting && styles.saveButtonDisabled]}
                  onPress={handleRequestResetCode}
                  disabled={isResetting}
                >
                  <Text style={styles.saveButtonText}>
                    {isResetting ? 'Sending...' : 'Send Reset Code'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {resetStep === 'code' && (
              <>
                <Text style={styles.modalDescription}>
                  Enter the 6-digit code sent to {resetEmail}
                </Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Reset Code</Text>
                  <TextInput
                    style={styles.input}
                    value={resetCode}
                    onChangeText={setResetCode}
                    placeholder="Enter 6-digit code"
                    placeholderTextColor={colors.textLight}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.saveButton, isResetting && styles.saveButtonDisabled]}
                  onPress={handleVerifyCode}
                  disabled={isResetting}
                >
                  <Text style={styles.saveButtonText}>
                    {isResetting ? 'Verifying...' : 'Verify Code'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleRequestResetCode} style={styles.resendCodeButton}>
                  <Text style={styles.resendCodeText}>Resend Code</Text>
                </TouchableOpacity>
              </>
            )}

            {resetStep === 'newPassword' && (
              <>
                <Text style={styles.modalDescription}>
                  Enter your new password.
                </Text>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>New Password</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Enter new password"
                      placeholderTextColor={colors.textLight}
                      secureTextEntry={!showNewPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={styles.passwordToggle}
                      onPress={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff size={20} color={colors.textLight} />
                      ) : (
                        <Eye size={20} color={colors.textLight} />
                      )}
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.passwordHint}>Must be at least 6 characters</Text>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      value={confirmNewPassword}
                      onChangeText={setConfirmNewPassword}
                      placeholder="Confirm new password"
                      placeholderTextColor={colors.textLight}
                      secureTextEntry={!showConfirmNewPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={styles.passwordToggle}
                      onPress={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                    >
                      {showConfirmNewPassword ? (
                        <EyeOff size={20} color={colors.textLight} />
                      ) : (
                        <Eye size={20} color={colors.textLight} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.saveButton, isResetting && styles.saveButtonDisabled]}
                  onPress={handleResetPassword}
                  disabled={isResetting}
                >
                  <Text style={styles.saveButtonText}>
                    {isResetting ? 'Resetting...' : 'Reset Password'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      )}
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  avatarText: {
    fontSize: 24,
    fontFamily: 'Orbitron_700Bold',
    color: colors.text,
    marginBottom: 8,
  },
  avatarSubtext: {
    fontSize: 14,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  tapToChangeText: {
    fontSize: 12,
    fontFamily: 'Orbitron_400Regular',
    color: colors.accent,
    marginTop: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Orbitron_500Medium',
    color: colors.textLight,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.cardLight,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Orbitron_400Regular',
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Orbitron_400Regular',
    color: colors.danger,
    marginTop: 6,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Orbitron_400Regular',
    color: colors.text,
  },
  passwordToggle: {
    padding: 16,
  },
  passwordHint: {
    fontSize: 12,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    marginTop: 6,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  locationButtonText: {
    fontSize: 14,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.textInverted,
  },
  picker: {
    backgroundColor: colors.cardLight,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  pickerDisabled: {
    opacity: 0.5,
  },
  pickerText: {
    fontSize: 16,
    fontFamily: 'Orbitron_400Regular',
    color: colors.text,
  },
  placeholderText: {
    color: colors.textLight,
  },
  pickerOptions: {
    backgroundColor: colors.cardLight,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 250,
    overflow: 'hidden',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Orbitron_400Regular',
    color: colors.text,
    padding: 0,
  },
  noResults: {
    padding: 16,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
  },
  pickerScroll: {
    maxHeight: 200,
  },
  pickerOption: {
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerOptionSelected: {
    backgroundColor: `${colors.accent}10`,
  },
  pickerOptionText: {
    fontSize: 15,
    fontFamily: 'Orbitron_400Regular',
    color: colors.text,
  },
  pickerOptionTextSelected: {
    color: colors.accent,
    fontFamily: 'Orbitron_500Medium',
  },
  carImagePicker: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  carImage: {
    width: '100%',
    height: '100%',
  },
  carImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.cardLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  carImagePlaceholderText: {
    fontSize: 14,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    marginTop: 8,
  },
  carCameraOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  additionalCarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  additionalCarImage: {
    width: 60,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  additionalCarInfo: {
    flex: 1,
  },
  additionalCarName: {
    fontSize: 15,
    fontFamily: 'Orbitron_500Medium',
    color: colors.text,
  },
  additionalCarLabel: {
    fontSize: 12,
    fontFamily: 'Orbitron_400Regular',
    color: colors.accent,
    marginTop: 2,
  },
  removeCarButton: {
    padding: 8,
  },
  addCarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.cardLight,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
  },
  addCarButtonText: {
    fontSize: 14,
    fontFamily: 'Orbitron_500Medium',
    color: colors.accent,
  },
  addCarForm: {
    backgroundColor: colors.cardLight,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  carImagePickerSmall: {
    width: 80,
    height: 54,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    alignSelf: 'center',
  },
  carImageSmall: {
    width: '100%',
    height: '100%',
  },
  carImagePlaceholderSmall: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 8,
  },
  addCarFormButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelCarButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  cancelCarButtonText: {
    fontSize: 14,
    fontFamily: 'Orbitron_500Medium',
    color: colors.textLight,
  },
  confirmCarButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  confirmCarButtonText: {
    fontSize: 14,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.textInverted,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.textInverted,
    fontSize: 16,
    fontFamily: 'Orbitron_600SemiBold',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    padding: 16,
  },
  signOutText: {
    color: colors.danger,
    fontSize: 16,
    fontFamily: 'Orbitron_500Medium',
  },
  switchAuthButton: {
    alignItems: 'center',
    marginTop: 20,
    padding: 12,
  },
  switchAuthText: {
    fontSize: 14,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
  },
  switchAuthLink: {
    color: colors.accent,
    fontFamily: 'Orbitron_600SemiBold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 14,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    marginHorizontal: 16,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardLight,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIcon: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: 16,
    fontFamily: 'Orbitron_500Medium',
    color: colors.text,
  },
  forgotPasswordButton: {
    marginTop: 12,
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    fontSize: 14,
    fontFamily: 'Orbitron_500Medium',
    color: colors.accent,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  modalContent: {
    backgroundColor: colors.cardLight,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalDescription: {
    fontSize: 14,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    marginBottom: 20,
    lineHeight: 20,
  },
  resendCodeButton: {
    alignItems: 'center',
    marginTop: 16,
    padding: 8,
  },
  resendCodeText: {
    fontSize: 14,
    fontFamily: 'Orbitron_500Medium',
    color: colors.accent,
  },
  selectCarHint: {
    fontSize: 13,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    marginBottom: 12,
    marginTop: -8,
  },
  garageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  garageCard: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  garageCardActive: {},
  garageCarImage: {
    width: '100%',
    height: 100,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  garageCarImagePlaceholder: {
    width: '100%',
    height: 100,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: colors.cardLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 0,
  },
  garageCardContent: {
    backgroundColor: colors.cardLight,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 0,
  },
  garageCarBrand: {
    fontSize: 11,
    fontFamily: 'Orbitron_400Regular',
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  garageCarModel: {
    fontSize: 14,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.text,
    marginTop: 2,
  },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
    gap: 4,
  },
  activeTagText: {
    fontSize: 10,
    fontFamily: 'Orbitron_600SemiBold',
    color: colors.textInverted,
    textTransform: 'uppercase',
  },
});
