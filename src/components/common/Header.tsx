import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ActiveTab } from '../../types';
import {
  BookOpen,
  Upload,
  Link as LinkIcon,
  Search,
  Menu,
  LogOut,
  User as UserIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon
} from 'lucide-react';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface HeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onOpenUpload: () => void;
  onOpenAddLink: () => void;
  onToggleMobileMenu: () => void;
}

export function Header({
  activeTab,
  onSelectTab,
  isSidebarCollapsed = false,
  onToggleSidebar,
  onOpenUpload,
  onOpenAddLink,
  onToggleMobileMenu
}: HeaderProps) {
  const { user, userProfile, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return 'Dashboard';
      case 'subjects':
        return 'Course Subjects';
      case 'vault':
        return 'Study Vault';
      case 'converter':
        return 'File Converter';
      case 'search':
        return 'Resource Search';
      case 'favorites':
        return 'Favorites';
      case 'profile':
        return 'Student Profile';
      default:
        return 'Dashboard';
    }
  };

  const userInitial =
    userProfile?.displayName?.charAt(0).toUpperCase() ||
    user?.email?.charAt(0).toUpperCase() ||
    'U';

  const userDisplayName =
    userProfile?.displayName || user?.email?.split('@')[0] || 'Student';

  const userAvatarUrl =
    userProfile?.photoURL ||
    userProfile?.avatarUrl ||
    user?.photoURL ||
    user?.avatarUrl;

  return (
    <header
      id="vaulta-header"
      className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 text-slate-900 dark:text-slate-100 shadow-xs transition-colors duration-200"
    >
      {/* Left: Sidebar Toggle, Mobile Toggle, Brand & Breadcrumb */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Hamburger Toggle */}
        <button
          id="mobile-menu-toggle-btn"
          type="button"
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 transition"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop Sidebar Toggle */}
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="hidden md:flex items-center justify-center p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label="Toggle Sidebar"
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Brand Logo & Breadcrumb */}
        <div
          onClick={() => onSelectTab('dashboard')}
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform shrink-0">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              Vaulta
            </span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700 font-light">/</span>
            <span className="hidden sm:inline text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400">
              {getPageTitle()}
            </span>
          </div>
        </div>
      </div>

      {/* Middle: Compact Quick Search Bar */}
      <div className="hidden lg:flex flex-1 max-w-sm mx-4">
        <div
          onClick={() => onSelectTab('search')}
          className="w-full py-1.5 px-3 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl text-slate-500 dark:text-slate-400 text-xs flex items-center justify-between cursor-pointer transition shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <span className="truncate">Search notes, 2/16 marks, docs...</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 font-semibold rounded border border-slate-200 dark:border-slate-600 shadow-2xs">
            /
          </kbd>
        </div>
      </div>

      {/* Right: Theme Toggle, Add Link, Upload File, Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Search icon button for smaller screens */}
        <button
          type="button"
          onClick={() => onSelectTab('search')}
          className="lg:hidden p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
          title="Search"
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Theme Toggle Button */}
        <button
          id="header-theme-toggle-btn"
          type="button"
          onClick={toggleTheme}
          className="p-2 text-slate-500 dark:text-amber-400 hover:text-slate-900 dark:hover:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>

        {/* PWA Install Button (automatically suppresses if already running as standalone app) */}
        <PWAInstallButton variant="header" />

        {/* Add Link Button */}
        <button
          id="header-add-link-btn"
          type="button"
          onClick={onOpenAddLink}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/70 rounded-xl transition cursor-pointer"
        >
          <LinkIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span>Add Link</span>
        </button>

        {/* Upload File Button */}
        <button
          id="header-upload-file-btn"
          type="button"
          onClick={onOpenUpload}
          className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Upload File</span>
          <span className="xs:hidden">Upload</span>
        </button>

        {/* User Profile Avatar & Logout */}
        <div className="flex items-center pl-1.5 sm:pl-2 border-l border-slate-200 dark:border-slate-800 gap-1 sm:gap-1.5">
          <button
            id="header-profile-btn"
            type="button"
            onClick={() => onSelectTab('profile')}
            className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition text-left"
            title={`Signed in as ${userDisplayName}`}
          >
            {userAvatarUrl ? (
              <img
                src={userAvatarUrl}
                alt={userDisplayName}
                className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
                {userInitial}
              </div>
            )}
            <span className="hidden md:block text-xs font-semibold text-slate-700 dark:text-slate-200 max-w-[110px] truncate">
              {userDisplayName}
            </span>
          </button>

          <button
            id="header-logout-btn"
            type="button"
            onClick={() => logout()}
            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition"
            title="Log Out"
            aria-label="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

