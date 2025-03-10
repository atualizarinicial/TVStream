// Component: EPGDownloadPopup
// @env:prod
// Description: Componente de popup para download do EPG após o login

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useIPTV } from '../lib/hooks/useIPTV';

interface EPGDownloadPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EPGDownloadPopup({ isOpen, onClose }: EPGDownloadPopupProps) {
  const { t } = useTranslation();
  const { forceEPGDownload } = useIPTV();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      setDownloadStatus('idle');
      setErrorMessage(null);
      
      const success = await forceEPGDownload();
      
      if (success) {
        setDownloadStatus('success');
        // Fechar automaticamente após 2 segundos em caso de sucesso
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setDownloadStatus('error');
        setErrorMessage(t('epg.default_error'));
      }
    } catch (error) {
      setDownloadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : t('epg.error'));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-70">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">{t('epg.title')}</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="bg-indigo-600/20 p-3 rounded-full">
              <Download className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-white mb-2">
                {t('epg.download_title')}
              </h3>
              <p className="text-gray-300 mb-4">
                {t('epg.download_description')}
              </p>
              
              {/* Status Messages */}
              {downloadStatus === 'success' && (
                <div className="bg-green-900/30 border border-green-800 rounded-lg p-3 mb-4 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <p className="text-green-300 text-sm">
                    {t('epg.success')}
                  </p>
                </div>
              )}
              
              {downloadStatus === 'error' && (
                <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 mb-4 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-red-300 text-sm">
                    {errorMessage || t('epg.error')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-gray-700 bg-gray-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            {t('epg.skip')}
          </button>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('epg.downloading')}
              </>
            ) : downloadStatus === 'success' ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                {t('epg.completed')}
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                {t('epg.download')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
} 