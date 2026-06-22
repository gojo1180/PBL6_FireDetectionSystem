"use client";

import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, ShieldAlert, CheckCircle2, Play } from 'lucide-react';
import { getBuzzerMode, setBuzzerMode, testBuzzer } from '@/lib/api';

type BuzzerMode = 'ANY' | 'FUSION_ONLY' | 'MUTE';

export default function BuzzerControlPanel() {
  const [mode, setModeState] = useState<BuzzerMode>('FUSION_ONLY');
  const [loading, setLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fetch initial mode
  useEffect(() => {
    const fetchMode = async () => {
      try {
        const data = await getBuzzerMode();
        if (data.current_mode) setModeState(data.current_mode as BuzzerMode);
      } catch (error) {
        console.error("Failed to fetch buzzer mode:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMode();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleModeChange = async (newMode: BuzzerMode) => {
    setModeState(newMode);
    try {
      await setBuzzerMode(newMode);
      showToast("Buzzer mode updated!");
    } catch (error) {
      console.error("Error updating buzzer mode:", error);
      showToast("Failed to update mode");
    }
  };

  const handleTestBuzzer = async () => {
    setIsTesting(true);
    try {
      await testBuzzer();
      showToast("Test buzzer (3 detik) dimulai!");
    } catch (error) {
      console.error("Error testing buzzer:", error);
      showToast("Gagal melakukan test buzzer");
    } finally {
      setTimeout(() => setIsTesting(false), 3000); // disable button while testing
    }
  };

  return (
    <div className="relative w-full p-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Alarm Buzzer
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Atur kondisi kapan buzzer pada perangkat ESP32 akan berbunyi
            </p>
          </div>
        </div>

        {/* Test Buzzer Button */}
        <button
          onClick={handleTestBuzzer}
          disabled={loading || isTesting}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play className="w-4 h-4" />
          {isTesting ? "Menguji..." : "Test Buzzer"}
        </button>
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* FUSION_ONLY Mode */}
        <label
          className={`relative flex flex-col p-4 cursor-pointer rounded-xl border-2 transition-all duration-200 ${mode === 'FUSION_ONLY'
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10'
              : 'border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 hover:border-gray-200 dark:hover:border-gray-700'
            }`}
        >
          <input
            type="radio"
            name="buzzerMode"
            value="FUSION_ONLY"
            checked={mode === 'FUSION_ONLY'}
            onChange={() => handleModeChange('FUSION_ONLY')}
            className="sr-only"
            disabled={loading}
          />
          <div className="flex justify-between items-start mb-2">
            <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-blue-500" />
              FUSION_ONLY
            </span>
            {mode === 'FUSION_ONLY' && (
              <CheckCircle2 className="w-5 h-5 text-blue-500" />
            )}
          </div>
          <span className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            <strong>Akurat:</strong> Menyala HANYA jika Kamera (CCTV) & Sensor (MQ/DHT) sepakat ada anomali.
          </span>
        </label>

        {/* ANY Mode */}
        <label
          className={`relative flex flex-col p-4 cursor-pointer rounded-xl border-2 transition-all duration-200 ${mode === 'ANY'
              ? 'border-red-500 bg-red-50/50 dark:bg-red-900/10'
              : 'border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 hover:border-gray-200 dark:hover:border-gray-700'
            }`}
        >
          <input
            type="radio"
            name="buzzerMode"
            value="ANY"
            checked={mode === 'ANY'}
            onChange={() => handleModeChange('ANY')}
            className="sr-only"
            disabled={loading}
          />
          <div className="flex justify-between items-start mb-2">
            <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-red-500" />
              ANY
            </span>
            {mode === 'ANY' && (
              <CheckCircle2 className="w-5 h-5 text-red-500" />
            )}
          </div>
          <span className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            <strong>Sensitif:</strong> Menyala jika ada peringatan dari CCTV ATAU Sensor (salah satu cukup).
          </span>
        </label>

        {/* MUTE Mode */}
        <label
          className={`relative flex flex-col p-4 cursor-pointer rounded-xl border-2 transition-all duration-200 ${mode === 'MUTE'
              ? 'border-gray-500 bg-gray-100 dark:bg-gray-800'
              : 'border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 hover:border-gray-200 dark:hover:border-gray-700'
            }`}
        >
          <input
            type="radio"
            name="buzzerMode"
            value="MUTE"
            checked={mode === 'MUTE'}
            onChange={() => handleModeChange('MUTE')}
            className="sr-only"
            disabled={loading}
          />
          <div className="flex justify-between items-start mb-2">
            <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <VolumeX className="w-4 h-4 text-gray-500" />
              MUTE
            </span>
            {mode === 'MUTE' && (
              <CheckCircle2 className="w-5 h-5 text-gray-500" />
            )}
          </div>
          <span className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            <strong>Senyap:</strong> Buzzer fisik dimatikan sepenuhnya. (Notifikasi UI tetap masuk).
          </span>
        </label>
      </div>

      {/* Custom Minimal Toast */}
      {toastMessage && (
        <div className="absolute top-4 right-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2 rounded-lg shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200 flex items-center gap-2 z-50">
          <CheckCircle2 className="w-4 h-4 text-green-400 dark:text-green-600" />
          {toastMessage}
        </div>
      )}
    </div>
  );
}
