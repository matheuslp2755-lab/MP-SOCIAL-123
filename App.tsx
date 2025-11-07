import React, { useState, useEffect, StrictMode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, doc, updateDoc, serverTimestamp } from './firebase';
import Login from './components/Login';
import SignUp from './context/SignUp';
import Feed from './components/Feed';
import Footer from './components/common/Footer';
import { LanguageProvider } from './context/LanguageContext';

const AppContent: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authPage, setAuthPage] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, 'users', user.uid);

    const updateUserLastSeen = () => {
        updateDoc(userDocRef, {
            lastSeen: serverTimestamp()
        }).catch(err => console.error("Failed to update last seen:", err));
    };

    updateUserLastSeen();

    const intervalId = setInterval(updateUserLastSeen, 5 * 60 * 1000); // every 5 minutes

    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            updateUserLastSeen();
        }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', updateUserLastSeen);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', updateUserLastSeen);
    };
}, [user]);

  const switchAuthPage = (page: 'login' | 'signup') => {
    setAuthPage(page);
  };

  if (loading) {
    return (
      <div className="bg-zinc-50 dark:bg-black min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-zinc-50 dark:bg-black font-sans text-zinc-900 dark:text-zinc-100 min-h-screen flex flex-col">
        <main className="flex-grow flex items-center justify-center py-10 px-4">
          {authPage === 'login' ? (
            <Login onSwitchMode={() => switchAuthPage('signup')} />
          ) : (
            <SignUp onSwitchMode={() => switchAuthPage('login')} />
          )}
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="bg-zinc-50 dark:bg-black font-sans text-zinc-900 dark:text-zinc-100 min-h-screen">
      <Feed />
    </div>
  );
};

const App: React.FC = () => (
  <StrictMode>
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  </StrictMode>
);


export default App;