import React, { useState, useEffect } from 'react';
import { updateProfile } from 'firebase/auth';
import {
    auth,
    db,
    storage,
    ref,
    uploadBytes,
    getDownloadURL,
    doc,
    getDoc,
    collection,
    getDocs,
    setDoc,
    deleteDoc,
    serverTimestamp,
    updateDoc,
    query,
    where,
    orderBy,
    addDoc,
    writeBatch,
    onSnapshot,
} from '../../firebase';
import Button from '../common/Button';
import EditProfileModal from './EditProfileModal';
import OnlineIndicator from '../common/OnlineIndicator';

const Spinner: React.FC = () => (
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-sky-500"></div>
);

const GridIcon: React.FC<{className?: string}> = ({ className }) => (
    <svg aria-label="Posts" className={className} fill="currentColor" height="24" viewBox="0 0 24 24" width="24"><rect fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" width="18" x="3" y="3"></rect><line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="9.015" x2="9.015" y1="3" y2="21"></line><line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="14.985" x2="14.985" y1="3" y2="21"></line><line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="21" x2="3" y1="9.015" y2="9.015"></line><line fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x1="21" x2="3" y1="14.985" y2="14.985"></line></svg>
);


interface UserProfileProps {
    userId: string;
    onStartMessage: (targetUser: { id: string, username: string, avatar: string }) => void;
}

type ProfileUserData = {
    username: string;
    avatar: string;
    bio?: string;
    isPrivate?: boolean;
    lastSeen?: { seconds: number; nanoseconds: number };
};

type Post = {
    id: string;
    imageUrl: string;
    caption: string;
};

