import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react';
import { Lesson } from '../types';

interface LessonViewerProps {
  lesson: Lesson;
  onNavigateToLesson?: (lessonPath: string) => void;
  onBack?: () => void;
  nextLessonPath?: string | null;
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
  const [loaded, setLoaded] = useState(() => imageCache.has(src));
  const [error, setError] = useState(false);

  const handleLoad = () => {
    imageCache.add(src);
    setLoaded(true);
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
      {!loaded && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'var(--bg-tertiary)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '14px',
          textAlign: 'center',
          border: '1px solid var(--border-color)',
          zIndex: 1
        }}>
          ⏳ Загрузка изображения...
        </div>
      )}
      
      <img
        src={src}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        style={{
          maxWidth: '100%',
          height: 'auto',
          borderRadius: '8px',
          display: 'block',
          opacity: loaded ? 1 : 0,
          transition: loaded ? 'opacity 0.2s ease-in-out' : 'none'
        }}
      />
    </div>
  );
};

const LessonViewer: React.FC<LessonViewerProps> = ({ lesson, onNavigateToLesson, onBack, nextLessonPath }) => {

  // Process Obsidian-style internal links [[Link Name]] and images
  const processObsidianLinks = (content: string) => {
    // First, process image links ![[Image.png]] format
    let processedContent = content.replace(/!\[\[([^\]]+)\]\]/g, (match, linkText) => {
      const cleanLinkText = linkText.trim();
      
      // This is definitely an image since it uses ![[]] syntax
      if (cleanLinkText.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
        const filename = cleanLinkText.replace(/\s+/g, '');
        const apiUrl = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');
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
        const apiUrl = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');
        const encodedFilename = btoa(filename);
        
        return `![${cleanLinkText}](${apiUrl}/api/image/${encodedFilename})`;
      }
      
      // Create a clickable link that could trigger navigation to another lesson
      return `[${cleanLinkText}](#internal-link-${encodeURIComponent(cleanLinkText)})`;
    });
    
    return processedContent;
  };

  const processedContent = processObsidianLinks(lesson.content);

  const handleInternalLink = async (href: string) => {
    if (href.startsWith('#internal-link-')) {
      const linkText = decodeURIComponent(href.replace('#internal-link-', ''));
      
      try {
        const apiUrl = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');
        const response = await fetch(`${apiUrl}/api/lessons/resolve/${encodeURIComponent(linkText)}`);
        const data = await response.json();
        
        if (data.found && onNavigateToLesson) {
          onNavigateToLesson(data.path);
        } else {
          console.warn('Could not resolve internal link:', linkText);
          // Could show a toast or notification here
        }
      } catch (error) {
        console.error('Error resolving internal link:', error);
      }
    }
  };

  return (
    <div className="lesson-viewer">
      <div className="lesson-header">
        {lesson.frontmatter.title && (
          <h1 className="lesson-title">{lesson.frontmatter.title}</h1>
        )}
        {lesson.frontmatter.description && (
          <p className="lesson-description">{lesson.frontmatter.description}</p>
        )}
        {lesson.frontmatter.tags && (
          <div className="lesson-tags">
            {lesson.frontmatter.tags.map((tag: string, index: number) => (
              <span key={index} className="tag">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="lesson-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ className, children, ...props }) {
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
            a({ href, children, ...props }) {
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
            h1({ children, ...props }) {
              return <h1 className="lesson-h1" {...props}>{children}</h1>;
            },
            h2({ children, ...props }) {
              return <h2 className="lesson-h2" {...props}>{children}</h2>;
            },
            h3({ children, ...props }) {
              return <h3 className="lesson-h3" {...props}>{children}</h3>;
            },
            h4({ children, ...props }) {
              return <h4 className="lesson-h4" {...props}>{children}</h4>;
            },
            h5({ children, ...props }) {
              return <h5 className="lesson-h5" {...props}>{children}</h5>;
            },
            h6({ children, ...props }) {
              return <h6 className="lesson-h6" {...props}>{children}</h6>;
            },
            blockquote({ children, ...props }) {
              return <blockquote className="lesson-blockquote" {...props}>{children}</blockquote>;
            },
            ul({ children, ...props }) {
              return <ul className="lesson-ul" {...props}>{children}</ul>;
            },
            ol({ children, ...props }) {
              return <ol className="lesson-ol" {...props}>{children}</ol>;
            },
            li({ children, ...props }) {
              return <li className="lesson-li" {...props}>{children}</li>;
            },
            p({ children, ...props }) {
              return <p className="lesson-p" {...props}>{children}</p>;
            },
            strong({ children, ...props }) {
              return <strong className="lesson-strong" {...props}>{children}</strong>;
            },
            em({ children, ...props }) {
              return <em className="lesson-em" {...props}>{children}</em>;
            },
            table({ children, ...props }) {
              return <table className="lesson-table" {...props}>{children}</table>;
            },
            thead({ children, ...props }) {
              return <thead className="lesson-thead" {...props}>{children}</thead>;
            },
            tbody({ children, ...props }) {
              return <tbody className="lesson-tbody" {...props}>{children}</tbody>;
            },
            tr({ children, ...props }) {
              return <tr className="lesson-tr" {...props}>{children}</tr>;
            },
            th({ children, ...props }) {
              return <th className="lesson-th" {...props}>{children}</th>;
            },
            td({ children, ...props }) {
              return <td className="lesson-td" {...props}>{children}</td>;
            },
            img({ src, alt, ...props }) {
              return (
                <LazyImage
                  src={src || ''}
                  alt={alt || ''}
                  className="lesson-image"
                  style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', margin: '1rem 0' }}
                />
              );
            },
          }}
        >
          {processedContent}
        </ReactMarkdown>
      </div>

      {/* Navigation Panel */}
      <div className="lesson-navigation">
        {onBack && (
          <button 
            className="nav-button back-button"
            onClick={onBack}
            title="Вернуться к предыдущему уроку"
          >
            <ArrowLeft size={18} />
            Назад
          </button>
        )}
        
        <div className="nav-spacer"></div>
        
        {nextLessonPath && onNavigateToLesson && (
          <button 
            className="nav-button next-button"
            onClick={() => onNavigateToLesson(nextLessonPath)}
            title="Перейти к следующему уроку"
          >
            Следующий урок
            <ArrowRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

export default LessonViewer;