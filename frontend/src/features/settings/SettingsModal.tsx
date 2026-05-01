import type { AppConfig } from '../../types';

type SettingsTab = 'data' | 'language' | 'about';
type Locale = 'zh-CN' | 'en-US';

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
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={(event) => event.stopPropagation()}>
        <div className="settings-modal__header">
          <h2>{copy.settingsTitle}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label={copy.close}>
            ×
          </button>
        </div>

        <div className="settings-tabs">
          {(['data', 'language', 'about'] as SettingsTab[]).map((tab) => (
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
                    className="topbar-link"
                    onClick={onBrowseStorageDir}
                    disabled={saving}
                  >
                    {copy.chooseDirectory}
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
              <div className="language-options" role="radiogroup" aria-label={copy.languageLabel}>
                {(['zh-CN', 'en-US'] as Locale[]).map((language) => (
                  <button
                    key={language}
                    type="button"
                    className={`language-option ${locale === language ? 'is-active' : ''}`}
                    onClick={() => onChangeLanguage(language)}
                    disabled={saving}
                  >
                    <strong>{copy.languageOptions[language].label}</strong>
                    <span>{copy.languageOptions[language].hint}</span>
                  </button>
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
              <div className="language-options">
                <button
                  type="button"
                  className="language-option"
                  onClick={() => onConfirmStorageDir('copy')}
                  disabled={saving}
                >
                  <strong>{copy.switchDirectoryCopy}</strong>
                  <span>{copy.switchDirectoryCopyHint}</span>
                </button>
                <button
                  type="button"
                  className="language-option"
                  onClick={() => onConfirmStorageDir('fresh')}
                  disabled={saving}
                >
                  <strong>{copy.switchDirectoryFresh}</strong>
                  <span>{copy.switchDirectoryFreshHint}</span>
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
      </div>
    </div>
  );
}
