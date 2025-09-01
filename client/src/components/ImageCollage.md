# ImageCollage Component

A responsive image collage component that automatically arranges multiple images in an optimal grid format with interactive lightbox functionality.

## Features

- ✅ **Adaptive Grid Layout**: Automatically determines the best grid arrangement based on image count
- ✅ **Interactive Lightbox**: Click any image to open in full-screen modal
- ✅ **Keyboard Navigation**: Arrow keys, Escape to navigate and close
- ✅ **Responsive Design**: Optimized layouts for desktop, tablet, and mobile
- ✅ **Lazy Loading**: Images load only when visible for better performance  
- ✅ **Loading States**: Smooth loading animations and spinners
- ✅ **Hover Effects**: Subtle zoom and overlay effects on interaction
- ✅ **Touch Support**: Optimized for mobile and touch devices
- ✅ **Accessibility**: Screen reader friendly with proper ARIA labels
- ✅ **Theme Support**: Compatible with dark/light themes
- ✅ **Optional Captions**: Support for image captions below each image

## Grid Layouts by Image Count

- **1 image**: 1x1 grid (full width)
- **2 images**: 2x1 grid (side by side)  
- **3 images**: 3x1 grid (horizontal row)
- **4 images**: 2x2 grid (square formation)
- **5+ images**: Dynamic grid with balanced rows

## Responsive Breakpoints

- **Large Desktop (1200px+)**: Up to 4+ images per row
- **Desktop (768-1199px)**: Max 3 images per row  
- **Tablet (480-767px)**: Max 2 images per row
- **Mobile (< 480px)**: Single column stack

## Installation & Usage

### Basic Usage

```tsx
import React from 'react';
import ImageCollage from './components/ImageCollage';

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
    },
    {
      src: '/path/to/image3.jpg',
      alt: 'Description of image 3'
    }
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
};
```

### With Utility Functions

```tsx
import { createCollageProps, parseMarkdownImages } from '../utils/imageCollageUtils';

// From markdown string
const markdownText = `
![Alt text 1](image1.jpg "Caption 1")
![Alt text 2](image2.jpg)
![[obsidian-image.png]]
`;

const collageProps = createCollageProps(markdownText, {
  maxHeight: 350,
  showCaptions: true
});

return <ImageCollage {...collageProps} />;

// From image paths array  
const imagePaths = ['img1.jpg', 'img2.jpg', 'img3.jpg'];
const props = createCollageProps(imagePaths, {
  basePath: '/assets/images',
  showCaptions: false
});

return <ImageCollage {...props} />;
```

## Props API

### ImageCollageProps

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `images` | `ImageItem[]` | **required** | Array of image objects to display |
| `maxHeight` | `number` | `400` | Maximum height of the collage in pixels |
| `gap` | `number` | `8` | Space between images in pixels |
| `showCaptions` | `boolean` | `false` | Whether to display image captions |
| `lazyLoad` | `boolean` | `true` | Enable lazy loading for better performance |
| `className` | `string` | `''` | Additional CSS class names |

### ImageItem Interface

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `src` | `string` | ✅ | Image source URL or path |
| `alt` | `string` | ❌ | Alternative text for accessibility |
| `caption` | `string` | ❌ | Optional caption text displayed below image |

## Utility Functions

### parseMarkdownImages(markdownText: string)

Converts markdown image syntax to ImageCollage format.

**Supported formats:**
- `![Alt text](image.jpg)` - Standard markdown
- `![Alt text](image.jpg "Caption")` - With title/caption  
- `![[Image.png]]` - Obsidian-style references

```tsx
const images = parseMarkdownImages('![Demo](demo.jpg "Demo Caption")');
// Result: [{ src: 'demo.jpg', alt: 'Demo', caption: 'Demo Caption' }]
```

### createImageItemsFromPaths(paths: string[], options?)

Converts array of image paths to ImageItem format.

```tsx
const images = createImageItemsFromPaths(
  ['img1.jpg', 'img2.jpg'], 
  {
    altPrefix: 'Gallery Image',
    basePath: '/assets',
    captionPrefix: 'Photo:'
  }
);
```

### findImageGroups(markdownLines: string[], minGroupSize?)

Finds groups of consecutive markdown images that can be converted to collages.

```tsx
const groups = findImageGroups(markdownLines, 2);
// Returns groups of 2+ consecutive images with their line positions
```

### createCollageProps(input, options?)

Creates complete ImageCollage props from various input formats.

```tsx
// From markdown string
const props1 = createCollageProps(markdownString, { maxHeight: 300 });

// From image paths
const props2 = createCollageProps(['img1.jpg', 'img2.jpg'], {
  showCaptions: true,
  basePath: '/images'
});

// From ImageItem array (with validation)
const props3 = createCollageProps(imageItems, { validateImages: true });
```

## Keyboard Controls

When lightbox modal is open:

- **Escape**: Close modal
- **Arrow Left**: Previous image
- **Arrow Right**: Next image
- **Click backdrop**: Close modal

## Accessibility Features

- Proper ARIA labels for all interactive elements
- Keyboard navigation support
- Screen reader compatible alt text
- Focus management in modal
- High contrast mode support
- Reduced motion support for animations

## Styling & Theming

The component uses CSS custom properties that integrate with your theme:

```css
:root {
  --bg-primary: #1e1e1e;
  --bg-secondary: #2d2d2d; 
  --text-primary: #dcddde;
  --text-secondary: #b9bbbe;
  --accent-primary: #7c3aed;
  --border-color: #40444b;
}
```

### Custom Styling

```css
.image-collage {
  border-radius: 12px; /* Custom border radius */
}

.image-collage .image-placeholder {
  border: 2px solid var(--accent-primary); /* Custom borders */
}

.image-collage .modal-image {
  border-radius: 16px; /* Custom modal styling */
}
```

## Performance Considerations

- **Lazy Loading**: Images load only when scrolled into view
- **Intersection Observer**: Efficient viewport detection
- **CSS Transforms**: Hardware-accelerated animations  
- **Event Delegation**: Optimized event handling
- **Memory Management**: Proper cleanup of event listeners
- **Image Optimization**: Supports modern formats (WebP, AVIF)

## Browser Support

- ✅ Chrome 60+
- ✅ Firefox 55+  
- ✅ Safari 12+
- ✅ Edge 79+
- ✅ Mobile Safari 12+
- ✅ Chrome Mobile 60+

## Migration from Sequential Images

Replace this:

```markdown
![Image 1](img1.jpg)
![Image 2](img2.jpg)  
![Image 3](img3.jpg)
```

With this:

```tsx
const images = [
  { src: 'img1.jpg', alt: 'Image 1' },
  { src: 'img2.jpg', alt: 'Image 2' },
  { src: 'img3.jpg', alt: 'Image 3' }
];

<ImageCollage images={images} />
```

Or use the utility function:

```tsx
const props = createCollageProps(`
![Image 1](img1.jpg)
![Image 2](img2.jpg)
![Image 3](img3.jpg)
`);

<ImageCollage {...props} />
```

## Examples

See `ImageCollageDemo.tsx` for comprehensive examples of all features and configurations.