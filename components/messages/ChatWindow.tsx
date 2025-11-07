import React, { useState, useEffect, useRef } from 'react';
import { 
    auth, 
    db, 
    doc, 
    collection, 
    query, 
    orderBy, 
    onSnapshot, 
    writeBatch, 
    serverTimestamp,
    deleteDoc,
    updateDoc,
    getDocs,
    limit,
    getDoc
} from '../../firebase';
import ConnectionCrystal from './ConnectionCrystal';
import OnlineIndicator from '../common/OnlineIndicator';

interface ChatWindowProps {
    conversationId: string | null;
    onBack: () => void;
}

interface Message {
    id: string;
    senderId: string;
    text: string;
    timestamp: any;
}

interface OtherUser {
    id: string;
    username: string;
    avatar: string;
}

type CrystalLevel = 'BRILHANTE' | 'EQUILIBRADO' | 'APAGADO' | 'RACHADO';

interface CrystalData {
    createdAt: any;
    lastInteractionAt: any;
    level: CrystalLevel;
    streak: number;
}

interface ConversationData {
    participants: string[];
    participantInfo: {
        [key: string]: {
            username: string;
            avatar: string;
            lastSeenMessageTimestamp?: any;
        }
    };
    crystal?: CrystalData;
}


// FIX: Corrected the `useRef` call inside the `usePrevious` hook. The generic type `T` was causing it to match an overload that requires an initial value. Changing it to `T | undefined` allows it to match the overload with no arguments.
function usePrevious<T>(value: T): T | undefined {
    // FIX: Changed useRef<T> to useRef<T | undefined> to fix the "Expected 1 arguments, but got 0" error.
    const ref = useRef<T | undefined>();
    useEffect(() => {
        ref.current = value;
    });
    return ref.current;
}


const TrashIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

const BackArrowIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
);

