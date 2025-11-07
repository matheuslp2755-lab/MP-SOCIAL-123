import React, { useState, useEffect } from 'react';
import { auth, db, collection, query, where, onSnapshot, orderBy, doc, formatTimestamp } from '../../firebase';
import OnlineIndicator from '../common/OnlineIndicator';

interface Conversation {
    id: string;
    otherUser: {
        id: string;
        username: string;
        avatar: string;
    };
    lastMessage?: {
        text: string;
        timestamp: any;
    };
    isOnline?: boolean;
}

interface ConversationListProps {
    onSelectConversation: (id: string) => void;
}

const ConversationList: React.FC<ConversationListProps> = ({ onSelectConversation }) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [userStatuses, setUserStatuses] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const currentUser = auth.currentUser;

    useEffect(() => {
        if (!currentUser) return;
        setLoading(true);

        const q = query(
            collection(db, 'conversations'), 
            where('participants', 'array-contains', currentUser.uid),
            orderBy('updatedAt', 'desc')
        );

        let userUnsubs: (() => void)[] = [];

        const unsubConvos = onSnapshot(q, (snapshot) => {
            userUnsubs.forEach(unsub => unsub());
            userUnsubs = [];

            const convos = snapshot.docs.map(doc => {
                const data = doc.data();
                const participants = data.participants;
                if (!Array.isArray(participants)) {
                    return null;
                }
                // FIX: Cast participants to string[] to ensure `otherUserId` is inferred as `string | undefined`.
                // This resolves the type error when using it as a computed property name downstream.
                const otherUserId = (participants as string[]).find(p => p !== currentUser.uid);

                if (!otherUserId) {
                    return null;
                }

                const otherUserInfo = data.participantInfo[otherUserId];

                return {
                    id: doc.id,
                    otherUser: {
                        id: otherUserId,
                        username: otherUserInfo?.username || 'User',
                        avatar: otherUserInfo?.avatar || `https://i.pravatar.cc/150?u=${otherUserId}`,
                    },
                    lastMessage: data.lastMessage,
                };
            }).filter((c): c is Exclude<typeof c, null> => c !== null);

            const uniqueUserIds = [...new Set(convos.map(c => c.otherUser.id))];
            
            uniqueUserIds.forEach(userId => {
                const userDocRef = doc(db, 'users', userId);
                const unsub = onSnapshot(userDocRef, (userSnap) => {
                    if (userSnap.exists()) {
                        const lastSeen = userSnap.data().lastSeen;
                        const isOnline = lastSeen && (new Date().getTime() / 1000 - lastSeen.seconds) < 600;
                        setUserStatuses(prev => ({ ...prev, [userId]: isOnline }));
                    }
                });
                userUnsubs.push(unsub);
            });

            setConversations(convos);
            setLoading(false);
        });

        return () => {
            unsubConvos();
            userUnsubs.forEach(unsub => unsub());
        };
    }, [currentUser]);

    const conversationsWithStatus = conversations.map(convo => ({
        ...convo,
        isOnline: userStatuses[convo.otherUser.id] || false,
    }));

    if (loading) {
        return <div className="p-4 text-center text-sm text-zinc-500">Loading conversations...</div>;
    }

    return (
        <div className="h-full overflow-y-auto">
            {conversations.length === 0 ? (
                <p className="p-4 text-center text-sm text-zinc-500 dark:text-zinc-400">No conversations yet.</p>
            ) : (
                <ul>
                    {conversationsWithStatus.map(convo => (
                        <li key={convo.id}>
                            <button
                                onClick={() => onSelectConversation(convo.id)}
                                className="w-full text-left flex items-center p-3 gap-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                            >
                                <div className="relative flex-shrink-0">
                                    <img src={convo.otherUser.avatar} alt={convo.otherUser.username} className="w-14 h-14 rounded-full object-cover" />
                                    {convo.isOnline && <OnlineIndicator className="bottom-0 right-0" />}
                                </div>
                                <div className="flex-grow overflow-hidden">
                                    <div className="flex justify-between items-center">
                                        <p className="font-semibold truncate">{convo.otherUser.username}</p>
                                        {convo.lastMessage?.timestamp && (
                                            <p className="text-xs text-zinc-400 flex-shrink-0 ml-2">
                                                {formatTimestamp(convo.lastMessage.timestamp).replace(' ago', '').replace(' ', '')}
                                            </p>
                                        )}
                                    </div>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
                                        {convo.lastMessage?.text || '...'}
                                    </p>
                                </div>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default ConversationList;
