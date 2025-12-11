import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { MBTI, MBTI_COLORS, ChatSession, Message, Character } from './types';
import { orchestrateChat, generateImage, generateVideo, searchWeb, searchMaps, checkApiKey, requestApiKey } from './services/geminiService';
import NewChatModal from './components/NewChatModal';
import Avatar from './components/Avatar';

// Icon components
const SendIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>;
const PlusIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={4} d="M12 4v16m8-8H4" /></svg>;
const MenuIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={3} d="M4 6h16M4 12h16M4 18h16" /></svg>;
const ImageIcon = () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
const XIcon = () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>;

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [processingSessions, setProcessingSessions] = useState<Record<string, boolean>>({});
  const [showSidebar, setShowSidebar] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasKey, setHasKey] = useState(false);

  // Initialize API Key check
  useEffect(() => {
    checkApiKey().then(setHasKey);
  }, []);

  // Handle initial responsive sidebar state
  useEffect(() => {
    if (window.innerWidth < 768) {
      setShowSidebar(false);
    }
  }, []);

  const handleApiKeyRequest = async () => {
    await requestApiKey();
    const valid = await checkApiKey();
    setHasKey(valid);
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const isCurrentProcessing = currentSessionId ? !!processingSessions[currentSessionId] : false;

  const createSession = (name: string, selectedMBTI: MBTI[]) => {
    const characters: Character[] = selectedMBTI.map(mbti => ({
      id: uuidv4(),
      mbti,
      name: `${mbti}`,
      color: MBTI_COLORS[mbti]
    }));

    const newSession: ChatSession = {
      id: uuidv4(),
      name,
      characters,
      messages: [],
      lastActivity: Date.now()
    };

    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
    if (window.innerWidth < 768) setShowSidebar(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages, isCurrentProcessing]);

  const addMessage = (sessionId: string, message: Message) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return {
          ...s,
          messages: [...s.messages, message],
          lastActivity: Date.now()
        };
      }
      return s;
    }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async () => {
    if ((!inputText.trim() && !selectedImage) || !currentSessionId || !hasKey) return;
    
    const sessionId = currentSessionId;
    if (processingSessions[sessionId]) return;

    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const userMsg: Message = {
      id: uuidv4(),
      senderId: 'user',
      senderName: 'You',
      content: inputText,
      type: selectedImage ? 'image' : 'text',
      mediaUrl: selectedImage || undefined,
      timestamp: Date.now()
    };

    addMessage(sessionId, userMsg);
    setInputText('');
    setSelectedImage(null);
    setProcessingSessions(prev => ({ ...prev, [sessionId]: true }));

    try {
      // Logic loop: The user spoke, now the AI Director orchestrates the response(s)
      const updatedHistory = [...session.messages, userMsg];
      
      const directorResponse = await orchestrateChat(updatedHistory, session.characters, userMsg);

      for (const res of directorResponse.responses) {
        const character = session.characters.find(c => c.mbti === res.speakerMbti);
        if (!character) continue;

        let content = res.content;
        let type: Message['type'] = 'text';
        let mediaUrl: string | undefined;
        let metadata: any;

        // Handle Actions
        try {
          if (res.action === 'generate_image' && res.actionQuery) {
            content = res.content || `Here is a picture of ${res.actionQuery}`;
            mediaUrl = await generateImage(res.actionQuery);
            type = 'image';
          } else if (res.action === 'generate_video' && res.actionQuery) {
            content = res.content || `Check out this video of ${res.actionQuery}`;
            mediaUrl = await generateVideo(res.actionQuery);
            type = 'video';
          } else if (res.action === 'search' && res.actionQuery) {
            // Check if it looks like a map query
            if (res.actionQuery.toLowerCase().includes('near') || res.actionQuery.toLowerCase().includes('location')) {
                const searchRes = await searchMaps(res.actionQuery);
                content = `${res.content}\n\n${searchRes.text}`;
                metadata = { linkTitle: searchRes.links[0]?.title, linkUrl: searchRes.links[0]?.url };
                type = 'link';
            } else {
                const searchRes = await searchWeb(res.actionQuery);
                content = `${res.content}\n\n${searchRes.text}`;
                metadata = { linkTitle: searchRes.links[0]?.title, linkUrl: searchRes.links[0]?.url };
                type = 'link';
            }
          }
        } catch (e) {
          console.error(`Action ${res.action} failed`, e);
          content += "\n(I tried to generate something but ran into an error!)";
        }

        const botMsg: Message = {
          id: uuidv4(),
          senderId: character.id,
          senderName: character.name, // Only use the Character Name (MBTI)
          content,
          type,
          mediaUrl,
          timestamp: Date.now(),
          metadata
        };

        // Artificial delay for reading
        await new Promise(r => setTimeout(r, 1000 + (Math.random() * 1000)));
        addMessage(sessionId, botMsg);
      }

    } catch (error) {
      console.error("Chat orchestration failed", error);
    } finally {
      setProcessingSessions(prev => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!hasKey) {
      return (
          <div className="h-[100dvh] w-screen bg-pixel-bg flex items-center justify-center p-4 font-pixel">
              <div className="bg-white border-4 border-black shadow-retro p-8 max-w-md text-center">
                  <h1 className="text-4xl mb-4">ACCESS KEY REQUIRED</h1>
                  <p className="text-xl mb-6">To use Veo video generation and Pro models, please connect your Paid Google Cloud Project.</p>
                  <button 
                    onClick={handleApiKeyRequest}
                    className="bg-pixel-card px-6 py-3 border-4 border-black shadow-retro hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none font-bold text-xl"
                  >
                      SELECT API KEY
                  </button>
                  <div className="mt-4 text-sm">
                      <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline text-blue-600">Pricing Information</a>
                  </div>
              </div>
          </div>
      )
  }

  return (
    <div className="h-[100dvh] w-screen flex overflow-hidden font-pixel bg-pixel-dark text-black relative">
      {/* Mobile Sidebar Backdrop */}
      {showSidebar && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar - Chat List */}
      <div className={`
        fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-white border-r-4 border-black z-40 transform transition-transform duration-300
        ${showSidebar ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 md:z-0
      `}>
        <div className="p-4 border-b-4 border-black bg-pixel-blue h-16 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-wider">MBTI CHAT</h1>
          <button onClick={() => setIsModalOpen(true)} className="p-1 hover:bg-white border-2 border-black">
            <PlusIcon />
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100%-4rem)] p-2 space-y-2 bg-gray-100">
          {sessions.map(session => (
            <div 
              key={session.id}
              onClick={() => {
                setCurrentSessionId(session.id);
                if (window.innerWidth < 768) setShowSidebar(false);
              }}
              className={`
                p-3 border-4 cursor-pointer transition-all
                ${currentSessionId === session.id 
                  ? 'bg-pixel-card border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' 
                  : 'bg-white border-gray-400 hover:border-black'
                }
              `}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-lg truncate">{session.name}</span>
                <span className="text-xs text-gray-500">{new Date(session.lastActivity).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
              <div className="flex -space-x-2 overflow-hidden py-1">
                {session.characters.map((c, i) => (
                  <div key={c.id} className="relative z-0 hover:z-10">
                    <Avatar name={c.name} color={c.color} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="text-center p-8 text-gray-500">
              <p>NO ACTIVE CHATS</p>
              <p className="text-sm mt-2">Click + to start</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative bg-white w-full">
        {/* Mobile Header */}
        <div className="md:hidden h-16 border-b-4 border-black flex items-center px-4 bg-pixel-blue shrink-0">
            <button onClick={() => setShowSidebar(!showSidebar)} className="mr-4 p-1 active:bg-white/20 rounded">
                <MenuIcon />
            </button>
            <h2 className="text-xl font-bold truncate">{currentSession?.name || 'Pixel MBTI Chat'}</h2>
        </div>

        {currentSession ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50 relative">
               {/* Background Pattern */}
               <div className="absolute inset-0 opacity-5 pointer-events-none" 
                    style={{backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px'}}>
               </div>

              {currentSession.messages.map((msg) => {
                const isUser = msg.senderId === 'user';
                const char = currentSession.characters.find(c => c.id === msg.senderId);
                
                return (
                  <div key={msg.id} className={`flex ${isUser ? 'justify-end items-end' : 'justify-start items-end'} group`}>
                    {!isUser && (
                        <div className="mr-2 mb-1 flex-shrink-0">
                            <Avatar name={char?.name || '?'} color={char?.color || 'bg-gray-400'} size="md" />
                        </div>
                    )}
                    
                    <div className={`max-w-[75%] md:max-w-[70%]`}>
                        {!isUser && <div className="text-xs font-bold mb-1 ml-1 text-gray-600">{msg.senderName}</div>}
                        
                        <div className={`
                            relative p-3 md:p-4 border-4 border-black text-lg break-words
                            ${isUser 
                                ? 'bg-pixel-green shadow-[-4px_4px_0px_0px_rgba(0,0,0,1)]' 
                                : 'bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                            }
                        `}>
                            {msg.type === 'text' && <p>{msg.content}</p>}
                            
                            {msg.type === 'image' && msg.mediaUrl && (
                                <div className="space-y-2">
                                    {msg.content && <p className="mb-2">{msg.content}</p>}
                                    <img src={msg.mediaUrl} alt="User Upload" className="w-full h-auto border-2 border-black max-h-64 object-contain bg-gray-100" />
                                </div>
                            )}

                            {msg.type === 'video' && msg.mediaUrl && (
                                <div className="space-y-2">
                                    <p className="mb-2">{msg.content}</p>
                                    <video src={msg.mediaUrl} controls autoPlay muted loop className="w-full h-auto border-2 border-black" />
                                </div>
                            )}

                            {msg.type === 'link' && (
                                <div className="space-y-2">
                                    <p>{msg.content}</p>
                                    {msg.metadata?.linkUrl && (
                                        <a 
                                            href={msg.metadata.linkUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="block mt-2 p-2 bg-blue-100 border-2 border-blue-500 hover:bg-blue-200 truncate text-blue-800"
                                        >
                                            🔗 {msg.metadata.linkTitle || msg.metadata.linkUrl}
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {isUser && (
                        <div className="ml-2 mb-1 flex-shrink-0">
                            <Avatar 
                              name="You" 
                              color="bg-pixel-blue" 
                              size="md" 
                              src="https://api.dicebear.com/9.x/pixel-art/svg?seed=PixelUser" 
                            />
                        </div>
                    )}
                  </div>
                );
              })}
              {isCurrentProcessing && (
                <div className="flex justify-start items-end animate-pulse">
                    <div className="ml-14 p-3 bg-gray-200 border-4 border-black">
                        ...
                    </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 md:p-4 bg-gray-100 border-t-4 border-black shrink-0">
              {/* Image Preview */}
              {selectedImage && (
                <div className="mb-2 flex items-start">
                  <div className="relative inline-block border-2 border-black">
                    <img src={selectedImage} alt="Preview" className="h-16 md:h-20 w-auto" />
                    <button 
                      onClick={() => setSelectedImage(null)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white border-2 border-black w-6 h-6 flex items-center justify-center hover:bg-red-600"
                    >
                      <XIcon />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  accept="image/*" 
                  className="hidden" 
                  disabled={isCurrentProcessing}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isCurrentProcessing}
                  className="p-2 md:p-3 border-4 border-black bg-white hover:bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] md:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ImageIcon />
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="flex-1 p-2 md:p-3 text-base md:text-lg border-4 border-black focus:outline-none focus:bg-white bg-white font-pixel shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:bg-gray-200"
                  disabled={isCurrentProcessing}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={(!inputText.trim() && !selectedImage) || isCurrentProcessing}
                  className={`
                    p-2 md:p-3 border-4 border-black transition-all
                    ${((!inputText.trim() && !selectedImage) || isCurrentProcessing) 
                        ? 'bg-gray-300 opacity-50 cursor-not-allowed' 
                        : 'bg-pixel-green hover:bg-green-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] md:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none'
                    }
                  `}
                >
                  <SendIcon />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
            <div className="bg-white p-6 md:p-8 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-md w-full">
                <h2 className="text-3xl md:text-4xl mb-4 text-pixel-bg">WELCOME</h2>
                <p className="text-lg md:text-xl mb-6">Select a chat from the sidebar or create a new one to talk with MBTI personalities!</p>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="w-full md:w-auto px-6 py-3 bg-pixel-card text-xl border-4 border-black hover:bg-yellow-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all"
                >
                    CREATE NEW CHAT
                </button>
            </div>
          </div>
        )}
      </div>

      <NewChatModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onCreate={createSession} 
      />
    </div>
  );
};

export default App;