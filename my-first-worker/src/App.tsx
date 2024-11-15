import React, { useState } from 'react';
import { RekognitionClient, CompareFacesCommand } from '@aws-sdk/client-rekognition';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';

import 'bootstrap/dist/css/bootstrap.min.css'; // Import Bootstrap CSS
import './ImageUpload.css';
import './App.css'

const ImageUpload = () => {
  const rekognitionClient = new RekognitionClient({
    region: 'ap-southeast-2', // Your AWS region
    credentials: fromCognitoIdentityPool({
      clientConfig: { region: 'ap-southeast-2' },
      identityPoolId: 'ap-southeast-2:e822749d-b54f-4456-94fe-cc1d8b9a88bb', // Your Cognito Identity Pool ID
    }),
  });
  

  const [images, setImages] = useState([]);  // Collection of images
  const [myImage, setMyImage] = useState(null);  // Single image for comparison
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [comparisonResults, setComparisonResults] = useState([]);
  const [matchedCount, setMatchedCount] = useState(0); // To store number of matched images


  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const fileUrls = files.map(file => URL.createObjectURL(file));
    setImages((prevImages) => [...prevImages, ...fileUrls]);
  };

  const handleClearImages = () => {
    setImages([]); // Reset the images array
    setMyImage(null)
    setMatchedCount(0);
  };

  const handleMyImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const fileUrl = URL.createObjectURL(file);
      setMyImage(fileUrl);
    }
  };

  const handleSuccessClick = async () => {
    if (!myImage || images.length === 0) {
      alert('Please upload at least one image in "My Image" and one image in the collection for comparison.');
      return;
    }
  
    setLoading(true);
    setError(null);
    setComparisonResults([]);
  
    try {
      const getBase64 = (file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      };
  
      // Convert images to base64 strings
      const myImageBlob = await fetch(myImage).then(res => res.blob());
      const myImageBase64 = await getBase64(myImageBlob);
  
      const newResults = [];
      let cMatch = 0;
      for (let i = 0; i < images.length; i++) {
        const imageUrl = images[i];
        const imageBlob = await fetch(imageUrl).then(res => res.blob());
        const imageBase64 = await getBase64(imageBlob);
  
        const payload = {
          SourceImage: { Bytes: Uint8Array.from(atob(myImageBase64), c => c.charCodeAt(0)) },
          TargetImage: { Bytes: Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0)) },
          SimilarityThreshold: 80, // Similarity threshold
        }

        console.log("payload", payload)

        const compareFacesCommand = new CompareFacesCommand(payload);                     

        const data = await rekognitionClient.send(compareFacesCommand);
        const matched = data.FaceMatches && data.FaceMatches.length > 0;
        if(matched){
          cMatch+=1;
        }
        newResults.push({
          index: i,
          matches: data.FaceMatches,
          matched,
          sourceImage: imageUrl,
        });
  
        if (newResults.length === images.length) {
          setLoading(false);
          setComparisonResults(newResults);
        }
      }
      setMatchedCount(cMatch)
    } catch (error) {
      setLoading(false);
      setError(error.message);
    }
  };
  

  return (
    <div className="image-upload-container">
      {/* <h2 className="collection-title">Collection</h2> */}

      <div className="image-upload">
        {/* Upload Section for Collection */}
        <h4>Upload collection</h4>
        <input
          type="file"
          accept=".jpg,.jpeg" // Only accept JPG/JPEG files
          multiple
          onChange={handleImageUpload}
          className="file-input"
        />

        {/* Preview Section for Collection */}
        <div className="collection-preview-container">          
          <div className="preview-container">
            {images.map((image, index) => {
              const result = comparisonResults.find(res => res.index === index);
              const matched = result ? result.matched : false;

              return (
                <div key={index} className="preview-image-container">
                  <img
                    src={image}
                    alt={`Uploaded Preview ${index + 1}`}
                    className={`preview-image ${matched ? 'matched' : ''}`}
                  />
                  {matched && <span className="image-match-label">Matched</span>}
                  <span className="image-index">{index + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="image-upload">
        {/* Upload Section for My Image */}
        <h4>Upload an image contains your face</h4>
        <input
          type="file"
          accept=".jpg,.jpeg" // Only accept JPG/JPEG files
          onChange={handleMyImageUpload}
          className="file-input"
        />

        {/* Preview Section for My Image */}
        <div className="my-image-preview-container">          
          {myImage && (
            <div className="preview-container">
              <img
                src={myImage}
                alt="My Image Preview"
                className="preview-image"
              />
            </div>
          )}
        </div>
      </div>

      <button
        className="btn btn-success mt-3 btn-lg"
        onClick={handleSuccessClick}
        disabled={loading}
      >
        {loading ? 'Processing...' : 'Find'}
      </button>      
      {error && <p className="text-danger mt-2">{error}</p>}

      {/* {comparisonResults.length > 0 && (
        <div className="comparison-result mt-3">
          <h4>Comparison Results</h4>
          {comparisonResults.map((result, index) => (
            <div key={index} className="comparison-item">
              <h5>Image {result.index + 1}:</h5>
              {result.error ? (
                <p className="text-danger">Error: {result.error}</p>
              ) : result.matched ? (
                <p>Faces matched with a similarity of {result.matches[0].Similarity}%</p>
              ) : (
                <p>No faces matched.</p>
              )}
            </div>
          ))}
        </div>
      )} */}
      {/* Display the total matched count */}
      {matchedCount > 0 && (
        <div>
          <h3>{matchedCount} images matched!</h3>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
