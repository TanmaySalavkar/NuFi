import React, { useContext, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, TextInput, Alert, ActivityIndicator, Modal, Pressable,
  Switch, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User, Mail, LogOut, Target, Flame, Beef, Wheat,
  Droplets, Zap, Edit3, Check, X,
  Activity, Scale, Ruler, Calendar, TrendingUp,
  Heart, RefreshCw, Shield, ExternalLink, Trash2, CheckCircle2, AlertCircle, Lock,
} from 'lucide-react-native';
import { AuthContext } from '../context/AuthContext';
import { DietContext } from '../context/DietContext';
import { HealthConnectContext } from '../context/HealthConnectContext';
import { PRIVACY_POLICY_URL } from '../config';

const LIME = '#C8FF00';
const LIME_DIM = '#A8D600';
const DARK_BG = '#1A1A2E';

// ── Per-row editable number field (Nutrition Targets) ─
const EditableRow = ({ icon: Icon, label, value, unit, onSave, color = LIME_DIM }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const handleSave = () => {
    const num = parseFloat(draft);
    if (!isNaN(num) && num > 0) {
      onSave(num);
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(String(value));
    setEditing(false);
  };

  React.useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  return (
    <View style={st.editRow}>
      <View style={st.editRowLeft}>
        <View style={[st.editIconWrap, { backgroundColor: color + '20' }]}>
          <Icon size={16} color={color} strokeWidth={2.5} />
        </View>
        <View>
          <Text style={st.editLabel}>{label}</Text>
          {!editing && (
            <Text style={[st.editValue, { color }]}>
              {value} <Text style={st.editUnit}>{unit}</Text>
            </Text>
          )}
        </View>
      </View>

      {editing ? (
        <View style={st.editInputRow}>
          <TextInput
            style={st.editInput}
            value={draft}
            onChangeText={setDraft}
            keyboardType="numeric"
            autoFocus
            selectTextOnFocus
          />
          <Text style={st.editUnit2}>{unit}</Text>
          <TouchableOpacity style={st.editActionBtn} onPress={handleSave}>
            <Check size={16} color={DARK_BG} strokeWidth={3} />
          </TouchableOpacity>
          <TouchableOpacity style={[st.editActionBtn, st.cancelBtn]} onPress={handleCancel}>
            <X size={16} color="#EF4444" strokeWidth={3} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setEditing(true)} style={st.editTrigger}>
          <Edit3 size={15} color="rgba(0,0,0,0.25)" strokeWidth={2} />
        </TouchableOpacity>
      )}
    </View>
  );
};

