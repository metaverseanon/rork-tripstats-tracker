import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Linking, Image, Switch, Platform, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { router } from 'expo-router';
import { ChevronRight, Gauge, Ruler, FileText, Shield, User, Car, Sun, Moon, HelpCircle, Bell, Mail, MessageSquare, X, Send } from 'lucide-react-native';
import { useSettings, SpeedUnit, DistanceUnit } from '@/providers/SettingsProvider';
import { useUser } from '@/providers/UserProvider';
import { useNotifications } from '@/providers/NotificationProvider';
import { ThemeType } from '@/constants/colors';
import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';

export default function SettingsScreen() {
  const { settings, colors, setSpeedUnit, setDistanceUnit, setTheme } = useSettings();
  const { user, isAuthenticated, getCarDisplayName } = useUser();
  const { notificationsEnabled, pushToken, registerForPushNotifications, disableNotifications } = useNotifications();

  const [isTogglingNotifications, setIsTogglingNotifications] = useState(false);
  const [isTogglingWeeklyRecap, setIsTogglingWeeklyRecap] = useState(false);
  const [weeklyRecapEnabled, setWeeklyRecapEnabled] = useState(true);
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');


  const weeklyRecapQuery = trpc.user.getWeeklyRecapEnabled.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  const updateWeeklyRecapMutation = trpc.user.updateWeeklyRecapEnabled.useMutation();

  useEffect(() => {
    if (weeklyRecapQuery.data !== undefined) {
      setWeeklyRecapEnabled(weeklyRecapQuery.data.enabled);
    }
  }, [weeklyRecapQuery.data]);

  const speedOptions: { value: SpeedUnit; label: string }[] = [
    { value: 'kmh', label: 'km/h' },
    { value: 'mph', label: 'mph' },
  ];

  const distanceOptions: { value: DistanceUnit; label: string }[] = [
    { value: 'km', label: 'Kilometers' },
    { value: 'mi', label: 'Miles' },
  ];

  const themeOptions: { value: ThemeType; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
  ];

  const openPrivacyPolicy = () => {
    Linking.openURL('https://redlineapp.io/privacy.html');
  };

  const openTermsOfUse = () => {
    Linking.openURL('https://redlineapp.io/terms.html');
  };

  const openHelpCenter = () => {
    Linking.openURL('https://redlineapp.io/help.html');
  };

  const sendFeedbackMutation = trpc.user.sendFeedback.useMutation({
    onSuccess: () => {
      Alert.alert('Thank you!', 'Your feedback has been sent successfully.');
      setFeedbackText('');
      setFeedbackModalVisible(false);
    },
    onError: (error: any) => {
      console.error('[SETTINGS] Failed to send feedback:', error);
      Alert.alert('Error', 'Failed to send feedback. Please try again.');
    },
  });

  const handleSendFeedback = () => {
    if (!feedbackText.trim()) {
      Alert.alert('Empty Feedback', 'Please enter your feedback before sending.');
      return;
    }
    sendFeedbackMutation.mutate({
      userId: user?.id || 'anonymous',
      email: user?.email || 'unknown',
      displayName: user?.displayName || 'Anonymous',
      feedback: feedbackText.trim(),
    });
  };

  const handleNotificationToggle = async (value: boolean) => {
    if (Platform.OS === 'web') {
      return;
    }
    
    setIsTogglingNotifications(true);
    try {
      if (value) {
        console.log('[SETTINGS] Enabling notifications...');
        await registerForPushNotifications(user?.id);
        console.log('[SETTINGS] Notifications enabled successfully');
      } else {
        console.log('[SETTINGS] Disabling notifications...');
        await disableNotifications(user?.id);
        console.log('[SETTINGS] Notifications disabled');
      }
    } catch (error: any) {
      console.error('[SETTINGS] Failed to toggle notifications:', error);
      const message = error?.message || String(error) || 'Unknown error';
      
      if (message.includes('not granted') || message.includes('Permission')) {
        Alert.alert(
          'Permission Required',
          'Please enable notifications in your device settings.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Error',
          `Failed to enable notifications: ${message}`,
          [{ text: 'OK' }]
        );
      }
    } finally {
      setIsTogglingNotifications(false);
    }
  };

  const openProfile = () => {
    router.push('/profile' as any);
  };

  const handleWeeklyRecapToggle = async (value: boolean) => {
    if (!user?.id) return;
    
    setIsTogglingWeeklyRecap(true);
    setWeeklyRecapEnabled(value);
    
    try {
      await updateWeeklyRecapMutation.mutateAsync({
        userId: user.id,
        enabled: value,
      });
      console.log('[SETTINGS] Weekly recap preference updated to:', value);
    } catch (error) {
      console.error('[SETTINGS] Failed to update weekly recap preference:', error);
      setWeeklyRecapEnabled(!value);
      Alert.alert('Error', 'Failed to update preference. Please try again.');
    } finally {
      setIsTogglingWeeklyRecap(false);
    }
  };



  const carName = getCarDisplayName();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    navHeader: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 12,
      alignItems: 'center' as const,
    },
    navTitle: {
      fontSize: 16,
      fontFamily: 'Orbitron_700Bold',
      color: colors.text,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingTop: 8,
      paddingBottom: 40,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600' as const,
      color: colors.textLight,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
      marginTop: 8,
    },
    settingsCard: {
      backgroundColor: colors.cardLight,
      borderRadius: 16,
      marginBottom: 24,
      overflow: 'hidden',
    },
    settingItem: {
      padding: 16,
    },
    settingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    settingIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: colors.text,
    },
    optionsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    optionButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: colors.background === '#000000' ? '#1C1C1E' : colors.background,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    optionButtonActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    optionText: {
      fontSize: 15,
      fontWeight: '500' as const,
      color: colors.textLight,
    },
    optionTextActive: {
      color: '#FFFFFF',
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: 16,
    },
    linkItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
    },
    linkContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    linkText: {
      fontSize: 16,
      fontWeight: '500' as const,
      color: colors.text,
    },
    footer: {
      alignItems: 'center',
      marginTop: -24,
    },
    footerLogo: {
      width: 144,
      height: 144,
      marginBottom: -36,
    },
    footerText: {
      fontSize: 13,
      fontWeight: '400' as const,
      color: colors.textLight,
    },
    profileItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
    },
    profileContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    avatarContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.cardBackground,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    profileInfo: {
      flex: 1,
    },
    profileName: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: colors.text,
      marginBottom: 2,
    },
    profileEmail: {
      fontSize: 13,
      fontWeight: '400' as const,
      color: colors.textLight,
    },
    carItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },
    notificationItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
    },
    notificationContent: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    notificationTextContainer: {
      flex: 1,
    },
    notificationDescription: {
      fontSize: 13,
      fontWeight: '400' as const,
      color: colors.textLight,
      marginTop: 2,
    },
    linkItemDisabled: {
      opacity: 0.5,
    },
    linkTextDisabled: {
      color: colors.textLight,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.cardLight,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 40,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700' as const,
      color: colors.text,
    },
    modalSubtitle: {
      fontSize: 14,
      color: colors.textLight,
      marginBottom: 16,
    },
    feedbackInput: {
      backgroundColor: colors.background === '#000000' ? '#1C1C1E' : colors.background,
      borderRadius: 12,
      padding: 16,
      fontSize: 15,
      color: colors.text,
      minHeight: 140,
      borderWidth: 1,
      borderColor: colors.border,
    },
    charCount: {
      fontSize: 12,
      color: colors.textLight,
      textAlign: 'right' as const,
      marginTop: 6,
      marginBottom: 16,
    },
    sendButton: {
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
    sendButtonText: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: '#FFFFFF',
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navHeader}>
        <Text style={styles.navTitle}>Settings</Text>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Account</Text>
        
        <View style={styles.settingsCard}>
          <TouchableOpacity style={styles.profileItem} onPress={openProfile} activeOpacity={0.7}>
            <View style={styles.profileContent}>
              <View style={styles.avatarContainer}>
                <User size={24} color={colors.textInverted} />
              </View>
              <View style={styles.profileInfo}>
                {isAuthenticated ? (
                  <>
                    <Text style={styles.profileName}>{user?.displayName}</Text>
                    <Text style={styles.profileEmail}>{user?.email}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.profileName}>Sign In</Text>
                    <Text style={styles.profileEmail}>Create account to save your trips</Text>
                  </>
                )}
              </View>
            </View>
            <ChevronRight size={20} color={colors.textLight} />
          </TouchableOpacity>

          {isAuthenticated && carName && (
            <>
              <View style={styles.divider} />
              <View style={styles.carItem}>
                <View style={styles.linkContent}>
                  <View style={styles.settingIconContainer}>
                    <Car size={20} color={colors.accent} />
                  </View>
                  <Text style={styles.linkText}>{carName}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <Text style={styles.sectionTitle}>Preferences</Text>
        
        <View style={styles.settingsCard}>
          <View style={styles.settingItem}>
            <View style={styles.settingHeader}>
              <View style={styles.settingIconContainer}>
                <Sun size={20} color={colors.accent} />
              </View>
              <Text style={styles.settingLabel}>Appearance</Text>
            </View>
            <View style={styles.optionsRow}>
              {themeOptions.map((option) => {
                const IconComponent = option.icon;
                const isActive = settings.theme === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.optionButton,
                      isActive && styles.optionButtonActive,
                    ]}
                    onPress={() => setTheme(option.value)}
                    activeOpacity={0.7}
                  >
                    <IconComponent 
                      size={18} 
                      color={isActive ? '#FFFFFF' : colors.text} 
                    />
                    <Text
                      style={[
                        styles.optionText,
                        isActive && styles.optionTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingItem}>
            <View style={styles.settingHeader}>
              <View style={styles.settingIconContainer}>
                <Gauge size={20} color={colors.accent} />
              </View>
              <Text style={styles.settingLabel}>Speed Unit</Text>
            </View>
            <View style={styles.optionsRow}>
              {speedOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionButton,
                    settings.speedUnit === option.value && styles.optionButtonActive,
                  ]}
                  onPress={() => setSpeedUnit(option.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.optionText,
                      settings.speedUnit === option.value && styles.optionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.settingItem}>
            <View style={styles.settingHeader}>
              <View style={styles.settingIconContainer}>
                <Ruler size={20} color={colors.accent} />
              </View>
              <Text style={styles.settingLabel}>Distance Unit</Text>
            </View>
            <View style={styles.optionsRow}>
              {distanceOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionButton,
                    settings.distanceUnit === option.value && styles.optionButtonActive,
                  ]}
                  onPress={() => setDistanceUnit(option.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.optionText,
                      settings.distanceUnit === option.value && styles.optionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Notifications</Text>
        
        <View style={styles.settingsCard}>
          <View style={styles.notificationItem}>
            <View style={styles.notificationContent}>
              <View style={styles.settingIconContainer}>
                <Bell size={20} color={colors.accent} />
              </View>
              <View style={styles.notificationTextContainer}>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.notificationDescription}>
                  {Platform.OS === 'web' 
                    ? 'Not available on web'
                    : 'Get notified about your trips'
                  }
                </Text>
              </View>
            </View>
            {Platform.OS !== 'web' && (
              isTogglingNotifications ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Switch
                  value={notificationsEnabled}
                  onValueChange={handleNotificationToggle}
                  trackColor={{ false: colors.border, true: colors.accent + '80' }}
                  thumbColor={notificationsEnabled ? colors.accent : colors.textLight}
                />
              )
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.notificationItem}>
            <View style={styles.notificationContent}>
              <View style={styles.settingIconContainer}>
                <Mail size={20} color={colors.accent} />
              </View>
              <View style={styles.notificationTextContainer}>
                <Text style={styles.settingLabel}>Weekly Recap Email</Text>
                <Text style={styles.notificationDescription}>
                  Receive weekly email with your driving stats
                </Text>
              </View>
            </View>
            {isTogglingWeeklyRecap ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Switch
                value={weeklyRecapEnabled}
                onValueChange={handleWeeklyRecapToggle}
                trackColor={{ false: colors.border, true: colors.accent + '80' }}
                thumbColor={weeklyRecapEnabled ? colors.accent : colors.textLight}
                disabled={!isAuthenticated}
              />
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Legal</Text>
        
        <View style={styles.settingsCard}>
          <TouchableOpacity style={styles.linkItem} onPress={openPrivacyPolicy} activeOpacity={0.7}>
            <View style={styles.linkContent}>
              <View style={styles.settingIconContainer}>
                <Shield size={20} color={colors.accent} />
              </View>
              <Text style={styles.linkText}>Privacy Policy</Text>
            </View>
            <ChevronRight size={20} color={colors.textLight} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.linkItem} onPress={openTermsOfUse} activeOpacity={0.7}>
            <View style={styles.linkContent}>
              <View style={styles.settingIconContainer}>
                <FileText size={20} color={colors.accent} />
              </View>
              <Text style={styles.linkText}>Terms of Use</Text>
            </View>
            <ChevronRight size={20} color={colors.textLight} />
          </TouchableOpacity>

        </View>

        <Text style={styles.sectionTitle}>About</Text>
        
        <View style={styles.settingsCard}>
          <TouchableOpacity style={styles.linkItem} onPress={openHelpCenter} activeOpacity={0.7}>
            <View style={styles.linkContent}>
              <View style={styles.settingIconContainer}>
                <HelpCircle size={20} color={colors.accent} />
              </View>
              <Text style={styles.linkText}>Help Center</Text>
            </View>
            <ChevronRight size={20} color={colors.textLight} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.linkItem} onPress={() => setFeedbackModalVisible(true)} activeOpacity={0.7}>
            <View style={styles.linkContent}>
              <View style={styles.settingIconContainer}>
                <MessageSquare size={20} color={colors.accent} />
              </View>
              <Text style={styles.linkText}>Leave Feedback</Text>
            </View>
            <ChevronRight size={20} color={colors.textLight} />
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Image
            source={{ uri: settings.theme === 'dark' ? 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/pt2pvulnkkxt2nez0x5hi' : 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/f6dxycsffzouzbzezjis9' }}
            style={styles.footerLogo}
            resizeMode="contain"
          />
          <Text style={styles.footerText}>RedLine v1.0.0</Text>
        </View>
      </ScrollView>
      <Modal
        visible={feedbackModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setFeedbackModalVisible(false)}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Leave Feedback</Text>
              <TouchableOpacity onPress={() => setFeedbackModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={22} color={colors.textLight} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>We{"'"}d love to hear your thoughts, suggestions, or issues.</Text>
            <TextInput
              style={styles.feedbackInput}
              placeholder="Type your feedback here..."
              placeholderTextColor={colors.textLight}
              value={feedbackText}
              onChangeText={setFeedbackText}
              multiline
              textAlignVertical="top"
              maxLength={1000}
            />
            <Text style={styles.charCount}>{feedbackText.length}/1000</Text>
            <TouchableOpacity
              style={[styles.sendButton, (!feedbackText.trim() || sendFeedbackMutation.isPending) && styles.sendButtonDisabled]}
              onPress={handleSendFeedback}
              disabled={!feedbackText.trim() || sendFeedbackMutation.isPending}
              activeOpacity={0.7}
            >
              {sendFeedbackMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Send size={18} color="#FFFFFF" />
                  <Text style={styles.sendButtonText}>Send Feedback</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
