export interface LessonStructure {
  id: string;
  name: string;
  type: 'folder' | 'file';
  path: string;
  filename?: string;
  children?: LessonStructure[];
}

export interface Lesson {
  path: string;
  frontmatter: Record<string, any>;
  content: string;
  html: string;
}

export interface SearchResult {
  id: string;
  name: string;
  path: string;
  type: 'lesson' | 'folder';
}