import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ArrowLeft, ArrowRight, Menu } from 'lucide-react';
import { Lesson } from '../types';
import { useProgressTracking } from '../hooks/useProgressTracking';
import MarkdownImageProcessor from './MarkdownImageProcessor';

interface LessonViewerProps {
  lesson: Lesson;
  onNavigateToLesson?: (lessonPath: string) => void;
  nextLessonPath?: string | null;
  prevLessonPath?: string | null;
  onSidebarToggle?: () => void;
  isSubscribed?: boolean;
  onSubscriptionRequired?: () => void;
}

// Image cache to prevent reloading
const imageCache = new Set<string>();

// Lazy loading image component
interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}

const LazyImage: React.FC<LazyImageProps> = ({ src, alt, className, style }) => {
  const [error, setError] = useState(false);

  const handleLoad = () => {
    imageCache.add(src);
  };

  const handleError = () => {
    setError(true);
  };

  if (error) {
    return (
      <div 
        className={className}
        style={{
          minHeight: '200px',
          backgroundColor: 'var(--bg-tertiary)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--error-color)',
          fontSize: '14px',
          textAlign: 'center',
          padding: '20px',
          border: '1px solid var(--border-color)',
          margin: '1rem 0',
          flexDirection: 'column',
          gap: '0.5rem',
          ...style
        }}
      >
        <span style={{ fontSize: '24px' }}>❌</span>
        <span>Не удалось загрузить изображение</span>
        <small style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{alt}</small>
      </div>
    );
  }

  return (
    <div 
      className={className}
      style={{
        position: 'relative',
        margin: '1rem 0',
        ...style
      }}
    >      
      <img
        src={src}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        style={{
          maxWidth: '100%',
          height: 'auto',
          borderRadius: '8px',
          display: 'block'
        }}
      />
    </div>
  );
};

