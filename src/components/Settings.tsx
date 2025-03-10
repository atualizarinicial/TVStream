// Component: Settings
// @env:prod
// Description: Componente para gerenciar configurações do aplicativo

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon, Globe2, Database, Trash2, RefreshCw } from 'lucide-react';
import { db } from '../lib/db';

export function Settings() {
  const { t, i18n } = useTranslation();

  const handleLanguageChange = (language: string) => {
    i18n.changeLanguage(language);
  };

  const handleClearData = async () => {
    if (window.confirm(t('settings.clear_confirm'))) {
      await db.delete();
      window.location.reload();
    }
  };

  const handleResetDatabase = async () => {
    if (window.confirm(t('settings.reset_db_confirm'))) {
      try {
        // Deleta o banco de dados
        await db.delete();
        
        // Limpa o localStorage
        localStorage.clear();
        
        // Recarrega a página
        window.location.reload();
      } catch (error) {
        console.error('Erro ao redefinir banco de dados:', error);
        alert('Ocorreu um erro ao redefinir o banco de dados. Consulte o console para mais detalhes.');
      }
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-6 h-6" />
          {t('nav.settings')}
        </h1>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* Language Settings */}
        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
            <Globe2 className="w-5 h-5" />
            {t('settings.language')}
          </h2>
          <div className="flex gap-4">
            <button
              onClick={() => handleLanguageChange('pt')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                i18n.language === 'pt'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Português
            </button>
            <button
              onClick={() => handleLanguageChange('en')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                i18n.language === 'en'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              English
            </button>
          </div>
        </section>

        {/* Data Management */}
        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
            <Database className="w-5 h-5" />
            {t('settings.data')}
          </h2>
          <div className="space-y-4">
            <button
              onClick={handleClearData}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              {t('settings.clear_data')}
            </button>
            
            <div className="border-t border-gray-700 pt-4">
              <h3 className="text-lg font-medium mb-2">{t('settings.troubleshooting')}</h3>
              <button
                onClick={handleResetDatabase}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                {t('settings.reset_db')}
              </button>
              <p className="text-gray-400 text-sm mt-2">
                {t('settings.reset_db_help')}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
} 