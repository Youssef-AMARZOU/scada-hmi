import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Globe, Clock } from 'lucide-react';
import { useAppStore, useAlarmStore, useTagStore } from '../../stores/index';
import './Header.css';

export default function Header() {
  const { t, i18n } = useTranslation();
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const criticalCount = useAlarmStore((s) => s.getCriticalCount());
  const activeCount = useAlarmStore((s) => s.getActiveAlarms().length);
  const connected = useTagStore((s) => s.connected);
  const tagCount = useTagStore((s) => s.tags.length);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleLang = () => {
    const next = language === 'fr' ? 'en' : 'fr';
    setLanguage(next);
    i18n.changeLanguage(next);
  };

  return (
    <header className="header">
      <div className="header-left">
        <div className="header-clock">
          <Clock size={16} />
          <span className="data-value">{time.toLocaleTimeString('fr-FR')}</span>
          <span className="header-date">{time.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
        </div>
      </div>

      <div className="header-right">
        {connected && (
          <div className="header-tag-count pulse-live">
            <span className="data-value" style={{ fontSize: '0.85rem' }}>{tagCount}</span>
            <span>{t('common.tags')}</span>
          </div>
        )}

        <button className="header-btn" onClick={toggleLang} title={t('header.language')}>
          <Globe size={18} />
          <span>{language === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}</span>
        </button>

        <button className="header-btn alarm-btn" title={t('header.notifications')}>
          <Bell size={18} />
          {activeCount > 0 && (
            <span className={`alarm-badge ${criticalCount > 0 ? 'critical' : 'warning'}`}>
              {activeCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
