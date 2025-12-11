import { GoogleGenAI, Type, Schema } from "@google/genai";
import { MBTI, Message, Character, AIActionResponse } from '../types';

// Helper to get client with current key
const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  return new GoogleGenAI({ apiKey });
};

export const checkApiKey = async (): Promise<boolean> => {
    // @ts-ignore - aistudio is injected by the environment
    if (window.aistudio && window.aistudio.hasSelectedApiKey) {
         // @ts-ignore
        return await window.aistudio.hasSelectedApiKey();
    }
    return !!process.env.API_KEY;
};

export const requestApiKey = async (): Promise<void> => {
    // @ts-ignore
    if (window.aistudio && window.aistudio.openSelectKey) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
    }
};

/**
 * The "Director" Agent: Decides who speaks and what actions they take.
 * Uses gemini-3-pro-preview with Thinking for complex orchestration.
 */
export const orchestrateChat = async (
  history: Message[],
  characters: Character[],
  lastUserMessage: Message
): Promise<AIActionResponse> => {
  const client = getClient();
  
  const characterDescriptions = characters.map(c => 
    `${c.mbti} (${c.name}): Strictly adheres to ${c.mbti} personality traits.`
  ).join('\n');

  // Filter out the last message from history string as we send it explicitly
  const previousHistory = history.slice(0, -1).slice(-10).map(m => 
    `${m.senderName}: ${m.content} [Type: ${m.type}]`
  ).join('\n');

  const maxResponses = Math.min(characters.length, 6);

  const systemInstruction = `
    You are the Director of a pixel-art MBTI chatroom with ${characters.length} characters.

    Characters:
    ${characterDescriptions}
    
    Current Context:
    The user just sent a message.
    
    Task:
    Decide how many should respond (1 to ${maxResponses}) based on the context:
    - In most cases, you can have 1, 2, or at most 4 characters respond in a sequence.
    - In rare cases, you can have upto ${maxResponses} characters respond in that very sequence.
    - The more characters in the room, the more can participate, but avoid spam.
    - Characters can reply to the user or to each other.
    - Consider MBTI - some types are more talkative (E) vs quiet (I).
    - Characters MUST stay in character (MBTI).
    - Balance natural group dynamics with readability.
    - If the user sent an image, characters should react to it visually/emotionally based on their MBTI.
    - Characters can perform actions: 
      - 'generate_image' (if asked to show something or feeling creative).
      - 'generate_video' (if asked to make a video/movie).
      - 'search' (if asked for facts/links).
    
    Return a JSON object containing an array of responses.
  `;

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      responses: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            speakerMbti: { type: Type.STRING, enum: characters.map(c => c.mbti) },
            content: { type: Type.STRING },
            action: { type: Type.STRING, enum: ['none', 'generate_image', 'generate_video', 'search'] },
            actionQuery: { type: Type.STRING }
          },
          required: ['speakerMbti', 'content']
        }
      }
    }
  };

  const parts: any[] = [
    { text: `Previous Conversation History:\n${previousHistory}\n\nUser Latest Message: ${lastUserMessage.content || "[Image/Media]"}` }
  ];

  // Add the image to the prompt if the user sent one
  if (lastUserMessage.type === 'image' && lastUserMessage.mediaUrl) {
    const base64Data = lastUserMessage.mediaUrl.split(',')[1];
    const mimeType = lastUserMessage.mediaUrl.split(';')[0].split(':')[1];
    if (base64Data && mimeType) {
        parts.push({
            inlineData: {
                mimeType,
                data: base64Data
            }
        });
    }
  }

  const response = await client.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts },
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: schema,
      thinkingConfig: { thinkingBudget: 2048 } // Use thinking for better roleplay logic
    }
  });

  if (!response.text) return { responses: [] };
  
  try {
    return JSON.parse(response.text) as AIActionResponse;
  } catch (e) {
    console.error("Failed to parse director response", e);
    return { responses: [] };
  }
};

/**
 * Image Generation (Nano Banana Pro)
 */
export const generateImage = async (prompt: string, aspectRatio: string = "1:1"): Promise<string> => {
  const client = getClient();
  // Using gemini-3-pro-image-preview for high quality pixel art generation if prompted, or general images
  const response = await client.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [{ text: prompt }]
    },
    config: {
      imageConfig: {
        aspectRatio: aspectRatio as any, 
        imageSize: '1K' 
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
};

/**
 * Video Generation (Veo)
 */
export const generateVideo = async (prompt: string): Promise<string> => {
  const client = getClient();
  // Veo fast generate
  let operation = await client.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await client.operations.getVideosOperation({ operation });
  }

  const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!videoUri) throw new Error("Video generation failed");

  // Fetch the actual bytes with the key
  const res = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
};

/**
 * Search Grounding
 */
export const searchWeb = async (query: string): Promise<{ text: string, links: {title: string, url: string}[] }> => {
  const client = getClient();
  const response = await client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Find information about: ${query}. Summarize it briefly for a chat message.`,
    config: {
      tools: [{ googleSearch: {} }]
    }
  });

  const text = response.text || "I couldn't find anything.";
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  
  const links = chunks
    .filter((c: any) => c.web)
    .map((c: any) => ({
      title: c.web.title,
      url: c.web.uri
    }));

  return { text, links };
};

/**
 * Maps Grounding
 */
export const searchMaps = async (query: string): Promise<{ text: string, links: {title: string, url: string}[] }> => {
    const client = getClient();
    
    // Attempt to get user location
    let location = { latitude: 37.7749, longitude: -122.4194 }; // Default SF
    try {
        const pos: GeolocationPosition = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        location = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch (e) {
        console.warn("Could not get location, using default");
    }

    const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: query,
        config: {
            tools: [{ googleMaps: {} }],
            toolConfig: {
                retrievalConfig: {
                    latLng: location
                }
            }
        }
    });

    const text = response.text || "No location found.";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    const links = chunks
        .filter((c: any) => c.maps)
        .map((c: any) => ({
             title: c.maps.title,
             url: c.maps.uri
        }));

    return { text, links };
}