// ── Goal chip selector ───────────────────────────────
const GoalSelector = ({ value, onChange, editable }) => {
  const options = [
    { key: 'lose',     label: 'Lose Weight', emoji: '📉' },
    { key: 'maintain', label: 'Maintain',    emoji: '⚖️' },
    { key: 'gain',     label: 'Gain Muscle', emoji: '💪' },
  ];
  return (
    <View style={st.goalRow}>
      {options.map(o => (
        <TouchableOpacity
          key={o.key}
          style={[st.goalChip, value === o.key && st.goalChipActive]}
          onPress={() => editable && onChange(o.key)}
          activeOpacity={editable ? 0.75 : 1}
        >
          <Text style={st.goalEmoji}>{o.emoji}</Text>
          <Text style={[st.goalLabel, value === o.key && st.goalLabelActive]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// ── Activity chip selector ───────────────────────────
const ActivitySelector = ({ value, onChange, editable }) => {
  const options = [
    { key: 'sedentary', label: 'Sedentary' },
    { key: 'light',     label: 'Light' },
    { key: 'moderate',  label: 'Moderate' },
    { key: 'active',    label: 'Active' },
  ];
  return (
    <View style={st.activityRow}>
      {options.map(o => (
        <TouchableOpacity
          key={o.key}
          style={[st.activityChip, value === o.key && st.activityChipActive]}
          onPress={() => editable && onChange(o.key)}
          activeOpacity={editable ? 0.75 : 1}
        >
          <Text style={[st.activityLabel, value === o.key && st.activityLabelActive]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// ── Body metric card: Text when read-only, TextInput when editing ─
const BodyMetricCard = ({ icon: Icon, label, value, unit, editable, onChangeText }) => (
  <View style={[st.bodyMetricCard, editable && st.bodyMetricCardEditable]}>
    <Icon size={16} color={LIME_DIM} strokeWidth={2.5} />
    <Text style={st.bodyMetricLabel}>{label}</Text>
    {editable ? (
      <TextInput
        style={st.bodyMetricInput}
        value={String(value)}
        keyboardType="numeric"
        onChangeText={onChangeText}
        selectTextOnFocus
      />
    ) : (
      <Text style={st.bodyMetricInput}>{value}</Text>
    )}
    <Text style={st.bodyMetricUnit}>{unit}</Text>
  </View>
);

// ── Main Screen ──────────────────────────────────────
const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const { user, logout } = useContext(AuthContext);
  const { dashboard, updateTargets } = useContext(DietContext);

  const [saving, setSaving] = useState(false);
  const [logoutModal, setLogoutModal] = useState(false);
  const [profileEditing, setProfileEditing] = useState(false);

  const [localProfile, setLocalProfile] = useState({
    goal: user?.profile?.goal || 'maintain',
    activityLevel: user?.profile?.activityLevel || 'moderate',
    weight: user?.profile?.weight || 70,
    height: user?.profile?.height || 170,
    age: user?.profile?.age || 25,
  });

  // Draft only exists while editing — strings for TextInput, committed as numbers on Save
  const [draft, setDraft] = useState({ ...localProfile });

  const targets = dashboard.targets || {
    calories: 2000, protein: 115, carbs: 250, fat: 65, fiber: 30, sugar: 50, sodium: 2300,
  };


  const startEditing = () => {
    setDraft({ ...localProfile });
    setProfileEditing(true);
  };

  const cancelEditing = () => {
    setDraft({ ...localProfile });
    setProfileEditing(false);
  };

  const saveProfile = async () => {
    // Parse numeric fields — onChangeText gives strings
    const parsed = {
      goal: draft.goal,
      activityLevel: draft.activityLevel,
      weight: parseFloat(draft.weight) || localProfile.weight,
      height: parseFloat(draft.height) || localProfile.height,
      age: parseFloat(draft.age) || localProfile.age,
    };
    setSaving(true);
    const result = await updateTargets({ profile: parsed });
    setSaving(false);
    if (result.success) {
      setLocalProfile(parsed);
      setDraft(parsed);
      setProfileEditing(false);
    } else {
      Alert.alert('Save failed', result.error || 'Could not update profile');
    }
  };

  const saveTarget = async (field, value) => {
    setSaving(true);
    const result = await updateTargets({ targets: { ...targets, [field]: Math.round(value) } });
    setSaving(false);
    if (!result.success) Alert.alert('Save failed', result.error || 'Could not update target');
  };

  const handleLogout = () => {
    setLogoutModal(false);
    logout();
  };

  // ── Health Connect domain state ──────────────────────────────────────────
  const {
    availability,
    isConnected,
    isSyncing,
    syncEnabled,
    assistantAccessEnabled,
    lastSyncedAt,
    requestAccess,
    syncNow,
    updateSettings,
    disconnect,
    deleteCloudData,
    openSettings,
  } = useContext(HealthConnectContext);

  const [privacyModal, setPrivacyModal] = useState(false);

  const formatLastSync = (timestamp) => {
    if (!timestamp) return 'Never synced';
    const diffMin = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const handleDeleteCloudData = () => {
    Alert.alert(
      'Delete Synced Health Data',
      'This will permanently delete all synced Health Connect records from our secure cloud storage. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteCloudData();
            if (res.success) {
              Alert.alert('Deleted', 'Your cloud Health Connect data has been permanently deleted.');
            } else {
              Alert.alert('Error', res.error || 'Failed to delete data.');
            }
          },
        },
      ]
    );
  };

  const handleConnectHealth = async () => {
    try {
      const res = await requestAccess();
      if (res && !res.success) {
        if (res.status === 'provider update required') {
          Alert.alert(
            'Update Required',
            'Health Connect requires an update. Please check Google Play or system settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: openSettings },
            ]
          );
        } else if (res.error && res.error !== 'No permissions were granted by user.') {
          Alert.alert('Health Connect', res.error);
        }
      }
    } catch (e) {
      Alert.alert('Health Connect', e.message || 'Could not connect to Health Connect');
    }
  };

  const userName = dashboard.userName || user?.name || 'User';
  const initial = userName[0]?.toUpperCase() || 'U';

  return (
    <View style={[st.container, { paddingTop: Math.max(insets.top, 12) }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F7" />

      <ScrollView
        style={st.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 16, 24) + 80 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={st.header}>
          <Text style={st.headerTitle}>Profile</Text>
          {saving && <ActivityIndicator size="small" color={LIME_DIM} />}
        </View>

        {/* Avatar card */}
        <View style={st.avatarCard}>
          <View style={st.avatarCircle}>
            <Text style={st.avatarInitial}>{initial}</Text>
          </View>
          <View style={st.avatarInfo}>
            <Text style={st.avatarName}>{userName}</Text>
            <View style={st.avatarMeta}>
              <Mail size={13} color="rgba(255,255,255,0.45)" strokeWidth={2} />
              <Text style={st.avatarEmail}>{user?.email || ''}</Text>
            </View>
          </View>
        </View>

        {/* ── Health Profile ── */}
        <View style={st.section}>
          <View style={st.sectionHeader}>
            <View style={st.sectionHeaderLeft}>
              <User size={15} color={LIME_DIM} strokeWidth={2.5} />
              <Text style={st.sectionTitle}>Health Profile</Text>
            </View>
            {profileEditing ? (
              <View style={st.sectionActions}>
                <TouchableOpacity style={st.saveChip} onPress={saveProfile} disabled={saving}>
                  <Check size={14} color={DARK_BG} strokeWidth={3} />
                  <Text style={st.saveChipText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.cancelChip} onPress={cancelEditing}>
                  <X size={14} color="#EF4444" strokeWidth={3} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={st.editChip} onPress={startEditing}>
                <Edit3 size={13} color={LIME_DIM} strokeWidth={2.5} />
                <Text style={st.editChipText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={st.subLabel}>Goal</Text>
          <GoalSelector
            value={profileEditing ? draft.goal : localProfile.goal}
            onChange={v => setDraft(d => ({ ...d, goal: v }))}
            editable={profileEditing}
          />

          <Text style={[st.subLabel, { marginTop: 16 }]}>Activity Level</Text>
          <ActivitySelector
            value={profileEditing ? draft.activityLevel : localProfile.activityLevel}
            onChange={v => setDraft(d => ({ ...d, activityLevel: v }))}
            editable={profileEditing}
          />

          <View style={st.bodyMetricsRow}>
            <BodyMetricCard
              icon={Scale}
              label="Weight"
              value={profileEditing ? draft.weight : localProfile.weight}
              unit="kg"
              editable={profileEditing}
              onChangeText={t => setDraft(d => ({ ...d, weight: t }))}
            />
            <BodyMetricCard
              icon={Ruler}
              label="Height"
              value={profileEditing ? draft.height : localProfile.height}
              unit="cm"
              editable={profileEditing}
              onChangeText={t => setDraft(d => ({ ...d, height: t }))}
            />
            <BodyMetricCard
              icon={Calendar}
              label="Age"
              value={profileEditing ? draft.age : localProfile.age}
              unit="yrs"
              editable={profileEditing}
              onChangeText={t => setDraft(d => ({ ...d, age: t }))}
            />
          </View>
        </View>

        {/* ── Daily Nutrition Targets ── */}
        <View style={st.section}>
          <View style={st.sectionHeader}>
            <View style={st.sectionHeaderLeft}>
              <Target size={15} color={LIME_DIM} strokeWidth={2.5} />
              <Text style={st.sectionTitle}>Daily Nutrition Targets</Text>
            </View>
          </View>
          <Text style={st.sectionHint}>Tap the pencil icon on any row to edit</Text>

          <EditableRow icon={Flame}      label="Calories" value={targets.calories} unit="kcal" color="#F97316" onSave={v => saveTarget('calories', v)} />
          <EditableRow icon={Beef}       label="Protein"  value={targets.protein}  unit="g"    color="#EF4444" onSave={v => saveTarget('protein', v)} />
          <EditableRow icon={Wheat}      label="Carbs"    value={targets.carbs}    unit="g"    color="#0EA5E9" onSave={v => saveTarget('carbs', v)} />
          <EditableRow icon={Droplets}   label="Fat"      value={targets.fat}      unit="g"    color="#EAB308" onSave={v => saveTarget('fat', v)} />
          <EditableRow icon={Activity}   label="Fiber"    value={targets.fiber}    unit="g"    color="#10B981" onSave={v => saveTarget('fiber', v)} />
          <EditableRow icon={Zap}        label="Sugar"    value={targets.sugar}    unit="g"    color="#F43F5E" onSave={v => saveTarget('sugar', v)} />
          <EditableRow icon={TrendingUp} label="Sodium"   value={targets.sodium}   unit="mg"   color="#8B5CF6" onSave={v => saveTarget('sodium', v)} />
        </View>

        {/* ── Google Health Connect Integration ── */}
        <View style={st.section}>
          <View style={st.hcSectionHeader}>
            <View style={st.hcSectionHeaderLeft}>
              <Heart size={16} color="#EF4444" strokeWidth={2.5} />
              <Text style={st.sectionTitle}>Google Health Connect</Text>
            </View>
            <View
              style={[
                st.statusDotContainer,
                isConnected ? st.statusDotContainerGreen : (availability === 'available' ? st.statusDotContainerGray : st.statusDotContainerOrange)
              ]}
              accessibilityLabel={isConnected ? 'Connected' : 'Disconnected'}
            >
              <View
                style={[
                  st.statusDotAlone,
                  { backgroundColor: isConnected ? '#10B981' : (availability === 'available' ? '#94A3B8' : '#F59E0B') }
                ]}
              />
            </View>
          </View>

          {/* Read-Only Privacy Notice */}
          <View style={st.privacyBanner}>
            <Shield size={14} color="#0284C7" strokeWidth={2.5} />
            <Text style={st.privacyBannerText}>
              Read-only biometric sensor integration. Zero write permissions. Zero background tracking.
            </Text>
            <TouchableOpacity onPress={() => setPrivacyModal(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <ExternalLink size={13} color="#0284C7" />
            </TouchableOpacity>
          </View>

          {!isConnected ? (
            /* Disconnected state: Connect CTA */
            <View style={st.hcConnectBox}>
              <View style={st.hcIconBadge}>
                <Heart size={22} color="#EF4444" strokeWidth={2.5} />
              </View>
              <Text style={st.hcConnectTitle}>Sync Health & Fitness Data</Text>
              <Text style={st.hcConnectSub}>
                Sync steps, sleep, workouts, heart rate, and 18 health metrics locally from Fitbit, Google Fit, Samsung Health & connected trackers.
              </Text>
              <TouchableOpacity
                style={st.hcConnectBtn}
                onPress={handleConnectHealth}
                activeOpacity={0.85}
              >
                <Heart size={16} color={DARK_BG} strokeWidth={2.5} />
                <Text style={st.hcConnectBtnText}>Connect Health Connect</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Connected state: Sync controls, metrics, settings, actions */
            <View style={st.hcConnectedContent}>
              {/* Sync Header Bar */}
              <View style={st.syncRow}>
                <View>
                  <Text style={st.syncLabel}>Last Synced</Text>
                  <Text style={st.syncTime}>{formatLastSync(lastSyncedAt)}</Text>
                </View>
                <TouchableOpacity
                  style={[st.syncNowBtn, isSyncing && st.syncNowBtnDisabled]}
                  onPress={() => syncNow()}
                  disabled={isSyncing}
                  activeOpacity={0.8}
                >
                  {isSyncing ? (
                    <ActivityIndicator size="small" color={DARK_BG} />
                  ) : (
                    <>
                      <RefreshCw size={14} color={DARK_BG} strokeWidth={2.5} />
                      <Text style={st.syncNowBtnText}>Sync Now</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Toggles */}
              <View style={st.switchRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={st.switchTitle}>Auto-Sync on Foreground</Text>
                  <Text style={st.switchSub}>Sync when returning to app if 5+ minutes old</Text>
                </View>
                <Switch
                  value={syncEnabled}
                  onValueChange={v => updateSettings({ sync_enabled: v })}
                  trackColor={{ false: '#CBD5E1', true: LIME }}
                  thumbColor={syncEnabled ? DARK_BG : '#F8FAFC'}
                />
              </View>

              <View style={st.switchRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={st.switchTitle}>NuFi AI Assistant Access</Text>
                  <Text style={st.switchSub}>Allow NuFi to coach you using recent activity and sleep</Text>
                </View>
                <Switch
                  value={assistantAccessEnabled}
                  onValueChange={v => updateSettings({ assistant_access_enabled: v })}
                  trackColor={{ false: '#CBD5E1', true: LIME }}
                  thumbColor={assistantAccessEnabled ? DARK_BG : '#F8FAFC'}
                />
              </View>

              {/* Action Buttons */}
              <View style={st.hcActionRow}>
                <TouchableOpacity
                  style={st.manageBtn}
                  onPress={openSettings}
                  activeOpacity={0.8}
                >
                  <Text style={st.manageBtnText}>Manage Permissions</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={st.disconnectBtn}
                  onPress={disconnect}
                  activeOpacity={0.8}
                >
                  <Text style={st.disconnectBtnText}>Disconnect</Text>
                </TouchableOpacity>
              </View>

              {/* Delete Cloud Data Button */}
              <TouchableOpacity
                style={st.deleteCloudBtn}
                onPress={handleDeleteCloudData}
                activeOpacity={0.7}
              >
                <Trash2 size={13} color="#EF4444" />
                <Text style={st.deleteCloudBtnText}>Delete Synced Data from Cloud</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={st.logoutBtn}
          onPress={() => setLogoutModal(true)}
          activeOpacity={0.8}
        >
          <LogOut size={18} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={st.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Health Connect Privacy Policy Modal */}
      <Modal
        visible={privacyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setPrivacyModal(false)}
      >
        <Pressable style={st.modalOverlay} onPress={() => setPrivacyModal(false)}>
          <Pressable style={[st.modalCard, { maxHeight: '85%' }]} onPress={e => e.stopPropagation()}>
            <View style={[st.avatarCircle, { width: 50, height: 50, borderRadius: 25, backgroundColor: '#E0F2FE', marginBottom: 12 }]}>
              <Shield size={24} color="#0284C7" strokeWidth={2.5} />
            </View>
            <Text style={st.modalTitle}>Health Connect Privacy</Text>
            <ScrollView style={{ maxHeight: 240, width: '100%' }} showsVerticalScrollIndicator={false}>
              <Text style={st.privacyModalP}>
                NuFi integrates with Android Health Connect to provide personalized wellness and nutritional coaching.
              </Text>
              <Text style={st.privacyModalSectionTitle}>🛡️ Read-Only Architecture</Text>
              <Text style={st.privacyModalP}>
                NuFi never writes or alters any data in your Health Connect store. We only request read access for supported biometric and activity metrics.
              </Text>
              <Text style={st.privacyModalSectionTitle}>🚫 Zero Background Tracking</Text>
              <Text style={st.privacyModalP}>
                NuFi does not run background health services or track biometric changes when the app is closed.
              </Text>
              <Text style={st.privacyModalSectionTitle}>🔒 Encrypted at Rest</Text>
              <Text style={st.privacyModalP}>
                All health metrics sent to the cloud are encrypted with AES-256-GCM authenticated encryption and never logged in plain text.
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={[st.modalConfirmBtn, { backgroundColor: DARK_BG, marginTop: 16 }]}
              onPress={() => {
                setPrivacyModal(false);
                Linking.openURL(PRIVACY_POLICY_URL).catch(() => {});
              }}
            >
              <Text style={[st.modalConfirmText, { color: LIME }]}>View Full Privacy Policy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.modalCancelBtn} onPress={() => setPrivacyModal(false)}>
              <Text style={st.modalCancelText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Logout confirm modal */}
      <Modal
        visible={logoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutModal(false)}
      >
        <Pressable style={st.modalOverlay} onPress={() => setLogoutModal(false)}>
          <Pressable style={st.modalCard} onPress={e => e.stopPropagation()}>
            <View style={[st.avatarCircle, { width: 52, height: 52, borderRadius: 26, marginBottom: 14 }]}>
              <LogOut size={22} color={DARK_BG} strokeWidth={2.5} />
            </View>
            <Text style={st.modalTitle}>Log Out?</Text>
            <Text style={st.modalSub}>You'll need to sign in again to access your data.</Text>
            <TouchableOpacity style={st.modalConfirmBtn} onPress={handleLogout}>
              <Text style={st.modalConfirmText}>Yes, Log Out</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.modalCancelBtn} onPress={() => setLogoutModal(false)}>
              <Text style={st.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  scroll: { flex: 1, paddingHorizontal: 16 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 8, marginBottom: 20, paddingHorizontal: 4,
  },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#1A1A2E', letterSpacing: -0.5 },

  avatarCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: DARK_BG, borderRadius: 24, padding: 20, marginBottom: 14,
  },
  avatarCircle: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: LIME, justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial: { fontSize: 26, fontWeight: '900', color: DARK_BG },
  avatarInfo: { flex: 1 },
  avatarName: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  avatarMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  avatarEmail: { fontSize: 13, color: 'rgba(255,255,255,0.45)' },

  section: {
    backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20,
    marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A2E' },
  sectionHint: { fontSize: 12, color: '#94A3B8', marginBottom: 12, marginTop: -8 },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  editChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: LIME_DIM + '18', borderRadius: 10,
    borderWidth: 1, borderColor: LIME_DIM + '40',
  },
  editChipText: { fontSize: 12, fontWeight: '700', color: LIME_DIM },

  saveChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: LIME, borderRadius: 10,
  },
  saveChipText: { fontSize: 12, fontWeight: '800', color: DARK_BG },

  cancelChip: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center',
  },

  subLabel: { fontSize: 12, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.5, marginBottom: 8 },

  goalRow: { flexDirection: 'row', gap: 8 },
  goalChip: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14,
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
  },
  goalChipActive: { backgroundColor: DARK_BG, borderColor: DARK_BG },
  goalEmoji: { fontSize: 18, marginBottom: 4 },
  goalLabel: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  goalLabelActive: { color: LIME },

  activityRow: { flexDirection: 'row', gap: 6 },
  activityChip: {
    flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10,
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
  },
  activityChipActive: { backgroundColor: DARK_BG, borderColor: DARK_BG },
  activityLabel: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  activityLabelActive: { color: LIME, fontWeight: '700' },

  bodyMetricsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  bodyMetricCard: {
    flex: 1, backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0',
  },
  bodyMetricCardEditable: { borderColor: LIME_DIM, backgroundColor: '#FAFFF0' },
  bodyMetricLabel: { fontSize: 11, color: '#94A3B8', marginTop: 6, marginBottom: 4 },
  // Used for both <Text> (read-only) and <TextInput> (edit mode)
  bodyMetricInput: {
    fontSize: 20, fontWeight: '800', color: '#1A1A2E',
    textAlign: 'center', padding: 0, minWidth: 40,
  },
  bodyMetricUnit: { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  editRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  editRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  editIconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  editLabel: { fontSize: 13, fontWeight: '600', color: '#94A3B8', marginBottom: 1 },
  editValue: { fontSize: 17, fontWeight: '800' },
  editUnit: { fontSize: 12, fontWeight: '500', color: '#94A3B8' },
  editTrigger: { padding: 8 },
  editInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  editInput: {
    borderWidth: 1.5, borderColor: LIME_DIM, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 6,
    fontSize: 16, fontWeight: '700', color: '#1A1A2E',
    minWidth: 64, textAlign: 'center',
  },
  editUnit2: { fontSize: 12, color: '#94A3B8', marginRight: 4 },
  editActionBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: LIME, justifyContent: 'center', alignItems: 'center',
  },
  cancelBtn: { backgroundColor: '#FEE2E2' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#e61c1cff', borderRadius: 16, paddingVertical: 16,
    marginBottom: 14,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF', borderRadius: 28, padding: 28,
    width: '100%', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 8,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1A1A2E', marginBottom: 8 },
  modalSub: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  modalConfirmBtn: {
    width: '100%', backgroundColor: '#EF4444', borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginBottom: 10,
  },
  modalConfirmText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  modalCancelBtn: { paddingVertical: 10 },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: '#94A3B8' },

  // ── Health Connect Styles ──
  hcSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 16,
  },
  hcSectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    marginRight: 6,
  },
  statusDotContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  statusDotContainerGreen: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
  },
  statusDotContainerGray: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  statusDotContainerOrange: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },
  statusDotAlone: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginTop: 2,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  privacyBannerText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: '#0369A1',
    fontWeight: '500',
  },

  hcConnectBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  hcIconBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  hcConnectTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1A2E',
    marginBottom: 6,
    textAlign: 'center',
  },
  hcConnectSub: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 18,
    paddingHorizontal: 6,
  },
  hcConnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: LIME,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  hcConnectBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: DARK_BG,
    letterSpacing: 0.2,
  },

  hcConnectedContent: {
    gap: 16,
  },
  syncRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  syncLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  syncTime: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1A1A2E',
    marginTop: 2,
  },
  syncNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: LIME,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  syncNowBtnDisabled: {
    opacity: 0.6,
  },
  syncNowBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: DARK_BG,
  },
  metricSectionHeader: {
    marginBottom: 2,
  },
  metricSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  noMetricsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  noMetricsText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    fontWeight: '500',
  },
  metricColumnWrap: {
    flexDirection: 'column',
    gap: 8,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },
  metricCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricRowLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  metricValueBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricValueText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  metricUnitText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  metricActiveBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metricActiveText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  switchSub: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 15,
  },
  hcActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  manageBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  manageBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  disconnectBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  disconnectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  deleteCloudBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FFE4E6',
    marginTop: -4,
  },
  deleteCloudBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  privacyModalP: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 12,
  },
  privacyModalSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1A1A2E',
    marginTop: 8,
    marginBottom: 4,
  },
});

export default ProfileScreen;
