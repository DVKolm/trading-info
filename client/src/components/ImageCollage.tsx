import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, Loader } from 'lucide-react';
import './ImageCollage.css';

interface ImageItem {
  src: string;
  alt?: string;
  caption?: string;
}

interface ImageCollageProps {
  images: ImageItem[];
  maxHeight?: number;
  gap?: number;
  showCaptions?: boolean;
  lazyLoad?: boolean;
  className?: string;
}

const ImageCollage: React.FC<ImageCollageProps> = ({
  images,
  maxHeight = 400,
  gap = 8,
  showCaptions = false,
  lazyLoad = true,
  className = ''
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [loadingImages, setLoadingImages] = useState<Set<number>>(new Set());
  const collageRef = useRef<HTMLDivElement>(null);

  const getGridLayout = (count: number) => {
    switch (count) {
      case 1:
        return { columns: 1, rows: 1 };
      case 2:
        return { columns: 2, rows: 1 };
      case 3:
        return { columns: 3, rows: 1 };
      case 4:
        return { columns: 2, rows: 2 };
      case 5:
        return { columns: 3, rows: 2 };
      case 6:
        return { columns: 3, rows: 2 };
      default:
        const columns = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / columns);
        return { columns, rows };
    }
  };

  const { columns, rows } = getGridLayout(images.length);

  const handleImageLoad = useCallback((index: number) => {
    setLoadedImages(prev => new Set(prev).add(index));
    setLoadingImages(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  }, []);

  const handleImageClick = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedIndex(null);
  }, []);

  const handlePrevious = useCallback(() => {
    if (selectedIndex !== null) {
      setSelectedIndex(prev => 
        prev === 0 ? images.length - 1 : (prev || 1) - 1
      );
    }
  }, [selectedIndex, images.length]);

  const handleNext = useCallback(() => {
    if (selectedIndex !== null) {
      setSelectedIndex(prev => 
        prev === images.length - 1 ? 0 : (prev || 0) + 1
      );
    }
  }, [selectedIndex, images.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIndex === null) return;
      
      switch (e.key) {
        case 'Escape':
          handleCloseModal();
          break;
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'ArrowRight':
          handleNext();
          break;
      }
    };

    if (selectedIndex !== null) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [selectedIndex, handleCloseModal, handlePrevious, handleNext]);

  const handleImageError = useCallback((index: number) => {
    setLoadingImages(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
  }, []);

  const startImageLoad = useCallback((index: number) => {
    if (!loadedImages.has(index) && !loadingImages.has(index)) {
      setLoadingImages(prev => new Set(prev).add(index));
    }
  }, [loadedImages, loadingImages]);

  useEffect(() => {
    if (!lazyLoad) {
      images.forEach((_, index) => startImageLoad(index));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-index') || '0');
            startImageLoad(index);
          }
        });
      },
      { threshold: 0.1 }
    );

    const imageElements = collageRef.current?.querySelectorAll('.image-placeholder');
    imageElements?.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [images, lazyLoad, startImageLoad]);

  if (!images.length) return null;

  return (
    <>
      <div 
        ref={collageRef}
        className={`image-collage ${className}`}
        style={{
          '--columns': columns,
          '--rows': rows,
          '--gap': `${gap}px`,
          '--max-height': `${maxHeight}px`
        } as React.CSSProperties}
      >
        {images.map((image, index) => (
          <div
            key={index}
            className="image-item"
            data-index={index}
          >
            <div 
              className="image-placeholder"
              data-index={index}
              onClick={() => handleImageClick(index)}
            >
              {loadingImages.has(index) && (
                <div className="image-loading">
                  <Loader className="loading-spinner" size={24} />
                </div>
              )}
              
              {(loadedImages.has(index) || !lazyLoad) && (
                <img
                  src={image.src}
                  alt={image.alt || `Image ${index + 1}`}
                  onLoad={() => handleImageLoad(index)}
                  onError={() => handleImageError(index)}
                  className="collage-image"
                />
              )}
              
              <div className="image-overlay">
                <ZoomIn size={20} />
              </div>
            </div>
            
            {showCaptions && image.caption && (
              <div className="image-caption">
                {image.caption}
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedIndex !== null && (
        <div className="image-modal" onClick={handleCloseModal}>
          <div className="modal-backdrop" />
          
          <button 
            className="modal-close"
            onClick={handleCloseModal}
            aria-label="Close modal"
          >
            <X size={24} />
          </button>

          {images.length > 1 && (
            <>
              <button
                className="modal-nav modal-prev"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevious();
                }}
                aria-label="Previous image"
              >
                <ChevronLeft size={32} />
              </button>
              
              <button
                className="modal-nav modal-next"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNext();
                }}
                aria-label="Next image"
              >
                <ChevronRight size={32} />
              </button>
            </>
          )}

          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <img
              src={images[selectedIndex].src}
              alt={images[selectedIndex].alt || `Image ${selectedIndex + 1}`}
              className="modal-image"
            />
            
            {showCaptions && images[selectedIndex].caption && (
              <div className="modal-caption">
                {images[selectedIndex].caption}
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="modal-counter">
              {selectedIndex + 1} / {images.length}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default ImageCollage;