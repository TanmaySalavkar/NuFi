import React, { useState, useContext, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Animated, Dimensions, Alert, Easing, Platform, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { Camera, useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import { launchImageLibrary } from 'react-native-image-picker';
import { ChevronLeft, Zap, ImageIcon, X } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { DietContext } from '../context/DietContext';

const { width } = Dimensions.get('window');
const LIME = '#C8FF00';
const DARK_BG = '#0A0A14';
const FRAME_SIZE = width - 64;
const CORNER_SIZE = 32;
const CORNER_W = 3;

// ── ArrayBuffer → Base64 helper ─────────────────────
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const FoodScannerScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { scanFood, isScanning, setIsScanning } = useContext(DietContext);
  const [scanProgress, setScanProgress] = useState(0);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [photoUri, setPhotoUri] = useState(null);
  const [flashOn, setFlashOn] = useState(false);

  // Camera
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const photoOutput = usePhotoOutput({ quality: 0.8 });

  // Animations
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isFocused = useIsFocused();

  // Request permission on mount
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Scan line animation loop
  useEffect(() => {
    if (isScanning) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(scanLineAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      scanLineAnim.setValue(0);
    }
  }, [isScanning]);

  // Pulse for capture button
  useEffect(() => {
    if (!hasPhoto && !isScanning) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [hasPhoto, isScanning]);

  // Real-time continuous progress counter
  useEffect(() => {
    if (isScanning) {
      setScanProgress(0);
      let p = 0;
      const interval = setInterval(() => {
        if (p < 40) {
          p += 2.5;
        } else if (p < 75) {
          p += 1.5;
        } else if (p < 92) {
          p += 0.8;
        } else if (p < 98) {
          p += 0.2;
        }
        setScanProgress(Math.min(Math.round(p), 98));
      }, 50);
      return () => clearInterval(interval);
    } else {
      setScanProgress(0);
    }
  }, [isScanning]);

  const cancelScanRef = useRef(false);

  const handleStopScan = useCallback(() => {
    cancelScanRef.current = true;
    isCapturingRef.current = false;
    if (setIsScanning) setIsScanning(false);
    setHasPhoto(false);
    setPhotoUri(null);
    setScanProgress(0);
  }, [setIsScanning]);

  // ── Process image (send base64 to AI) ────────────
  const processImage = useCallback(async (base64Data) => {
    if (!base64Data) {
      Alert.alert('Error', 'No image data received.');
      setHasPhoto(false);
      setPhotoUri(null);
      return;
    }
    cancelScanRef.current = false;
    try {
      const result = await scanFood(base64Data);
      if (cancelScanRef.current) {
        cancelScanRef.current = false;
        setHasPhoto(false);
        setPhotoUri(null);
        setScanProgress(0);
        return;
      }
      if (result && result.success) {
        setScanProgress(100);
        setTimeout(() => {
          setHasPhoto(false);
          setPhotoUri(null);
          navigation.navigate('MealNutritionDetail', { nutrition: result.nutrition, imageBase64: base64Data });
        }, 300);
      } else {
        setHasPhoto(false);
        setPhotoUri(null);
        if (!cancelScanRef.current) {
          Alert.alert(
            'Unable to Scan',
            (result && result.error) || 'Could not analyze the food image.',
            [
              { text: 'Retry', onPress: () => { setHasPhoto(false); setPhotoUri(null); } },
              { text: 'Back', onPress: () => navigation.goBack(), style: 'cancel' },
            ]
          );
        }
      }
    } catch (e) {
      setHasPhoto(false);
      setPhotoUri(null);
      if (!cancelScanRef.current) {
        Alert.alert('Error', 'An unexpected error occurred.');
      }
    }
  }, [scanFood, navigation]);

  const isCapturingRef = useRef(false);

  // ── Capture photo with VisionCamera ──────────────
  const capturePhoto = useCallback(async () => {
    if (isScanning || hasPhoto || isCapturingRef.current) return;
    try {
      cancelScanRef.current = false;
      isCapturingRef.current = true;
      const photo = await photoOutput.capturePhoto(
        { flashMode: flashOn ? 'on' : 'off', enableShutterSound: true },
        {}
      );
      const uri = photo.path ? (photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`) : null;
      // Convert photo to base64
      const fileData = await photo.getFileDataAsync();
      const base64 = arrayBufferToBase64(fileData);
      photo.dispose();
      
      setPhotoUri(uri || `data:image/jpeg;base64,${base64}`);
      setHasPhoto(true);

      await processImage(base64);
    } catch (err) {
      console.error('Capture error:', err);
      setHasPhoto(false);
      setPhotoUri(null);
      if (!cancelScanRef.current) {
        Alert.alert('Capture Error', 'Could not capture photo. Please try again.');
      }
    } finally {
      isCapturingRef.current = false;
    }
  }, [isScanning, hasPhoto, photoOutput, flashOn, processImage]);

  // ── Gallery picker ────────────────────────────────
  const openGallery = useCallback(async () => {
    if (isScanning) return;
    try {
      cancelScanRef.current = false;
      const result = await launchImageLibrary({
        mediaType: 'photo',
        includeBase64: true,
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.8,
      });
      if (result.didCancel) return;
      if (result.assets && result.assets[0] && result.assets[0].base64) {
        const uri = result.assets[0].uri || `data:image/jpeg;base64,${result.assets[0].base64}`;
        setPhotoUri(uri);
        setHasPhoto(true);
        await processImage(result.assets[0].base64);
      }
    } catch (err) {
      console.error('Gallery error:', err);
      setHasPhoto(false);
      setPhotoUri(null);
      Alert.alert('Error', 'Could not open gallery.');
    }
  }, [isScanning, processImage]);

  const scanLineTranslateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, FRAME_SIZE - 4],
  });

  // ── Permission / No device ────────────────────────
  const toggleFlash = useCallback(() => {
    if (device && device.hasTorch === false) {
      Alert.alert('Flashlight Unavailable', 'Your camera device does not support flashlight / torch.');
      return;
    }
    setFlashOn(prev => !prev);
  }, [device]);

  if (!hasPermission) {
    return (
      <View style={[s.container, s.centered]}>
        <StatusBar barStyle="light-content" backgroundColor={DARK_BG} />
        <Text style={s.permText}>Camera permission is required</Text>
        <TouchableOpacity style={s.permBtn} onPress={requestPermission}>
          <Text style={s.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.permBackBtn} onPress={() => navigation.goBack()}>
          <Text style={s.permBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={[s.container, s.centered]}>
        <StatusBar barStyle="light-content" backgroundColor={DARK_BG} />
        <Text style={s.permText}>No camera device found</Text>
        <TouchableOpacity style={s.permBackBtn} onPress={() => navigation.goBack()}>
          <Text style={s.permBackText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={DARK_BG} />

      {/* ═══ Live Camera Preview ═══ */}
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isFocused}
        torchMode={flashOn ? 'on' : 'off'}
        outputs={[photoOutput]}
        onError={(err) => {
          if (err?.message?.includes('OperationCanceledException') || err?.message?.includes('not active')) return;
          console.warn('Camera notice:', err);
        }}
      />

      {/* Static Captured Photo Overlay */}
      {hasPhoto && photoUri && (
        <Image
          source={{ uri: photoUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      )}

      {/* Dark overlay above/below the frame */}
      <View style={s.overlayTop} />
      <View style={s.overlayBottom} />

      {/* ═══ Top Bar (Shifted downwards with larger icons) ═══ */}
      <View style={[s.topBar, { paddingTop: Math.max(insets.top, 16) + 16 }]}>
        <TouchableOpacity style={s.iconBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={28} color="#FFFFFF" strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={[s.iconBtn, flashOn && s.iconBtnActive]} onPress={toggleFlash}>
          <Zap size={26} color={flashOn ? DARK_BG : '#FFFFFF'} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      {/* ═══ Scanner Frame Overlay ═══ */}
      <View style={s.frameWrap}>
        <View style={s.frameBox}>
          {/* Four Green Corners */}
          <View style={[s.corner, s.cTL]} />
          <View style={[s.corner, s.cTR]} />
          <View style={[s.corner, s.cBL]} />
          <View style={[s.corner, s.cBR]} />

          {/* Scanning Line */}
          {isScanning && (
            <Animated.View style={[s.scanLine, { transform: [{ translateY: scanLineTranslateY }] }]} />
          )}

          {/* Floating Scan Labels */}
          {isScanning && (
            <>
              <View style={[s.scanLabel, { top: '22%', left: '6%' }]}>
                <View style={s.scanDot} />
                <Text style={s.scanLabelText}>Scanning</Text>
              </View>
              <View style={[s.scanLabel, { top: '48%', right: '8%' }]}>
                <View style={s.scanDot} />
                <Text style={s.scanLabelText}>Ingredients</Text>
              </View>
              <View style={[s.scanLabel, { top: '70%', left: '12%' }]}>
                <View style={s.scanDot} />
                <Text style={s.scanLabelText}>Portions</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* ═══ Status Text ═══ */}
      <View style={s.statusArea}>
        {isScanning ? (
          <>
            <Text style={s.statusTitle}>Hold steady — we got this</Text>
            <Text style={s.statusSub}>AI is identifying ingredients & portions</Text>
          </>
        ) : null}
      </View>

      {/* ═══ Bottom Controls (Shifted upwards with larger gallery icon) ═══ */}
      <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 24) + 24 }]}>
        {isScanning ? (
          /* Scanning: circular progress */
          <View style={s.bottomRow}>
            <View style={s.sideBtn}>
              <ImageIcon size={28} color="rgba(255,255,255,0.3)" strokeWidth={1.8} />
              <Text style={s.sideBtnLabel}>Gallery</Text>
            </View>

            <View style={s.progressWrap}>
              <Svg width={72} height={72} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
                <Circle
                  cx={36}
                  cy={36}
                  r={31}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth={3.5}
                  fill="none"
                />
                <Circle
                  cx={36}
                  cy={36}
                  r={31}
                  stroke={LIME}
                  strokeWidth={3.5}
                  fill="none"
                  strokeDasharray={194.8}
                  strokeDashoffset={194.8 * (1 - scanProgress / 100)}
                  strokeLinecap="round"
                />
              </Svg>
              <View style={s.progressRingInner}>
                <Text style={s.progressText}>{scanProgress}%</Text>
              </View>
            </View>

            <TouchableOpacity style={s.sideBtn} onPress={handleStopScan} activeOpacity={0.7}>
              <View style={s.stopIconCircle}>
                <X size={18} color="#FF4D4D" strokeWidth={2.8} />
              </View>
              <Text style={s.stopLabel}>Stop</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Ready: stable capture button + gallery */
          <View style={s.bottomRow}>
            <TouchableOpacity style={s.sideBtn} onPress={openGallery} activeOpacity={0.7}>
              <ImageIcon size={28} color="rgba(255,255,255,0.85)" strokeWidth={2} />
              <Text style={s.sideBtnLabel}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.captureBtn} onPress={capturePhoto} activeOpacity={0.85}>
              <View style={s.captureBtnInner} />
            </TouchableOpacity>

            <View style={s.sideBtn} />
          </View>
        )}
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_BG },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 32 },

  // Permission screens
  permText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginBottom: 20 },
  permBtn: { backgroundColor: LIME, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, marginBottom: 12 },
  permBtnText: { fontSize: 16, fontWeight: '700', color: DARK_BG },
  permBackBtn: { paddingVertical: 12 },
  permBackText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },

  // Overlay darkening
  overlayTop: { position: 'absolute', top: 0, left: 0, right: 0, height: '18%', backgroundColor: 'rgba(10,10,20,0.7)' },
  overlayBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '28%', backgroundColor: 'rgba(10,10,20,0.85)' },

  // Top bar
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8, zIndex: 10 },
  iconBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center', alignItems: 'center' },
  iconBtnActive: { backgroundColor: LIME },

  // Frame
  frameWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 },
  frameBox: { width: FRAME_SIZE, height: FRAME_SIZE, borderRadius: 24 },

  // Four green corners
  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE },
  cTL: { top: 0, left: 0, borderTopWidth: CORNER_W, borderLeftWidth: CORNER_W, borderTopColor: LIME, borderLeftColor: LIME, borderTopLeftRadius: 8 },
  cTR: { top: 0, right: 0, borderTopWidth: CORNER_W, borderRightWidth: CORNER_W, borderTopColor: LIME, borderRightColor: LIME, borderTopRightRadius: 8 },
  cBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_W, borderLeftWidth: CORNER_W, borderBottomColor: LIME, borderLeftColor: LIME, borderBottomLeftRadius: 8 },
  cBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_W, borderRightWidth: CORNER_W, borderBottomColor: LIME, borderRightColor: LIME, borderBottomRightRadius: 8 },

  // Scan line
  scanLine: {
    position: 'absolute', left: 12, right: 12, height: 2,
    backgroundColor: LIME, opacity: 0.75,
    shadowColor: LIME, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 10,
    elevation: 5,
  },

  // Scan labels
  scanLabel: {
    position: 'absolute', flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  scanDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: LIME, marginRight: 6 },
  scanLabelText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },

  // Status
  statusArea: { position: 'absolute', bottom: '28%', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 32 },
  statusTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', textAlign: 'center', marginBottom: 4 },
  statusSub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },

  // Bottom bar
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 32, paddingTop: 12, zIndex: 10 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  sideBtn: { width: 56, alignItems: 'center' },
  sideBtnLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginTop: 4 },
  stopIconCircle: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255, 77, 77, 0.18)',
    borderWidth: 1.5, borderColor: 'rgba(255, 77, 77, 0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  stopLabel: { fontSize: 10, color: '#FF4D4D', fontWeight: '800', marginTop: 4 },

  // Capture button
  captureBtn: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 3, borderColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  captureBtnInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFFFFF' },

  // Progress ring
  progressWrap: { width: 72, height: 72, justifyContent: 'center', alignItems: 'center' },
  progressRingInner: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: DARK_BG,
    justifyContent: 'center', alignItems: 'center',
  },
  progressText: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
});

export default FoodScannerScreen;
