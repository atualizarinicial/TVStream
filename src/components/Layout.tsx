// Component: Layout
// @env:prod
// Description: Componente de layout principal que contém a estrutura comum entre as páginas

import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Tv as TvIcon,
  Film,
  MonitorPlay,
  Settings,
  Menu,
  X,
  LogOut
} from 'lucide-react';
import { useAuth } from '../lib/hooks/useAuth';
import { EPGDownloadPopup } from './EPGDownloadPopup';

export function Layout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { logout, showEPGPopup, setShowEPGPopup } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCloseEPGPopup = () => {
    setShowEPGPopup(false);
  };

  const navItems = [
    { path: '/live', icon: TvIcon, label: t('nav.live') },
    { path: '/movies', icon: Film, label: t('nav.movies') },
    { path: '/series', icon: MonitorPlay, label: t('nav.series') },
    { path: '/settings', icon: Settings, label: t('nav.settings') }
  ];

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* EPG Download Popup */}
      <EPGDownloadPopup isOpen={showEPGPopup} onClose={handleCloseEPGPopup} />

      {/* Sidebar */}
      <aside
        className={`
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
          fixed lg:relative
          z-30
          w-64
          h-full
          bg-gray-800
          border-r
          border-gray-700
          transition-transform
          duration-300
          ease-in-out
        `}
      >
        {/* Logo */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-full">
              <TvIcon className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold">IPTV Pro</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {navItems.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-lg
                transition-colors duration-200
                ${isActive 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-gray-400 hover:bg-gray-700 hover:text-white'}
              `}
              onClick={() => setIsSidebarOpen(false)}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout Button */}
        <div className="absolute bottom-0 w-full p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-gray-400 hover:bg-gray-700 hover:text-white rounded-lg transition-colors duration-200"
          >
            <LogOut className="w-5 h-5" />
            <span>{t('nav.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors duration-200"
          >
            {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <span className="text-xl font-bold">IPTV Pro</span>
          <div className="w-10" /> {/* Spacer for alignment */}
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center justify-around">
          {navItems.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => `
                flex flex-col items-center gap-1 py-3 px-4
                transition-colors duration-200
                ${isActive ? 'text-indigo-500' : 'text-gray-400'}
              `}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-20"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
} 