const LessonViewer: React.FC<LessonViewerProps> = React.memo(({ lesson, onNavigateToLesson, nextLessonPath, prevLessonPath, onSidebarToggle, isSubscribed, onSubscriptionRequired }) => {
  const { handleScroll } = useProgressTracking(lesson);
  const lessonViewerRef = useRef<HTMLDivElement>(null);

  // Check if a lesson is premium/requires subscription
  const isPremiumLesson = useCallback((lessonPath: string) => {
    return lessonPath.includes('Средний уровень (Подписка)') || lessonPath.includes('🎓');
  }, []);

  // Enhanced navigation handler with subscription check
  const handleNavigateToLesson = useCallback((lessonPath: string) => {
    if (isPremiumLesson(lessonPath) && !isSubscribed) {
      onSubscriptionRequired?.();
      return;
    }
    onNavigateToLesson?.(lessonPath);
  }, [isPremiumLesson, isSubscribed, onSubscriptionRequired, onNavigateToLesson]);


  // Memoized process Obsidian-style internal links [[Link Name]] and images
  const processedContent = useMemo(() => {
    const processObsidianLinks = (content: string) => {
      // First, replace <br> tags with double line breaks for better spacing
      let processedContent = content.replace(/<br\s*\/?>/gi, '\n\n&nbsp;\n\n');
      
      // Then, process image links ![[Image.png]] format
      processedContent = processedContent.replace(/!\[\[([^\]]+)\]\]/g, (match, linkText) => {
        const cleanLinkText = linkText.trim();
        
        // This is definitely an image since it uses ![[]] syntax
        if (cleanLinkText.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
          const filename = cleanLinkText.replace(/\s+/g, '');
          const apiUrl = process.env.REACT_APP_API_URL || '';
          const encodedFilename = btoa(filename);
          
          return `![${cleanLinkText}](${apiUrl}/api/image/${encodedFilename})`;
        }
        
        // If it's not an image, treat as regular link
        return `[${cleanLinkText}](#internal-link-${encodeURIComponent(cleanLinkText)})`;
      });
      
      // Then, process regular internal links [[Link Name]]
      processedContent = processedContent.replace(/\[\[([^\]]+)\]\]/g, (match, linkText) => {
        const cleanLinkText = linkText.trim();
        
        // Check if it's an image (has image extension)
        if (cleanLinkText.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
          const filename = cleanLinkText.replace(/\s+/g, '');
          const apiUrl = process.env.REACT_APP_API_URL || '';
          const encodedFilename = btoa(filename);
          
          return `![${cleanLinkText}](${apiUrl}/api/image/${encodedFilename})`;
        }
        
        // Create a clickable link that could trigger navigation to another lesson
        return `[${cleanLinkText}](#internal-link-${encodeURIComponent(cleanLinkText)})`;
      });
      
      return processedContent;
    };

    return processObsidianLinks(lesson.content);
  }, [lesson.content]);

  // Determine if this is a sub-file (checklist, settings, etc.) and find parent lesson
  const isSubFile = useMemo(() => {
    const filename = lesson.path.split('/').pop() || '';
    return filename.includes('Чек-лист') || 
           filename.includes('Настройки') || 
           filename.includes('Сигналы') ||
           (lesson.path.includes('Урок') && !filename.match(/^Урок \d+\./));
  }, [lesson.path]);

  const parentLessonPath = useMemo(() => {
    if (!isSubFile) return null;
    
    // Extract lesson number from path
    const lessonMatch = lesson.path.match(/Урок (\d+)/);
    if (!lessonMatch) return null;
    
    const lessonNumber = lessonMatch[1];
    const lessonDir = lesson.path.substring(0, lesson.path.lastIndexOf('/'));
    
    // Find the main lesson file in the same directory - try different patterns
    const basePath = lessonDir.split('/').pop() || '';
    const possibleMainFiles = [
      `${lessonDir}/Урок ${lessonNumber}. ${basePath.replace(/^Урок \d+\.\s*/, '')}.md`,
      `${lessonDir}/Урок ${lessonNumber}.md`,
      `${lessonDir}/${basePath}.md`
    ];
    
    // Return the first possible match (we'll validate it exists when navigating)
    return possibleMainFiles[0];
  }, [isSubFile, lesson.path]);

  const handleInternalLink = useCallback(async (href: string) => {
    if (href.startsWith('#internal-link-')) {
      const linkText = decodeURIComponent(href.replace('#internal-link-', ''));
      
      try {
        const apiUrl = process.env.REACT_APP_API_URL || '';
        const response = await fetch(`${apiUrl}/api/lessons/resolve?name=${encodeURIComponent(linkText)}`);
        const data = await response.json();
        
        if (data.found) {
          handleNavigateToLesson(data.path);
        } else {
          // Could show a toast or notification here
          console.warn('Internal link not found:', linkText);
        }
      } catch (error) {
        console.error('Failed to resolve internal link:', error);
      }
    }
  }, [handleNavigateToLesson]);

  // Set up scroll tracking
  useEffect(() => {
    const handleScrollEvent = () => {
      if (!lessonViewerRef.current) return;
      
      const scrollPosition = lessonViewerRef.current.scrollTop;
      const maxScroll = lessonViewerRef.current.scrollHeight - lessonViewerRef.current.clientHeight;
      
      handleScroll(scrollPosition, maxScroll);
    };

    const currentRef = lessonViewerRef.current;
    if (currentRef) {
      currentRef.addEventListener('scroll', handleScrollEvent, { passive: true });
      return () => currentRef.removeEventListener('scroll', handleScrollEvent);
    }
  }, [handleScroll]);


  // Memoized markdown components
  const markdownComponents = useMemo(() => ({
    code({ className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      return match ? (
        <SyntaxHighlighter
          style={oneDark as any}
          language={match[1]}
          PreTag="div"
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    a({ href, children, ...props }: any) {
      if (href?.startsWith('#internal-link-')) {
        return (
          <a
            href={href}
            className="internal-link"
            onClick={(e) => {
              e.preventDefault();
              handleInternalLink(href);
            }}
            {...props}
          >
            {children}
          </a>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      );
    },
    h1({ children, ...props }: any) {
      return <h1 className="lesson-h1" {...props}>{children}</h1>;
    },
    h2({ children, ...props }: any) {
      return <h2 className="lesson-h2" {...props}>{children}</h2>;
    },
    h3({ children, ...props }: any) {
      return <h3 className="lesson-h3" {...props}>{children}</h3>;
    },
    h4({ children, ...props }: any) {
      return <h4 className="lesson-h4" {...props}>{children}</h4>;
    },
    h5({ children, ...props }: any) {
      return <h5 className="lesson-h5" {...props}>{children}</h5>;
    },
    h6({ children, ...props }: any) {
      return <h6 className="lesson-h6" {...props}>{children}</h6>;
    },
    blockquote({ children, ...props }: any) {
      return <blockquote className="lesson-blockquote" {...props}>{children}</blockquote>;
    },
    ul({ children, ...props }: any) {
      return <ul className="lesson-ul" {...props}>{children}</ul>;
    },
    ol({ children, ...props }: any) {
      return <ol className="lesson-ol" {...props}>{children}</ol>;
    },
    li({ children, ...props }: any) {
      return <li className="lesson-li" {...props}>{children}</li>;
    },
    p({ children, ...props }: any) {
      return <p className="lesson-p" {...props}>{children}</p>;
    },
    strong({ children, ...props }: any) {
      return <strong className="lesson-strong" {...props}>{children}</strong>;
    },
    em({ children, ...props }: any) {
      return <em className="lesson-em" {...props}>{children}</em>;
    },
    table({ children, ...props }: any) {
      return <table className="lesson-table" {...props}>{children}</table>;
    },
    thead({ children, ...props }: any) {
      return <thead className="lesson-thead" {...props}>{children}</thead>;
    },
    tbody({ children, ...props }: any) {
      return <tbody className="lesson-tbody" {...props}>{children}</tbody>;
    },
    tr({ children, ...props }: any) {
      return <tr className="lesson-tr" {...props}>{children}</tr>;
    },
    th({ children, ...props }: any) {
      return <th className="lesson-th" {...props}>{children}</th>;
    },
    td({ children, ...props }: any) {
      return <td className="lesson-td" {...props}>{children}</td>;
    },
    img({ src, alt, ...props }: any) {
      return (
        <LazyImage
          src={src || ''}
          alt={alt || ''}
          className="lesson-image"
          style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', margin: '1rem 0' }}
        />
      );
    },
    br({ ...props }: any) {
      return <br className="lesson-br" {...props} />;
    },
  }), [handleInternalLink]);

  return (
    <div className="lesson-viewer" ref={lessonViewerRef}>
      <div className="lesson-content">
        <MarkdownImageProcessor
          content={processedContent}
          components={markdownComponents}
          minGroupSize={2}
          collageMaxHeight={400}
          showCaptions={false}
        />
      </div>


      {/* Back to Main Lesson Button (for sub-files like checklists) */}
      {isSubFile && parentLessonPath && (
        <button 
          className="back-to-lesson-btn"
          onClick={() => handleNavigateToLesson(parentLessonPath)}
          title="Назад к уроку"
        >
          <ArrowLeft size={20} />
          <span>Назад к уроку</span>
        </button>
      )}

      {/* Floating Navigation Buttons */}
      <div className="floating-lesson-nav">
        {prevLessonPath && (
          <button 
            className="floating-nav-btn prev-btn"
            onClick={() => handleNavigateToLesson(prevLessonPath)}
            title="Предыдущий урок"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        
        {nextLessonPath && (
          <button 
            className="floating-nav-btn next-btn"
            onClick={() => handleNavigateToLesson(nextLessonPath)}
            title="Следующий урок"
          >
            <ArrowRight size={20} />
          </button>
        )}
      </div>

      {/* Floating Sidebar Toggle */}
      {onSidebarToggle && (
        <button className="floating-sidebar-toggle" onClick={onSidebarToggle}>
          <Menu size={20} />
        </button>
      )}

    </div>
  );
});

LessonViewer.displayName = 'LessonViewer';

export default LessonViewer;