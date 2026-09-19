import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { ActiveTab, Subject } from '../../types';
import {
  LayoutDashboard,
  BookMarked,
  FolderLock,
  Search,
  Star,
  User,
  RefreshCw,
  LogOut,
  Plus,
  BookOpen,
  X,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  subjects: Subject[];
  selectedSubjectId?: string | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onSelectSubject?: (subjectId: string) => void;
  onOpenCreateSubject: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  subjects,
  selectedSubjectId,
  isCollapsed = false,
  onToggleCollapse,
  onSelectSubject,
  onOpenCreateSubject,
  isMobileOpen,
  onCloseMobile
}: SidebarProps) {
  const { user, userProfile, logout } = useAuth();

  const navItems = [
    { id: 'dashboard' as ActiveTab, label: 'Dashboard', shortLabel: 'Dashboard', icon: LayoutDashboard },
    { id: 'subjects' as ActiveTab, label: 'Subjects', shortLabel: 'Subjects', icon: BookMarked },
    { id: 'vault' as ActiveTab, label: 'Vault', shortLabel: 'Vault', icon: FolderLock },
    { id: 'converter' as ActiveTab, label: 'File Converter', shortLabel: 'Converter', icon: RefreshCw },
    { id: 'search' as ActiveTab, label: 'Search', shortLabel: 'Search', icon: Search },
    { id: 'favorites' as ActiveTab, label: 'Favorites', shortLabel: 'Favorites', icon: Star },
    { id: 'profile' as ActiveTab, label: 'Profile', shortLabel: 'Profile', icon: User }
  ];

  const handleNavClick = (tabId: ActiveTab) => {
    onSelectTab(tabId);
    onCloseMobile();
  };

  const handleSubjectClick = (subjectId: string) => {
    if (onSelectSubject) {
      onSelectSubject(subjectId);
      onSelectTab('subjects');
      onCloseMobile();
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
    <>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          id="mobile-sidebar-backdrop"
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Main Desktop & Drawer Sidebar */}
      <aside
        id="vaulta-sidebar"
        className={`
          fixed top-0 bottom-0 left-0 z-40 bg-white dark:bg-slate-900 border-r border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between
          transition-all duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full'}
          md:static md:translate-x-0 md:z-10 md:rounded-2xl md:border md:my-0 md:h-[calc(100vh-5.5rem)] md:sticky md:top-20
          ${isCollapsed ? 'md:w-18' : 'md:w-60 lg:w-64'}
        `}
      >
        {/* Top: Brand Header & Collapse Toggle */}
        <div className="p-3.5 flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
          {/* Mobile Drawer Top Header */}
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 dark:border-slate-800 md:hidden">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-xs">
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight">Vaulta</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">
                Hub
              </span>
            </div>
            <button
              onClick={onCloseMobile}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Desktop Collapse Toggle Row */}
          <div className="hidden md:flex items-center justify-between pb-2.5 mb-2 border-b border-slate-100 dark:border-slate-800">
            {!isCollapsed ? (
              <div className="flex items-center justify-between w-full px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Navigation
                </span>
                {onToggleCollapse && (
                  <button
                    type="button"
                    onClick={onToggleCollapse}
                    className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition cursor-pointer"
                    title="Collapse Sidebar"
                    aria-label="Collapse Sidebar"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="w-full flex justify-center py-0.5">
                {onToggleCollapse && (
                  <button
                    type="button"
                    onClick={onToggleCollapse}
                    className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition cursor-pointer"
                    title="Expand Sidebar"
                    aria-label="Expand Sidebar"
                  >
                    <PanelLeftOpen className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Primary Nav Links */}
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-item-${item.id}`}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  title={item.label}
                  className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
                  } ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-200 dark:shadow-none'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>

          {/* Subject Shortcuts Section (Only if expanded) */}
          {!isCollapsed ? (
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  My Subjects ({subjects.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onOpenCreateSubject();
                    onCloseMobile();
                  }}
                  className="text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 p-1 rounded-md transition cursor-pointer"
                  title="Add new subject"
                  aria-label="Add new subject"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {subjects.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-slate-400 dark:text-slate-500 italic">
                    No subjects created yet.
                  </div>
                ) : (
                  subjects.map((sub) => {
                    const isCurrent = activeTab === 'subjects' && selectedSubjectId === sub.id;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => handleSubjectClick(sub.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer text-left ${
                          isCurrent
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="truncate pr-2">{sub.name}</span>
                        {sub.code && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono shrink-0">
                            {sub.code}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center">
              <button
                type="button"
                onClick={() => handleNavClick('subjects')}
                title={`My Subjects (${subjects.length})`}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition"
              >
                <BookMarked className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* PWA Install Button in Sidebar (if installable and not collapsed) */}
        {!isCollapsed && (
          <div className="px-3 pb-2">
            <PWAInstallButton variant="sidebar" />
          </div>
        )}

        {/* Bottom: User Card & Logout */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 md:rounded-b-2xl">
          {!isCollapsed ? (
            <div className="flex items-center justify-between gap-2">
              <div
                onClick={() => handleNavClick('profile')}
                className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1 group"
                title="View profile"
              >
                {userAvatarUrl ? (
                  <img
                    src={userAvatarUrl}
                    alt={userDisplayName}
                    className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    {userInitial}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {userDisplayName}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{user?.email}</p>
                </div>
              </div>

              <button
                id="sidebar-logout-btn"
                type="button"
                onClick={() => logout()}
                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                title="Log Out"
                aria-label="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => handleNavClick('profile')}
                title={`${userDisplayName} (${user?.email})`}
                className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer overflow-hidden"
              >
                {userAvatarUrl ? (
                  <img
                    src={userAvatarUrl}
                    alt={userDisplayName}
                    className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-colors">
                    {userInitial}
                  </div>
                )}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile-Only Bottom Navigation Bar (Hidden on desktop & tablets md:) */}
      <nav
        id="mobile-bottom-nav"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-lg"
      >
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center py-1 px-3 rounded-lg text-[10px] font-medium transition cursor-pointer ${
                isActive ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
              <span>{item.shortLabel || item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

