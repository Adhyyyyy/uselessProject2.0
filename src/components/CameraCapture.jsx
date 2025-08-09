import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CameraCapture = ({ onPhotosReady, onCancel }) => {
  const videoRef = useRef();
  const canvasRef = useRef();
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [currentStep, setCurrentStep] = useState('setup'); // 'setup', 'capture', 'review'
  const [countdown, setCountdown] = useState(null);
  const [error, setError] = useState(null);

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        setCurrentStep('capture');
        setError(null);
      }
    } catch (err) {
      console.error('Camera access denied:', err);
      setError('Camera access denied. Please allow camera permission and try again.');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Capture photo with countdown
  const capturePhoto = () => {
    setCountdown(3);
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          // Actual photo capture
          setTimeout(() => {
            takePhoto();
            setCountdown(null);
          }, 500);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Take the actual photo
  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video && canvas) {
      const context = canvas.getContext('2d');
      
      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw video frame to canvas
      context.drawImage(video, 0, 0);
      
      // Convert to blob and store
      canvas.toBlob((blob) => {
        const imageUrl = URL.createObjectURL(blob);
        const newPhoto = {
          id: Date.now() + Math.random(),
          url: imageUrl,
          blob: blob
        };
        
        setCapturedPhotos(prev => [...prev, newPhoto]);
      }, 'image/jpeg', 0.8);
    }
  };

  // Remove photo
  const removePhoto = (photoId) => {
    setCapturedPhotos(prev => {
      const photoToRemove = prev.find(p => p.id === photoId);
      if (photoToRemove) {
        URL.revokeObjectURL(photoToRemove.url);
      }
      return prev.filter(p => p.id !== photoId);
    });
  };

  // Complete setup
  const completeSetup = () => {
    if (capturedPhotos.length >= 3) {
      stopCamera();
      onPhotosReady(capturedPhotos);
    }
  };

  // Cancel setup
  const handleCancel = () => {
    stopCamera();
    // Clean up blob URLs
    capturedPhotos.forEach(photo => {
      URL.revokeObjectURL(photo.url);
    });
    onCancel();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      capturedPhotos.forEach(photo => {
        URL.revokeObjectURL(photo.url);
      });
    };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
    >
      <div className="bg-gray-900 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-yellow-400 mb-2">
            Add Your Falling Objects
          </h2>
          <p className="text-gray-300">
            Capture 3-8 photos to use as your bouncing objects
          </p>
          <div className="text-sm text-gray-400 mt-2">
            Photos captured: {capturedPhotos.length}/8
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-600 text-white p-3 rounded-lg mb-4 text-center">
            {error}
          </div>
        )}

        {/* Setup Step */}
        {currentStep === 'setup' && (
          <div className="text-center">
            <div className="mb-6">
              <div className="text-6xl mb-4">📷</div>
              <p className="text-gray-300 mb-6">
                Ready to capture some hilarious falling objects? 
                Click below to start your camera!
              </p>
            </div>
            
            <div className="flex gap-4 justify-center">
              <button
                onClick={startCamera}
                className="px-8 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500 transition-colors"
              >
                Start Camera
              </button>
              <button
                onClick={handleCancel}
                className="px-8 py-3 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-500 transition-colors"
              >
                Skip for Now
              </button>
            </div>
          </div>
        )}

        {/* Capture Step */}
        {currentStep === 'capture' && cameraActive && (
          <div className="space-y-6">
            {/* Camera Feed */}
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full max-w-md mx-auto block rounded-lg"
              />
              
              {/* Countdown Overlay */}
              {countdown && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <motion.div
                    key={countdown}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-8xl font-bold text-yellow-400"
                  >
                    {countdown}
                  </motion.div>
                </div>
              )}
              
              {/* Face Guide Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border-4 border-yellow-400 border-dashed rounded-full opacity-50"></div>
              </div>
            </div>

            {/* Controls */}
            <div className="text-center">
              <button
                onClick={capturePhoto}
                disabled={countdown !== null}
                className="px-8 py-3 bg-yellow-600 text-black font-bold rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {countdown ? 'Get Ready!' : 'Capture Photo'}
              </button>
            </div>

            {/* Hidden canvas for photo processing */}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}

        {/* Photo Gallery */}
        {capturedPhotos.length > 0 && (
          <div className="mt-6">
            <h3 className="text-xl font-bold text-white mb-4">Your Objects:</h3>
            <div className="grid grid-cols-4 gap-4 mb-6">
              {capturedPhotos.map((photo) => (
                <div key={photo.id} className="relative group">
                  <img
                    src={photo.url}
                    alt="Captured object"
                    className="w-full h-24 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => removePhoto(photo.id)}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Controls */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-700">
          <button
            onClick={handleCancel}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors"
          >
            Cancel
          </button>
          
          <div className="flex gap-4">
            {cameraActive && capturedPhotos.length < 8 && (
              <span className="text-gray-400 text-sm self-center">
                Capture {3 - capturedPhotos.length > 0 ? 3 - capturedPhotos.length : 0} more (minimum 3)
              </span>
            )}
            
            <button
              onClick={completeSetup}
              disabled={capturedPhotos.length < 3}
              className="px-8 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Game ({capturedPhotos.length} objects)
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default CameraCapture;
