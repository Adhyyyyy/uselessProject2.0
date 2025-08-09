/**
 * Image processing utilities for game objects
 */

/**
 * Convert captured photos to circular game objects
 * @param {Array} photos - Array of photo objects with blob data
 * @returns {Promise<Array>} Array of processed image data URLs
 */
export const processPhotosForGame = async (photos) => {
  const processedPhotos = [];
  
  for (const photo of photos) {
    try {
      const processedImage = await createCircularImage(photo.blob);
      processedPhotos.push({
        id: photo.id,
        imageData: processedImage,
        originalUrl: photo.url
      });
    } catch (error) {
      console.error('Error processing photo:', error);
    }
  }
  
  return processedPhotos;
};

/**
 * Create a circular cropped version of the image
 * @param {Blob} imageBlob - Original image blob
 * @returns {Promise<string>} Data URL of processed circular image
 */
const createCircularImage = (imageBlob) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      // Set canvas size for circular crop (60x60 for game objects)
      const size = 60;
      canvas.width = size;
      canvas.height = size;
      
      // Calculate crop dimensions (square crop from center)
      const minDimension = Math.min(img.width, img.height);
      const cropX = (img.width - minDimension) / 2;
      const cropY = (img.height - minDimension) / 2;
      
      // Create circular clipping path
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      
      // Draw image to fit within circle
      ctx.drawImage(
        img,
        cropX, cropY, minDimension, minDimension, // Source rectangle (square crop)
        0, 0, size, size // Destination rectangle
      );
      
      // Convert to data URL
      resolve(canvas.toDataURL('image/png'));
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(imageBlob);
  });
};

/**
 * Store processed photos in localStorage
 * @param {Array} processedPhotos - Array of processed photo data
 */
export const storePhotosLocally = (processedPhotos) => {
  try {
    const photoData = processedPhotos.map(photo => ({
      id: photo.id,
      imageData: photo.imageData
    }));
    
    localStorage.setItem('gamePhotos', JSON.stringify(photoData));
    localStorage.setItem('gamePhotosTimestamp', Date.now().toString());
  } catch (error) {
    console.error('Error storing photos locally:', error);
  }
};

/**
 * Load stored photos from localStorage
 * @returns {Array|null} Array of stored photos or null if none found
 */
export const loadStoredPhotos = () => {
  try {
    const photoData = localStorage.getItem('gamePhotos');
    const timestamp = localStorage.getItem('gamePhotosTimestamp');
    
    if (!photoData || !timestamp) return null;
    
    // Check if photos are less than 24 hours old
    const age = Date.now() - parseInt(timestamp);
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    if (age > maxAge) {
      // Photos are too old, clear them
      clearStoredPhotos();
      return null;
    }
    
    return JSON.parse(photoData);
  } catch (error) {
    console.error('Error loading stored photos:', error);
    return null;
  }
};

/**
 * Clear stored photos from localStorage
 */
export const clearStoredPhotos = () => {
  localStorage.removeItem('gamePhotos');
  localStorage.removeItem('gamePhotosTimestamp');
};

/**
 * Create a Matter.js texture from image data
 * @param {string} imageData - Data URL of the image
 * @returns {Object} Texture object for Matter.js
 */
export const createMatterTexture = (imageData) => {
  return {
    texture: imageData,
    xScale: 1,
    yScale: 1
  };
};
