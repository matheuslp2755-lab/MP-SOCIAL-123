import React, { useState, useEffect } from 'react';
import ConversationList from './ConversationList';
import ChatWindow from './ChatWindow';
import { auth, db, doc, getDoc, setDoc, serverTimestamp, updateDoc } from '../../firebase';

interface MessagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTargetUser: { id: string, username: string, avatar: string } | null;
}

const MessagesModal: React.FC<MessagesModalProps> = ({ isOpen, onClose, initialTargetUser }) => {
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            setActiveConversationId(null);
            return;
        }

        const setupConversation = async () => {
            if (initialTargetUser && auth.currentUser) {
                const currentUserId = auth.currentUser.uid;
                const targetUserId = initialTargetUser.id;
                const conversationId = [currentUserId, targetUserId].sort().join('_');
                
                const conversationRef = doc(db, 'conversations', conversationId);
                
                try {
                    const conversationSnap = await getDoc(conversationRef);
                    if (!conversationSnap.exists()) {
                        await setDoc(conversationRef, {
                            participants: [currentUserId, targetUserId],
                            participantInfo: {
                                [currentUserId]: {
                                    username: auth.currentUser.displayName,
                                    avatar: auth.currentUser.photoURL,
                                },
                                [targetUserId]: {
                                    username: initialTargetUser.username,
                                    avatar: initialTargetUser.avatar,
                                }
                            },
                            updatedAt: serverTimestamp(),
                        });
                    } else {
                        // Update timestamp to bring it to the top of the list
                        await updateDoc(conversationRef, {
                            updatedAt: serverTimestamp()
                        });
                    }
                    setActiveConversationId(conversationId);
                } catch (error) {
                    console.error("Error ensuring conversation exists:", error);
                }
            } else {
                setActiveConversationId(null);
            }
        };

        setupConversation();
    }, [isOpen, initialTargetUser]);

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div 
                className="bg-white dark:bg-black rounded-lg shadow-xl w-full max-w-4xl h-[90vh] max-h-[700px] flex flex-col" 
                onClick={e => e.stopPropagation()}
            >
                {activeConversationId ? (
                    <ChatWindow 
                        conversationId={activeConversationId} 
                        onBack={() => setActiveConversationId(null)}
                    />
                ) : (
                    <>
                        <header className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
                            <div className="w-8"></div> {/* Spacer */}
                            <h2 className="text-lg font-semibold text-center">Messages</h2>
                            <button onClick={onClose} className="text-2xl font-light leading-none w-8 text-right" aria-label="Close messages">&times;</button>
                        </header>
                        <main className="flex-grow overflow-hidden">
                            <ConversationList onSelectConversation={setActiveConversationId} />
                        </main>
                    </>
                )}
            </div>
        </div>
    );
};

export default MessagesModal;