const ChatWindow: React.FC<ChatWindowProps> = ({ conversationId, onBack }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
    const [isOtherUserOnline, setIsOtherUserOnline] = useState(false);
    const [conversationData, setConversationData] = useState<ConversationData | null>(null);
    const [crystalData, setCrystalData] = useState<CrystalData | null>(null);
    const [loading, setLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ open: boolean, messageId: string | null }>({ open: false, messageId: null });
    
    type AnimationState = 'idle' | 'forming' | 'settling';
    const [animationState, setAnimationState] = useState<AnimationState>('idle');
    const [animationMessage, setAnimationMessage] = useState('');
    const [finalCrystalPos, setFinalCrystalPos] = useState({ top: 0, left: 0, width: 0, height: 0 });

    const currentUser = auth.currentUser;
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const crystalHeaderRef = useRef<HTMLDivElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const prevCrystalData = usePrevious(crystalData);
    const unsubUserStatusRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [messages]);
    
    useEffect(() => {
        if (!crystalData || !crystalHeaderRef.current || !dialogRef.current) return;

        const now = new Date();
        const createdAt = crystalData.createdAt.toDate();
        const justCreated = (now.getTime() - createdAt.getTime()) < 5000; // 5 seconds threshold

        const upgradedToBrilhante = crystalData.level === 'BRILHANTE' && prevCrystalData?.level && prevCrystalData.level !== 'BRILHANTE';

        if (justCreated || upgradedToBrilhante) {
            const rect = crystalHeaderRef.current.getBoundingClientRect();
            const modalRect = dialogRef.current.getBoundingClientRect();
           
            setFinalCrystalPos({
                top: rect.top - modalRect.top,
                left: rect.left - modalRect.left,
                width: rect.width,
                height: rect.height
            });

            setAnimationMessage(justCreated ? '💎 Um novo Cristal de Conexão foi formado!' : '💎 Sua conexão está brilhando!');
            setAnimationState('forming');

            const settlingTimer = setTimeout(() => {
                setAnimationState('settling');
            }, 4000); // Wait 4s before moving

            return () => {
                clearTimeout(settlingTimer);
            };
        }
    }, [crystalData, prevCrystalData]);

    useEffect(() => {
        if (!conversationId || !currentUser) {
            setMessages([]);
            setOtherUser(null);
            setCrystalData(null);
            setConversationData(null);
            return;
        }

        setLoading(true);

        const unsubConversation = onSnapshot(doc(db, 'conversations', conversationId), (docSnap) => {
            const data = docSnap.data() as ConversationData;
            if (data) {
                setConversationData(data);
                const otherUserId = data.participants.find((p: string) => p !== currentUser.uid);
                
                if(otherUserId) {
                    const otherUserInfo = data.participantInfo[otherUserId];
                    setOtherUser({
                        id: otherUserId,
                        username: otherUserInfo?.username || 'User',
                        avatar: otherUserInfo?.avatar || `https://i.pravatar.cc/150?u=${otherUserId}`,
                    });

                    if (!unsubUserStatusRef.current) {
                        const userDocRef = doc(db, 'users', otherUserId);
                        unsubUserStatusRef.current = onSnapshot(userDocRef, (userSnap) => {
                            if (userSnap.exists()) {
                                const lastSeen = userSnap.data().lastSeen;
                                const isOnline = lastSeen && (new Date().getTime() / 1000 - lastSeen.seconds) < 600;
                                setIsOtherUserOnline(isOnline);
                            } else {
                                setIsOtherUserOnline(false);
                            }
                        });
                    }
                }


                if (data.crystal) {
                    const lastInteractionDate = data.crystal.lastInteractionAt.toDate();
                    const now = new Date();
                    const diffHours = (now.getTime() - lastInteractionDate.getTime()) / (1000 * 60 * 60);

                    let calculatedLevel: CrystalLevel = data.crystal.level;
                    if (diffHours <= 24) {
                        calculatedLevel = 'BRILHANTE';
                    } else if (diffHours > 24 && diffHours <= 72) {
                        calculatedLevel = 'EQUILIBRADO';
                    } else if (diffHours > 72 && diffHours <= 168) {
                        calculatedLevel = 'APAGADO';
                    } else if (diffHours > 168) {
                        calculatedLevel = 'RACHADO';
                    }
                    
                    setCrystalData({ ...data.crystal, level: calculatedLevel });
                } else {
                    setCrystalData(null);
                }
            }
        });

        const messagesQuery = query(collection(db, 'conversations', conversationId, 'messages'), orderBy('timestamp', 'asc'));
        const unsubMessages = onSnapshot(messagesQuery, async (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
            setMessages(msgs);

            const lastOtherUserMessage = [...msgs].reverse().find(m => m.senderId !== currentUser.uid);
            
            if (lastOtherUserMessage) {
                const convRef = doc(db, 'conversations', conversationId);
                const convSnap = await getDoc(convRef);
                const convData = convSnap.data() as ConversationData;
                const currentUserInfo = convData?.participantInfo?.[currentUser.uid];

                if (!currentUserInfo?.lastSeenMessageTimestamp || 
                    lastOtherUserMessage.timestamp?.seconds > currentUserInfo.lastSeenMessageTimestamp.seconds) {
                    
                    await updateDoc(convRef, {
                        [`participantInfo.${currentUser.uid}.lastSeenMessageTimestamp`]: lastOtherUserMessage.timestamp
                    });
                }
            }
            
            setLoading(false);
        });

        return () => {
            unsubConversation();
            unsubMessages();
            if (unsubUserStatusRef.current) {
                unsubUserStatusRef.current();
                unsubUserStatusRef.current = null;
            }
        };
    }, [conversationId, currentUser]);

    const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (newMessage.trim() === '' || !currentUser || !conversationId || !otherUser) return;

        const tempMessage = newMessage;
        setNewMessage('');

        const conversationRef = doc(db, 'conversations', conversationId);
        const messagesRef = collection(conversationRef, 'messages');
        const recipientNotificationRef = doc(collection(db, 'users', otherUser.id, 'notifications'));

        try {
            const conversationSnap = await getDoc(conversationRef);
            const currentData = conversationSnap.data();
            
            let newStreak = 1;
            if (currentData?.crystal?.lastInteractionAt) {
                const lastInteractionDate = currentData.crystal.lastInteractionAt.toDate();
                
                const isYesterday = (d: Date) => {
                    const today = new Date();
                    const yesterday = new Date(today);
                    yesterday.setDate(today.getDate() - 1);
                    return d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate();
                };

                const isToday = (d: Date) => {
                    const today = new Date();
                    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
                };

                if (isYesterday(lastInteractionDate)) {
                    newStreak = (currentData.crystal.streak || 0) + 1;
                } else if (isToday(lastInteractionDate)) {
                    newStreak = currentData.crystal.streak || 1;
                }
            }

            const crystalUpdate = {
                crystal: {
                    createdAt: currentData?.crystal?.createdAt || serverTimestamp(),
                    lastInteractionAt: serverTimestamp(),
                    level: 'BRILHANTE',
                    streak: newStreak,
                }
            };
            
            const batch = writeBatch(db);
            
            const newMessageRef = doc(messagesRef);
            batch.set(newMessageRef, {
                senderId: currentUser.uid,
                text: tempMessage,
                timestamp: serverTimestamp(),
            });

            batch.update(conversationRef, {
                lastMessage: {
                    text: tempMessage,
                    senderId: currentUser.uid,
                    timestamp: serverTimestamp(),
                },
                updatedAt: serverTimestamp(),
                ...crystalUpdate,
            });

            batch.set(recipientNotificationRef, {
                type: 'message',
                fromUserId: currentUser.uid,
                fromUsername: currentUser.displayName,
                fromUserAvatar: currentUser.photoURL,
                conversationId: conversationId,
                timestamp: serverTimestamp(),
                read: false,
            });
            
            await batch.commit();

        } catch (error) {
            console.error("Error sending message:", error);
        }
    };
    
    const handleDeleteMessage = async () => {
        if (!showDeleteConfirm.messageId || !conversationId) return;
        
        const messageIdToDelete = showDeleteConfirm.messageId;
        setShowDeleteConfirm({ open: false, messageId: null });

        const messageRef = doc(db, 'conversations', conversationId, 'messages', messageIdToDelete);
        const conversationRef = doc(db, 'conversations', conversationId);

        try {
            await deleteDoc(messageRef);

            const messagesQuery = query(collection(db, 'conversations', conversationId, 'messages'), orderBy('timestamp', 'desc'), limit(1));
            const lastMessageSnap = await getDocs(messagesQuery);

            let lastMessageUpdate: any = {};
            if (lastMessageSnap.empty) {
                lastMessageUpdate = { lastMessage: null };
            } else {
                const lastMessage = lastMessageSnap.docs[0].data();
                lastMessageUpdate = {
                    lastMessage: {
                        text: lastMessage.text,
                        senderId: lastMessage.senderId,
                        timestamp: lastMessage.timestamp,
                    }
                };
            }
            await updateDoc(conversationRef, lastMessageUpdate);

        } catch (error) {
            console.error("Error deleting message:", error);
        }
    };

    const getCrystalStatusText = (level: CrystalLevel) => {
        const statuses = {
            BRILHANTE: 'Brilhante',
            EQUILIBRADO: 'Equilibrado',
            APAGADO: 'Apagado',
            RACHADO: 'Rachado',
        };
        return statuses[level] || '';
    }

    const lastSentMessageIndex = messages.map(m => m.senderId).lastIndexOf(currentUser?.uid);
    let shouldShowSeen = false;
    if (lastSentMessageIndex !== -1 && otherUser && conversationData) {
        const lastSentMessage = messages[lastSentMessageIndex];
        const otherUserInfo = conversationData.participantInfo[otherUser.id];
        if (otherUserInfo?.lastSeenMessageTimestamp && lastSentMessage.timestamp?.seconds <= otherUserInfo.lastSeenMessageTimestamp.seconds) {
            shouldShowSeen = true;
        }
    }


    if (loading) {
        return <div className="h-full flex items-center justify-center">Loading messages...</div>;
    }
    
    if (!conversationId) {
         return (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <svg aria-label="Direct" className="w-24 h-24 text-zinc-800 dark:text-zinc-200" fill="currentColor" height="96" role="img" viewBox="0 0 96 96" width="96"><path d="M48 0C21.534 0 0 21.534 0 48s21.534 48 48 48 48-21.534 48-48S74.466 0 48 0Zm0 91.5C24.087 91.5 4.5 71.913 4.5 48S24.087 4.5 48 4.5 91.5 24.087 91.5 48 71.913 91.5 48 91.5Zm16.5-54.498L33.91 56.41l-10.46-10.46a4.5 4.5 0 0 0-6.364 6.364l13.642 13.64a4.5 4.5 0 0 0 6.364 0L70.864 43.37a4.5 4.5 0 0 0-6.364-6.368Z"></path></svg>
                <h2 className="text-2xl mt-4">Your Messages</h2>
                <p className="text-zinc-500 dark:text-zinc-400 mt-2">Send private photos and messages to a friend.</p>
            </div>
        );
    }


    return (
        <div className="flex flex-col h-full relative" ref={dialogRef}>
            {otherUser && (
                <header className="flex items-center gap-3 p-4 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
                    <button onClick={onBack} aria-label="Back to conversations">
                       <BackArrowIcon className="w-6 h-6" />
                    </button>
                    <div className="relative">
                        <img src={otherUser.avatar} alt={otherUser.username} className="w-10 h-10 rounded-full object-cover" />
                        {isOtherUserOnline && <OnlineIndicator className="bottom-0 right-0 h-3 w-3" />}
                    </div>
                    <div className="flex-grow">
                        <p className="font-semibold">{otherUser.username}</p>
                        {crystalData && (
                            <div 
                                ref={crystalHeaderRef} 
                                className={`flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 transition-opacity duration-300 ${animationState !== 'idle' ? 'opacity-0' : 'opacity-100'}`} 
                                title={`Cristal de Conexão: ${getCrystalStatusText(crystalData.level)}`}
                            >
                                <ConnectionCrystal level={crystalData.level} className="w-4 h-4" />
                                <span>{getCrystalStatusText(crystalData.level)}</span>
                                {crystalData.streak > 1 && (
                                    <span title={`${crystalData.streak} dias de interação seguida`}>🔥 {crystalData.streak}</span>
                                )}
                            </div>
                        )}
                    </div>
                </header>
            )}
            <div className="flex-grow p-4 overflow-y-auto">
                <div className="flex flex-col gap-1">
                    {messages.map(msg => (
                         <div key={msg.id} className={`flex group ${msg.senderId === currentUser?.uid ? 'justify-end' : 'justify-start'}`}>
                            <div className={`flex items-center gap-2 ${msg.senderId === currentUser?.uid ? 'flex-row-reverse' : ''}`}>
                                <div className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl ${
                                    msg.senderId === currentUser?.uid 
                                    ? 'bg-sky-500 text-white rounded-br-none' 
                                    : 'bg-zinc-200 dark:bg-zinc-800 rounded-bl-none'
                                }`}>
                                    <p className="text-sm">{msg.text}</p>
                                </div>
                                {msg.senderId === currentUser?.uid && (
                                    <button 
                                        onClick={() => setShowDeleteConfirm({ open: true, messageId: msg.id })}
                                        className="p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        aria-label="Delete message"
                                    >
                                        <TrashIcon className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {shouldShowSeen && (
                         <div className="flex justify-end pr-2">
                             <p className="text-xs text-zinc-500 dark:text-zinc-400">Visto</p>
                         </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>
            </div>
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex-shrink-0">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                     <input 
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Message..."
                        className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full py-2 pl-4 pr-4 text-sm focus:outline-none focus:border-sky-500"
                    />
                    <button type="submit" disabled={!newMessage.trim()} className="text-sky-500 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed px-2">
                        Send
                    </button>
                </form>
            </div>
            {showDeleteConfirm.open && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60]"
                    onClick={() => setShowDeleteConfirm({ open: false, messageId: null })}
                >
                    <div className="bg-white dark:bg-black rounded-lg shadow-xl p-6 w-full max-w-sm text-center"
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-semibold mb-2">Delete Message?</h3>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                            Are you sure you want to delete this message? This cannot be undone.
                        </p>
                        <div className="flex justify-center gap-4">
                            <button 
                                onClick={() => setShowDeleteConfirm({ open: false, messageId: null })}
                                className="px-4 py-2 rounded-lg bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 font-semibold"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleDeleteMessage}
                                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-semibold"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {animationState !== 'idle' && (
                <div className="absolute inset-0 bg-black bg-opacity-30 z-10 flex flex-col justify-center items-center pointer-events-none">
                    <div
                        onTransitionEnd={() => {
                            if (animationState === 'settling') {
                                setAnimationState('idle');
                            }
                        }}
                        className="absolute transition-all duration-1000 ease-in-out"
                        style={
                            animationState === 'forming'
                            ? {
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: '96px', // w-24
                                height: '96px', // h-24
                            }
                            : { // 'settling'
                                top: `${finalCrystalPos.top}px`,
                                left: `${finalCrystalPos.left}px`,
                                width: `${finalCrystalPos.width}px`,
                                height: `${finalCrystalPos.height}px`,
                                transform: 'translate(0, 0)',
                            }
                        }
                    >
                        <ConnectionCrystal level="BRILHANTE" className="w-full h-full" />
                    </div>
                    <p
                        className="text-white text-lg font-semibold mt-40 transition-opacity duration-500"
                        style={{
                            opacity: animationState === 'forming' ? 1 : 0,
                            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                        }}
                    >
                        {animationMessage}
                    </p>
                </div>
            )}
        </div>
    );
};

export default ChatWindow;