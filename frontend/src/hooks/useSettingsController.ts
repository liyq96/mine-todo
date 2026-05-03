import { useEffect, useState } from 'react';
import { readError } from '../lib/todos';
import { backend } from '../lib/wails';
import type { DirectorySwitchMode, Locale, SettingsTab } from '../appTypes';
import type { BootstrapResponse } from '../types';

type UseSettingsControllerArgs = {
  storageDir: string;
  locale: Locale;
  setSaving: (value: boolean) => void;
  setError: (value: string) => void;
  unknownErrorText: string;
  applyBootstrap: (data: BootstrapResponse) => void;
};

export function useSettingsController({
  storageDir,
  locale,
  setSaving,
  setError,
  unknownErrorText,
  applyBootstrap,
}: UseSettingsControllerArgs) {
  const [storageInput, setStorageInput] = useState(storageDir);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('data');
  const [isDirectoryConfirmOpen, setIsDirectoryConfirmOpen] = useState(false);

  useEffect(() => {
    setStorageInput(storageDir);
  }, [storageDir]);

  function openSettings(tab: SettingsTab) {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  }

  function closeSettings() {
    setIsSettingsOpen(false);
  }

  function handleRequestStorageDirChange() {
    const nextPath = storageInput.trim();
    if (!nextPath || nextPath === storageDir) {
      return;
    }
    setIsDirectoryConfirmOpen(true);
  }

  async function handleConfirmStorageDir(mode: DirectorySwitchMode) {
    try {
      setSaving(true);
      const data = await backend.updateStorageDirectory(storageInput.trim(), mode === 'copy');
      applyBootstrap(data);
      setError('');
      setIsDirectoryConfirmOpen(false);
      setIsSettingsOpen(false);
    } catch (err) {
      setError(readError(err, unknownErrorText));
    } finally {
      setSaving(false);
    }
  }

  async function handleBrowseStorageDir() {
    try {
      setSaving(true);
      const selected = await backend.selectStorageDirectory();
      if (!selected) {
        return;
      }
      setStorageInput(selected);
      setError('');
    } catch (err) {
      setError(readError(err, unknownErrorText));
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeLanguage(language: Locale) {
    if (language === locale) {
      return;
    }

    try {
      setSaving(true);
      const data = await backend.updateLanguage(language);
      applyBootstrap(data);
      setError('');
    } catch (err) {
      setError(readError(err, unknownErrorText));
    } finally {
      setSaving(false);
    }
  }

  return {
    storageInput,
    setStorageInput,
    isSettingsOpen,
    setIsSettingsOpen,
    settingsTab,
    setSettingsTab,
    isDirectoryConfirmOpen,
    setIsDirectoryConfirmOpen,
    openSettings,
    closeSettings,
    handleRequestStorageDirChange,
    handleConfirmStorageDir,
    handleBrowseStorageDir,
    handleChangeLanguage,
  };
}
