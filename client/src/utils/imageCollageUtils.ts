interface ImageItem {
  src: string;
  alt?: string;
  caption?: string;
}

/**
 * Converts markdown image syntax to ImageCollage format
 * Supports both standard markdown and Obsidian-style image references
 * 
 * Examples:
 * ![Alt text](image.jpg) -> { src: 'image.jpg', alt: 'Alt text' }
 * ![[Image.png]] -> { src: 'Image.png', alt: 'Image.png' }
 * ![Alt text](image.jpg "Caption") -> { src: 'image.jpg', alt: 'Alt text', caption: 'Caption' }
 */
export const parseMarkdownImages = (markdownText: string): ImageItem[] => {
  const images: ImageItem[] = [];
  
  // Standard markdown image pattern: ![alt](src "optional title")
  const standardPattern = /!\[([^\]]*)\]\(([^)]+?)(?:\s+"([^"]+)")?\)/g;
  let match;
  
  while ((match = standardPattern.exec(markdownText)) !== null) {
    const [, alt, src, caption] = match;
    images.push({
      src: src.trim(),
      alt: alt || undefined,
      caption: caption || undefined
    });
  }
  
  // Obsidian-style image pattern: ![[filename]]
  const obsidianPattern = /!\[\[([^\]]+)\]\]/g;
  
  while ((match = obsidianPattern.exec(markdownText)) !== null) {
    const [, filename] = match;
    const cleanFilename = filename.trim();
    images.push({
      src: cleanFilename,
      alt: cleanFilename,
    });
  }
  
  return images;
};

/**
 * Extracts image paths from an array of markdown lines
 */
export const extractImagesFromLines = (lines: string[]): ImageItem[] => {
  const markdownText = lines.join('\n');
  return parseMarkdownImages(markdownText);
};

/**
 * Converts an array of image paths/URLs to ImageCollage format
 */
export const createImageItemsFromPaths = (
  imagePaths: string[], 
  options?: {
    altPrefix?: string;
    captionPrefix?: string;
    basePath?: string;
  }
): ImageItem[] => {
  const { altPrefix = 'Image', captionPrefix, basePath = '' } = options || {};
  
  return imagePaths.map((path, index) => {
    const fullPath = basePath ? `${basePath}/${path}` : path;
    const filename = path.split('/').pop()?.split('.')[0] || `${index + 1}`;
    
    return {
      src: fullPath,
      alt: `${altPrefix} ${index + 1}`,
      caption: captionPrefix ? `${captionPrefix} ${filename}` : undefined
    };
  });
};

/**
 * Groups sequential markdown images for replacement with ImageCollage
 * Returns groups of 2+ consecutive images that can be converted to collages
 */
export const findImageGroups = (
  markdownLines: string[], 
  minGroupSize: number = 2
): Array<{
  startIndex: number;
  endIndex: number;
  images: ImageItem[];
}> => {
  const groups: Array<{
    startIndex: number;
    endIndex: number;
    images: ImageItem[];
  }> = [];
  
  let currentGroup: ImageItem[] = [];
  let groupStart = -1;
  
  markdownLines.forEach((line, index) => {
    const lineImages = parseMarkdownImages(line);
    
    if (lineImages.length > 0) {
      if (currentGroup.length === 0) {
        groupStart = index;
      }
      currentGroup.push(...lineImages);
    } else if (currentGroup.length > 0) {
      // End of current group
      if (currentGroup.length >= minGroupSize) {
        groups.push({
          startIndex: groupStart,
          endIndex: index - 1,
          images: currentGroup
        });
      }
      currentGroup = [];
      groupStart = -1;
    }
  });
  
  // Handle group at end of content
  if (currentGroup.length >= minGroupSize) {
    groups.push({
      startIndex: groupStart,
      endIndex: markdownLines.length - 1,
      images: currentGroup
    });
  }
  
  return groups;
};

/**
 * Validates image URLs/paths
 */
export const validateImageSrc = (src: string): boolean => {
  // Check if it's a valid URL
  try {
    new URL(src);
    return true;
  } catch {
    // Check if it's a valid relative path
    return /^[./]?[^<>:"|?*]+\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(src);
  }
};

/**
 * Filters out invalid images from an array
 */
export const filterValidImages = (images: ImageItem[]): ImageItem[] => {
  return images.filter(image => validateImageSrc(image.src));
};

/**
 * Creates a complete ImageCollage props object from various input formats
 */
export const createCollageProps = (
  input: string | string[] | ImageItem[],
  options?: {
    maxHeight?: number;
    showCaptions?: boolean;
    lazyLoad?: boolean;
    gap?: number;
    basePath?: string;
    validateImages?: boolean;
  }
) => {
  const {
    maxHeight = 400,
    showCaptions = false,
    lazyLoad = true,
    gap = 8,
    basePath,
    validateImages = true
  } = options || {};

  let images: ImageItem[];

  if (typeof input === 'string') {
    // Parse markdown string
    images = parseMarkdownImages(input);
  } else if (Array.isArray(input)) {
    if (typeof input[0] === 'string') {
      // Array of image paths
      images = createImageItemsFromPaths(input as string[], { basePath });
    } else {
      // Already ImageItem array
      images = input as ImageItem[];
    }
  } else {
    images = [];
  }

  if (validateImages) {
    images = filterValidImages(images);
  }

  return {
    images,
    maxHeight,
    showCaptions,
    lazyLoad,
    gap
  };
};