import React, { useContext, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, TextInput, Alert, ActivityIndicator, Modal, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User, Mail, LogOut, Target, Flame, Beef, Wheat,
  Droplets, Zap, Edit3, Check, X,
  Activity, Scale, Ruler, Calendar, TrendingUp,
} from 'lucide-react-native';
import { AuthContext } from '../context/AuthContext';
import { DietContext } from '../context/DietContext';

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
});

export default ProfileScreen;
