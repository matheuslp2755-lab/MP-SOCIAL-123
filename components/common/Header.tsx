import React, { useState, useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { auth, db, collection, query, where, getDocs, limit, doc, setDoc, deleteDoc, serverTimestamp, orderBy, onSnapshot, writeBatch, addDoc } from '../../firebase';

type UserSearchResult = {
    id: string;
    username: string;
    avatar: string;
};

type Notification = {
    id: string;
    type: 'follow';
    fromUserId: string;
    fromUsername: string;
    fromUserAvatar: string;
    timestamp: { seconds: number; nanoseconds: number };
    read: boolean;
};


interface HeaderProps {
    onSelectUser: (userId: string) => void;
    onGoHome: () => void;
    onOpenCreatePostModal: () => void;
    onOpenMessages: () => void;
}

const SearchIcon: React.FC<{className?: string}> = ({className = "h-4 w-4 text-zinc-400 dark:text-zinc-500"}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

const MessagesIcon: React.FC<{className?: string}> = ({className = "h-6 w-6"}) => (
    <svg aria-label="Direct" className={className} fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>Direct</title><line fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" x1="22" x2="9.218" y1="3" y2="10.083"></line><polygon fill="none" points="11.698 20.334 22 3.001 2 3.001 9.218 10.084 11.698 20.334" stroke="currentColor" strokeLinejoin="round" strokeWidth="2"></polygon></svg>
);


const HeartIcon: React.FC<{className?: string}> = ({className = "h-6 w-6"}) => (
    <svg aria-label="Notifications" className={className} fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><title>Notifications</title><path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.959-6.12 8.351C12.89 20.72 12.434 21 12 21s-.89-.28-1.38-.627C7.152 14.08 4.5 12.192 4.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175.98 1.763 1.12 1.763s.278-.588 1.118-1.763a4.21 4.21 0 0 1 3.675-1.941Z"></path></svg>
);

const ProfileIcon: React.FC<{className?: string}> = ({className = "h-5 w-5 mr-3"}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const PlusCircleIcon: React.FC<{className?: string}> = ({className = "h-6 w-6"}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);


const SpinnerIcon: React.FC = () => (
    <div className="flex justify-center items-center p-4">
        <svg className="animate-spin h-5 w-5 text-zinc-500 dark:text-zinc-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>
);


const Header: React.FC<HeaderProps> = ({ onSelectUser, onGoHome, onOpenCreatePostModal, onOpenMessages }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
    const [isActivityDropdownOpen, setIsActivityDropdownOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
    const [following, setFollowing] = useState<string[]>([]);
    const [isMobileSearchVisible, setIsMobileSearchVisible] = useState(false);
    const [forceUpdate, setForceUpdate] = useState(0); // Dummy state to force re-render on profile update
    const searchRef = useRef<HTMLDivElement>(null);
    const profileRef = useRef<HTMLDivElement>(null);
    const activityRef = useRef<HTMLDivElement>(null);
    const currentUser = auth.currentUser;

    // Force re-render on profile update to show new avatar
    useEffect(() => {
        const handleProfileUpdate = () => {
            setForceUpdate(c => c + 1);
        };
        window.addEventListener('profileUpdated', handleProfileUpdate);
        return () => window.removeEventListener('profileUpdated', handleProfileUpdate);
    }, []);

    // Listen for notifications
    useEffect(() => {
        if (!currentUser) return;

        const notificationsRef = collection(db, 'users', currentUser.uid, 'notifications');
        const q = query(notificationsRef, orderBy('timestamp', 'desc'), limit(20));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedNotifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
            setNotifications(fetchedNotifications);
            const hasUnread = fetchedNotifications.some(n => !n.read);
            setHasUnreadNotifications(hasUnread);
        }, (error) => {
            console.error("Error fetching notifications:", error);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const fetchFollowing = async () => {
        if (auth.currentUser) {
            const followingRef = collection(db, 'users', auth.currentUser.uid, 'following');
            const querySnapshot = await getDocs(followingRef);
            const followingIds = querySnapshot.docs.map(doc => doc.id);
            setFollowing(followingIds);
        }
    };
    
    useEffect(() => {
        fetchFollowing();
    }, []);

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setSearchResults([]);
            return;
        }

        const debouncedSearch = setTimeout(async () => {
            setIsSearching(true);
            const usersRef = collection(db, 'users');
            const q = query(
                usersRef,
                where('username_lowercase', '>=', searchQuery.toLowerCase()),
                where('username_lowercase', '<=', searchQuery.toLowerCase() + '\uf8ff'),
                limit(10)
            );
            
            try {
                const querySnapshot = await getDocs(q);
                const users = querySnapshot.docs
                    .map(doc => ({ id: doc.id, ...(doc.data() as Omit<UserSearchResult, 'id'>) }))
                    .filter(user => user.id !== auth.currentUser?.uid);
                
                setSearchResults(users);
            } catch (error) {
                console.error("Error searching users:", error);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(debouncedSearch);
    }, [searchQuery]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsSearchFocused(false);
            }
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setIsProfileDropdownOpen(false);
            }
            if (activityRef.current && !activityRef.current.contains(event.target as Node)) {
                setIsActivityDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [searchRef, profileRef, activityRef]);


    const handleLogout = () => {
        signOut(auth).catch(error => console.error("Error signing out: ", error));
    };
    
    const handleProfileLink = () => {
        if (currentUser) {
            onSelectUser(currentUser.uid);
            setIsProfileDropdownOpen(false);
        }
    }

    const handleFollow = async (targetUser: UserSearchResult) => {
        if (!auth.currentUser) return;
        setFollowing(prev => [...prev, targetUser.id]);
        
        const currentUserFollowingRef = doc(db, 'users', auth.currentUser.uid, 'following', targetUser.id);
        const targetUserFollowersRef = doc(db, 'users', targetUser.id, 'followers', auth.currentUser.uid);
        const notificationRef = collection(db, 'users', targetUser.id, 'notifications');

        try {
            await setDoc(currentUserFollowingRef, {
                username: targetUser.username,
                avatar: targetUser.avatar,
                timestamp: serverTimestamp()
            });
            await setDoc(targetUserFollowersRef, {
                username: auth.currentUser.displayName,
                avatar: auth.currentUser.photoURL,
                timestamp: serverTimestamp()
            });
            await addDoc(notificationRef, {
                type: 'follow',
                fromUserId: auth.currentUser.uid,
                fromUsername: auth.currentUser.displayName,
                fromUserAvatar: auth.currentUser.photoURL,
                timestamp: serverTimestamp(),
                read: false,
            });
        } catch (error) {
            console.error("Error following user:", error);
            setFollowing(prev => prev.filter(id => id !== targetUser.id)); // Revert optimistic update
        }
    };
    
    const handleUnfollow = async (targetUserId: string) => {
        if (!auth.currentUser) return;
        setFollowing(prev => prev.filter(id => id !== targetUserId));

        const currentUserFollowingRef = doc(db, 'users', auth.currentUser.uid, 'following', targetUserId);
        const targetUserFollowersRef = doc(db, 'users', targetUserId, 'followers', auth.currentUser.uid);
        
        try {
            await deleteDoc(currentUserFollowingRef);
            await deleteDoc(targetUserFollowersRef);
        } catch(error) {
            console.error("Error unfollowing user:", error);
            setFollowing(prev => [...prev, targetUserId]); // Revert optimistic update
        }
    };

    const handleUserClick = (user: UserSearchResult) => {
        onSelectUser(user.id);
        setSearchQuery('');
        setIsSearchFocused(false);
        setIsMobileSearchVisible(false);
    };

    const handleOpenActivity = async () => {
        setIsActivityDropdownOpen(prev => !prev);
        if (hasUnreadNotifications && currentUser) {
            setHasUnreadNotifications(false); // Optimistic update
            const notificationsRef = collection(db, 'users', currentUser.uid, 'notifications');
            const q = query(notificationsRef, where('read', '==', false));
            const snapshot = await getDocs(q);
            const batch = writeBatch(db);
            snapshot.docs.forEach(doc => {
                batch.update(doc.ref, { read: true });
            });
            await batch.commit();
        }
    };
    
    const searchResultContent = (
        <>
           {isSearching && <SpinnerIcon />}
           {!isSearching && searchQuery && searchResults.length === 0 && <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 p-4">No results found.</p>}
           {!isSearching && searchResults.map(user => (
               <button key={user.id} onClick={() => handleUserClick(user)} className="w-full text-left flex items-center p-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer">
                   <img src={user.avatar} alt={user.username} className="w-11 h-11 rounded-full object-cover" />
                   <div className="ml-3 flex-grow">
                       <p className="font-semibold text-sm">{user.username}</p>
                   </div>
                   {following.includes(user.id) ? (
                       <button onClick={(e) => { e.stopPropagation(); handleUnfollow(user.id); }} className="ml-auto text-sm font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 px-4 py-1 rounded-lg transition-colors">Following</button>
                   ) : (
                       <button onClick={(e) => { e.stopPropagation(); handleFollow(user); }} className="ml-auto text-sm font-semibold text-white bg-sky-500 hover:bg-sky-600 px-4 py-1 rounded-lg transition-colors">Follow</button>
                   )}
               </button>
           ))}
        </>
    );

    return (
        <header className="fixed top-0 left-0 right-0 bg-white dark:bg-black border-b border-zinc-300 dark:border-zinc-800 z-10">
            <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-4xl gap-4">
                
                <h1 onClick={onGoHome} className={`text-2xl font-serif cursor-pointer transition-all duration-300 ${isMobileSearchVisible ? 'hidden sm:block' : 'block'}`}>
                    MP SOCIAL
                </h1>

                <div 
                    className={`relative flex-grow sm:flex-grow-0 ${isMobileSearchVisible ? 'block' : 'hidden sm:block'}`}
                    ref={searchRef}
                >
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <SearchIcon />
                        </span>
                        <input
                            type="text"
                            placeholder="Search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onFocus={() => setIsSearchFocused(true)}
                            className={`bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md py-1.5 pl-10 pr-4 w-full sm:w-64 text-sm focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500 dark:text-zinc-100`}
                            autoFocus={isMobileSearchVisible}
                        />
                    </div>
                    {isSearchFocused && (
                        <div className={`absolute top-full mt-2 bg-white dark:bg-zinc-950 rounded-md shadow-lg border border-zinc-200 dark:border-zinc-800 z-20 max-h-80 overflow-y-auto w-full sm:w-80`}>
                           {searchResultContent}
                        </div>
                    )}
                </div>

                <nav className={`flex items-center gap-4 ${isMobileSearchVisible ? 'hidden sm:flex' : 'flex'}`}>
                    <button onClick={() => setIsMobileSearchVisible(true)} className="sm:hidden">
                        <SearchIcon className="h-6 w-6 text-zinc-800 dark:text-zinc-200" />
                    </button>
                    
                    <button onClick={onOpenCreatePostModal} className="relative">
                        <PlusCircleIcon className="w-6 h-6 text-zinc-800 dark:text-zinc-200 hover:text-zinc-500 dark:hover:text-zinc-400"/>
                    </button>

                    <button onClick={onOpenMessages} className="relative">
                        <MessagesIcon className="w-6 h-6 text-zinc-800 dark:text-zinc-200 hover:text-zinc-500 dark:hover:text-zinc-400"/>
                    </button>
                    
                    <div ref={activityRef} className="relative">
                        <button onClick={handleOpenActivity} className="relative">
                            <HeartIcon className="w-6 h-6 text-zinc-800 dark:text-zinc-200 hover:text-zinc-500 dark:hover:text-zinc-400"/>
                            {hasUnreadNotifications && (
                                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-black"></span>
                            )}
                        </button>
                        {isActivityDropdownOpen && (
                             <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-950 rounded-md shadow-lg border border-zinc-200 dark:border-zinc-800 z-20 max-h-96 overflow-y-auto">
                                {notifications.length > 0 ? (
                                    notifications.map(notification => (
                                        <div key={notification.id} className="flex items-center p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                                            <img src={notification.fromUserAvatar} alt={notification.fromUsername} className="w-11 h-11 rounded-full object-cover"/>
                                            <p className="ml-3 text-sm flex-grow">
                                                <span className="font-semibold">{notification.fromUsername}</span> started following you.
                                            </p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 p-4">No new activity.</p>
                                )}
                            </div>
                        )}
                    </div>

                    <div ref={profileRef} className="relative">
                        <button onClick={() => setIsProfileDropdownOpen(prev => !prev)} className="w-8 h-8 rounded-full focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-white dark:focus:ring-offset-black">
                             <img src={currentUser?.photoURL || `https://i.pravatar.cc/150?u=${currentUser?.uid}`} alt="Profile" className="w-full h-full rounded-full object-cover" />
                        </button>
                        {isProfileDropdownOpen && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-zinc-950 rounded-md shadow-lg border border-zinc-200 dark:border-zinc-800 z-20 py-1">
                                <button onClick={handleProfileLink} className="w-full flex items-center text-left px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900">
                                    <ProfileIcon /> Profile
                                </button>
                                <div className="border-t border-zinc-200 dark:border-zinc-800 my-1"></div>
                                <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900">
                                    Log Out
                                </button>
                            </div>
                        )}
                    </div>
                </nav>

                <div className={`${isMobileSearchVisible ? 'flex sm:hidden' : 'hidden'} items-center`}>
                    <button 
                        onClick={() => {
                            setIsMobileSearchVisible(false);
                            setSearchQuery('');
                            setIsSearchFocused(false);
                        }} 
                        className="text-sm font-semibold"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
