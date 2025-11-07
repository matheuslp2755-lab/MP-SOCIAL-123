import React from 'react';
import { auth } from '../../firebase';
import { PulseGroup } from '../Feed';
import { useLanguage } from '../../context/LanguageContext';

interface PulseTrayProps {
    pulseGroups: PulseGroup[];
    onOpenCreator: () => void;
    onOpenViewer: (startIndex: number) => void;
}

const PulseTray: React.FC<PulseTrayProps> = ({ pulseGroups, onOpenCreator, onOpenViewer }) => {
    const currentUser = auth.currentUser;
    const { t } = useLanguage();

    if (!currentUser) return null;

    const myPulseGroup = pulseGroups.find(g => g.userId === currentUser.uid);
    const otherPulseGroups = pulseGroups.filter(g => g.userId !== currentUser.uid);

    return (
        <div className="w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
            <div className="flex items-center space-x-4 overflow-x-auto pb-2 -mb-2">
                {/* Current User's Pulse */}
                <div className="flex-shrink-0 text-center">
                    <button onClick={myPulseGroup ? () => onOpenViewer(pulseGroups.findIndex(p => p.userId === currentUser.uid)) : onOpenCreator} className="relative block">
                        <div className={`w-16 h-16 rounded-full p-0.5 ${myPulseGroup?.hasUnviewed ? 'bg-gradient-to-tr from-yellow-400 to-fuchsia-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
                            <div className="bg-white dark:bg-black rounded-full p-0.5">
                                <img src={currentUser.photoURL || ''} alt="Your profile" className="w-full h-full object-cover rounded-full" />
                            </div>
                        </div>
                        {!myPulseGroup && (
                             <div className="absolute -bottom-1 -right-1 bg-sky-500 rounded-full text-white w-6 h-6 flex items-center justify-center border-2 border-white dark:border-black">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                </svg>
                            </div>
                        )}
                    </button>
                    <p className="text-xs mt-2 truncate w-16">{myPulseGroup ? t('pulse.yourPulse') : t('pulse.addPulse')}</p>
                </div>

                {/* Other Users' Pulses */}
                {otherPulseGroups.map((group) => {
                    const groupIndex = pulseGroups.findIndex(p => p.userId === group.userId);
                    return (
                    <div key={group.userId} className="flex-shrink-0 text-center">
                        <button onClick={() => onOpenViewer(groupIndex)}>
                            <div className={`w-16 h-16 rounded-full p-0.5 ${group.hasUnviewed ? 'bg-gradient-to-tr from-yellow-400 to-fuchsia-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
                               <div className="bg-white dark:bg-black rounded-full p-0.5">
                                    <img src={group.userAvatar} alt={group.username} className="w-full h-full object-cover rounded-full" />
                                </div>
                            </div>
                        </button>
                        <p className="text-xs mt-2 truncate w-16">{group.username}</p>
                    </div>
                )})}
            </div>
        </div>
    );
};

export default PulseTray;
