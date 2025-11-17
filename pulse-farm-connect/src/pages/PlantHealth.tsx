import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Leaf, Sparkles, Loader, AlertTriangle, Image as ImageIcon } from "lucide-react";

const PlantHealth = () => {
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(",")[1]); 
      reader.onerror = (error) => reject(error);
    });

  // Handle image selection
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit for example
        setError("File is too large. Please upload an image under 2MB.");
        return;
      }
      setImageFile(file);
      setImageUrl(URL.createObjectURL(file));
      setAnalysis("");
      setError("");
    }
  };

  // Handle drag and drop
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      if (file.size > 2 * 1024 * 1024) {
        setError("File is too large. Please upload an image under 2MB.");
        return;
      }
      setImageFile(file);
      setImageUrl(URL.createObjectURL(file));
      setAnalysis("");
      setError("");
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Function to call Gemini API with exponential backoff
  const analyzeImage = async () => {
    if (!imageFile) {
      setError("Please upload an image first.");
      return;
    }

    setLoading(true);
    setAnalysis("");
    setError("");

    try {
      const base64ImageData = await toBase64(imageFile);
      const apiKey = "AIzaSyD8eTdMWYJKC7t06GtwIwteD9sz-fOAVxM"; 
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

      const systemPrompt = "You are a botanist and plant pathologist. Analyze the provided image of a plant leaf. Identify the plant species if possible, diagnose any visible diseases or nutrient deficiencies, and provide a concise, actionable care recommendation. **Format everything as short bullet points under markdown headings.**";
      const userPrompt = "Analyze this plant leaf. Keep the analysis brief and to the point.";

      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              { text: userPrompt },
              {
                inlineData: {
                  mimeType: imageFile.type,
                  data: base64ImageData,
                },
              },
            ],
          },
        ],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
      };

      let response;
      let delay = 1000; 
      for (let i = 0; i < 5; i++) { 
        try {
          response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            const result = await response.json();
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              setAnalysis(text);
              setLoading(false);
              return; // Success
            } else {
              throw new Error("Invalid response structure from API.");
            }
          } else if (response.status === 429) { // Throttling
            // Wait and retry
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
          } else {
            const err = await response.json();
            throw new Error(err.error?.message || "An error occurred during analysis.");
          }
        } catch (fetchError) {
          if (i === 4) {
            // Last retry failed
            throw fetchError;
          }
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
        }
      }
      throw new Error("API request failed after multiple retries.");

    } catch (err) {
      setError(err.message || "Failed to analyze image. Please try again.");
      setLoading(false);
    }
  };

  // Simple markdown-to-HTML converter
  const formatAnalysis = (text) => {
    if (!text) return "";
    return text
      .replace(/\n/g, '<br />') // Basic newline conversion
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
      .replace(/##(.*?)(<br \/>)/g, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>') // H2
      .replace(/#(.*?)(<br \/>)/g, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>') // H1
      .replace(/^- (.*?)(<br \/>)/gm, '<li class="ml-5 list-disc">$1</li>') // List items
      .replace(/^[*-] (.*?)(<br \/>)/gm, '<li class="ml-5 list-disc">$1</li>') // List items (fallback)
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-green-700">
              Plant Health Detection
            </h1>
            <p className="text-gray-500 mt-1">
              Upload an image to identify plant diseases and get treatment advice.
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 rounded-md bg-red-100 border border-red-300 text-red-800 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
            <button
              onClick={() => setError("")}
              className="ml-auto text-red-800 hover:text-red-900"
            >
              &times;
            </button>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Upload and Preview */}
          <Card className="shadow-soft hover:shadow-strong transition-shadow bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Upload className="h-5 w-5" />
                Upload Plant Image
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label
                htmlFor="plant-upload"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Plant preview"
                    className="h-full w-full object-contain rounded-lg p-2"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center text-gray-500">
                    <ImageIcon className="h-12 w-12 mb-3" />
                    <p className="font-medium">Drag & drop an image here</p>
                    <p className="text-sm">or click to browse</p>
                    <p className="text-xs mt-2">(Max 2MB)</p>
                  </div>
                )}
                <input
                  id="plant-upload"
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </label>

              <Button
                onClick={analyzeImage}
                disabled={!imageFile || loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {loading ? (
                  <Loader className="h-5 w-5 animate-spin" />
                ) : (
                  <Sparkles className="h-5 w-5 mr-2" />
                )}
                <span>{loading ? "Analyzing..." : "Analyze Plant Health"}</span>
              </Button>
            </CardContent>
          </Card>

          {/* Analysis Result */}
          <Card className="shadow-soft bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Leaf className="h-5 w-5" />
                AI Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading && (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <Loader className="h-10 w-10 animate-spin text-green-600" />
                  <p className="mt-3">Analyzing image, please wait...</p>
                </div>
              )}
              {!loading && !analysis && (
                <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                  <p className="text-center">
                    Analysis results will appear here once you upload an image and click "Analyze".
                  </p>
                </div>
              )}
              {analysis && (
                <div
                  className="prose prose-sm max-w-none text-gray-700"
                  dangerouslySetInnerHTML={{ __html: formatAnalysis(analysis) }}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PlantHealth;