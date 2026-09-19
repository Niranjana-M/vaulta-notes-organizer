export type ResourceType = 'pdf' | 'doc' | 'word' | 'docx' | 'image' | 'link';

export interface Subject {
  id: string;
  userId: string;
  name: string;
  code?: string;
  description?: string;
  color?: string; // e.g. 'indigo', 'emerald', 'amber', 'rose', 'sky', 'purple'
  createdAt: number;
  resourceCount?: number;
}

export interface StudyResource {
  id: string;
  userId: string;
  title: string;
  subjectId: string;
  subjectName: string;
  resourceType: ResourceType;
  fileName?: string;
  fileUrl: string;
  storagePath?: string;
  fileSize?: number; // in bytes
  mimeType?: string;
  uploadDate: number;
  description?: string;
  tags: string[];
  isFavorite: boolean;
}

export interface ShareRecord {
  id: string;
  shareId: string;
  resourceId: string;
  ownerId: string;
  createdAt: number;
  enabled: boolean;
  resource: {
    id: string;
    userId: string;
    title: string;
    subjectId?: string;
    subjectName?: string;
    resourceType: ResourceType;
    fileName?: string;
    fileUrl: string;
    storagePath?: string;
    fileSize?: number;
    mimeType?: string;
    uploadDate?: number;
    description?: string;
    tags?: string[];
    isFavorite?: boolean;
  };
}

export interface UploadProgress {
  fileName: string;
  progress: number; // 0 - 100
  status: 'idle' | 'uploading' | 'saving' | 'completed' | 'error';
  errorMessage?: string;
}

export type ActiveTab = 'dashboard' | 'subjects' | 'vault' | 'converter' | 'search' | 'favorites' | 'profile';

export const COMMON_TAGS = [
  '2 Marks',
  '16 Marks',
  'Important',
  'Assignment',
  'Notes',
  'Question Bank',
  'Formula Sheet',
  'Syllabus',
  'Lab Manual',
  'Previous Year QP'
];

export const PRESET_SUBJECTS = [
  { name: 'Biosensor and Transducer', code: 'BM3401', color: 'emerald' },
  { name: 'IoT', code: 'CS3591', color: 'indigo' },
  { name: 'Digital Electronics', code: 'EC3352', color: 'amber' },
  { name: 'Operating Systems', code: 'CS3451', color: 'sky' },
  { name: 'Data Structures', code: 'CS3301', color: 'purple' },
  { name: 'Computer Graphics', code: 'CS3601', color: 'rose' }
];
