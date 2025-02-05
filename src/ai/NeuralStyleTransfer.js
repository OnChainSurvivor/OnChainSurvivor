// NeuralStyleTransfer.js - Responsible for applying style transfer to rendered frames using TensorFlow.js

import * as tf from 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.6.0/dist/tf.min.js';
// Removed the <script> tags since TensorFlow.js is properly imported using ES module syntax at the top:
// import * as tf from '@tensorflow/tfjs';

// Placeholder: load your pre-trained neural style transfer model
let model = null;

export async function loadModel() {
  try {
    // Load a pre-trained GraphModel (or you can use a model from tfhub)
    model = await tf.loadGraphModel('path/to/model.json');
    console.log("Neural style transfer model loaded.");
  } catch (error) {
    console.error("Failed to load AI model for style transfer:", error);
  }
}

/**
 * Applies style transfer to the given image element or ImageData.
 * @param {HTMLCanvasElement|HTMLImageElement|ImageData} frame - The current frame.
 * @returns {Promise<ImageData>} - A promise resolving to processed image data.
 */
export async function applyStyleTransfer(frame) {
  if (!model) {
    console.warn("Model is not loaded. Bypassing style transfer.");
    return frame;
  }
  // Convert input frame to a tensor
  const inputTensor = tf.browser.fromPixels(frame).toFloat();
  
  // Preprocess the tensor (resize, normalize, etc.) as needed by your model
  const resizedTensor = tf.image.resizeBilinear(inputTensor, [256, 256]).div(255.0).expandDims(0);
  
  // Run inference
  const outputTensor = await model.executeAsync(resizedTensor);
  
  // Post-process: convert output tensor back to ImageData (this will vary depending on your model)
  const squeezed = outputTensor.squeeze();
  const clipped = squeezed.clipByValue(0, 1);
  const scaled = clipped.mul(255).toInt();
  const [height, width, channels] = scaled.shape;
  
  // Convert tensor to pixel data
  const pixelData = await tf.browser.toPixels(scaled);
  
  // Create a new ImageData object
  const processedFrame = new ImageData(new Uint8ClampedArray(pixelData), width, height);
  
  // Clean up the tensors
  tf.dispose([inputTensor, resizedTensor, outputTensor, squeezed, clipped, scaled]);
  
  return processedFrame;
} 