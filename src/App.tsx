import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { ActiveTab, Subject, StudyResource } from './types';
import { isPdfDoc, isWordDoc, isImageDoc } from './services/storageService';
import {
  subscribeSubjects,
  subscribeResources,
  fetchResources,
  deleteResource,
  toggleFavoriteResource,
  deleteSubject,
  seedSuggestedSubjects
} from './services/firestoreService';

import { LoginPage } from './components/auth/LoginPage';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { ConfirmDialog } from './components/common/ConfirmDialog';

import { DashboardView } from './components/dashboard/DashboardView';
import { SubjectsView } from './components/subjects/SubjectsView';
import { VaultView } from './components/vault/VaultView';
import { SearchView } from './components/search/SearchView';
import { FavoritesView } from './components/favorites/FavoritesView';
import { ProfileView } from './components/profile/ProfileView';
import { FileConverterView } from './components/converter/FileConverterView';

import { UploadModal } from './components/upload/UploadModal';
import { AddLinkModal } from './components/upload/AddLinkModal';
import { CreateSubjectModal } from './components/subjects/CreateSubjectModal';
import { EditResourceModal } from './components/resources/EditResourceModal';
import { ShareModal } from './components/resources/ShareModal';
import { SharedResourcePage } from './components/shared/SharedResourcePage';
import { getShareIdFromUrl } from './services/shareService';

import { PdfViewerModal } from './components/viewers/PdfViewerModal';
import { WordViewerModal } from './components/viewers/WordViewerModal';
import { ImageViewerModal } from './components/viewers/ImageViewerModal';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';

import { BookOpen } from 'lucide-react';

