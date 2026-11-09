import { IconFolderOpen, IconX } from '@tabler/icons-react';
import { RadioOptions } from '../_primitives/RadioOptions';
import { Modal } from '../_primitives/Modal';
import type { Locale, SettingsTab } from '../../appTypes';
import type { AppConfig } from '../../types';

type SettingsCopy = {
  settingsTitle: string;
  close: string;
  tabs: Record<SettingsTab, string>;
  dataTitle: string;
  dataDescription: string;
  directoryLabel: string;
  chooseDirectory: string;
  cancel: string;
  saveDirectory: string;
  languageTitle: string;
  languageDescription: string;
  languageLabel: string;
  shortcutsTitle: string;
  shortcutsDescription: string;
  shortcutGroups: Array<{
    title: string;
    items: Array<{ label: string; keys: string[] }>;
  }>;
  aboutTitle: string;
  aboutDescription: string;
  projectName: string;
  version: string;
  releaseDate: string;
  loading: string;
  switchDirectoryTitle: string;
  switchDirectoryDescription: string;
  switchDirectoryCopy: string;
  switchDirectoryCopyHint: string;
  switchDirectoryFresh: string;
  switchDirectoryFreshHint: string;
  languageOptions: Record<Locale, { label: string; hint: string }>;
};

type AppInfo = {
  name: string;
  version: string;
  releaseDate: string;
};

type SettingsModalProps = {
  error: string;
  isOpen: boolean;
  copy: SettingsCopy;
  locale: Locale;
  settingsTab: SettingsTab;
  config: AppConfig | null;
  storageInput: string;
  saving: boolean;
  isDirectoryConfirmOpen: boolean;
  appInfo: AppInfo;
  onClose: () => void;
  onTabChange: (tab: SettingsTab) => void;
  onBrowseStorageDir: () => void;
  onRequestStorageDirChange: () => void;
  onChangeLanguage: (language: Locale) => void;
  onCloseDirectoryConfirm: () => void;
  onConfirmStorageDir: (mode: 'copy' | 'fresh') => void;
};

export function SettingsModal({
  error,
  isOpen,
  copy,
  locale,
  settingsTab,
  config,
  storageInput,
  saving,
  isDirectoryConfirmOpen,
  appInfo,
  onClose,
  onTabChange,
  onBrowseStorageDir,
  onRequestStorageDirChange,
  onChangeLanguage,
  onCloseDirectoryConfirm,
  onConfirmStorageDir,
}: SettingsModalProps) {
  return (
    <Modal title={copy.settingsTitle} open={isOpen} onClose={onClose} contentClassName="settings-modal">
      <div className="settings-modal__header">
        <h2>{copy.settingsTitle}</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label={copy.close}>
          <IconX size={16} stroke={2} />
        </button>
      </div>

      <div className="settings-tabs">
        {(['data', 'language', 'shortcuts', 'about'] as SettingsTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            className={`settings-tab ${settingsTab === tab ? 'is-active' : ''}`}
            onClick={() => onTabChange(tab)}
          >
            {copy.tabs[tab]}
          </button>
        ))}
      </div>

      <div className="settings-panel">
        {error && !isDirectoryConfirmOpen ? <div className="error-banner" role="alert">{error}</div> : null}
        {settingsTab === 'data' ? (
          <section className="settings-pane">
            <div className="settings-pane__header">
              <h3>{copy.dataTitle}</h3>
              <p>{copy.dataDescription}</p>
            </div>
            <label className="settings-field">
              <span>{copy.directoryLabel}</span>
              <div className="settings-path-row">
                <div className="settings-path-value" title={storageInput}>
                  {storageInput || copy.loading}
                </div>
                <button
                  type="button"
                  className="settings-path-action"
                  onClick={onBrowseStorageDir}
                  disabled={saving}
                  aria-label={copy.chooseDirectory}
                  title={copy.chooseDirectory}
                >
                  <IconFolderOpen size={16} stroke={2} />
                </button>
              </div>
            </label>
            <div className="settings-meta">{config?.dbPath ?? copy.loading}</div>
            <div className="settings-actions">
              <button type="button" className="topbar-link" onClick={onClose}>
                {copy.cancel}
              </button>
              <button
                type="button"
                className="topbar-link"
                onClick={onRequestStorageDirChange}
                disabled={saving || !storageInput.trim() || storageInput.trim() === config?.storageDir}
              >
                {copy.saveDirectory}
              </button>
            </div>
          </section>
        ) : null}

        {settingsTab === 'language' ? (
          <section className="settings-pane">
            <div className="settings-pane__header">
              <h3>{copy.languageTitle}</h3>
              <p>{copy.languageDescription}</p>
            </div>
            <RadioOptions
              label={copy.languageLabel}
              value={locale}
              disabled={saving}
              onChange={onChangeLanguage}
              options={(['zh-CN', 'en-US'] as Locale[]).map((language) => ({ value: language, ...copy.languageOptions[language] }))}
            />
          </section>
        ) : null}

        {settingsTab === 'shortcuts' ? (
          <section className="settings-pane">
            <div className="settings-pane__header">
              <h3>{copy.shortcutsTitle}</h3>
              <p>{copy.shortcutsDescription}</p>
            </div>
            <div className="shortcut-groups">
              {copy.shortcutGroups.map((group) => (
                <section key={group.title} className="shortcut-group">
                  <h4>{group.title}</h4>
                  <div className="shortcut-list">
                    {group.items.map((item) => (
                      <div key={item.label} className="shortcut-row">
                        <span>{item.label}</span>
                        <span className="shortcut-row__keys" aria-label={item.keys.join(' + ')}>
                          {item.keys.map((key) => <kbd key={key}>{key}</kbd>)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>
        ) : null}

        {settingsTab === 'about' ? (
          <section className="settings-pane">
            <div className="settings-pane__header">
              <h3>{copy.aboutTitle}</h3>
              <p>{copy.aboutDescription}</p>
            </div>
            <div className="about-grid">
              <div className="about-item">
                <span>{copy.projectName}</span>
                <strong>{appInfo.name}</strong>
              </div>
              <div className="about-item">
                <span>{copy.version}</span>
                <strong>{appInfo.version}</strong>
              </div>
              <div className="about-item">
                <span>{copy.releaseDate}</span>
                <strong>{appInfo.releaseDate}</strong>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      {isDirectoryConfirmOpen ? (
        <div className="settings-confirm-overlay">
          <div className="settings-confirm-card">
            <div className="settings-pane__header">
              <h3>{copy.switchDirectoryTitle}</h3>
              <p>{copy.switchDirectoryDescription}</p>
            </div>
            {error ? <div className="error-banner" role="alert">{error}</div> : null}
            <div className="language-options">
              <button
                type="button"
                className="language-option"
                onClick={() => onConfirmStorageDir('copy')}
                disabled={saving}
              >
                <span className="language-option__copy">
                  <strong>{copy.switchDirectoryCopy}</strong>
                  <span>{copy.switchDirectoryCopyHint}</span>
                </span>
              </button>
              <button
                type="button"
                className="language-option"
                onClick={() => onConfirmStorageDir('fresh')}
                disabled={saving}
              >
                <span className="language-option__copy">
                  <strong>{copy.switchDirectoryFresh}</strong>
                  <span>{copy.switchDirectoryFreshHint}</span>
                </span>
              </button>
            </div>
            <div className="settings-actions">
              <button
                type="button"
                className="topbar-link"
                onClick={onCloseDirectoryConfirm}
                disabled={saving}
              >
                {copy.cancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
