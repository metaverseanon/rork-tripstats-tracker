import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Linking, Image } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight, Gauge, Ruler, FileText, Shield, User, Car, Sun, Moon, HelpCircle } from 'lucide-react-native';
import { useSettings, SpeedUnit, DistanceUnit } from '@/providers/SettingsProvider';
import { useUser } from '@/providers/UserProvider';
import { ThemeType } from '@/constants/colors';

export default function SettingsScreen() {
  const { settings, colors, setSpeedUnit, setDistanceUnit, setTheme } = useSettings();
  const { user, isAuthenticated, getCarDisplayName } = useUser();

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

  const openProfile = () => {
    router.push('/profile' as any);
  };

  const carName = getCarDisplayName();

  const styles = StyleSheet.create({
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
  });

  return (
    <View style={styles.container}>
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

          <View style={styles.divider} />

          <TouchableOpacity style={styles.linkItem} onPress={openHelpCenter} activeOpacity={0.7}>
            <View style={styles.linkContent}>
              <View style={styles.settingIconContainer}>
                <HelpCircle size={20} color={colors.accent} />
              </View>
              <Text style={styles.linkText}>Help Center</Text>
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
    </View>
  );
}