function MainApp() {
  const { user, loading } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [resources, setResources] = useState<StudyResource[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);

  // Modals state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('vaulta_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('vaulta_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadSubjectId, setUploadSubjectId] = useState<string | undefined>(undefined);

  const [isAddLinkOpen, setIsAddLinkOpen] = useState(false);
  const [addLinkSubjectId, setAddLinkSubjectId] = useState<string | undefined>(undefined);

  const [isCreateSubjectOpen, setIsCreateSubjectOpen] = useState(false);
  const [subjectToEdit, setSubjectToEdit] = useState<Subject | null>(null);

  const [isEditResourceOpen, setIsEditResourceOpen] = useState(false);
  const [resourceToEdit, setResourceToEdit] = useState<StudyResource | null>(null);

  // Share Resource modal state
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [resourceToShare, setResourceToShare] = useState<StudyResource | null>(null);

  // Shared Route Detection (/shared/<shareId>)
  const [sharedRouteId, setSharedRouteId] = useState<string | null>(() => getShareIdFromUrl());

  useEffect(() => {
    const handleUrlChange = () => {
      setSharedRouteId(getShareIdFromUrl());
    };
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  const handleShareResource = (res: StudyResource) => {
    setResourceToShare(res);
    setIsShareOpen(true);
  };

  // Deletion confirmations
  const [resourceToDelete, setResourceToDelete] = useState<StudyResource | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);

  // In-App Viewers
  const [pdfResource, setPdfResource] = useState<StudyResource | null>(null);
  const [wordResource, setWordResource] = useState<StudyResource | null>(null);
  const [imageResource, setImageResource] = useState<StudyResource | null>(null);

  // Real-time Firestore subscriptions for the authenticated user
  useEffect(() => {
    if (!user) {
      setSubjects([]);
      setResources([]);
      return;
    }

    const unsubSubjects = subscribeSubjects(
      user.uid,
      (subs) => setSubjects(subs),
      (err) => console.error('Subject subscription error:', err)
    );

    const unsubResources = subscribeResources(
      user.uid,
      (res) => setResources(res),
      (err) => console.error('Resource subscription error:', err)
    );

    return () => {
      unsubSubjects();
      unsubResources();
    };
  }, [user]);

  // If a public share link is being viewed, render SharedResourcePage directly
  if (sharedRouteId) {
    return (
      <SharedResourcePage
        shareId={sharedRouteId}
        onNavigateHome={() => {
          window.history.pushState({}, '', '/');
          setSharedRouteId(null);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center text-slate-900 dark:text-slate-100 gap-4 transition-colors duration-200">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
          <BookOpen className="w-6 h-6 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300">Loading Vaulta...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  // Action Handlers
  const handleOpenResource = (res: StudyResource) => {
    if (isPdfDoc(res)) {
      setPdfResource(res);
    } else if (isWordDoc(res)) {
      setWordResource(res);
    } else if (isImageDoc(res)) {
      setImageResource(res);
    } else if (res.resourceType === 'link') {
      window.open(res.fileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleToggleFavorite = async (res: StudyResource) => {
    try {
      await toggleFavoriteResource(res.id, res.isFavorite);
      showToast(
        'info',
        res.isFavorite ? 'Removed from Favorites' : 'Starred to Favorites',
        `"${res.title}"`
      );
    } catch (err: any) {
      showToast('error', 'Favorite Error', err.message);
    }
  };

  const handleConfirmDeleteResource = async () => {
    if (!resourceToDelete) return;
    try {
      await deleteResource(resourceToDelete.id, resourceToDelete.storagePath);
      showToast('success', 'Resource Deleted', `"${resourceToDelete.title}" was removed.`);
    } catch (err: any) {
      showToast('error', 'Delete Error', err.message);
    } finally {
      setResourceToDelete(null);
    }
  };

  const handleConfirmDeleteSubject = async () => {
    if (!subjectToDelete) return;
    try {
      await deleteSubject(subjectToDelete.id);
      if (selectedSubjectId === subjectToDelete.id) {
        setSelectedSubjectId(null);
      }
      showToast('success', 'Subject Deleted', `"${subjectToDelete.name}" was removed.`);
    } catch (err: any) {
      showToast('error', 'Subject Delete Error', err.message);
    } finally {
      setSubjectToDelete(null);
    }
  };

  const handleSeedPresets = async () => {
    if (!user) return;
    try {
      await seedSuggestedSubjects(user.uid);
      showToast('success', 'Subjects Added', 'Loaded suggested college course subjects.');
    } catch (err: any) {
      showToast('error', 'Setup Error', err.message);
    }
  };

  const handleOpenUploadForSubject = (subjectId: string) => {
    setUploadSubjectId(subjectId);
    setIsUploadOpen(true);
  };

  const handleOpenAddLinkForSubject = (subjectId: string) => {
    setAddLinkSubjectId(subjectId);
    setIsAddLinkOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased selection:bg-indigo-600 selection:text-white pb-16 md:pb-0 transition-colors duration-200">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={handleToggleSidebar}
        onOpenUpload={() => {
          setUploadSubjectId(undefined);
          setIsUploadOpen(true);
        }}
        onOpenAddLink={() => {
          setAddLinkSubjectId(undefined);
          setIsAddLinkOpen(true);
        }}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      {/* Body Layout: Fixed/Collapsible Sidebar + Main Content */}
      <div className="flex-1 flex w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 gap-4 sm:gap-6">
        {/* Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          subjects={subjects}
          selectedSubjectId={selectedSubjectId}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
          onSelectSubject={(subId) => {
            setSelectedSubjectId(subId);
            setActiveTab('subjects');
          }}
          onOpenCreateSubject={() => {
            setSubjectToEdit(null);
            setIsCreateSubjectOpen(true);
          }}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Dynamic Main View */}
        <main className="flex-1 min-w-0 transition-all duration-300">
          {activeTab === 'dashboard' && (
            <DashboardView
              subjects={subjects}
              resources={resources}
              onSelectTab={setActiveTab}
              onSelectSubject={(subId) => {
                setSelectedSubjectId(subId);
                setActiveTab('subjects');
              }}
              onOpenUpload={() => {
                setUploadSubjectId(undefined);
                setIsUploadOpen(true);
              }}
              onOpenAddLink={() => {
                setAddLinkSubjectId(undefined);
                setIsAddLinkOpen(true);
              }}
              onOpenCreateSubject={() => {
                setSubjectToEdit(null);
                setIsCreateSubjectOpen(true);
              }}
              onSeedPresets={handleSeedPresets}
              onOpenResource={handleOpenResource}
              onToggleFavorite={handleToggleFavorite}
              onEditResource={(res) => {
                setResourceToEdit(res);
                setIsEditResourceOpen(true);
              }}
              onDeleteResource={(res) => setResourceToDelete(res)}
              onShareResource={handleShareResource}
            />
          )}

          {activeTab === 'subjects' && (
            <SubjectsView
              subjects={subjects}
              resources={resources}
              selectedSubjectId={selectedSubjectId}
              onSelectSubject={setSelectedSubjectId}
              onOpenCreateSubject={() => {
                setSubjectToEdit(null);
                setIsCreateSubjectOpen(true);
              }}
              onOpenEditSubject={(sub) => {
                setSubjectToEdit(sub);
                setIsCreateSubjectOpen(true);
              }}
              onDeleteSubject={(sub) => setSubjectToDelete(sub)}
              onSeedPresets={handleSeedPresets}
              onOpenUploadForSubject={handleOpenUploadForSubject}
              onOpenAddLinkForSubject={handleOpenAddLinkForSubject}
              onOpenResource={handleOpenResource}
              onToggleFavorite={handleToggleFavorite}
              onEditResource={(res) => {
                setResourceToEdit(res);
                setIsEditResourceOpen(true);
              }}
              onDeleteResource={(res) => setResourceToDelete(res)}
              onShareResource={handleShareResource}
            />
          )}

          {activeTab === 'vault' && (
            <VaultView
              resources={resources}
              subjects={subjects}
              onOpenUpload={() => {
                setUploadSubjectId(undefined);
                setIsUploadOpen(true);
              }}
              onOpenAddLink={() => {
                setAddLinkSubjectId(undefined);
                setIsAddLinkOpen(true);
              }}
              onOpenResource={handleOpenResource}
              onToggleFavorite={handleToggleFavorite}
              onEditResource={(res) => {
                setResourceToEdit(res);
                setIsEditResourceOpen(true);
              }}
              onDeleteResource={(res) => setResourceToDelete(res)}
              onShareResource={handleShareResource}
            />
          )}

          {activeTab === 'converter' && (
            <FileConverterView
              subjects={subjects}
              onOpenResource={handleOpenResource}
              onNavigateToVault={() => setActiveTab('vault')}
            />
          )}

          {activeTab === 'search' && (
            <SearchView
              resources={resources}
              onOpenResource={handleOpenResource}
              onToggleFavorite={handleToggleFavorite}
              onEditResource={(res) => {
                setResourceToEdit(res);
                setIsEditResourceOpen(true);
              }}
              onDeleteResource={(res) => setResourceToDelete(res)}
              onShareResource={handleShareResource}
            />
          )}

          {activeTab === 'favorites' && (
            <FavoritesView
              resources={resources}
              onOpenResource={handleOpenResource}
              onToggleFavorite={handleToggleFavorite}
              onEditResource={(res) => {
                setResourceToEdit(res);
                setIsEditResourceOpen(true);
              }}
              onDeleteResource={(res) => setResourceToDelete(res)}
              onShareResource={handleShareResource}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileView subjects={subjects} resources={resources} />
          )}
        </main>
      </div>

      {/* Global Action Modals */}
      <UploadModal
        isOpen={isUploadOpen}
        subjects={subjects}
        defaultSubjectId={uploadSubjectId}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={async () => {
          if (user) {
            const latest = await fetchResources(user.uid);
            setResources(latest);
          }
        }}
        onOpenCreateSubject={() => {
          setIsUploadOpen(false);
          setSubjectToEdit(null);
          setIsCreateSubjectOpen(true);
        }}
      />

      <AddLinkModal
        isOpen={isAddLinkOpen}
        subjects={subjects}
        defaultSubjectId={addLinkSubjectId}
        onClose={() => setIsAddLinkOpen(false)}
        onOpenCreateSubject={() => {
          setIsAddLinkOpen(false);
          setSubjectToEdit(null);
          setIsCreateSubjectOpen(true);
        }}
      />

      <CreateSubjectModal
        isOpen={isCreateSubjectOpen}
        subjectToEdit={subjectToEdit}
        onClose={() => {
          setIsCreateSubjectOpen(false);
          setSubjectToEdit(null);
        }}
      />

      <EditResourceModal
        isOpen={isEditResourceOpen}
        resource={resourceToEdit}
        subjects={subjects}
        onClose={() => {
          setIsEditResourceOpen(false);
          setResourceToEdit(null);
        }}
      />

      {/* Share Resource Modal */}
      <ShareModal
        isOpen={isShareOpen}
        resource={resourceToShare}
        onClose={() => {
          setIsShareOpen(false);
          setResourceToShare(null);
        }}
      />

      {/* In-App Viewers */}
      <PdfViewerModal
        resource={pdfResource}
        onClose={() => setPdfResource(null)}
      />

      <WordViewerModal
        resource={wordResource}
        onClose={() => setWordResource(null)}
      />

      <ImageViewerModal
        resource={imageResource}
        onClose={() => setImageResource(null)}
      />

      {/* Resource Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!resourceToDelete}
        title="Delete Resource"
        message={`Are you sure you want to permanently delete "${resourceToDelete?.title}" from your vault? This will remove the file and all associated tags.`}
        confirmText="Delete Resource"
        cancelText="Keep"
        isDestructive
        onConfirm={handleConfirmDeleteResource}
        onCancel={() => setResourceToDelete(null)}
      />

      {/* Subject Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!subjectToDelete}
        title="Delete Subject"
        message={`Are you sure you want to delete "${subjectToDelete?.name}"? Resources belonging to this subject will remain in your vault.`}
        confirmText="Delete Subject"
        cancelText="Keep"
        isDestructive
        onConfirm={handleConfirmDeleteSubject}
        onCancel={() => setSubjectToDelete(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <MainApp />
          <OfflineIndicator />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
