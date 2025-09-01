import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ImageCollage from './ImageCollage';
import { findImageGroups } from '../utils/imageCollageUtils';

interface MarkdownImageProcessorProps {
  content: string;
  components?: any;
  minGroupSize?: number;
  collageMaxHeight?: number;
  showCaptions?: boolean;
  basePath?: string;
}

const MarkdownImageProcessor: React.FC<MarkdownImageProcessorProps> = ({
  content,
  components = {},
  minGroupSize = 2,
  collageMaxHeight = 400,
  showCaptions = false,
  basePath = ''
}) => {
  
  const { processedContent, imageGroupsData } = useMemo(() => {
    const lines = content.split('\n');
    const imageGroups = findImageGroups(lines, minGroupSize);
    
    if (imageGroups.length === 0) {
      return { processedContent: content, imageGroupsData: [] };
    }

    let processedLines = [...lines];
    const groupsData: any[] = [];

    // Process groups from end to beginning to avoid index issues
    for (let i = imageGroups.length - 1; i >= 0; i--) {
      const group = imageGroups[i];
      
      // Create a unique collage marker based on position
      const collageId = `COLLAGE_${group.startIndex}_${group.endIndex}_${i}`;
      const collageMarker = `<ImageCollage id="${collageId}" />`;
      
      // Convert images to proper format with base path
      const images = group.images.map((img, imgIndex) => ({
        src: basePath ? `${basePath}/${img.src}` : img.src,
        alt: img.alt || `Image ${imgIndex + 1}`,
        caption: showCaptions ? img.caption : undefined
      }));

      groupsData.unshift({
        id: collageId,
        images,
        maxHeight: collageMaxHeight,
        showCaptions: showCaptions
      });
      
      // Replace the image lines with our collage marker
      const beforeLines = processedLines.slice(0, group.startIndex);
      const afterLines = processedLines.slice(group.endIndex + 1);
      
      processedLines = [
        ...beforeLines,
        collageMarker,
        ...afterLines
      ];
    }

    return { 
      processedContent: processedLines.join('\n'), 
      imageGroupsData: groupsData 
    };
  }, [content, minGroupSize, basePath, collageMaxHeight, showCaptions]);


  // Enhanced components with ImageCollage support
  const enhancedComponents = useMemo(() => {
    return {
      ...components,
      // Handle our custom ImageCollage markers
      p: ({ children, ...props }: any) => {
        // Check if this paragraph contains an ImageCollage marker
        const childrenString = React.Children.toArray(children).join('');
        const collageMatch = childrenString.match(/<ImageCollage id="([^"]+)" \/>/);
        
        if (collageMatch) {
          const collageId = collageMatch[1];
          const collageData = imageGroupsData.find(group => group.id === collageId);
          
          if (collageData) {
            return (
              <ImageCollage
                images={collageData.images}
                maxHeight={collageData.maxHeight}
                showCaptions={collageData.showCaptions}
                lazyLoad={true}
                gap={8}
              />
            );
          }
        }

        // If there's a custom p component in the original components, use it
        if (components.p) {
          return components.p({ children, ...props });
        }

        // Default paragraph rendering
        return <p {...props}>{children}</p>;
      }
    };
  }, [components, imageGroupsData]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={enhancedComponents}
    >
      {processedContent}
    </ReactMarkdown>
  );
};

export default MarkdownImageProcessor;