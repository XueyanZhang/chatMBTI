import React, { useState } from 'react';
import { MBTI, MBTI_COLORS, Character } from '../types';
import Avatar from './Avatar';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, selectedMBTI: MBTI[]) => void;
}

const NewChatModal: React.FC<NewChatModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [chatName, setChatName] = useState('');
  const [selected, setSelected] = useState<MBTI[]>([]);

  if (!isOpen) return null;

  const toggleMBTI = (type: MBTI) => {
    if (selected.includes(type)) {
      setSelected(selected.filter(t => t !== type));
    } else {
      if (selected.length < 5) {
        setSelected([...selected, type]);
      }
    }
  };

  const handleCreate = () => {
    if (chatName && selected.length > 0) {
      onCreate(chatName, selected);
      setChatName('');
      setSelected([]);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-2xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-2xl font-bold hover:text-red-600">X</button>
        
        <h2 className="text-3xl font-pixel mb-6 text-center text-black">CREATE CHAT ROOM</h2>
        
        <div className="mb-6">
          <label className="block text-xl mb-2 font-bold">ROOM NAME</label>
          <input 
            type="text" 
            value={chatName}
            onChange={e => setChatName(e.target.value)}
            className="w-full border-4 border-black p-3 text-xl font-pixel focus:outline-none focus:bg-yellow-100"
            placeholder="e.g. The Debaters"
          />
        </div>

        <div className="mb-6">
          <label className="block text-xl mb-2 font-bold">SELECT MEMBERS (MAX 5)</label>
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {Object.values(MBTI).map((mbti) => (
              <button
                key={mbti}
                onClick={() => toggleMBTI(mbti)}
                className={`
                  p-2 border-2 border-black text-center font-bold text-sm
                  transition-all duration-100
                  ${selected.includes(mbti) 
                    ? 'bg-pixel-green translate-x-[2px] translate-y-[2px] shadow-none' 
                    : `${MBTI_COLORS[mbti]} opacity-80 hover:opacity-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`
                  }
                `}
              >
                {mbti}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t-4 border-black">
          <button 
            onClick={handleCreate}
            disabled={!chatName || selected.length === 0}
            className={`
              px-8 py-3 text-xl font-bold border-4 border-black
              ${(!chatName || selected.length === 0) ? 'bg-gray-300 cursor-not-allowed' : 'bg-pixel-card hover:bg-yellow-300 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-x-[4px] active:translate-y-[4px]'}
            `}
          >
            START CHAT
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewChatModal;