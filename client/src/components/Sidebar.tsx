import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Search, Menu, X, File, Folder } from 'lucide-react';
import { LessonStructure, SearchResult } from '../types';

interface SidebarProps {
  structure: LessonStructure[];
  isOpen: boolean;
  onToggle: () => void;
  onLessonSelect: (lessonPath: string) => void;
  onSearch: (query: string) => Promise<SearchResult[]>;
  isSubscribed: boolean;
  onSubscriptionRequired: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  structure,
  isOpen,
  onToggle,
  onLessonSelect,
  onSearch,
  isSubscribed,
  onSubscriptionRequired
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();
    const searchDelayed = setTimeout(async () => {
      if (searchQuery.trim()) {
        setIsSearching(true);
        try {
          const results = await onSearch(searchQuery);
          if (!abortController.signal.aborted) {
            setSearchResults(results);
          }
        } catch (error) {
          if (!abortController.signal.aborted) {
            console.error('Search error:', error);
            setSearchResults([]);
          }
        } finally {
          if (!abortController.signal.aborted) {
            setIsSearching(false);
          }
        }
      } else {
        setSearchResults([]);
        setIsSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(searchDelayed);
      abortController.abort();
    };
  }, [searchQuery, onSearch]);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const renderStructureItem = (item: LessonStructure, level: number = 0) => {
    const isExpanded = expandedFolders.has(item.id);
    const paddingLeft = `${level * 20 + 12}px`;

    if (item.type === 'folder') {
      return (
        <div key={item.id} className="folder-item">
          <div
            className="folder-header"
            style={{ paddingLeft }}
            onClick={() => toggleFolder(item.id)}
          >
            <div className="folder-icon">
              {isExpanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </div>
            <Folder size={16} />
            <span className="folder-name">{item.name}</span>
          </div>
          {isExpanded && item.children && (
            <div className="folder-children">
              {item.children.map(child => renderStructureItem(child, level + 1))}
            </div>
          )}
        </div>
      );
    }

    const handleLessonClick = () => {
      const isPremiumLesson = item.path.includes('Средний уровень (Подписка)') || item.path.includes('🎓');
      
      if (isPremiumLesson && !isSubscribed) {
        onSubscriptionRequired();
        return;
      }
      
      onLessonSelect(item.path);
    };

    return (
      <div
        key={item.id}
        className="lesson-item"
        style={{ paddingLeft }}
        onClick={handleLessonClick}
      >
        <File size={16} />
        <span className="lesson-name">{item.name}</span>
      </div>
    );
  };

  const renderSearchResults = () => {
    if (isSearching) {
      return <div className="search-loading">Searching...</div>;
    }

    if (searchResults.length === 0 && searchQuery.trim()) {
      return <div className="no-results">No results found</div>;
    }

    return searchResults.map(result => (
      <div
        key={result.id}
        className={`search-result ${result.type}`}
        onClick={() => {
          if (result.type === 'lesson') {
            const isPremiumLesson = result.path.includes('Средний уровень (Подписка)') || result.path.includes('🎓');
            
            if (isPremiumLesson && !isSubscribed) {
              onSubscriptionRequired();
              return;
            }
            
            onLessonSelect(result.path);
            setSearchQuery('');
            setSearchResults([]);
          }
        }}
      >
        {result.type === 'lesson' ? <File size={16} /> : <Folder size={16} />}
        <span>{result.name}</span>
      </div>
    ));
  };

  return (
    <>
      <button className={`sidebar-toggle ${isOpen ? 'hidden' : ''}`} onClick={onToggle}>
        <Menu size={20} />
      </button>

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>Lessons</h2>
          <button className="close-button" onClick={onToggle}>
            <X size={20} />
          </button>
        </div>

        <div className="search-container">
          <div className="search-input-wrapper">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search lessons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        <div className="sidebar-content">
          {searchQuery.trim() ? (
            <div className="search-results">
              {renderSearchResults()}
            </div>
          ) : (
            <div className="lesson-tree">
              {structure.map(item => renderStructureItem(item))}
            </div>
          )}
        </div>
      </aside>

      {isOpen && <div className="sidebar-overlay" onClick={onToggle} />}
    </>
  );
};

export default Sidebar;