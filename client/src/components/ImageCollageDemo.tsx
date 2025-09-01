import React, { useState } from 'react';
import ImageCollage from './ImageCollage';

const ImageCollageDemo: React.FC = () => {
  const [showCaptions, setShowCaptions] = useState(false);

  const sampleImages = [
    {
      src: 'https://picsum.photos/400/300?random=1',
      alt: 'Sample image 1',
      caption: 'Beautiful landscape with mountains and lake'
    },
    {
      src: 'https://picsum.photos/400/300?random=2', 
      alt: 'Sample image 2',
      caption: 'Urban cityscape at sunset'
    },
    {
      src: 'https://picsum.photos/400/300?random=3',
      alt: 'Sample image 3', 
      caption: 'Nature photography with vibrant colors'
    },
    {
      src: 'https://picsum.photos/400/300?random=4',
      alt: 'Sample image 4',
      caption: 'Abstract architectural design'
    },
    {
      src: 'https://picsum.photos/400/300?random=5',
      alt: 'Sample image 5',
      caption: 'Wildlife in natural habitat'
    },
    {
      src: 'https://picsum.photos/400/300?random=6',
      alt: 'Sample image 6',
      caption: 'Artistic black and white photography'
    }
  ];

  const createTestSet = (count: number) => sampleImages.slice(0, count);

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ color: 'var(--text-primary)', marginBottom: '2rem' }}>
        ImageCollage Component Demo
      </h2>

      <div style={{ marginBottom: '2rem' }}>
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem',
          color: 'var(--text-secondary)',
          cursor: 'pointer'
        }}>
          <input 
            type="checkbox" 
            checked={showCaptions}
            onChange={(e) => setShowCaptions(e.target.checked)}
          />
          Show captions
        </label>
      </div>

      <div style={{ marginBottom: '3rem' }}>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>
          Single Image
        </h3>
        <ImageCollage 
          images={createTestSet(1)} 
          showCaptions={showCaptions}
          maxHeight={300}
        />
      </div>

      <div style={{ marginBottom: '3rem' }}>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>
          Two Images (2x1 Grid)
        </h3>
        <ImageCollage 
          images={createTestSet(2)} 
          showCaptions={showCaptions}
          maxHeight={300}
        />
      </div>

      <div style={{ marginBottom: '3rem' }}>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>
          Three Images (3x1 Grid)
        </h3>
        <ImageCollage 
          images={createTestSet(3)} 
          showCaptions={showCaptions}
          maxHeight={300}
        />
      </div>

      <div style={{ marginBottom: '3rem' }}>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>
          Four Images (2x2 Grid)
        </h3>
        <ImageCollage 
          images={createTestSet(4)} 
          showCaptions={showCaptions}
          maxHeight={400}
        />
      </div>

      <div style={{ marginBottom: '3rem' }}>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>
          Five Images (3x2 Grid)
        </h3>
        <ImageCollage 
          images={createTestSet(5)} 
          showCaptions={showCaptions}
          maxHeight={400}
        />
      </div>

      <div style={{ marginBottom: '3rem' }}>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>
          Six Images (3x2 Grid)
        </h3>
        <ImageCollage 
          images={createTestSet(6)} 
          showCaptions={showCaptions}
          maxHeight={450}
        />
      </div>

      <div style={{ marginTop: '4rem', padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>
          Usage Example
        </h3>
        <pre style={{ 
          backgroundColor: 'var(--code-bg)', 
          color: 'var(--text-primary)',
          padding: '1rem',
          borderRadius: '4px',
          overflow: 'auto',
          fontSize: '0.9rem',
          lineHeight: '1.4'
        }}>
{`import ImageCollage from './components/ImageCollage';

const MyComponent = () => {
  const images = [
    {
      src: '/path/to/image1.jpg',
      alt: 'Description of image 1',
      caption: 'Optional caption for image 1'
    },
    {
      src: '/path/to/image2.jpg',
      alt: 'Description of image 2',
      caption: 'Optional caption for image 2'
    }
    // ... more images
  ];

  return (
    <ImageCollage 
      images={images}
      maxHeight={400}
      showCaptions={true}
      lazyLoad={true}
      gap={8}
    />
  );
};`}
        </pre>
      </div>

      <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px' }}>
        <h4 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>
          Features:
        </h4>
        <ul style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          <li>✅ Adaptive grid layout based on image count</li>
          <li>✅ Click any image to open full-screen lightbox</li>
          <li>✅ Keyboard navigation (Arrow keys, Escape)</li>
          <li>✅ Responsive design for mobile/tablet/desktop</li>
          <li>✅ Lazy loading for better performance</li>
          <li>✅ Hover effects and loading states</li>
          <li>✅ Optional captions support</li>
          <li>✅ Dark/light theme compatibility</li>
          <li>✅ Touch-friendly for mobile devices</li>
        </ul>
      </div>
    </div>
  );
};

export default ImageCollageDemo;