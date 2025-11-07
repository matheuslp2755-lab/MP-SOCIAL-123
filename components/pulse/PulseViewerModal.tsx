import React, { useState, useEffect, useRef } from 'react';
import { PulseGroup, Pulse } from '../Feed';
import { auth, db, doc, updateDoc, arrayUnion } from '../../firebase';

interface PulseViewerModalProps {
  isOpen: boolean;
  pulseGroups: PulseGroup[];
  startIndex: number;
  onClose: () => void;
}

const PulseViewerModal: React.FC<PulseViewerModalProps> = ({
  isOpen,
  pulseGroups,
  startIndex,
  onClose,
}) => {
  const [activeGroupIndex, setActiveGroupIndex] = useState(startIndex);
  const [activePulseInGroupIndex, setActivePulseInGroupIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  // FIX: Changed type from NodeJS.Timeout to number, which is correct for browser environments.
  const timerRef = useRef<number | null>(null);
  const viewedPulsesRef = useRef<Set<string>>(new Set());
  const currentUser = auth.currentUser;

  const activeGroup = pulseGroups[activeGroupIndex];
  const activePulse = activeGroup?.pulses[activePulseInGroupIndex];

  useEffect(() => {
    setActiveGroupIndex(startIndex);
    // Find first unviewed pulse in the starting group, or start at 0
    const firstUnviewed = pulseGroups[startIndex]?.pulses.findIndex(p => !p.viewers.includes(currentUser?.uid || '')) ?? 0;
    setActivePulseInGroupIndex(firstUnviewed >= 0 ? firstUnviewed : 0);
  }, [startIndex, pulseGroups, isOpen, currentUser]);

  const goToNext = () => {
    // Next pulse in same group
    if (activeGroup && activePulseInGroupIndex < activeGroup.pulses.length - 1) {
      setActivePulseInGroupIndex(prev => prev + 1);
    } 
    // Next group
    else if (activeGroupIndex < pulseGroups.length - 1) {
      const nextGroupIndex = activeGroupIndex + 1;
      setActiveGroupIndex(nextGroupIndex);
       const firstUnviewed = pulseGroups[nextGroupIndex]?.pulses.findIndex(p => !p.viewers.includes(currentUser?.uid || '')) ?? 0;
      setActivePulseInGroupIndex(firstUnviewed >= 0 ? firstUnviewed : 0);
    } 
    // Last pulse of last group
    else {
      onClose();
    }
  };

  const goToPrev = () => {
    // Prev pulse in same group
    if (activePulseInGroupIndex > 0) {
      setActivePulseInGroupIndex(prev => prev - 1);
    } 
    // Prev group
    else if (activeGroupIndex > 0) {
      const prevGroupIndex = activeGroupIndex - 1;
      setActiveGroupIndex(prevGroupIndex);
      // Go to the last pulse of the previous group
      setActivePulseInGroupIndex(pulseGroups[prevGroupIndex].pulses.length - 1);
    }
  };

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (isOpen && activePulse && !isPaused) {
      timerRef.current = setTimeout(goToNext, 5000);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [activePulse, isOpen, isPaused]);
  
  // Mark pulse as viewed
  useEffect(() => {
    if (activePulse && currentUser && !viewedPulsesRef.current.has(activePulse.id) && !activePulse.viewers.includes(currentUser.uid)) {
        viewedPulsesRef.current.add(activePulse.id);
        const pulseRef = doc(db, 'pulses', activePulse.id);
        updateDoc(pulseRef, {
            viewers: arrayUnion(currentUser.uid)
        }).catch(err => console.error("Failed to mark pulse as viewed:", err));
    }
  }, [activePulse, currentUser]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
        if (e.key === 'ArrowRight') goToNext();
        if (e.key === 'ArrowLeft') goToPrev();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeGroupIndex, activePulseInGroupIndex]);


  if (!isOpen || !activeGroup || !activePulse) return null;

  return (
    <div className="fixed inset-0 bg-black z-50 flex justify-center items-center">
      <div 
        className="relative w-full h-full max-w-md max-h-[95vh] aspect-[9/16] bg-zinc-900 rounded-lg overflow-hidden select-none"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        <div className="absolute top-2 left-2 right-2 flex items-center gap-1 z-20">
            {activeGroup.pulses.map((pulse, index) => (
                <div key={pulse.id} className="h-1 bg-white/30 rounded-full flex-1">
                    <div 
                        className="h-1 bg-white rounded-full"
                        style={{
                            width: `${index < activePulseInGroupIndex ? 100 : index === activePulseInGroupIndex ? 100 : 0}%`,
                            transition: index === activePulseInGroupIndex && !isPaused ? 'width 5s linear' : 'none'
                        }}
                    ></div>
                </div>
            ))}
        </div>

        <header className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <img src={activeGroup.userAvatar} alt={activeGroup.username} className="w-8 h-8 rounded-full"/>
                <span className="text-white font-semibold text-sm">{activeGroup.username}</span>
            </div>
            <button onClick={onClose} className="text-white text-2xl">&times;</button>
        </header>
        
        <img src={activePulse.mediaUrl} alt="Pulse" className="w-full h-full object-contain" />
        
        <div className="absolute inset-0 flex justify-between z-10">
            <div className="w-1/3 h-full" onClick={goToPrev}></div>
            <div className="w-1/3 h-full" onClick={goToNext}></div>
        </div>
      </div>
    </div>
  );
};

export default PulseViewerModal;