const UserProfile: React.FC<UserProfileProps> = ({ userId, onStartMessage }) => {
    const [user, setUser] = useState<ProfileUserData | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
    const [isFollowing, setIsFollowing] = useState(false);
    const [followRequestSent, setFollowRequestSent] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const currentUser = auth.currentUser;

    useEffect(() => {
        setLoading(true);
        const userDocRef = doc(db, 'users', userId);

        const unsubscribe = onSnapshot(userDocRef, async (userDocSnap) => {
            if (!userDocSnap.exists()) {
                console.error("No such user!");
                setUser(null);
                setLoading(false);
                return;
            }

            const userData = userDocSnap.data() as ProfileUserData;
            setUser(userData);

            const followersQuery = collection(db, 'users', userId, 'followers');
            const followingQuery = collection(db, 'users', userId, 'following');
            const postsQuery = query(collection(db, 'posts'), where('userId', '==', userId), orderBy('timestamp', 'desc'));

            const [followersSnap, followingSnap, postsSnap] = await Promise.all([
                getDocs(followersQuery),
                getDocs(followingQuery),
                getDocs(postsQuery)
            ]);
            
            setStats({ posts: postsSnap.size, followers: followersSnap.size, following: followingSnap.size });

            let userIsFollowing = false;
            if (currentUser && currentUser.uid !== userId) {
                const followingDoc = await getDoc(doc(db, 'users', currentUser.uid, 'following', userId));
                userIsFollowing = followingDoc.exists();
                setIsFollowing(userIsFollowing);

                if (userData.isPrivate && !userIsFollowing) {
                    const requestDoc = await getDoc(doc(db, 'users', userId, 'followRequests', currentUser.uid));
                    setFollowRequestSent(requestDoc.exists());
                }
            }
            
            if (currentUser?.uid === userId || !userData.isPrivate || userIsFollowing) {
                const userPosts = postsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
                setPosts(userPosts);
            } else {
                setPosts([]);
            }

            setLoading(false);
        }, (error) => {
            console.error("Error fetching user data:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId, currentUser]);

    const handleFollowAction = async () => {
        if (!currentUser || !user) return;
        if(user.isPrivate) {
            handleSendFollowRequest();
        } else {
            handleFollowPublic();
        }
    };
    
    const handleSendFollowRequest = async () => {
        if (!currentUser || !user) return;
        setFollowRequestSent(true);

        const targetUserRequestRef = doc(db, 'users', userId, 'followRequests', currentUser.uid);
        const currentUserSentRequestRef = doc(db, 'users', currentUser.uid, 'sentFollowRequests', userId);
        const notificationRef = doc(collection(db, 'users', userId, 'notifications'));

        try {
            const batch = writeBatch(db);
            batch.set(targetUserRequestRef, {
                username: currentUser.displayName,
                avatar: currentUser.photoURL,
                timestamp: serverTimestamp()
            });
            batch.set(currentUserSentRequestRef, {
                username: user.username,
                avatar: user.avatar,
                timestamp: serverTimestamp()
            });
            batch.set(notificationRef, {
                type: 'follow_request',
                fromUserId: currentUser.uid,
                fromUsername: currentUser.displayName,
                fromUserAvatar: currentUser.photoURL,
                timestamp: serverTimestamp(),
                read: false,
            });
            await batch.commit();
        } catch (error) {
            console.error("Error sending follow request:", error);
            setFollowRequestSent(false); // Revert on failure
        }
    };

    const handleCancelFollowRequest = async () => {
        if (!currentUser) return;
        setFollowRequestSent(false);

        const targetUserRequestRef = doc(db, 'users', userId, 'followRequests', currentUser.uid);
        const currentUserSentRequestRef = doc(db, 'users', currentUser.uid, 'sentFollowRequests', userId);

        try {
            const batch = writeBatch(db);
            batch.delete(targetUserRequestRef);
            batch.delete(currentUserSentRequestRef);
            await batch.commit();
        } catch (error) {
            console.error("Error cancelling follow request:", error);
            setFollowRequestSent(true); // Revert on failure
        }
    };

    const handleFollowPublic = async () => {
        if (!currentUser || !user) return;
        setIsFollowing(true);
        setStats(prev => ({ ...prev, followers: prev.followers + 1 }));

        const currentUserFollowingRef = doc(db, 'users', currentUser.uid, 'following', userId);
        const targetUserFollowersRef = doc(db, 'users', userId, 'followers', currentUser.uid);
        const notificationRef = collection(db, 'users', userId, 'notifications');

        try {
            await setDoc(currentUserFollowingRef, {
                username: user.username,
                avatar: user.avatar,
                timestamp: serverTimestamp()
            });
            await setDoc(targetUserFollowersRef, {
                username: currentUser.displayName,
                avatar: currentUser.photoURL,
                timestamp: serverTimestamp()
            });
            await addDoc(notificationRef, {
                type: 'follow',
                fromUserId: currentUser.uid,
                fromUsername: currentUser.displayName,
                fromUserAvatar: currentUser.photoURL,
                timestamp: serverTimestamp(),
                read: false,
            });
        } catch (error) {
            console.error("Error following user:", error);
            setIsFollowing(false);
            setStats(prev => ({ ...prev, followers: prev.followers - 1 }));
        }
    };
    
    const handleUnfollow = async () => {
        if (!currentUser) return;
        setIsFollowing(false);
        setStats(prev => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));

        const currentUserFollowingRef = doc(db, 'users', currentUser.uid, 'following', userId);
        const targetUserFollowersRef = doc(db, 'users', userId, 'followers', currentUser.uid);
        
        try {
            await deleteDoc(currentUserFollowingRef);
            await deleteDoc(targetUserFollowersRef);
        } catch(error) {
            console.error("Error unfollowing user:", error);
            setIsFollowing(true);
            setStats(prev => ({ ...prev, followers: prev.followers + 1 }));
        }
    };
    
    const handleProfileUpdate = async ({ username, bio, avatarFile, isPrivate }: { username: string; bio: string; avatarFile: File | null; isPrivate: boolean }) => {
        if (!currentUser) return;
        setIsUpdating(true);
        
        try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const firestoreUpdates: { [key: string]: any } = {};
            const authUpdates: { displayName?: string; photoURL?: string } = {};
            let newAvatarUrl: string | undefined = undefined;

            if (avatarFile) {
                const storageRef = ref(storage, `avatars/${currentUser.uid}/${Date.now()}-${avatarFile.name}`);
                await uploadBytes(storageRef, avatarFile);
                newAvatarUrl = await getDownloadURL(storageRef);
                firestoreUpdates.avatar = newAvatarUrl;
                authUpdates.photoURL = newAvatarUrl;
            }

            if (username !== user?.username) {
                firestoreUpdates.username = username;
                firestoreUpdates.username_lowercase = username.toLowerCase();
                authUpdates.displayName = username;
            }
            if (bio !== (user?.bio || '')) {
                firestoreUpdates.bio = bio;
            }
            if (isPrivate !== (user?.isPrivate || false)) {
                firestoreUpdates.isPrivate = isPrivate;
            }

            if (Object.keys(firestoreUpdates).length > 0) {
                await updateDoc(userDocRef, firestoreUpdates);
            }

            if (Object.keys(authUpdates).length > 0) {
                await updateProfile(currentUser, authUpdates);
            }

            // Batch update denormalized avatar URLs in other documents
            if (newAvatarUrl) {
                try {
                    const currentUserUid = currentUser.uid;
            
                    // Update posts in batches
                    const postsQuery = query(collection(db, 'posts'), where('userId', '==', currentUserUid));
                    const postsSnapshot = await getDocs(postsQuery);
                    if (!postsSnapshot.empty) {
                        // Firestore batches are limited to 500 operations.
                        for (let i = 0; i < postsSnapshot.docs.length; i += 500) {
                            const batch = writeBatch(db);
                            const chunk = postsSnapshot.docs.slice(i, i + 500);
                            chunk.forEach(postDoc => {
                                batch.update(postDoc.ref, { userAvatar: newAvatarUrl });
                            });
                            await batch.commit();
                        }
                    }
            
                    // Update conversations in batches
                    const convosQuery = query(collection(db, 'conversations'), where('participants', 'array-contains', currentUserUid));
                    const convosSnapshot = await getDocs(convosQuery);
                    if (!convosSnapshot.empty) {
                        for (let i = 0; i < convosSnapshot.docs.length; i += 500) {
                            const batch = writeBatch(db);
                            const chunk = convosSnapshot.docs.slice(i, i + 500);
                            chunk.forEach(convoDoc => {
                                batch.update(convoDoc.ref, { [`participantInfo.${currentUserUid}.avatar`]: newAvatarUrl });
                            });
                            await batch.commit();
                        }
                    }
                    
                } catch (batchError) {
                    console.error("Failed to batch update avatars in posts and conversations:", batchError);
                    // This is a background task, so we don't show an error to the user.
                    // The main profile update has already succeeded.
                }
            }


            setUser(prev => {
                if (!prev) return null;
                return { ...prev, username, bio, isPrivate, avatar: newAvatarUrl || prev.avatar };
            });
            window.dispatchEvent(new CustomEvent('profileUpdated'));
            setIsEditModalOpen(false);
        } catch (error) {
            console.error("Error updating profile: ", error);
            throw error;
        } finally {
            setIsUpdating(false);
        }
    };

    const renderFollowButton = () => {
        if (currentUser?.uid === userId) {
            return <Button onClick={() => setIsEditModalOpen(true)} className="!w-auto !bg-zinc-200 dark:!bg-zinc-700 !text-black dark:!text-white hover:!bg-zinc-300 dark:hover:!bg-zinc-600">Edit Profile</Button>;
        }
        return (
            <div className="flex items-center gap-2">
                {isFollowing ? (
                    <Button onClick={handleUnfollow} className="!w-auto !bg-zinc-200 dark:!bg-zinc-700 !text-black dark:!text-white hover:!bg-zinc-300 dark:hover:!bg-zinc-600">Following</Button>
                ) : followRequestSent ? (
                    <Button onClick={handleCancelFollowRequest} className="!w-auto !bg-zinc-200 dark:!bg-zinc-700 !text-black dark:!text-white hover:!bg-zinc-300 dark:hover:!bg-zinc-600">Requested</Button>
                ) : (
                    <Button onClick={handleFollowAction} className="!w-auto">Follow</Button>
                )}
                 <Button onClick={() => onStartMessage({ id: userId, username: user!.username, avatar: user!.avatar })} className="!w-auto !bg-zinc-200 dark:!bg-zinc-700 !text-black dark:!text-white hover:!bg-zinc-300 dark:hover:!bg-zinc-600">Message</Button>
            </div>
        );
    };

    const renderContent = () => {
        if (user?.isPrivate && !isFollowing && currentUser?.uid !== userId) {
            return (
                <div className="flex flex-col justify-center items-center p-16 text-center border-t border-zinc-300 dark:border-zinc-700">
                    <h3 className="text-xl font-semibold">This Account is Private</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-2">Follow to see their photos and videos.</p>
                </div>
            );
        }

        return (
             <div className="border-t border-zinc-300 dark:border-zinc-700 pt-2">
                <div className="flex justify-center gap-8 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    <button className="flex items-center gap-2 text-sky-500 border-t-2 border-sky-500 pt-2 -mt-0.5">
                        <GridIcon className="w-4 h-4"/> POSTS
                    </button>
                </div>
                {posts.length > 0 ? (
                    <div className="grid grid-cols-3 gap-1 sm:gap-4 mt-4">
                        {posts.map(post => (
                            <div key={post.id} className="aspect-square bg-zinc-200 dark:bg-zinc-800 relative group">
                                <img src={post.imageUrl} alt={post.caption} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex justify-center items-center">
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                     <div className="flex flex-col justify-center items-center p-16">
                        <h3 className="text-2xl font-bold">No Posts Yet</h3>
                        <p className="text-zinc-500 dark:text-zinc-400 mt-2">When this user shares photos, you'll see them here.</p>
                    </div>
                )}
            </div>
        )
    }


    if (loading) {
        return <div className="flex justify-center items-center p-8"><Spinner /></div>;
    }
    
    if (!user) {
        return <p className="text-center p-8 text-zinc-500 dark:text-zinc-400">User not found.</p>;
    }

    const isOnline = user.lastSeen && (new Date().getTime() / 1000 - user.lastSeen.seconds) < 600; // 10 minutes

    return (
        <>
        <div className="container mx-auto max-w-4xl p-4 sm:p-8">
            <header className="flex flex-col sm:flex-row items-center gap-4 sm:gap-16 mb-8">
                <div className="w-36 h-36 sm:w-40 sm:h-40 flex-shrink-0 relative">
                    <img src={user.avatar} alt={user.username} className="w-full h-full rounded-full object-cover border-2 dark:border-zinc-800 p-1" />
                    {isOnline && <OnlineIndicator className="bottom-2 right-2" />}
                </div>
                <div className="flex flex-col gap-4 items-center sm:items-start w-full">
                    <div className="flex items-center gap-4">
                        <h2 className="text-2xl font-light">{user.username}</h2>
                        {renderFollowButton()}
                    </div>
                    <div className="flex items-center gap-8 text-sm">
                        <span><span className="font-semibold">{stats.posts}</span> posts</span>
                        <span><span className="font-semibold">{stats.followers}</span> followers</span>
                        <span><span className="font-semibold">{stats.following}</span> following</span>
                    </div>
                     {user.bio && (
                        <div className="text-sm pt-2 text-center sm:text-left">
                            <p className="whitespace-pre-wrap">{user.bio}</p>
                        </div>
                    )}
                </div>
            </header>
            {renderContent()}
        </div>
        {user && (
            <EditProfileModal 
                isOpen={isEditModalOpen} 
                onClose={() => setIsEditModalOpen(false)}
                user={user}
                onUpdate={handleProfileUpdate}
                isSubmitting={isUpdating}
            />
        )}
        </>
    );
};

export default UserProfile;