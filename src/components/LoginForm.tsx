// Component: LoginForm
// @env:prod
// Description: Componente de formulário de login para autenticação de usuários IPTV
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tv, Lock, User, Globe2, ArrowRight, Loader2, Menu, X, Info } from 'lucide-react';
import { useAuth } from '../lib/hooks/useAuth';

const SERVERS = [
  { id: 'nhflix', url: 'http://nhflix.xyz' },
  { id: 'pandatv', url: 'http://pandatvuhd.tech' },
  { id: 'cdn88', url: 'http://cdn88.xyz' },
  { id: 'rota66', url: 'http://rota66.bar' },
  { id: 'v220', url: 'http://v220xpco.com' }
];

export function LoginForm() {
  const { t } = useTranslation();
  const { login, error: authError, isLoading } = useAuth();
  const [server, setServer] = useState(SERVERS[0].url);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isDev = import.meta.env.DEV;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(server, username, password);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Mobile Header - Only visible on small screens */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between p-4 bg-gray-800/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-full">
              <Tv className="w-6 h-6 text-white" />
            </div>
            <span className="text-white font-semibold">IPTV Pro</span>
          </div>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-white p-2"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="bg-gray-800/95 backdrop-blur-sm p-4 space-y-4">
            <a href="#" className="block text-white py-2 px-4 rounded hover:bg-gray-700">
              {t('nav.live')}
            </a>
            <a href="#" className="block text-white py-2 px-4 rounded hover:bg-gray-700">
              {t('nav.movies')}
            </a>
            <a href="#" className="block text-white py-2 px-4 rounded hover:bg-gray-700">
              {t('nav.series')}
            </a>
            <a href="#" className="block text-white py-2 px-4 rounded hover:bg-gray-700">
              {t('nav.settings')}
            </a>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-64px)] lg:min-h-screen">
        <div className="w-full max-w-md space-y-8">
          {/* Logo and Title - Hidden on mobile when menu is open */}
          <div className={`text-center ${isMenuOpen ? 'hidden lg:block' : ''}`}>
            <div className="flex justify-center mb-4">
              <div className="bg-indigo-600 p-4 rounded-full">
                <Tv className="w-12 h-12 text-white" />
              </div>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">
              {t('login.title')}
            </h2>
            <p className="mt-2 text-sm md:text-base text-gray-400">
              {t('login.subtitle')}
            </p>
          </div>

          {/* Development Mode Notice */}
          {isDev && (
            <div className="bg-blue-900/50 border border-blue-700 rounded-lg p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-200">
                <p className="font-medium mb-1">Modo de Desenvolvimento</p>
                <p>Use uma das seguintes credenciais para login:</p>
                <ul className="list-disc list-inside mt-1 ml-1 space-y-1">
                  <li><strong>Usuário:</strong> demo / <strong>Senha:</strong> demo</li>
                  <li><strong>Usuário:</strong> mtfVNd / <strong>Senha:</strong> (qualquer senha)</li>
                </ul>
              </div>
            </div>
          )}

          {/* Login Form */}
          <div className="bg-gray-800 rounded-xl p-6 md:p-8 shadow-2xl mx-4 lg:mx-0">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Server Selection */}
              <div>
                <label htmlFor="server" className="block text-sm font-medium text-gray-300 mb-2">
                  <div className="flex items-center gap-2">
                    <Globe2 className="w-4 h-4" />
                    {t('login.server')}
                  </div>
                </label>
                <select
                  id="server"
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  disabled={isLoading}
                >
                  {SERVERS.map((s) => (
                    <option key={s.id} value={s.url}>
                      {s.url}
                    </option>
                  ))}
                </select>
              </div>

              {/* Username Field */}
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {t('login.username')}
                  </div>
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  placeholder={t('login.username_placeholder')}
                  disabled={isLoading}
                />
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    {t('login.password')}
                  </div>
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                  placeholder={t('login.password_placeholder')}
                  disabled={isLoading}
                />
              </div>

              {/* Error Message */}
              {authError && (
                <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                  {authError}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {t('login.submit')}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-xs md:text-sm text-gray-400 px-4">
            {t('login.footer')}
          </p>
        </div>
      </div>
    </div>
  );
}